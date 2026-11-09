"""NHC HURDAT2 parsing and temporal sampling for the GOES player (UTC)."""
from __future__ import annotations
from bisect import bisect_left
from datetime import datetime, timezone
from pathlib import Path
import json, math

STORM_IDS={'irma':'AL112017','maria':'AL152017','fiona':'AL072022','ernesto':'AL052024'}
NHC_URL='https://www.nhc.noaa.gov/data/hurdat/hurdat2-1851-2025-091226.txt'
STATUS_LABELS={'TD':'Tropical depression','TS':'Tropical storm','HU':'Hurricane','EX':'Extratropical cyclone','SS':'Subtropical storm','SD':'Subtropical depression','LO':'Low pressure','DB':'Disturbance','WV':'Tropical wave'}

def utc(value):
    dt=datetime.fromisoformat(value.replace('Z','+00:00')) if isinstance(value,str) else value
    if dt.tzinfo is None: raise ValueError('The timestamp must include a time zone')
    return dt.astimezone(timezone.utc)

def hurricane_category(status,wind):
    if status!='HU' or wind is None or not math.isfinite(wind) or wind<64:return None
    return 1+sum(wind>=threshold for threshold in (83,96,113,137))

def coordinate(text):
    sign=-1 if text[-1] in 'SW' else 1
    if text[-1] not in 'NSEW':raise ValueError('Invalid HURDAT2 coordinate')
    return sign*float(text[:-1])

def read_track(path,storm_id):
    lines=Path(path).read_text(encoding='utf-8-sig').splitlines()
    header=[v.strip() for v in lines[0].split(',')]
    if header[0]!=storm_id:raise ValueError(f'Incorrect storm identifier: {path}')
    records=[]
    for line in lines[1:]:
        if not line.strip():continue
        fields=[v.strip() for v in line.split(',')]
        moment=datetime.strptime(fields[0]+fields[1],'%Y%m%d%H%M').replace(tzinfo=timezone.utc)
        wind=int(fields[6]);pressure=int(fields[7]);status=fields[3]
        records.append({'utc':moment.isoformat().replace('+00:00','Z'),'lat':coordinate(fields[4]),'lon':coordinate(fields[5]),'status':status,'windKt':None if wind<0 else wind,'pressureHpa':None if pressure<0 else pressure,'recordType':fields[2],'category':hurricane_category(status,wind)})
    if len(records)!=int(header[2]):raise ValueError(f'Incomplete record count: {path}')
    if any(utc(a['utc'])>=utc(b['utc']) for a,b in zip(records,records[1:])):raise ValueError('Unsorted or duplicate records')
    return records

def sample_track(records,moment,bbox):
    moment=utc(moment)
    times=[utc(row['utc']) for row in records]
    index=bisect_left(times,moment)
    if index<len(times) and times[index]==moment:
        record=records[index];lat=record['lat'];lon=record['lon'];interpolated=False
    elif index==0 or index==len(times):return None
    else:
        gap=(times[index]-times[index-1]).total_seconds()
        if gap>9*3600:return None
        record=records[index-1];next_record=records[index]
        fraction=(moment-times[index-1]).total_seconds()/gap
        lat=record['lat']+(next_record['lat']-record['lat'])*fraction
        lon=record['lon']+(next_record['lon']-record['lon'])*fraction
        interpolated=True
    category=record['category'];label=STATUS_LABELS.get(record['status'],record['status'])
    if category is not None:label+=f' · Category {category}'
    w,s,e,n=bbox
    return {'lat':lat,'lon':lon,'interpolated':interpolated,'officialUtc':record['utc'],'status':record['status'],'category':category,'label':label,'windKt':record['windKt'],'pressureHpa':record['pressureHpa'],'outside':not(w<=lon<=e and s<=lat<=n)}

def enrich_events(events,source_dir,bbox):
    for slug,event in events.items():
        if slug not in STORM_IDS:continue
        records=read_track(Path(source_dir)/(STORM_IDS[slug]+'_excerpt.txt'),STORM_IDS[slug])
        event.update(nhcId=STORM_IDS[slug],track=records,trackSource=NHC_URL)
        for frame in event.get('frames',[]):frame['trackState']=sample_track(records,frame['utc'],bbox)
    return events

def read_events(path):
    path=Path(path)
    if not path.exists():return {}
    value=path.read_text(encoding='utf-8-sig').strip()
    prefix='window.HURRICANE_DATA = '
    if not value.startswith(prefix):raise ValueError('Unexpected events.js format')
    return json.loads(value[len(prefix):].rstrip(';'))['events']

def merge_event(previous,current):
    result={**previous,**current}
    frames={frame['utc']:frame for frame in previous.get('frames',[])}
    frames.update({frame['utc']:frame for frame in current.get('frames',[])})
    result['frames']=sorted(frames.values(),key=lambda frame:utc(frame['utc']))
    if result['frames']:
        result['startUtc']=result['frames'][0]['utc'];result['endUtc']=result['frames'][-1]['utc']
    return result
