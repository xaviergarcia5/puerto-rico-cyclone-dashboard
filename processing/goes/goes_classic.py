"""GOES Level 2 colour composition matching the first Earth Engine script."""
from pathlib import Path
import numpy as np
import xarray as xr
from pyproj import Proj
from PIL import Image

RECIPE = 'script1-mcmipf-v1'
PRODUCT = 'ABI-L2-MCMIPF'
CHANNELS = ('01', '02', '03', '07', '13')
VARIABLES = [f'{prefix}_C{band}' for band in CHANNELS for prefix in ('CMI', 'DQF')]

def render_classic(source, destination, bbox, width, height, daylight):
    """Use official CMI values and the original colour recipe, without Rayleigh.

    Projection locates each output pixel on the satellite grid. Nearest-neighbour
    sampling does not change the source values. Missing measurements raise an
    error instead of being silently turned into black cloud pixels.
    """
    west, south, east, north = bbox
    lon, lat = np.meshgrid(west+(np.arange(width)+.5)*(east-west)/width,
                           north-(np.arange(height)+.5)*(north-south)/height)
    with xr.open_dataset(source, engine='h5netcdf') as ds:
        p = ds.goes_imager_projection.attrs
        h = float(p['perspective_point_height'])
        proj = Proj(proj='geos', h=h, lon_0=float(p['longitude_of_projection_origin']),
                    sweep=p.get('sweep_angle_axis','x'), a=float(p['semi_major_axis']), b=float(p['semi_minor_axis']))
        xx, yy = proj(lon, lat)
        xs, ys = ds.x.values, ds.y.values
        ix = np.rint((xx/h-xs[0])/(xs[1]-xs[0])).astype(int)
        iy = np.rint((yy/h-ys[0])/(ys[1]-ys[0])).astype(int)
        if np.any((ix<0)|(ix>=len(xs))|(iy<0)|(iy>=len(ys))):
            raise ValueError('The subset does not cover every output pixel')
        bands = {c:np.asarray(ds[f'CMI_C{c}'].values[iy,ix], dtype=np.float32) for c in CHANNELS}
        quality = {}
        for c in CHANNELS:
            q=ds[f'DQF_C{c}'].values[iy,ix]
            values,counts=np.unique(q,return_counts=True)
            quality[c]={str(v):int(n) for v,n in zip(values,counts)}
        start = ds.attrs.get('time_coverage_start')
    needed = {'01':daylight>0,'02':daylight>0,'03':daylight>0,'07':daylight<1,'13':daylight<1}
    missing = {c:int(np.count_nonzero(~np.isfinite(bands[c]) & needed[c])) for c in CHANNELS}
    if any(missing.values()):
        raise ValueError(f'Datos NOAA ausentes en canales utilizados {missing}')
    # Set unused day/night branches to zero so NaN * 0 cannot affect valid pixels.
    for c in CHANNELS: bands[c]=np.where(needed[c],bands[c],0)
    blue, red, veggie = (bands[c] for c in ('01','02','03'))
    green = .45*red+.10*veggie+.45*blue
    day = np.clip(np.stack((red,green,blue),axis=-1)/.72,0,1)**(1/1.3)
    cold = np.clip((302-bands['13'])/112,0,1)**.86
    core = cold**3
    low = np.clip((bands['13']-bands['07']+2.5)/7.5,0,1)*(1-cold)
    night = np.clip(np.stack((.78*cold+.20*core+.04*low,
                              .86*cold+.14*core+.13*low,
                              .98*cold+.08*core+.23*low),axis=-1),0,1)
    rgb = day*daylight[...,None]+night*(1-daylight[...,None])
    if not np.isfinite(rgb).all(): raise ValueError('The composite contains invalid values')
    dest=Path(destination);dest.parent.mkdir(parents=True,exist_ok=True)
    tmp=dest.with_suffix('.png.tmp')
    Image.fromarray(np.floor(np.clip(rgb,0,1)*255+.5).astype('uint8')).save(tmp,format='PNG',optimize=True)
    tmp.replace(dest)
    return {'recipe':RECIPE,'product':PRODUCT,'timeCoverageStart':start,'missingUsedPixels':missing,'qualityFlags':quality}
