"""Download a lossless geographic subset of official ABI files using HTTP ranges."""
from pathlib import Path
import json, time, h5py
from concurrent.futures import ThreadPoolExecutor
import numpy as np
import xarray as xr
from fsspec.spec import AbstractBufferedFile
import boto3
from botocore import UNSIGNED
from botocore.config import Config

class S3RangeFile(AbstractBufferedFile):
    def __init__(self,key,size):
        self.client=boto3.client("s3",region_name="us-east-1",config=Config(signature_version=UNSIGNED,retries={"max_attempts":5,"mode":"standard"},max_pool_connections=16))
        super().__init__(None,key,mode="rb",size=size,block_size=262144,cache_type="blockcache",cache_options={"maxblocks":512})
    def prefetch_for_region(self,slices,names=None):
        blocks=set()
        with h5py.File(self,'r') as handle:
            for name in (names or ('Rad','DQF')):
                if name not in handle:continue
                dataset=handle[name]
                if not dataset.chunks:continue
                cy,cx=dataset.chunks;ys=slices['y'];xs=slices['x']
                for y in range(ys.start//cy*cy,ys.stop,cy):
                    for x in range(xs.start//cx*cx,xs.stop,cx):
                        info=dataset.id.get_chunk_info_by_coord((y,x))
                        if info.byte_offset is not None and info.size:
                            blocks.update(range(info.byte_offset//self.blocksize,(info.byte_offset+info.size-1)//self.blocksize+1))
        with ThreadPoolExecutor(max_workers=12) as pool:
            list(pool.map(self.cache._fetch_block_cached,sorted(blocks)))
    def _fetch_range(self,start,end):
        end=min(end,self.size)
        if start>=end:return b""
        response=self.client.get_object(Bucket="noaa-goes16",Key=self.path,Range=f"bytes={start}-{end-1}")
        with response["Body"] as body: data=body.read()
        if len(data)!=end-start:raise OSError("Incomplete NOAA range response")
        return data

from pyproj import Proj

def subset_slices(ds,bbox):
    p=ds['goes_imager_projection'].attrs
    h=float(p['perspective_point_height'])
    proj=Proj(proj='geos',h=h,lon_0=float(p['longitude_of_projection_origin']),sweep=p.get('sweep_angle_axis','x'),a=float(p['semi_major_axis']),b=float(p['semi_minor_axis']))
    w,s,e,n=bbox
    lons=np.r_[np.linspace(w,e,100),np.linspace(w,e,100),np.full(100,w),np.full(100,e)]
    lats=np.r_[np.full(100,s),np.full(100,n),np.linspace(s,n,100),np.linspace(s,n,100)]
    xx,yy=proj(lons,lats)
    out={}
    for name,positions in [('x',xx),('y',yy)]:
        var=ds[name];values=var.values.astype(float)*var.attrs.get('scale_factor',1)+var.attrs.get('add_offset',0)
        low=(np.min(positions)-60000)/h;high=(np.max(positions)+60000)/h
        selected=np.flatnonzero((values>=low)&(values<=high))
        if not len(selected): raise ValueError('Region outside satellite disk')
        out[name]=slice(max(0,int(selected[0])-2),min(len(values),int(selected[-1])+3))
    return out

def write_subset(source,destination,bbox,variables=None):
    destination=Path(destination)
    destination.parent.mkdir(parents=True,exist_ok=True)
    with xr.open_dataset(source,engine='h5netcdf',decode_cf=False,mask_and_scale=False) as ds:
        slices=subset_slices(ds,bbox)
        if hasattr(source,'prefetch_for_region'):source.prefetch_for_region(slices,variables)
        selected=ds[variables + ['goes_imager_projection']] if variables else ds
        cropped=selected.isel(**slices).load()
        cropped.attrs['project_processing']='Lossless spatial subset; original measurements, coordinates and calibration retained. Full-disk summary variables retain source values.'
        for var in cropped.variables.values(): var.encoding={}
        tmp=destination.with_suffix('.nc.part')
        cropped.to_netcdf(tmp,engine='h5netcdf',encoding={name:{'zlib':True,'complevel':1} for name in cropped.data_vars if cropped[name].ndim==2})
        tmp.replace(destination)
        return {name:[sl.start,sl.stop] for name,sl in slices.items()}

def download_subset(key,destination,bbox,size=None,variables=None):
    destination=Path(destination);meta=destination.with_suffix('.source.json')
    if destination.exists() and meta.exists():
        info=json.loads(meta.read_text())
        if info.get('key')==key and info.get('bbox')==list(bbox) and info.get('sourceBytes')==size and info.get('variables')==variables:return info
    url='https://noaa-goes16.s3.amazonaws.com/'+key
    t=time.monotonic()
    with S3RangeFile(key,size) as source:
        slices=write_subset(source,destination,bbox,variables)
        stats={'hits':source.cache.hit_count,'misses':source.cache.miss_count,'requestedBytes':source.cache.total_requested_bytes}
    meta.write_text(json.dumps({'url':url,'key':key,'sourceBytes':size,'variables':variables,'bbox':list(bbox),'slices':slices,'seconds':round(time.monotonic()-t,2),**stats},indent=2),encoding='utf-8')
    return json.loads(meta.read_text())
