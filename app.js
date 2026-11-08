(() => {
  "use strict";
  const i18n=window.PanelI18n,t=i18n.t;
  const data = window.HURRICANE_DATA;
  if (!data?.events) { document.body.textContent = t("No se encontraron los datos del panel."); return; }
  const $ = id => document.getElementById(id);
  const selector=$("storm-selector"), image=$("frame-image"), loading=$("loading"), slider=$("scrubber");
  const svg=$("track-overlay"), pathLayer=$("track-path"), pointLayer=$("official-points");
  const width=data.frameWidth||960, height=data.frameHeight||600, [west,south,east,north]=data.bbox;
  const state={event:null,slug:null,index:0,playing:false,rate:1,timer:null,request:0,cache:new Map()};
  // Colors from the visible NOAA Historical Hurricane Tracks legend, https://coast.noaa.gov/hurricanes/
  const palette={"TD":"#1c54ff","TS":"#6cc343","1":"#ffc309","2":"#ff7209","3":"#e83b0c","4":"#e80cae","5":"#bd00ff"};
  const color=r=>palette[r?.category]||palette[r?.status]||"#cbd5e1";
  const projected=r=>[(r.lon-west)/(east-west)*width,(north-r.lat)/(north-south)*height];
  const inside=r=>r.lon>=west&&r.lon<=east&&r.lat>=south&&r.lat<=north;
  const ns="http://www.w3.org/2000/svg";
  const stamp=i18n.date;
  let loadingMessage='Cargando imagen…';
  function showLoading(message){loadingMessage=message;loading.textContent=t(message);loading.classList.remove('hidden');}
  function shape(tag,attributes){const el=document.createElementNS(ns,tag);Object.entries(attributes).forEach(([key,value])=>el.setAttribute(key,String(value)));return el;}
  function drawPuertoRico(){
    const outline=$("puerto-rico-overlay"), geography=window.PUERTO_RICO_OUTLINE;
    if(!outline||!geography?.features)return;
    outline.setAttribute("viewBox",`0 0 ${width} ${height}`);
    const rings=[];
    for(const feature of geography.features){
      const geometry=feature.geometry;
      const polygons=geometry.type==="MultiPolygon"?geometry.coordinates:geometry.type==="Polygon"?[geometry.coordinates]:[];
      for(const polygon of polygons)for(const ring of polygon){
        rings.push(ring.map(([lon,lat],i)=>{const [x,y]=projected({lon,lat});return `${i?"L":"M"}${x.toFixed(3)},${y.toFixed(3)}`;}).join(" ")+" Z");
      }
    }
    const d=rings.join(" ");
    // Anchor both labels inside Puerto Rico, in the same geographic coordinates as the coast.
    const [labelX,labelY]=projected({lon:-66.45,lat:18.22});
    const fullName=shape("text",{x:labelX,y:labelY,class:"pr-map-name pr-name-full",textLength:78,lengthAdjust:"spacing"});
    fullName.textContent="Puerto Rico";
    const shortName=shape("text",{x:labelX,y:labelY,class:"pr-map-name pr-name-short"});
    shortName.textContent="PR";
    outline.replaceChildren(
      shape("path",{d,class:"pr-outline-shadow","vector-effect":"non-scaling-stroke"}),
      shape("path",{d,class:"pr-outline","vector-effect":"non-scaling-stroke"}),
      fullName,shortName
    );
  }
  drawPuertoRico();
  // Horizontal ground distance on the WGS84 parallel through the scale bar.
  // The image is a longitude/latitude grid, with geographic north at its top.
  function updateMapScale(){
    const scale=$("map-scale"), wrap=scale.parentElement;
    const imageRect=image.getBoundingClientRect(), scaleRect=scale.getBoundingClientRect();
    const available=wrap.clientWidth;
    if(!imageRect.width||!imageRect.height||!available)return;
    const latitude=north-(scaleRect.top+7-imageRect.top)/imageRect.height*(north-south);
    const radians=latitude*Math.PI/180, flattening=1/298.257223563;
    const eccentricitySquared=flattening*(2-flattening);
    const parallelRadiusKm=6378.137*Math.cos(radians)/Math.sqrt(1-eccentricitySquared*Math.sin(radians)**2);
    const kmPerPixel=parallelRadiusKm*Math.PI/180*(east-west)/imageRect.width;
    const maximumKm=available*kmPerPixel, magnitude=10**Math.floor(Math.log10(maximumKm));
    const distanceKm=[5,2,1].map(step=>step*magnitude).find(value=>value<=maximumKm);
    const pixels=distanceKm/kmPerPixel, midpoint=pixels/2;
    const number=new Intl.NumberFormat(i18n.language==='en'?'en-US':'es-PR',{maximumFractionDigits:2});
    scale.style.width=`${pixels}px`;
    scale.setAttribute("viewBox",`0 0 ${pixels} 30`);
    scale.setAttribute("aria-label",t('Escala de {distance} kilómetros, válida a {latitude} grados norte',{distance:number.format(distanceKm),latitude:number.format(latitude)}));
    const title=shape("title",{});
    title.textContent=t('Escala horizontal a {latitude}° N',{latitude:number.format(latitude)});
    const labels=[[0,0,"start"],[pixels,distanceKm,"end"]].map(([x,value,anchor],index)=>{
      const text=shape("text",{x,y:28,"text-anchor":anchor});
      text.textContent=`${number.format(value)}${index===1?" km":""}`;
      return text;
    });
    scale.replaceChildren(title,
      shape("rect",{x:0,y:5,width:midpoint,height:4,fill:"#f4f7fb"}),
      shape("rect",{x:midpoint,y:5,width:midpoint,height:4,fill:"#f4f7fb",opacity:.25}),
      shape("path",{d:`M0 3 V11 M${midpoint} 5 V9 M${pixels} 3 V11 M0 9 H${pixels}`,fill:"none",stroke:"#f4f7fb","stroke-width":1.2}),
      ...labels
    );
  }
  new ResizeObserver(updateMapScale).observe(image);
  updateMapScale();
  function preload(src){
    if(state.cache.has(src))return state.cache.get(src);
    const img=new Image();img.src=`${src}?v=${encodeURIComponent(state.event?.imageRecipe||"legacy")}`;state.cache.set(src,img);
    if(state.cache.size>48)state.cache.delete(state.cache.keys().next().value);
    return img;
  }
  function drawTrack(frame){
    pathLayer.replaceChildren();pointLayer.replaceChildren();
    const track=state.event.track||[], now=Date.parse(frame.utc), current=frame.trackState;
    const pathFragment=document.createDocumentFragment(), pointsFragment=document.createDocumentFragment();
    for(let i=0;i<track.length;i++){
      const a=track[i],ta=Date.parse(a.utc);if(ta>now)break;
      if(inside(a)){
        const [cx,cy]=projected(a);const dot=shape("circle",{cx,cy,r:3.6,fill:color(a),stroke:"#fff","stroke-width":1.2});
        pointsFragment.appendChild(dot);
      }
      const b=track[i+1];if(!b)continue;
      const tb=Date.parse(b.utc);if(tb-ta>9*3600000)continue;
      let end=b;
      if(tb>now){if(!current)continue;end=current;}
      const [x1,y1]=projected(a),[x2,y2]=projected(end);
      const d=`M ${x1} ${y1} L ${x2} ${y2}`;
      pathFragment.appendChild(shape("path",{d,fill:"none",stroke:"#020b18","stroke-width":6,"stroke-linecap":"round"}));
      pathFragment.appendChild(shape("path",{d,fill:"none",stroke:color(a),"stroke-width":3,"stroke-linecap":"round"}));
    }
    pathLayer.appendChild(pathFragment);pointLayer.appendChild(pointsFragment);
    $("storm-info").style.setProperty("--storm-color",color(current));
    if(!current){
      $("storm-intensity").textContent=t("Sin posición válida para esta hora");
      $("wind-value").textContent=t("No disponible");$("pressure-value").textContent=t("No disponible");
      $("position-label").textContent=t("Posición del centro del ciclón");$("position-info").textContent=t("Sin registro");$("position-info").removeAttribute("title");

      return;
    }
    $("storm-intensity").textContent=i18n.intensity(current);
    $("wind-value").textContent=current.windKt==null?t("No disponible"):`${Math.round(current.windKt*1.852)} km/h`;
    $("pressure-value").textContent=current.pressureHpa==null?t("No disponible"):`${current.pressureHpa} hPa`;
    const coordinates=`${Math.abs(current.lat).toFixed(2)}° ${current.lat>=0?"N":"S"}, ${Math.abs(current.lon).toFixed(2)}° ${current.lon>=0?"E":i18n.language==='en'?"W":"O"}`;
    $("position-label").textContent=t(current.interpolated?"Posición estimada del centro del ciclón":"Posición del centro del ciclón");
    $("position-info").textContent=coordinates;
    if(current.outside) $("position-info").title=t("Centro del ciclón fuera del área de la imagen");
    else $("position-info").removeAttribute("title");

  }
  function updateTranslation(frame){
    const track=state.event.track||[],now=Date.parse(frame.utc);
    let j=track.findIndex(r=>Date.parse(r.utc)>now);
    if(j<0)j=track.length-1;
    const a=track[j-1],b=track[j],hours=a&&b?(Date.parse(b.utc)-Date.parse(a.utc))/3600000:0;
    if(!a||!b||hours<=0||hours>9||now<Date.parse(track[0].utc)||now>Date.parse(track.at(-1).utc)){
      $("translation-value").textContent=t("No disponible");$("translation-value").removeAttribute('title');return;
    }
    const rad=v=>v*Math.PI/180,dl=rad(b.lat-a.lat),dn=rad(b.lon-a.lon);
    const h=Math.sin(dl/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dn/2)**2;
    const km=6371.0088*2*Math.asin(Math.min(1,Math.sqrt(h))),speed=km/hours;
    $("translation-value").textContent=`${speed.toFixed(1)} km/h`;
    $("translation-value").title=`${stamp(a.utc)} → ${stamp(b.utc)} · ${km.toFixed(1)} km`;
  }
  function updateButton(){
    $("play-icon").dataset.playing=String(state.playing);$("play-text").textContent=t(state.playing?"PAUSA":"REPRODUCIR");
    $("play-button").setAttribute("aria-label",t(state.playing?"Pausar":"Reproducir"));
  }
  function stopTimer(){if(state.timer!==null){clearTimeout(state.timer);state.timer=null;}}
  function pause(){state.playing=false;stopTimer();updateButton();}
  document.addEventListener('rain-inspect',pause);
  function schedule(){stopTimer();if(!state.playing)return;state.timer=setTimeout(()=>showFrame((state.index+1)%state.event.frames.length),1000/((data.playbackFps||4)*state.rate));}
  function play(){if(!state.event?.frames.length)return;state.playing=true;updateButton();schedule();}
  function renderFrameText(frame){
    image.alt=`${state.event.name}, ${stamp(frame.utc)}, ${i18n.intensity(frame.trackState)}`;
    $("date-time").textContent=stamp(frame.utc);
    $("frame-count").textContent=t('Imagen {current} de {total}',{current:state.index+1,total:state.event.frames.length});
    $("mode-badge").textContent=t(frame.mode);drawTrack(frame);updateTranslation(frame);
    window.updateRain?.(state.slug,frame.utc,state.event.name);
  }
  function showFrame(index){
    if(!state.event?.frames.length)return;
    stopTimer();const request=++state.request;const event=state.event;
    index=Math.max(0,Math.min(event.frames.length-1,index));const frame=event.frames[index];
    showLoading('Cargando imagen…');
    const ready=preload(frame.src);
    function commit(){
      if(request!==state.request)return;
      state.index=index;image.src=ready.src;slider.value=String(index);renderFrameText(frame);loading.classList.add("hidden");
      for(let offset=1;offset<=6;offset++)preload(event.frames[(index+offset)%event.frames.length].src);
      schedule();
    }
    if(ready.complete&&ready.naturalWidth)commit();
    else{
      ready.onload=commit;
      ready.onerror=()=>{if(request!==state.request)return;pause();showLoading('No fue posible cargar este fotograma. Mueve la barra para continuar.');};
      if(ready.complete&&!ready.naturalWidth)ready.onerror();
    }
  }
  function selectStorm(slug){
    const event=data.events[slug];if(!event?.frames.length)return;
    pause();state.event=event;state.slug=slug;state.index=0;
    slider.max=String(event.frames.length-1);slider.value="0";

    selector.querySelectorAll("button").forEach(button=>button.setAttribute("aria-pressed",String(button.dataset.slug===slug)));
    state.playing=!window.matchMedia("(prefers-reduced-motion: reduce)").matches;updateButton();showFrame(0);
  }
  Object.entries(data.events).forEach(([slug,event])=>{
    const button=document.createElement("button");button.className="storm-button";button.type="button";button.dataset.slug=slug;
    const year=event.frames[0]?.utc?.slice(0,4)||event.nhcId?.slice(-4)||"";
    button.textContent=`${event.name.toLocaleUpperCase("es-PR")} ${year}`.trim();button.setAttribute("aria-pressed","false");
    if(!event.frames.length){button.disabled=true;button.textContent+=t(" · pendiente");button.title=t("Fotogramas pendientes de generación");}
    button.addEventListener("click",()=>selectStorm(slug));selector.appendChild(button);
  });
  $("play-button").addEventListener("click",()=>state.playing?pause():play());
  $("replay-button").addEventListener("click",()=>{state.playing=true;updateButton();showFrame(0);});
  slider.addEventListener("input",()=>{pause();showFrame(Number(slider.value));});
  $("speed-select").addEventListener("change",event=>{state.rate=Number(event.target.value);if(state.playing)schedule();});
  $("track-toggle").addEventListener("change",event=>{svg.hidden=!event.target.checked;svg.style.display=event.target.checked?"":"none";});
  document.addEventListener("keydown",event=>{
    if($("notes-dialog").open)return;
    if(/INPUT|SELECT|BUTTON|TEXTAREA|SUMMARY/.test(event.target.tagName))return;
    if(event.code==="Space"){event.preventDefault();state.playing?pause():play();}
    if(event.code==="ArrowRight"||event.code==="ArrowLeft"){event.preventDefault();pause();showFrame(state.index+(event.code==="ArrowRight"?1:-1));}
  });
  const dialog=$("notes-dialog");let pages=[],page=0,noteKind=null;
  function showNote(){
    const menu=document.querySelector(`.note-open[data-note="${noteKind}"]`);
    $("notes-title").textContent=menu.textContent.replace('↗','').trim();
    if(i18n.language==='en')$("notes-content").innerHTML=window.PANEL_NOTES_EN[noteKind][page];
    else $("notes-content").replaceChildren(pages[page].content.cloneNode(true));
    i18n.updateLinks($("notes-content"));
    $("notes-page").textContent=`${page+1} / ${pages.length}`;
    $("notes-prev").disabled=page===0;$("notes-next").disabled=page===pages.length-1;
  }
  document.querySelectorAll('[data-note]:not(template)').forEach(button=>button.addEventListener('click',()=>{
    pause();noteKind=button.dataset.note;pages=[...document.querySelectorAll(`template[data-note="${noteKind}"]`)];page=Number(button.dataset.page||0);
    const menu=document.querySelector(`.note-open[data-note="${button.dataset.note}"]`);
    $("notes-title").textContent=menu.textContent.replace('↗','').trim();showNote();dialog.showModal();
  }));
  $("notes-close").addEventListener('click',()=>dialog.close());
  $("notes-prev").addEventListener('click',()=>{if(page>0){page--;showNote();}});
  $("notes-next").addEventListener('click',()=>{if(page<pages.length-1){page++;showNote();}});
  document.addEventListener('languagechange',()=>{
    updateButton();updateMapScale();loading.textContent=t(loadingMessage);
    if(state.event?.frames[state.index])renderFrameText(state.event.frames[state.index]);
    if(dialog.open)showNote();
    // Deliberately do not restart playback, change frame, speed or map zoom.
  });
  const scene=$("scene"),viewer=scene.parentElement;
  function fitScene(){const w=Math.min(viewer.clientWidth,viewer.clientHeight*width/height);scene.style.width=`${w}px`;scene.style.height=`${w*height/width}px`;}
  new ResizeObserver(fitScene).observe(viewer);fitScene();
  const first=data.events.irma?.frames.length?"irma":Object.keys(data.events).find(slug=>data.events[slug].frames.length);
  if(first)selectStorm(first);else showLoading("Todavía no hay fotogramas generados.");
})();
