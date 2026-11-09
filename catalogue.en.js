// English catalogue text. Official station names, identifiers and measurements stay unchanged.
(() => {
  const strings={
    'Estaciones USGS por evento':'USGS stations by event',
    'Catálogo de estaciones USGS · Lluvia':'USGS station catalogue · Rainfall',
    'Estaciones de lluvia de USGS':'USGS rainfall stations',
    'Eventos':'Events',
    'No se pudo cargar el archivo local de estaciones.':'The local station file could not be loaded.',
    'Irma 2017: 12 · María 2017: 12 · Fiona 2022: 14 · Ernesto 2024: 12. Consulta verificada el 5 de octubre de 2026. Todas corresponden a precipitación, parámetro USGS 00045.':'Irma 2017: 12 · María 2017: 12 · Fiona 2022: 14 · Ernesto 2024: 12. Access verified on October 5, 2026. All records are for precipitation, USGS parameter 00045.',
    'Criterio de selección':'Selection criteria',
    'Se buscaron registros de precipitación del USGS en distintas regiones de Puerto Rico. Se procuró mantener las mismas estaciones en los cuatro eventos. Cuando una estación carecía de registros para un evento, se evaluaron las estaciones cercanas con datos disponibles. Por ejemplo, Río Rosario, en Mayagüez, aparece durante Fiona. Lares se mantiene en los cuatro eventos como parte de la cobertura del interior oeste.':'USGS precipitation records were sought across different regions of Puerto Rico. The selection aimed to retain the same stations across all four events. When a station lacked records for an event, nearby stations with available data were evaluated. For example, Río Rosario, in Mayagüez, appears during Fiona. Lares is retained for all four events as part of the coverage of the western interior.',
    'Costa norte: Barceloneta, Manatí, Arecibo, Hatillo. Suroeste: Guánica, Lajas, Guayanilla, Cabo Rojo, Sabana Grande, Yauco. Interior oeste: Las Marías, Maricao, San Sebastián, Lares.':'North coast: Barceloneta, Manatí, Arecibo, Hatillo. Southwest: Guánica, Lajas, Guayanilla, Cabo Rojo, Sabana Grande, Yauco. Western interior: Las Marías, Maricao, San Sebastián, Lares.',
    'Cada punto muestra la lluvia registrada en su ubicación. Lares se mantiene como parte de la cobertura del interior oeste en los cuatro eventos. Río Rosario aparece en Mayagüez durante Fiona. Vieques A1 Well aparece en Vieques durante Fiona y Ernesto. Para Culebra no se recuperaron registros USGS durante los cuatro eventos.':'Each point shows rainfall recorded at its location. Lares is retained as part of the coverage of the western interior for all four events. Río Rosario appears in Mayagüez during Fiona. Vieques A1 Well appears in Vieques during Fiona and Ernesto. No USGS records were retrieved for Culebra during the four events.',
    'Para la costa norte se utiliza Central Cambalache, Arecibo, en 2017. En Fiona se muestra Río Camuy junto al límite con Hatillo y se utiliza Lago Viví para la cobertura de Utuado. Yauco y Lares se mantienen en los cuatro eventos para los nuevos sectores del suroeste e interior oeste.':'For the north coast, Central Cambalache, Arecibo, is used in 2017. Fiona shows Río Camuy near the boundary with Hatillo, and Lago Viví is used for coverage of Utuado. Yauco and Lares are retained for all four events for the added southwestern and western interior areas.',
    'Zonas consultadas durante la búsqueda':'Areas covered by the search',
    'Estación USGS y municipio':'USGS station and municipality',
    'Coordenadas':'Coordinates', 'Frecuencia y registros':'Reporting interval and records',
    'Criterios y distancias de búsqueda':'Search criteria and distances',
    'Registro completo al cierre':'Complete record at the end of the period',
    'Acumulado con interrupciones':'Accumulation with gaps',
    'Se conserva la estación USGS del sector con datos en los cuatro eventos.':'The area’s USGS station with data for all four events is retained.',
    'Estación seleccionada en la costa norte con registros disponibles para este evento.':'Station selected on the north coast with records available for this event.',
    'Estación del grupo con registros en los cuatro eventos. Se prioriza continuidad entre eventos.':'Station in the group with records for all four events. Continuity across events is prioritized.',
    'Río Icacos, Naguabo, como referencia de El Yunque en los cuatro eventos.':'Río Icacos, Naguabo, as a reference for El Yunque during all four events.',
    'Estación dentro del municipio con registros para este evento.':'Station within the municipality with records for this event.',
    'Sin serie recuperada dentro del grupo. Estación con datos más cercana a sus límites, junto a Hatillo. Distancia aproximada al límite de Hatillo: 0.0 km.':'No series retrieved within the group. The nearest station with data to its boundaries is near Hatillo. Approximate distance to the Hatillo boundary: 0.0 km.',
    'Disponibilidad de lluvia en el oeste':'Rainfall data availability in the west',
    'El catálogo de precipitación instantánea USGS recuperado contiene las siguientes series en Añasco, Hormigueros y Mayagüez. Sus periodos publicados abarcan partes de 2018–2022 y las consultas por evento recuperaron registros para Fiona. Para Cabo Rojo y San Germán no se recuperó una serie de precipitación instantánea en este catálogo ni en los cuatro periodos consultados.':'The retrieved USGS instantaneous precipitation catalogue contains the following series in Añasco, Hormigueros and Mayagüez. Their published periods cover parts of 2018–2022, and records were retrieved for Fiona. No instantaneous precipitation series was retrieved for Cabo Rojo or San Germán in this catalogue or during the four periods checked.',
    'Municipio':'Municipality', 'Estación':'Station',
    'Inicio del registro de lluvia':'Start of rainfall record', 'Fin del registro publicado':'End of published record',
    'Registros por evento':'Records by event',
    'Estas fechas corresponden a precipitación. Los periodos de caudal, nivel u otras variables de cada estación pueden ser diferentes.':'These dates apply to precipitation. The periods for discharge, water level or other variables at each station may differ.',
    'Disponibilidad en el norte y las islas':'Availability in the north and the islands',
    'Central Cambalache, en Arecibo, tiene lluvia publicada para 2017. El registro de Vieques A1 Well comienza el 27 de julio de 2021. Estos periodos explican cuáles eventos cuentan con datos de cada estación.':'Central Cambalache, in Arecibo, has published rainfall data for 2017. The Vieques A1 Well record begins on July 27, 2021. These periods explain which events have data from each station.',
    'Fin publicado en la consulta':'Published end date at the time of access',
    'Eventos con registros recuperados':'Events with retrieved records',
    'Fiona y Ernesto':'Fiona and Ernesto', 'Irma y María':'Irma and María',
    'Se revisó la disponibilidad de lluvia en la costa norte y las islas para los periodos de los cuatro eventos. Cada punto representa la lluvia medida donde está instalada la estación.':'Rainfall data availability on the north coast and the islands was reviewed for the four event periods. Each point represents rainfall measured where the station is installed.',
    'Otras estaciones y fuentes complementarias':'Other stations and supplementary sources',
    'El inventario completo incluye estaciones que no se muestran en el mapa, como Río Guanajibo y Lago Daguey durante Fiona, Arenas 1 Well en Guánica durante Fiona y Ernesto y Bo. Guajataca en San Sebastián durante Ernesto. La selección reducida del mapa facilita comparar regiones y conserva estaciones entre eventos cuando hay datos.':'The complete inventory includes stations not shown on the map, such as Río Guanajibo and Lago Daguey during Fiona, Arenas 1 Well in Guánica during Fiona and Ernesto, and Bo. Guajataca in San Sebastián during Ernesto. The smaller map selection makes regional comparisons easier and retains stations across events when data are available.',
    'También se recuperaron datos de':'Data were also retrieved from',
    'Miradero, Mayagüez, de USDA NRCS/SCAN':'Miradero, Mayagüez, operated by USDA NRCS/SCAN',
    'para Fiona y Ernesto, y registros diarios de':'for Fiona and Ernesto, and daily records from',
    'Culebra Hill, de NOAA/NWS–COOP':'Culebra Hill, operated by NOAA/NWS–COOP',
    'para Irma y María. Los puntos del panel corresponden exclusivamente a USGS.':'for Irma and María. All points on the panel represent USGS stations.',
    'Para consultar la lluvia, abre la página oficial de la estación en USGS Water Data for the Nation, entra en':'To consult rainfall, open the station’s official page in USGS Water Data for the Nation, go to',
    ', selecciona':', select',
    'y establece las fechas del evento. Cada variable tiene su propio periodo disponible.':'and set the event dates. Each variable has its own available period.',
    'Fuentes y registros completos':'Sources and complete records',
    'Inventario completo de estaciones USGS recuperadas':'Complete inventory of retrieved USGS stations',
    '. El archivo contiene 40 estaciones para Irma, 40 para María, 80 para Fiona y 55 para Ernesto.':'. The file contains 40 stations for Irma, 40 for María, 80 for Fiona and 55 for Ernesto.',
    'Documentación de las series instantáneas':'Instantaneous-series documentation',
    'y':'and', 'catálogo de estaciones':'station catalogue',
    'Las respuestas originales del USGS y las consultas utilizadas están en processing/usgs/ del repositorio. La guía de procesamiento explica cómo reproducir la selección y revisar las estaciones candidatas. El mapa muestra únicamente estaciones del USGS.':'The original USGS responses and their queries are in processing/usgs/ in the repository. The processing guide explains how to reproduce the selection and review eligible stations. The map displays USGS stations only.',
    'Este inventario contiene las estaciones de lluvia recuperadas para cada evento: 40 en Irma, 40 en María, 80 en Fiona y 55 en Ernesto. Para consultar la lluvia, abre la página oficial de la estación en USGS Water Data for the Nation, entra en':'This inventory contains the rainfall stations retrieved for each event: 40 for Irma, 40 for María, 80 for Fiona and 55 for Ernesto. To consult rainfall, open the station’s official page in USGS Water Data for the Nation, go to',
    'y establece las fechas del evento. Cada variable tiene su propio periodo disponible. La consulta se verificó el 5 de octubre de 2026. Las descargas originales y sus enlaces están en':'and set the event dates. Each variable has its own available period. Access was verified on October 5, 2026. Original downloads and their links are in',
    ', dentro del proyecto.':', within the project.',
    'El mapa principal presenta una selección de 12 estaciones en Irma, María y Ernesto, y 14 en Fiona. Este inventario conserva también los registros que quedan fuera del mapa. “Registro incompleto” indica que faltan mediciones en parte del periodo. El':'The main map displays a selection of 12 stations for Irma, María and Ernesto, and 14 for Fiona. This inventory also retains records not shown on the map. “Incomplete record” means measurements are missing during part of the period. The',
    'catálogo de estaciones seleccionadas':'selected-station catalogue',
    'explica los criterios, las sustituciones por cercanía y las diferencias de disponibilidad entre eventos.':'explains the criteria, nearby-station substitutions and differences in availability across events.',
    '{total} estaciones consultadas · {start} a {end} · hora de Puerto Rico.':'{total} stations checked · {start} to {end} · Puerto Rico time.',
    'Estación y ficha oficial':'Station and official page', 'Latitud / longitud':'Latitude / longitude',
    'Mediciones disponibles':'Available measurements', 'Registro durante el evento':'Record during the event',
    'Sin observaciones':'No observations', 'Registro incompleto':'Incomplete record', 'Registro completo':'Complete record'
  };
  // Translate repeated catalogue phrases without altering names, dates or numerical values.
  const rules=[
    [/^(.*) · (\d+) estaciones$/, '$1 · $2 stations'],
    [/^(.*?)(\d+) lecturas$/, '$1$2 readings'],
    [/^Periodo UTC: (.*?) a (.*?)\. En el panel se presenta la hora de Puerto Rico \(UTC−4\)\.$/, 'UTC period: $1 to $2. The panel displays Puerto Rico time (UTC−4).'],
    [/^Sin serie recuperada dentro del municipio\. Estación con datos más cercana a su límite entre las estaciones con datos del evento\. Distancia aproximada al límite de (.*?): ([\d.]+) km\.$/, 'No series retrieved within the municipality. Nearest station to its boundary among the stations with data for the event. Approximate distance to the $1 boundary: $2 km.']
  ];
  const walk=document.createTreeWalker(document,NodeFilter.SHOW_TEXT);
  while(walk.nextNode()){
    const n=walk.currentNode;if(n.parentElement?.closest('script,style,template'))continue;
    const key=n.nodeValue.replace(/\s+/g,' ').trim();if(key in strings)continue;
    let en=key;
    for(const [pattern,replacement] of rules)en=en.replace(pattern,replacement);
    en=en.replace(/Costa norte/g,'North coast').replace(/Interior oeste/g,'Western interior').replace(/Suroeste/g,'Southwest');
    if(en!==key)strings[key]=en;
  }
  window.PANEL_EXTRA_STRINGS=strings;
})();
