(() => {
  'use strict';
  // Spanish is the default on every fresh visit. No browser-language detection.
  let language = new URLSearchParams(location.search).get('lang') === 'en' ? 'en' : 'es';
  const strings = {
    'Idioma':'Language', 'Seleccionar idioma':'Select language',
    'Huracanes y lluvia acumulada · Puerto Rico':'Hurricanes and accumulated rainfall · Puerto Rico',
    'Irma, María, Fiona y Ernesto: imágenes GOES, trayectoria NHC, lluvia NWS/NCEP y registros de precipitación de estaciones USGS.':'Irma, María, Fiona and Ernesto: GOES imagery, NHC tracks, NWS/NCEP rainfall and USGS rain-gauge records.',
    'Ciclón y reproducción':'Cyclone and playback', 'Escoger sistema tropical':'Choose a tropical cyclone',
    'Animación satelital y trayectoria':'Satellite animation and track',
    'Contorno de Puerto Rico y sus islas':'Outline of Puerto Rico and its islands',
    'Trayectoria recorrida y posiciones oficiales':'Track to the current time and official positions',
    'Orientación y escala del mapa':'Map orientation and scale', 'Norte geográfico':'Geographic north',
    'Escala de distancia en kilómetros':'Distance scale in kilometers',
    'Controles de la animación':'Animation controls', 'Cargando imagen…':'Loading image…',
    'REPRODUCIR':'PLAY', 'PAUSA':'PAUSE', 'REPETIR':'REPLAY',
    'Pausar':'Pause', 'Reproducir':'Play', 'Repetir desde el inicio':'Replay from the beginning',
    'Fotograma':'Image', 'Reproducción':'Playback', 'Velocidad de reproducción':'Playback speed',
    'hora de Puerto Rico (UTC−4)':'Puerto Rico time (UTC−4)', 'Leyenda de intensidad':'Intensity legend',
    'Tormenta tropical':'Tropical storm', 'Depresión tropical':'Tropical depression',
    'Huracán':'Hurricane', 'Categoría {n}':'Category {n}',
    'Contorno de Puerto Rico':'Puerto Rico outline', 'Mostrar trayectoria':'Show track',
    'Lluvia y datos del ciclón':'Rainfall and cyclone data', 'Lluvia acumulada':'Accumulated rainfall',
    'Acercar el mapa de lluvia':'Zoom the rainfall map', 'Acercar el mapa':'Zoom in',
    'Alejar el mapa':'Zoom out', 'Ver Puerto Rico completo':'Show all of Puerto Rico',
    'Lluvia estimada, municipios y estaciones de lluvia observada':'Estimated rainfall, municipalities and rain gauges',
    'Leyenda de lluvia acumulada en pulgadas':'Accumulated rainfall legend in inches',
    'Tiene todas las lecturas esperadas en su periodo de acumulación':'All expected readings are available for its accumulation period',
    'Hay lecturas recientes, pero faltan registros anteriores':'Recent readings are available, but some earlier readings are missing',
    'Falta la última lectura esperada según la frecuencia de la estación':'The latest expected reading is missing based on the station’s reporting interval',
    '● Registro completo':'● Complete record', '△ Incompleto':'△ Incomplete', '× Lectura faltante':'× Missing reading',
    'Información del ciclón':'Cyclone information', 'Velocidad de traslación':'Forward speed',
    'Viento máximo sostenido':'Maximum sustained wind', 'Presión central mínima':'Minimum central pressure',
    'Posición del centro del ciclón':'Cyclone center position',
    'Posición estimada del centro del ciclón':'Estimated cyclone center position',
    'Información y fuentes':'Information and sources', 'Fuentes de los datos':'Data sources',
    'Las imágenes y la animación':'Imagery and animation', 'Créditos y tecnologías utilizadas':'Credits and technologies',
    'Cerrar información':'Close information', '← Anterior':'← Previous', 'Siguiente →':'Next →',
    'No se encontraron los datos del panel.':'The panel data could not be found.',
    'Sin posición válida para esta hora':'No valid position for this time', 'No disponible':'Unavailable',
    'Sin registro':'No record', 'Centro del ciclón fuera del área de la imagen':'Cyclone center outside the image area',
    'Escala de {distance} kilómetros, válida a {latitude} grados norte':'Scale of {distance} kilometers, valid at {latitude} degrees north',
    'Escala horizontal a {latitude}° N':'Horizontal scale at {latitude}° N',
    'Imagen {current} de {total}':'Image {current} of {total}',
    'DÍA':'DAY', 'NOCHE':'NIGHT', 'TRANSICIÓN':'TRANSITION',
    'intensidad no disponible':'intensity unavailable',
    'No fue posible cargar este fotograma. Mueve la barra para continuar.':'This image could not be loaded. Move the slider to continue.',
    ' · pendiente':' · pending', 'Fotogramas pendientes de generación':'Images have not yet been generated',
    'Todavía no hay fotogramas generados.':'No images have been generated yet.',
    'No se cargaron los datos de lluvia.':'Rainfall data could not be loaded.',
    'Lluvia acumulada (pulgadas)':'Accumulated rainfall (inches)',
    'Faltan datos para calcular la lluvia de este lugar':'Rainfall data are missing for this location',
    'Lluvia estimada: {value} pulgadas':'Estimated rainfall: {value} inches',
    'Cerrar estación':'Close station', 'Sin lecturas hasta este momento':'No readings available up to this time',
    'Lluvia registrada: {value} pulgadas':'Recorded rainfall: {value} inches',
    ' · acumulado incompleto':' · incomplete accumulation', 'Ubicación: {name}':'Location: {name}',
    'Lecturas cada {minutes} minutos':'Readings every {minutes} minutes',
    'Última lectura: {date} (UTC−4)':'Last reading: {date} (UTC−4)',
    'Sin lectura desde el inicio del acumulado':'No reading since the accumulation period began',
    'Faltan mediciones desde {date}':'Readings missing since {date}',
    'La estación volvió a registrar. Faltan algunas lecturas anteriores.':'The station resumed recording. Some earlier readings are missing.',
    'Observaciones aprobadas por USGS':'USGS-approved observations',
    'Incluye observaciones provisionales USGS':'Includes provisional USGS observations',
    'Estado de revisión no disponible':'Review status unavailable', 'Ficha de la estación ↗':'Station page ↗',
    'sin lectura':'no reading', '{value} pulgadas':'{value} inches', ', acumulado parcial':', partial accumulation',
    '{total} estaciones del USGS · {missing} con lecturas faltantes.':'{total} USGS stations · {missing} with missing readings.',
    'Sin datos de lluvia para este evento.':'No rainfall data for this event.',
    'Desde {date}':'From {date}', 'Hasta {date} · hora de Puerto Rico (UTC−4)':'Through {date} · Puerto Rico time (UTC−4)',
    'Lluvia acumulada estimada de {event} hasta {date}, con registros de estaciones USGS.':'Estimated accumulated rainfall for {event} through {date}, with USGS station records.',
    '← Volver al panel':'← Back to the panel', 'Volver al panel':'Back to the panel'
  };
  Object.assign(strings,window.PANEL_EXTRA_STRINGS||{});
  for (let n=1;n<=5;n++) strings[`Categoría ${n}`]=`Category ${n}`;
  const entries=[];
  const clean=s=>s.replace(/\s+/g,' ').trim();
  const t=(key,values={})=>{
    const translated=language==='en'?(strings[key]??key):key;
    return translated.replace(/\{(\w+)\}/g,(_,name)=>values[name]??`{${name}}`);
  };
  const dateFormats=Object.fromEntries([['es','es-PR'],['en','en-US']].map(([lang,locale])=>[lang,new Intl.DateTimeFormat(locale,{
    timeZone:'America/Puerto_Rico',day:'numeric',month:'short',year:'numeric',hour:'numeric',minute:'2-digit',hour12:true
  })]));
  const date=value=>dateFormats[language].format(new Date(value));
  const intensity=record=>{
    let label=record?.label?.replace('categoría','Categoría').replace(/\s*·\s*/g,' ')||t('intensidad no disponible');
    if(language==='en') label=label.replace('Huracán','Hurricane').replace('Categoría','Category').replace('Tormenta tropical','Tropical storm').replace('Depresión tropical','Tropical depression');
    return label;
  };
  function capture(root){
    const walk=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    while(walk.nextNode()){
      const node=walk.currentNode,key=clean(node.nodeValue);
      if(node.parentElement?.closest('script,style,template,option')||!(key in strings))continue;
      entries.push({node,key,original:node.nodeValue});
    }
    for(const el of root.querySelectorAll('[aria-label],[title],meta[name="description"]')){
      for(const attr of ['aria-label','title','content']){
        const key=el.getAttribute(attr);if(key in strings)entries.push({node:el,attr,key});
      }
    }
  }
  function updateLinks(root=document){
    for(const a of root.querySelectorAll('a[href]')){
      const raw=a.getAttribute('href');
      if(!/^(?:index|estaciones_campo|estaciones_usgs|estaciones_scan)\.html(?:[?#]|$)/.test(raw))continue;
      const url=new URL(raw,location.href);
      if(language==='en')url.searchParams.set('lang','en');else url.searchParams.delete('lang');
      a.setAttribute('href',url.pathname.split('/').pop()+url.search+url.hash);
    }
  }
  function setLanguage(value){
    language=value==='en'?'en':'es';document.documentElement.lang=language;
    for(const entry of entries){
      if(entry.attr)entry.node.setAttribute(entry.attr,t(entry.key));
      else entry.node.nodeValue=language==='es'?entry.original:entry.original.replace(entry.original.trim(),t(entry.key));
    }
    document.querySelectorAll('.language-select').forEach(s=>s.value=language);
    updateLinks();document.dispatchEvent(new CustomEvent('languagechange',{detail:{language}}));
  }
  function mount(){
    const bar=document.createElement('div');bar.className='language-bar';
    const label=document.createElement('label'),name=document.createElement('span'),select=document.createElement('select');
    name.textContent='Idioma';select.className='language-select';select.id='language-select';select.setAttribute('aria-label','Seleccionar idioma');
    for(const [value,text] of [['es','Español'],['en','English']]){const option=document.createElement('option');option.value=value;option.textContent=text;select.append(option);}
    label.append(name,select);bar.append(label);
    const mapTools=document.querySelector('.app-shell .map-tools');
    if(mapTools){
      bar.classList.add('language-toolbar');name.className='language-caption';
      const cartography=document.querySelector('.rain-cartography');
      const controls=document.createElement('div');controls.className='map-tools rain-map-controls';
      controls.setAttribute('aria-label',mapTools.getAttribute('aria-label'));
      for(const button of [...mapTools.querySelectorAll('button')])controls.append(button);
      cartography.prepend(controls);
      mapTools.setAttribute('aria-label','Seleccionar idioma');
      select.setAttribute('title','Seleccionar idioma');mapTools.append(bar);
    }else document.body.prepend(bar);
    select.addEventListener('change',()=>setLanguage(select.value));
  }
  window.PanelI18n={t,date,intensity,updateLinks,setLanguage,get language(){return language;},strings};
  mount();capture(document);setLanguage(language);
})();
