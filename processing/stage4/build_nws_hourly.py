"""Decode native Puerto Rico NWS/NCEP Stage IV hourly grids, preserving missing data."""
from pathlib import Path
import io,gzip,tarfile,json,hashlib,re
from datetime import datetime,timedelta,timezone
import numpy as np
import argparse

parser = argparse.ArgumentParser(description='Decode and accumulate Puerto Rico Stage IV hourly precipitation grids.')
parser.add_argument("dashboard", type=Path, help="Directory containing the published dashboard files.")
parser.add_argument("sources", type=Path, help="Directory containing the original source files.")
parser.add_argument("output", type=Path, help="Directory for generated files.")
args = parser.parse_args()
DASHBOARD = args.dashboard.resolve()
RAW = args.sources.resolve()
ROOT = args.output.resolve()
if ROOT == DASHBOARD or DASHBOARD in ROOT.parents:
    parser.error("Choose an output directory outside the dashboard directory.")
OUT = ROOT / 'hourly_grib'
OUT.mkdir(parents=True, exist_ok=True)
import eccodes as ec
from shapely.geometry import shape,Point
from shapely.ops import unary_union
events=json.loads((DASHBOARD/'events.js').read_text(encoding='utf-8').split('=',1)[1].strip().rstrip(';'))['events']
geo=json.loads((DASHBOARD/'municipalities.js').read_text(encoding='utf-8').split('=',1)[1].strip().rstrip(';'))
land=unary_union([shape(f['geometry']) for f in geo['features']])
parse=lambda s:datetime.fromisoformat(s.replace('Z','+00:00'))
iso=lambda t:t.isoformat().replace('+00:00','Z')
windows={s:(parse(e['startUtc']).replace(second=0,microsecond=0),parse(e['endUtc']).replace(second=0,microsecond=0)) for s,e in events.items()}
manifest=[];decoded={};all_names=[]

def walk(a,chain):
    for m in a:
        if not m.isfile():continue
        name=m.name;all_names.append('/'.join(chain+[name]))
        if '_pr.' in name.lower() and '.01h.' in name and name.endswith(('.gz','.grb2','.grb')):
            match=re.search(r'\.(\d{10})\.01h',name)
            if not match:continue
            when=datetime.strptime(match.group(1),'%Y%m%d%H').replace(tzinfo=timezone.utc)
            if not any(lo<when<=hi for lo,hi in windows.values()):continue
            content=a.extractfile(m).read();p=OUT/Path(name).name
            if p.exists():assert p.read_bytes()==content
            else:p.write_bytes(content)
            manifest.append({'file':p.name,'bytes':len(content),'sha256':hashlib.sha256(content).hexdigest(),'memberChain':chain+[name],'endUTC':iso(when)})
            body=gzip.decompress(content) if name.endswith('.gz') else content
            gid=ec.codes_new_from_message(body)
            keys=['edition','gridType','Nx','Ny','DxInMetres','DyInMetres','dataDate','dataTime','validityDate','validityTime','startStep','endStep','stepType','units','name','numberOfMissing','missingValue']
            meta={k:ec.codes_get(gid,k) for k in keys if ec.codes_is_defined(gid,k)}
            assert meta['stepType']=='accum' and meta['endStep']-meta['startStep']==1,meta
            assert meta['units'] in ['kg m**-2','kg m-2','mm'],meta
            vt=datetime.strptime(f"{meta['validityDate']}{meta['validityTime']:04d}",'%Y%m%d%H%M').replace(tzinfo=timezone.utc)
            assert vt==when,(vt,when)
            v=ec.codes_get_values(gid);lats=ec.codes_get_array(gid,'latitudes');lons=(ec.codes_get_array(gid,'longitudes')+180)%360-180
            missing=meta['missingValue'];v[(v==missing)|~np.isfinite(v)|(v<0)]=np.nan
            decoded[when]=(v,lats,lons,meta);ec.codes_release(gid)
        elif ('stage4.' in name.lower() or Path(name).name.startswith('ST4.') or name.endswith('.tar')) and not name.endswith(('.gz','.gif','.grb2')):
            content=a.extractfile(m).read()
            try:
                with tarfile.open(fileobj=io.BytesIO(content)) as nested:walk(nested,chain+[name])
            except tarfile.ReadError:pass

for month in ['201709','202209','202408']:
    archive=RAW/f'katz_{month}.tar'
    if not archive.is_file():
        raise FileNotFoundError(archive)
    with tarfile.open(archive) as a:walk(a,[archive.name])
    print(month,'decoded cumulative',len(decoded),flush=True)

payload={'events':{},'source':'NWS/NCEP Stage IV Puerto Rico, NSF NCAR d507005','nominalResolution':'approximately 4 km','intervalMinutes':60}
audit={}
for slug,event in events.items():
    lo,hi=windows[slug];times=[lo+timedelta(minutes=30*i) for i in range(len(event['frames']))]
    required=[lo+timedelta(hours=i) for i in range(1,int((hi-lo).total_seconds()/3600)+1)]
    absent=[iso(t) for t in required if t not in decoded]
    if absent:
        audit[slug]={'usable':False,'reason':'Missing hourly files','missingHours':absent};continue
    first=decoded[required[0]];_,lats,lons,meta=first
    nx0=int(meta['Nx']);ny0=int(meta['Ny']);assert nx0*ny0==len(lats)
    la=lats.reshape(ny0,nx0);ln=lons.reshape(ny0,nx0)
    inside=(ln>=-67.5)&(ln<=-65.12)&(la>=17.8)&(la<=18.66)
    ys,xs=np.nonzero(inside);y0=max(0,ys.min()-2);y1=min(ny0,ys.max()+3);x0=max(0,xs.min()-2);x1=min(nx0,xs.max()+3)
    la=la[y0:y1,x0:x1];ln=ln[y0:y1,x0:x1];ny,nx=la.shape
    landmask=np.array([land.contains(Point(lon,lat)) for lon,lat in zip(ln.flat,la.flat)]).reshape(ny,nx)
    cum=np.zeros((ny,nx));complete=np.ones((ny,nx),dtype=bool);frames=[];cuts=[];coverages=[];hour=0;latest=lo;hourmeta=[]
    for now in times:
        while hour<len(required) and required[hour]<=now:
            t=required[hour];v,ls,lns,md=decoded[t]
            assert np.allclose(ls,lats) and np.allclose(lns,lons),slug
            v=v.reshape(ny0,nx0)[y0:y1,x0:x1]
            finite=np.isfinite(v);complete &= finite;cum+=np.where(finite,v/25.4,0)
            coverage=float(finite[landmask].mean());coverages.append(coverage)
            hourmeta.append({'endUTC':iso(t),'landCoverage':round(coverage,5),'maxMm':float(np.nanmax(v)),'metadata':md})
            hour+=1;latest=t
        flat=np.where(complete,np.round(cum,3),np.nan).ravel()
        frames.append([float(v) if np.isfinite(v) else None for v in flat]);cuts.append(iso(latest))
    finalcoverage=float(complete[landmask].mean())
    # Export only events that pass both coverage checks.
    usable=min(coverages)>=.95 and finalcoverage>=.90
    surface=np.where(complete&landmask,cum,np.nan);peak=np.unravel_index(np.nanargmax(surface),surface.shape)
    audit[slug]={'usable':usable,'hourlyFiles':len(required),'minHourlyLandCoverage':min(coverages),'finalCompleteLandCoverage':finalcoverage,'landCells':int(landmask.sum()),'nativeSubset':[nx,ny],'maxFinalIn':float(np.nanmax(np.where(complete,cum,np.nan))),'maxLandIn':float(surface[peak]),'maxLandCoordinates':[float(ln[peak]),float(la[peak])],'extremeHourlyIntervalsOver100mm':[h['endUTC'] for h in hourmeta if h['maxMm']>100],'hours':hourmeta}
    if usable:
        payload['events'][slug]={'startUTC':iso(lo),'endsUTC':[iso(t) for t in times],'mapCutoffUTC':cuts,'accumulatedIn':frames,
          'sourceShort':'NWS/NCEP Stage IV · ≈4 km · hourly accumulations','sourceKind':'NWS',
          'grid':{'nx':nx,'ny':ny,'latitude':[round(float(v),6) for v in la.flat],'longitude':[round(float(v),6) for v in ln.flat]},'nativeMetadata':meta}
    print(slug,{k:v for k,v in audit[slug].items() if k!='hours'},flush=True)

(ROOT/'nws_data.js').write_text('window.NWS_RAIN_DATA = '+json.dumps(payload,ensure_ascii=False,separators=(',',':'),allow_nan=False)+';\n',encoding='utf-8')
(ROOT/'nws_hourly_QA.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2),encoding='utf-8')
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
(ROOT/'ncar_all_member_inventory.json').write_text(json.dumps(all_names,indent=2),encoding='utf-8')
