(() => {
  'use strict';
  const i18n=window.PanelI18n,t=i18n.t;
  const data={...window.RAIN_DATA,events:{...window.RAIN_DATA?.events,...window.NWS_RAIN_DATA?.events}},geo=window.RAIN_GEOGRAPHY,$=id=>document.getElementById(id);
  if(!data||!geo||!window.d3){$('rain-period').textContent=t('Rainfall data could not be loaded.');return;}
  const ns='http://www.w3.org/2000/svg';
  const colors=['#ededed','#d3d3d3','#5d7fe5','#51d3ff','#51ffff','#51d326','#51ff51','#d2dd5e','#ffff26','#ffd37d','#ffa826','#ff7d26','#ff2626','#ffa8ff','#d37dd3','#a851a8','#7d517d'];
  const breaks=[0,.25,.5,1,2,3,4,5,6,8,10,12,14,16,18,20,25];
  const svg=$('rain-map'),legend=$('rain-legend');
  // USGS-only subset for each event. Preserve source coordinates and gaps.
  const selectedStations=slug=>window.FIELD_GAUGE_DATA?.events[slug]?.stations||[];
  const project=(lon,lat)=>[(lon+67.32)*435+10,(18.60-lat)*450+8];
  const path=d3.geoPath(d3.geoTransform({point(lon,lat){this.stream.point(...project(lon,lat));}}));
  const node=(tag,attrs={},text)=>{const n=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);if(text!==undefined)n.textContent=text;return n;};
  const map=node('g');svg.append(map);
  const zoom=d3.zoom().scaleExtent([1,5]).extent([[0,0],[1000,340]]).translateExtent([[0,0],[1000,340]]).on('zoom',e=>map.setAttribute('transform',e.transform));
  d3.select(svg).call(zoom).on('dblclick.zoom',null);
  $('rain-zoom-in').addEventListener('click',()=>d3.select(svg).call(zoom.scaleBy,1.5));
  $('rain-zoom-out').addEventListener('click',()=>d3.select(svg).call(zoom.scaleBy,1/1.5));
  $('rain-zoom-reset').addEventListener('click',()=>d3.select(svg).call(zoom.transform,d3.zoomIdentity));
  const landD=geo.features.map(f=>path(f)).join(' ');
  const defs=node('defs'),clip=node('clipPath',{id:'rain-land-clip'});clip.append(node('path',{d:landD}));defs.append(clip);
  const pattern=node('pattern',{id:'rain-missing',width:7,height:7,patternUnits:'userSpaceOnUse'});pattern.append(node('rect',{width:7,height:7,fill:'#283344'}),node('path',{d:'M0 7 L7 0',stroke:'#8395ac','stroke-width':1}));defs.append(pattern);map.append(defs);
  const base=node('path',{d:landD,fill:colors[0]});map.append(base);
  const rainLayer=node('g',{'clip-path':'url(#rain-land-clip)'});map.append(rainLayer);
  const boundaryLayer=node('g'),labels=node('g'),hits=node('g');
  for(const f of geo.features){
    const [x,y]=project(...f.properties.label);
    boundaryLayer.append(node('path',{d:path(f),class:'municipality-border'}));
    const words=f.properties.name.split(' '),lines=words.length>1?[words.slice(0,Math.ceil(words.length/2)).join(' '),words.slice(Math.ceil(words.length/2)).join(' ')]:words;
    const compact=['Naranjito','Corozal','Hormigueros','Guaynabo','Bayamón','Cataño','Las Piedras','Humacao','Barceloneta'];
    const text=node('text',{x,y,class:`municipality-name ${[...compact,'Toa Alta','Toa Baja','Dorado'].includes(f.properties.name)?'compact-town':''}`,'font-size':compact.includes(f.properties.name)?12:13,'data-municipality':f.properties.name});
    if(f.properties.name==='Quebradillas'){text.setAttribute('transform',`rotate(-65 ${x} ${y})`);text.setAttribute('font-size','12');}
    text.dataset.baseTransform=text.getAttribute('transform')||'';
    for(let i=0;i<lines.length;i++)text.append(node('tspan',{x,dy:i===0?(lines.length===2?-6:0):13},lines[i]));
    labels.append(text);
    const hit=node('path',{d:path(f),class:'municipality-hit',tabindex:0,role:'img','aria-label':f.properties.name});
    hit.append(node('title',{},f.properties.name));
    hit.addEventListener('pointermove',e=>tooltip(f,e));hit.addEventListener('pointerleave',hideTip);
    hit.addEventListener('focus',()=>tooltip(f));hit.addEventListener('blur',hideTip);hits.append(hit);
  }
  map.append(boundaryLayer,node('path',{d:landD,class:'coastline'}),hits,labels);
  const stationLayer=node('g');map.append(stationLayer);
  const barX=25,barY=5,w=55;
  colors.forEach((color,i)=>{
    if(i===colors.length-1)legend.append(node('path',{d:`M${barX+i*w},${barY} l${w},11 l-${w},11 Z`,fill:color,stroke:'#091626','stroke-width':.5}));
    else legend.append(node('rect',{x:barX+i*w,y:barY,width:w,height:22,fill:color,stroke:'#091626','stroke-width':.5}));
    legend.append(node('text',{x:barX+i*w,y:45,fill:'#eaf2ff','font-size':16,'text-anchor':'middle'},i===colors.length-1?'≥25':String(breaks[i])));
  });
  const legendTitle=node('text',{x:500,y:65,fill:'#e0eafa','font-size':16,'text-anchor':'middle'},t('Accumulated rainfall (inches)'));legend.append(legendTitle);
  let current=null,values=null,activeKey=null,locked=false,activeSlug=null,activeIndex=0,activeTip=null;const cache=new Map(),placements=new Map();
  const number=n=>Number(n).toFixed(2);
  const format={format:i18n.date};
  function hideTip(){if(!locked)$('rain-tooltip').hidden=true;}
  function placeTip(e){
    const tip=$('rain-tooltip'),rect=svg.parentElement.getBoundingClientRect();
    tip.hidden=false;
    tip.style.left=`${Math.max(2,Math.min(rect.width-tip.offsetWidth-2,e?e.clientX-rect.left+12:15))}px`;
    tip.style.top=`${Math.max(2,Math.min(rect.height-tip.offsetHeight-2,e?e.clientY-rect.top-25:15))}px`;
  }
  function sample(lon,lat){
    if(current?.grid){
      const g=current.grid;let best=Infinity,index=0;
      for(let j=0;j<g.latitude.length;j++){const d=(g.latitude[j]-lat)**2+((g.longitude[j]-lon)*.95)**2;if(d<best){best=d;index=j;}}
      return values[index];
    }
    const x=Math.max(0,Math.min(30,(lon+68.05)/.1)),y=Math.max(0,Math.min(10,(18.65-lat)/.1));
    const x0=Math.floor(x),y0=Math.floor(y),x1=Math.min(30,x0+1),y1=Math.min(10,y0+1),fx=x-x0,fy=y-y0;
    return values[y0*31+x0]*(1-fx)*(1-fy)+values[y0*31+x1]*fx*(1-fy)+values[y1*31+x0]*(1-fx)*fy+values[y1*31+x1]*fx*fy;
  }
  function tooltip(f,e){
    if(!values||locked)return;const tip=$('rain-tooltip');
    activeTip={f,e};
    // Screen CTM also handles letterboxing when a short viewport constrains map height.
    const point=e?new DOMPoint(e.clientX,e.clientY).matrixTransform(map.getScreenCTM().inverse()):null;
    const lon=point?(point.x-10)/435-67.32:f.properties.label[0];
    const lat=point?18.60-(point.y-8)/450:f.properties.label[1];
    const v=sample(lon,lat);tip.replaceChildren();const strong=document.createElement('strong');strong.textContent=f.properties.name;tip.append(strong,document.createTextNode(v==null?t('Rainfall data are missing for this location'):t('Estimated rainfall: {value} inches',{value:number(v)})));
    placeTip(e);
  }
  function gaugeTip(station,i,e,pin=false,refresh=false){
    if(locked&&!pin)return;
    activeTip={station,i,e,pin};
    locked=pin;const tip=$('rain-tooltip');tip.classList.toggle('locked',locked);tip.replaceChildren();
    if(pin){
      if(!refresh)document.dispatchEvent(new CustomEvent('rain-inspect'));
      const close=document.createElement('button');close.textContent='✕';close.setAttribute('aria-label',t('Close station'));close.addEventListener('click',()=>{locked=false;hideTip();});tip.append(close);
    }
    const title=document.createElement('strong');title.textContent=station.name;tip.append(title);
    const total=station.valuesIn[i];
    const line=document.createElement('div');line.textContent=total==null?t('No readings available up to this time'):t('Recorded rainfall: {value} inches',{value:number(total)})+(station.partial[i]?t(' · incomplete accumulation'):'');tip.append(line);
    const meta=document.createElement('small');meta.textContent=`${station.agency||'USGS'} ${station.sourceId||station.id} · ${station.lat.toFixed(5)}, ${station.lon.toFixed(5)}`;tip.append(meta);
    const region=document.createElement('small');region.textContent=t('Location: {name}',{name:station.municipality});tip.append(region);
    const frequency=document.createElement('small');frequency.textContent=t('Readings every {minutes} minutes',{minutes:station.intervalSeconds/60});tip.append(frequency);
    const last=document.createElement('small');last.textContent=station.lastUTC[i]?t('Last reading: {date} (UTC−4)',{date:format.format(station.lastUTC[i])}):t('No reading since the accumulation period began');tip.append(last);
    if(station.gapSinceUTC[i]&&!station.noEventData){const gap=document.createElement('small');gap.textContent=t('Readings missing since {date}',{date:format.format(station.gapSinceUTC[i])});tip.append(gap);}
    if(station.states[i]==='resumed'){const resumed=document.createElement('small');resumed.textContent=t('The station resumed recording. Some earlier readings are missing.');tip.append(resumed);}
    const quality=document.createElement('small');quality.textContent=(station.qualityText?t(station.qualityText):null)||t(station.quality[i]==='A'?'USGS-approved observations':station.quality[i]==='P'?'Includes provisional USGS observations':'Review status unavailable');tip.append(quality);
    const link=document.createElement('a');link.href=station.source;link.target='_blank';link.rel='noopener';link.textContent=t('Station page ↗');tip.append(link);placeTip(e);
  }
  function positions(slug,stations){
    const townNodes=[...labels.querySelectorAll('.municipality-name')];
    function applyTownLayout(layout){for(const t of townNodes){const p=layout[t.dataset.municipality];t.setAttribute('transform',`translate(${p.dx} ${p.dy}) ${t.dataset.baseTransform}`);t.dataset.dx=String(p.dx);t.dataset.dy=String(p.dy);}}
    if(placements.has(slug)){const saved=placements.get(slug);applyTownLayout(saved.towns);return saved.stations;}
    for(const t of townNodes)t.setAttribute('transform',t.dataset.baseTransform);
    const inverse=map.getScreenCTM().inverse();
    const area=(a,b)=>Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
    function hitsLine(b,l){
      let lo=0,hi=1;const dx=l.x2-l.x1,dy=l.y2-l.y1;
      for(const [p,q] of [[-dx,l.x1-b.x],[dx,b.x+b.w-l.x1],[-dy,l.y1-b.y],[dy,b.y+b.h-l.y1]]){if(p===0){if(q<0)return false;}else{const r=q/p;if(p<0)lo=Math.max(lo,r);else hi=Math.min(hi,r);if(lo>hi)return false;}}
      return true;
    }
    function ringContains(r,x,y){let inside=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const [xi,yi]=r[i],[xj,yj]=r[j];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)inside=!inside;}return inside;}
    function insideTown(f,x,y){const lon=(x-10)/435-67.32,lat=18.60-(y-8)/450,polys=f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates;return polys.some(p=>ringContains(p[0],lon,lat)&&!p.slice(1).some(r=>ringContains(r,lon,lat)));}
    const towns=townNodes.map(t=>{const b=t.getBoundingClientRect(),a=new DOMPoint(b.left,b.top).matrixTransform(inverse),z=new DOMPoint(b.right,b.bottom).matrixTransform(inverse),f=geo.features.find(f=>f.properties.name===t.dataset.municipality);return{name:t.dataset.municipality,f,anchor:project(...f.properties.label),x:a.x-.75,y:a.y-.75,w:z.x-a.x+1.5,h:z.y-a.y+1.5};});
    const dots=stations.map(s=>{const [x,y]=project(s.lon,s.lat);return{x:x-7,y:y-7,w:14,h:14,id:s.id};});
    const fixed=[...dots,{x:928,y:35,w:60,h:80}],answer={},lines=[];
    // Preserve true station coordinates. Relocate town names inside their own polygons.
    const preferred={
      '181708066152400':'NW','50999965':'W','50049620':'NE','182723066055200':'E',
      '50029000':'NE','50014800':'E','50028000':'W','50126150':'W','50023110':'NE','50011088':'NW',
      '50010500':'NE','50115240':'E','50032590':'N','50999960':'E','50083500':'E','50136400':'W',
      '50075000':'NE','180559065280501':'S','182350066063700':'W'
    };
    if(slug==='ernesto')preferred['50999965']='E';
    for(const s of [...stations].sort((a,b)=>b.lat-a.lat)){
      const digits=String(Math.floor(Math.max(0,...s.valuesIn.filter(v=>v!=null)))).length;
      const probe=node('text',{x:0,y:0,class:'station-label',visibility:'hidden'},'9'.repeat(digits)+'.99');labels.append(probe);const measured=probe.getBBox();const labelBox={x:measured.x-1,y:measured.y-1,w:measured.width+2,h:measured.height+2};probe.remove();
      const [sx,sy]=project(s.lon,s.lat);let best=null;
      for(const gap of [8,14,20])for(const dir of ['N','NE','E','SE','S','SW','W','NW']){
        const centerX=sx+(dir.includes('E')?gap+labelBox.w/2:dir.includes('W')?-gap-labelBox.w/2:0);
        const centerY=sy+(dir.includes('N')?-gap-labelBox.h/2:dir.includes('S')?gap+labelBox.h/2:0);
        const b={x:centerX-labelBox.w/2,y:centerY-labelBox.h/2,w:labelBox.w,h:labelBox.h};
        if(b.x<1||b.x+b.w>998||b.y<32||b.y+b.h>328)continue;
        const overlaps=fixed.reduce((sum,q)=>sum+area(b,q),0),townPenalty=towns.reduce((sum,q)=>sum+area(b,q),0);
        const cost=(overlaps?1e8+overlaps*1000:0)+townPenalty*.01+gap+(dir===preferred[s.id]?0:100);
        if(!best||cost<best.cost)best={...b,cost,xLabel:b.x-labelBox.x,yLabel:b.y-labelBox.y};
      }
      const ex=Math.max(best.x,Math.min(best.x+best.w,sx)),ey=Math.max(best.y,Math.min(best.y+best.h,sy));
      answer[s.id]=best;fixed.push(best);lines.push({x1:sx,y1:sy,x2:ex,y2:ey,id:s.id});
    }
    const townOptions=towns.map(t=>{const options=[];for(let dy=-36;dy<=36;dy+=2)for(let dx=-42;dx<=42;dx+=2){if((dx||dy)&&!insideTown(t.f,t.anchor[0]+dx,t.anchor[1]+dy))continue;options.push({...t,x:t.x+dx,y:t.y+dy,dx,dy,distance:Math.hypot(dx,dy)});}options.sort((a,b)=>a.distance-b.distance);return{t,options};}).sort((a,b)=>a.options.length-b.options.length);
    const choices=townOptions.map(({t,options})=>{for(const p of options){p.fixedCost=fixed.reduce((sum,b)=>sum+area(p,b),0)*1e6+lines.reduce((sum,l)=>sum+Number(hitsLine(p,l)),0)*1e9;}const clear=options.filter(p=>p.fixedCost===0);return{name:t.name,options:clear.length?clear:options.sort((a,b)=>a.fixedCost-b.fixedCost).slice(0,8)};});
    let layout=choices.map(c=>c.options[0]);
    const localCost=(p,index)=>p.fixedCost+p.distance*.03+layout.reduce((sum,b,j)=>sum+(j===index?0:area(p,b)*20),0);
    function improve(){for(let pass=0;pass<5;pass++)for(let k=0;k<choices.length;k++){const j=pass%2?k:choices.length-1-k;let best=layout[j],score=localCost(best,j);for(const p of choices[j].options){const c=localCost(p,j);if(c<score){best=p;score=c;}}layout[j]=best;}}
    improve();
    const totalCost=()=>layout.reduce((sum,p,i)=>sum+p.fixedCost+p.distance*.03+layout.slice(i+1).reduce((s,q)=>s+area(p,q)*20,0),0);
    let bestLayout=[...layout],bestCost=totalCost(),seed=1234567;
    const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
    let crowded=[];
    for(let step=0;step<12000;step++){
      if(step%100===0)crowded=layout.map((p,i)=>layout.some((q,j)=>i!==j&&area(p,q)>0)?i:-1).filter(i=>i>=0);
      if(!crowded.length)break;
      const j=random()<.9?crowded[Math.floor(random()*crowded.length)]:Math.floor(random()*layout.length),options=choices[j].options,p=options[Math.floor(random()*options.length)],change=localCost(p,j)-localCost(layout[j],j),temperature=200*(1-step/12000)**2+.1;
      if(change<=0||random()<Math.exp(-change/temperature)){layout[j]=p;const cost=totalCost();if(cost<bestCost){bestCost=cost;bestLayout=[...layout];}}
    }
    layout=bestLayout;improve();
    // Resolve adjacent town names together when moving either one alone is insufficient.
    for(let pass=0;pass<6;pass++){
      let changed=false;
      for(let a=0;a<layout.length;a++)for(let b=a+1;b<layout.length;b++){
        if(!area(layout[a],layout[b]))continue;
        const independent=(p)=>p.fixedCost+p.distance*.03+layout.reduce((sum,q,j)=>sum+(j===a||j===b?0:area(p,q)*20),0);
        const candidates=j=>choices[j].options.map(p=>({p,c:independent(p)})).sort((x,y)=>x.c-y.c).slice(0,120);
        let score=independent(layout[a])+independent(layout[b])+area(layout[a],layout[b])*20,pair=null;
        for(const x of candidates(a))for(const y of candidates(b)){const c=x.c+y.c+area(x.p,y.p)*20;if(c<score){score=c;pair=[x.p,y.p];}}
        if(pair){[layout[a],layout[b]]=pair;changed=true;}
      }
      if(!changed)break;
      improve();
    }
    const conflicting=layout.filter((p,i)=>layout.some((q,j)=>i!==j&&area(p,q)>0));
    if(conflicting.length){
      const local=choices.map((c,i)=>conflicting.some(p=>Math.hypot(layout[i].anchor[0]-p.anchor[0],layout[i].anchor[1]-p.anchor[1])<120)?i:-1).filter(i=>i>=0);
      const localSet=new Set(local),outside=layout.filter((p,i)=>!localSet.has(i));
      const initial=local.map(i=>({i,options:choices[i].options.filter(p=>!p.fixedCost&&!outside.some(q=>area(p,q)>0)).sort((a,b)=>a.distance-b.distance)}));
      let visits=0;const deadline=performance.now()+700;
      function resolve(todo,placed){
        if(!todo.length)return placed;
        if(++visits>5000||performance.now()>deadline)return null;
        todo.sort((a,b)=>a.options.length-b.options.length);const [next,...rest]=todo;
        for(const p of next.options){
          const remaining=rest.map(c=>({i:c.i,options:c.options.filter(q=>!area(p,q))}));
          if(remaining.some(c=>!c.options.length))continue;
          const answer=resolve(remaining,[...placed,{i:next.i,p}]);if(answer)return answer;
        }
        return null;
      }
      if(initial.every(c=>c.options.length)){const result=resolve(initial,[]);if(result)for(const {i,p}of result)layout[i]=p;}
    }
    const townLayout={};let collisions=0;
    layout.forEach((p,i)=>{townLayout[choices[i].name]=p;if(p.fixedCost||layout.some((q,j)=>i!==j&&area(p,q)>0))collisions++;});
    svg.dataset.unplacedTowns=layout.filter(p=>p.fixedCost).map(p=>p.name).join(',');
    applyTownLayout(townLayout);svg.dataset.labelConflicts=String(collisions);
    placements.set(slug,{stations:answer,towns:townLayout});return answer;
  }
  function drawStations(slug,i){
    const stations=selectedStations(slug),layout=positions(slug,stations);
    const fragment=document.createDocumentFragment();let missing=0,partial=0;
    for(const station of stations){
      const [sx,sy]=project(station.lon,station.lat),p=layout[station.id],sum=station.valuesIn[i],state=station.states[i],incomplete=station.partial[i];
      missing+=state==='missing'?1:0;partial+=incomplete?1:0;
      const g=node('g',{class:`gauge-point ${incomplete?'partial':''} ${state==='missing'?'missing':''}`,tabindex:0,role:'button','aria-label':`${station.name}, ${sum==null?t('no reading'):t('{value} inches',{value:number(sum)})}${incomplete?t(', partial accumulation'):''}`,'data-station':station.id});
      if(sum!=null){
        const ex=Math.max(p.x,Math.min(p.x+p.w,sx)),ey=Math.max(p.y,Math.min(p.y+p.h,sy));
        const distance=Math.hypot(ex-sx,ey-sy),factor=distance?Math.min(1,7/distance):0;
        const d=`M${sx+(ex-sx)*factor},${sy+(ey-sy)*factor} L${ex},${ey}`;
        g.append(node('path',{d,class:'station-line-halo'}),node('path',{d,class:'station-line'}));
      }
      if(state==='missing')g.append(node('path',{d:`M${sx-4},${sy-4} L${sx+4},${sy+4} M${sx-4},${sy+4} L${sx+4},${sy-4}`,class:'station-symbol'}));
      else if(incomplete)g.append(node('path',{d:`M${sx},${sy-5} L${sx+5},${sy+4} L${sx-5},${sy+4} Z`,class:'station-symbol'}));
      else g.append(node('circle',{cx:sx,cy:sy,r:4,class:'station-symbol'}));
      if(sum!=null)g.append(node('text',{x:p.xLabel,y:p.yLabel,class:'station-label'},number(sum)));
      g.append(node('circle',{cx:sx,cy:sy,r:9,class:'station-hit'}));
      g.addEventListener('pointermove',e=>gaugeTip(station,i,e));g.addEventListener('pointerleave',hideTip);
      g.addEventListener('click',e=>{e.stopPropagation();gaugeTip(station,i,e,true);});
      g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();gaugeTip(station,i,null,true);}});
      fragment.append(g);
    }
    stationLayer.replaceChildren(fragment);
    $('station-status').textContent=t('{total} USGS stations · {missing} with missing readings.',{total:stations.length,missing});
  }
  function contourPaths(){
    if(current.grid){
      const g=current.grid;
      const nativePath=d3.geoPath(d3.geoTransform({point(x,y){
        x=Math.max(0,Math.min(g.nx-1,x-.5));y=Math.max(0,Math.min(g.ny-1,y-.5));
        const x0=Math.floor(x),y0=Math.floor(y),x1=Math.min(g.nx-1,x0+1),y1=Math.min(g.ny-1,y0+1),fx=x-x0,fy=y-y0;
        const blend=a=>a[y0*g.nx+x0]*(1-fx)*(1-fy)+a[y0*g.nx+x1]*fx*(1-fy)+a[y1*g.nx+x0]*(1-fx)*fy+a[y1*g.nx+x1]*fx*fy;
        this.stream.point(...project(blend(g.longitude),blend(g.latitude)));
      }}));
      return d3.contours().size([g.nx,g.ny]).thresholds(breaks)(values.map(v=>v==null?-1:v)).map((c,i)=>({d:nativePath(c),fill:colors[i]}));
    }
    // Bilinear display smoothing only. Source information remains 0.1 degree.
    const factor=4,nx=31*factor,ny=11*factor,grid=new Float32Array(nx*ny);
    for(let j=0;j<ny;j++)for(let i=0;i<nx;i++)grid[j*nx+i]=sample(-68.10+(i+.5)*.1/factor,18.70-(j+.5)*.1/factor);
    const contourPath=d3.geoPath(d3.geoTransform({point(x,y){this.stream.point(...project(-68.10+x*.1/factor,18.70-y*.1/factor));}}));
    return d3.contours().size([nx,ny]).thresholds(breaks.slice(1))(grid).map((g,i)=>({d:contourPath(g),fill:colors[i+1]}));
  }
  window.updateRain=(slug,utc,eventName)=>{
    const event=data.events[slug];if(!event){$('rain-period').textContent=t('No rainfall data for this event.');rainLayer.replaceChildren();stationLayer.replaceChildren();return;}
    const now=Date.parse(utc);
    let i=event.endsUTC.findLastIndex(t=>Date.parse(t)<=now);i=Math.max(0,i);
    const key=`${slug}:${i}`;current=event;values=event.accumulatedIn[i];activeSlug=slug;activeIndex=i;
    if(key!==activeKey){
      activeKey=key;locked=false;hideTip();
      base.setAttribute('fill',event.grid?'url(#rain-missing)':colors[0]);
      if(!cache.has(key)){cache.set(key,contourPaths());if(cache.size>40)cache.delete(cache.keys().next().value);}
      rainLayer.replaceChildren(...cache.get(key).map(a=>node('path',a)));
      drawStations(slug,i);
    }
    const cutoff=event.mapCutoffUTC?.[i]||event.endsUTC[i];
    $('rain-period').replaceChildren();
    for(const text of [t('From {date}',{date:format.format(event.startUTC)}),t('Through {date} · Puerto Rico time (UTC−4)',{date:format.format(cutoff)})]){const line=document.createElement('span');line.textContent=text;$('rain-period').append(line);}
    svg.setAttribute('aria-label',t('Estimated accumulated rainfall for {event} through {date}, with USGS station records.',{event:eventName,date:format.format(cutoff)}));
    svg.dataset.event=slug;svg.dataset.cutoff=cutoff;svg.dataset.index=String(i);svg.dataset.source=event.sourceKind||'IMERG';
  };
  document.addEventListener('languagechange',()=>{
    legendTitle.textContent=t('Accumulated rainfall (inches)');
    if(activeSlug)drawStations(activeSlug,activeIndex);
    if(!$('rain-tooltip').hidden&&activeTip){
      const a=activeTip;
      if(a.station)gaugeTip(a.station,a.i,a.e,a.pin,true);else tooltip(a.f,a.e);
    }
  });
  // Repack the station labels when viewport typography or map dimensions change.
  new ResizeObserver(()=>{placements.clear();if(activeSlug)drawStations(activeSlug,activeIndex);}).observe(svg);
})();
