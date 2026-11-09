"""Build all returned USGS rain gauges, retaining gaps and original interval readings.
No spatial interpolation, future readings, or conversion of missing observations to zero.
"""
from pathlib import Path
from datetime import datetime,timedelta
from collections import Counter
import json,math
import argparse

parser = argparse.ArgumentParser(description='Accumulate precipitation observations and preserve missing intervals.')
parser.add_argument("dashboard", type=Path, help="Directory containing the published dashboard files.")
parser.add_argument("sources", type=Path, help="Directory containing the original source files.")
parser.add_argument("output", type=Path, help="Directory for generated files.")
args = parser.parse_args()
DASHBOARD = args.dashboard.resolve()
RAW = args.sources.resolve()
ROOT = args.output.resolve()
if ROOT == DASHBOARD or DASHBOARD in ROOT.parents:
    parser.error("Choose an output directory outside the dashboard directory.")
ROOT.mkdir(parents=True, exist_ok=True)
events=json.loads((DASHBOARD/'events.js').read_text(encoding='utf-8').split('=',1)[1].strip().rstrip(';'))['events']
parse=lambda s:datetime.fromisoformat(s.replace('Z','+00:00'))
iso=lambda t:t.isoformat().replace('+00:00','Z') if t else None
payload={'agency':'USGS','parameter':'00045','unit':'in','events':{}}
audit={}
for slug,e in events.items():
 start=parse(e['startUtc']).replace(second=0,microsecond=0)
 end=parse(e['endUtc']).replace(second=0,microsecond=0)
 times=[start+timedelta(minutes=30*i) for i in range(len(e['frames']))]
 raw=json.loads((RAW/f'usgs_pr_{slug}.json').read_text(encoding='utf-8'))
 stations=[]; rows=0
 for ts in raw['value']['timeSeries']:
  info=ts['sourceInfo']; geog=info['geoLocation']['geogLocation']; sid=info['siteCode'][0]['value']
  assert ts['variable']['unit']['unitCode']=='in'
  assert ts['variable']['variableCode'][0]['value']=='00045'
  if not(-67.5<=geog['longitude']<=-65.1 and 17.85<=geog['latitude']<=18.65):continue
  obs={};conflicts=[];invalid=0
  for group in ts['values']:
   for r in group['value']:
    t=parse(r['dateTime']);v=float(r['value'])
    if not math.isfinite(v) or v<0:invalid+=1;continue
    if t in obs and obs[t][0]!=v:conflicts.append(iso(t));continue
    obs[t]=(v,r.get('qualifiers',[]))
  for t in conflicts:obs.pop(parse(t),None)
  ordered=sorted(obs.items())
  intervals=[round((b[0]-a[0]).total_seconds()) for a,b in zip(ordered,ordered[1:])]
  cadence=Counter(d for d in intervals if 30<=d<=3600).most_common(1)
  step=cadence[0][0] if cadence else None
  measured=[(t,v,q) for t,(v,q) in ordered if start<t<=end]
  rows+=len(measured)
  gaps=[]
  if step:
   prev=start
   for t,v,q in measured:
    gapstart=prev+timedelta(seconds=step)
    # A missed expected observation leaves an uncovered interval. No filling.
    if t>gapstart+timedelta(seconds=max(1,step*.1)):
     gaps.append({'fromUTC':iso(gapstart),'toUTC':iso(t),'resumed':True})
    prev=t
   if end>prev+timedelta(seconds=step*1.1):
    gaps.append({'fromUTC':iso(prev+timedelta(seconds=step)),'toUTC':iso(end),'resumed':False})
  else:
   gaps=[{'fromUTC':iso(start),'toUTC':iso(end),'resumed':False}]
  framevals=[]; states=[]; lasttimes=[]; partial=[]; quality=[]; gapsince=[]
  total=0.;cursor=0;last=None;approved=True;any_read=False
  for now in times:
   while cursor<len(measured) and measured[cursor][0]<=now:
    t,v,q=measured[cursor];total+=v;last=t;any_read=True;approved=approved and 'A' in q;cursor+=1
   pastgaps=[g for g in gaps if parse(g['fromUTC'])<=now]
   incomplete=bool(pastgaps) or (step is None)
   activegap=next((g for g in pastgaps if now<parse(g['toUTC']) or not g['resumed']),None)
   resumed=any(g['resumed'] and parse(g['toUTC'])<=now for g in pastgaps)
   baseline=now==start and bool(ordered) and step is not None and any(abs((t-start).total_seconds())<=step for t,_ in ordered)
   val=round(total,2) if any_read or baseline else None
   if activegap or val is None: status='missing'
   elif incomplete and resumed:status='resumed'
   else:status='available'
   framevals.append(val);states.append(status);lasttimes.append(iso(last));partial.append(incomplete);quality.append('A' if approved and any_read else ('P' if any_read else None))
   gapsince.append(activegap['fromUTC'] if activegap else None)
  stations.append({'id':sid,'name':info['siteName'],'lat':geog['latitude'],'lon':geog['longitude'],
   'source':f'https://waterdata.usgs.gov/monitoring-location/USGS-{sid}/',
   'intervalSeconds':step,'valuesIn':framevals,'states':states,'partial':partial,'lastUTC':lasttimes,
   'quality':quality,'gapSinceUTC':gapsince,'gaps':gaps,'observations':len(measured),
   'invalidReadings':invalid,'conflictingTimes':conflicts})
  vals=[v for v in framevals if v is not None]
  assert all(b>=a for a,b in zip(vals,vals[1:]))
  assert all(t is None or parse(t)<=now for t,now in zip(lasttimes,times))
 stations.sort(key=lambda s:s['id'])
 assert len(stations)==len({s['id'] for s in stations})
 payload['events'][slug]={'startUTC':iso(start),'endsUTC':[iso(t) for t in times],'stations':stations}
 audit[slug]={'returnedSeries':len(raw['value']['timeSeries']),'mappedStations':len(stations),
  'stationsWithObservations':sum(s['observations']>0 for s in stations),'stationsWithCompleteRecord':sum(not s['partial'][-1] for s in stations),
  'validIntervalReadings':rows,'partialFinal':sum(s['partial'][-1] for s in stations),
  'stations':[{'id':s['id'],'count':s['observations'],'stepSeconds':s['intervalSeconds'],'sumIn':s['valuesIn'][-1],
               'partial':s['partial'][-1],'gaps':s['gaps'],'conflicts':s['conflictingTimes']} for s in stations]}
 print(slug,{k:v for k,v in audit[slug].items() if k!='stations'})
(ROOT/'gauge_data.js').write_text('window.GAUGE_DATA = '+json.dumps(payload,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
(ROOT/'station_network_QA.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2),encoding='utf-8')
