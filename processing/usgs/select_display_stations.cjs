// Rebuild only the displayed USGS subset. Never edit source readings or coordinates.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {loadStationInputs, contains, distanceToMunicipality} = require('./station_geometry.cjs');
const [gaugePath, geographyPath, outputPath] = process.argv.slice(2);
if (!gaugePath || !geographyPath || !outputPath || process.argv.length !== 5) {
  console.error('Usage: node select_display_stations.cjs GAUGE_DATA_JS MUNICIPIOS_JS OUTPUT_DIRECTORY');
  process.exit(2);
}
const out = path.resolve(outputPath);
if ([gaugePath, geographyPath].some(file => path.dirname(path.resolve(file)) === out)) {
  console.error('Choose a separate output directory for the selected stations.');
  process.exit(2);
}
const {events, geo} = loadStationInputs(gaugePath, geographyPath);
const groups={
  'North coast':['Barceloneta','Manatí','Arecibo','Hatillo'],
  'Southwest':['Guánica','Lajas','Guayanilla','Cabo Rojo','Sabana Grande','Yauco'],
  'Western interior':['Las Marías','Maricao','San Sebastián','Lares']
};
const fixed={Ponce:'50115240',Utuado:'50023110',Isabela:'50011088',Naranjito:'181708066152400',Caguas:'50999965',Orocovis:'50032590','El Yunque':'50075000'};
const preferred={
  'San Juan':['182723066055200'],
  'Mayagüez':['50136400'],
  'Yabucoa':['50083500'],
  'Vieques':['180559065280501']
};
const feature=name=>{const f=geo.find(f=>f.properties.name===name);assert(f,name);return f;};
const good=s=>s.observations>0&&s.valuesIn.some(v=>v!==null)&&s.intervalSeconds<86400;
const all=Object.fromEntries(Object.entries(events).map(([e,v])=>[e,v.stations.filter(good)]));
const common=new Set(all.irma.filter(s=>Object.values(all).every(list=>list.some(q=>q.id===s.id))).map(s=>s.id));
const municipality=s=>geo.find(f=>contains(f,s))?.properties.name||'Outside the mapped municipal boundary';
function nearest(list,names){
  return list.map(s=>{
    const locations=names.map(name=>({name,inside:contains(feature(name),s),distanceKm:distanceToMunicipality(feature(name),s)})).sort((a,b)=>Number(b.inside)-Number(a.inside)||a.distanceKm-b.distanceKm);
    return {s,...locations[0]};
  }).sort((a,b)=>Number(b.inside)-Number(a.inside)||a.distanceKm-b.distanceKm||Number(common.has(b.s.id))-Number(common.has(a.s.id))||b.s.observations-a.s.observations);
}
function selectGroup(event,region,names){
  // Prefer a station inside this requested group that can be kept for all events.
  for(const name of names){const match=all[event].filter(s=>common.has(s.id)&&contains(feature(name),s));if(match.length)return{station:match[0],reason:'Station in the group with records for all four events. Continuity across events takes priority.'};}
  // Otherwise honor the user's municipal order for this event.
  for(const name of names){const match=all[event].filter(s=>contains(feature(name),s));if(match.length)return{station:match.sort((a,b)=>b.observations-a.observations)[0],reason:'Station in the first municipality in the specified order with records for this event.'};}
  const match=nearest(all[event],names)[0];
  return{station:match.s,reason:`No series recovered within the group. The nearest reference to its boundary is near ${match.name}.`};
}
function selectTown(event,name){
  const candidates=all[event].filter(s=>contains(feature(name),s));
  const stable=candidates.find(s=>common.has(s.id));
  const priority=candidates.find(s=>(preferred[name]||[]).includes(s.id));
  if(candidates.length)return{station:stable||priority||candidates[0],reason:stable?'Station within the municipality with records for all four events.':'Station within the municipality with records for this event.'};
  return{station:nearest(all[event],[name])[0].s,reason:'No series recovered within the municipality. This station has event data and is closest to its boundary.'};
}
const payload={agency:'USGS',retrieved:'2026-10-05',parameterCode:'00045',policy:'Location, continuity and proximity. Original coordinates are retained. External references retain their actual municipality. Shared points are listed once. The display retains only the southern Lago Viví station in Utuado.',events:{}};
const audit=[];
for(const [event,original] of Object.entries(events)){
  const chosen=new Map(),selection={},displayExcluded=[];
  const assignments=[];
  for(const [region,id] of Object.entries(fixed)){const station=all[event].find(s=>s.id===id);assert(station,`${event} ${id}`);assignments.push({region,station,reason:region==='El Yunque'?'Río Icacos in Naguabo serves as the reference for El Yunque in all four events.':"Retains the sector's USGS station with records for all four events."});}
  for(const region of ['San Juan','Mayagüez','Yabucoa','Vieques','Culebra'])assignments.push({region,...selectTown(event,region)});
  for(const [region,names] of Object.entries(groups))assignments.push({region,...selectGroup(event,region,names)});
  for(const {region,station,reason} of assignments){
    if(municipality(station)==='Utuado'&&station.id!==fixed.Utuado){
      displayExcluded.push({region,id:station.id,name:station.name,reason:'The display retains only Lago Viví, farther south in Utuado. The original data remain available.'});
      continue;
    }
    const names=groups[region]||[region==='El Yunque'?'Naguabo':region];
    const closest=nearest([station],names)[0];
    selection[region]=station.id;
    if(!chosen.has(station.id))chosen.set(station.id,{...station,agency:'USGS',municipality:municipality(station),regions:[],fallbacks:[]});
    const s=chosen.get(station.id);s.regions.push(region);
    if(!closest.inside)s.fallbacks.push({region,referenceMunicipality:closest.name,municipality:s.municipality,distanceKm:closest.distanceKm});
    audit.push({event,region,id:s.id,name:s.name,municipality:s.municipality,referenceMunicipality:closest.name,inside:closest.inside,distanceKm:closest.distanceKm,lat:s.lat,lon:s.lon,observations:s.observations,intervalMinutes:s.intervalSeconds/60,reason,source:s.source});
  }
  const stations=[...chosen.values()].sort((a,b)=>b.lat-a.lat);
  assert(stations.every(s=>s.observations>0));
  payload.events[event]={startUTC:original.startUTC,endsUTC:original.endsUTC,stations,selection,displayExcluded};
  console.log(event,stations.length,'points',Object.keys(selection).length,'sectors',JSON.stringify(selection));
}
fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(path.join(out,'field_gauge_data.js'),'window.FIELD_GAUGE_DATA='+JSON.stringify(payload)+';\n');
fs.writeFileSync(path.join(out,'usgs_selection.json'),JSON.stringify(audit,null,2));
const csvFields=Object.keys(audit[0]);
const quote=v=>'"'+String(v??'').replaceAll('"','""')+'"';
fs.writeFileSync(path.join(out,'usgs_selection.csv'),'\ufeff'+[csvFields.map(quote).join(','),...audit.map(r=>csvFields.map(k=>quote(r[k])).join(','))].join('\r\n'));
// Save every eligible candidate and its distance, so nearest-site choices are auditable.
const candidates={};
for(const event of Object.keys(events)){
  candidates[event]={};
  for(const region of Object.keys(payload.events[event].selection)){
    const names=groups[region]||[region==='El Yunque'?'Naguabo':region];
    candidates[event][region]=nearest(all[event],names).map(({s,name,inside,distanceKm})=>({id:s.id,municipality:municipality(s),referenceMunicipality:name,inside,distanceKm,observations:s.observations,common:common.has(s.id)}));
  }
}
fs.writeFileSync(path.join(out,'candidates_by_sector.json'),JSON.stringify(candidates,null,2));
