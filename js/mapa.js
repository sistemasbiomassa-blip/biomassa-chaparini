// ==================== MAPA ====================
var mapaInstance=null;
var LOCAIS_COORDS={
  // Carga
  'FAZ. ALVORADA':{lat:-7.089551,lng:-48.026917,tipo:'carga'},
  'FAZ. SANTIAGO':{lat:-7.344518,lng:-48.193359,tipo:'carga'},
  'FAZ. PEDRA FURADA':{lat:-10.865908,lng:-47.399536,tipo:'carga'},
  'DEPÓSITO':{lat:-10.184376,lng:-48.301049,tipo:'carga'},
  'DEPOSITO':{lat:-10.184376,lng:-48.301049,tipo:'carga'},
  // Descarga
  'AGROJEM':{lat:-9.574910,lng:-49.728280,tipo:'descarga'},
  'ADM PF':{lat:-6.459100,lng:-47.403410,tipo:'descarga'},
  'CARGILL - PORTO NACIONAL':{lat:-10.608120,lng:-48.374210,tipo:'descarga'},
  'ACP MARIANÓPOLIS':{lat:-9.796610,lng:-49.651560,tipo:'descarga'},
  'ACP MARIANOPOLIS':{lat:-9.796610,lng:-49.651560,tipo:'descarga'},
  'ADM LEM':{lat:-12.111540,lng:-45.959780,tipo:'descarga'},
  'ALZ LUZIMANGUES':{lat:-10.232900,lng:-48.559460,tipo:'descarga'},
  'CARGILL - CAMPOS LINDOS':{lat:-8.088640,lng:-46.661950,tipo:'descarga'},
  'COFCO':{lat:-11.457320,lng:-48.083170,tipo:'descarga'}
};

function buildMapa(){
  var filteredLocal=document.getElementById('fmLocal')?document.getElementById('fmLocal').value:'';
  var filteredMot=document.getElementById('fmMapMot')?document.getElementById('fmMapMot').value:'';

  // Build filter options
  var locais=Object.keys(LOCAIS_COORDS).sort();
  var motoristas=[];var motSet={};
  DB.cadastro.forEach(function(r){if(r.MOTORISTA&&!motSet[r.MOTORISTA]){motSet[r.MOTORISTA]=1;motoristas.push(r.MOTORISTA)}});
  motoristas.sort();

  createFilters('filtersMapa',[
    {id:'fmLocal',label:'Local',options:locais,onChange:buildMapa},
    {id:'fmMapMot',label:'Motorista',options:motoristas,onChange:buildMapa}
  ],null,function(){clearFilters(['fmLocal','fmMapMot'],buildMapa)});

  // Count routes
  var routeCount={};var totalViagens=0;
  DB.cadastro.forEach(function(r){
    if(!r.ENTREGA||!r['LOCAL CARGA']||!r['LOCAL DESCARGA']) return;
    if(filteredMot&&r.MOTORISTA!==filteredMot) return;
    var orig=r['LOCAL CARGA'];var dest=r['LOCAL DESCARGA'];
    if(filteredLocal&&orig!==filteredLocal&&dest!==filteredLocal) return;
    var key=orig+'→'+dest;
    if(!routeCount[key]) routeCount[key]={orig:orig,dest:dest,count:0,ton:0,m3:0};
    routeCount[key].count++;
    if(r.QUANTIDADE){
      if(BASE.clientesM3.includes(dest)) routeCount[key].m3+=r.QUANTIDADE;
      else routeCount[key].ton+=r.QUANTIDADE;
    }
    totalViagens++;
  });

  var cargaCount=0,descargaCount=0;
  Object.keys(LOCAIS_COORDS).forEach(function(k){
    if(LOCAIS_COORDS[k].tipo==='carga') cargaCount++;
    else descargaCount++;
  });

  // KPIs
  document.getElementById('kpiMapa').innerHTML=
    '<div class="kpi-card"><div class="kpi-icon">📍</div><div class="kpi-value">'+Object.keys(LOCAIS_COORDS).length+'</div><div class="kpi-label">Locais Mapeados</div></div>'+
    '<div class="kpi-card green"><div class="kpi-icon">🌲</div><div class="kpi-value">'+cargaCount+'</div><div class="kpi-label">Locais de Carga</div></div>'+
    '<div class="kpi-card"><div class="kpi-icon">🏭</div><div class="kpi-value">'+descargaCount+'</div><div class="kpi-label">Locais de Descarga</div></div>'+
    '<div class="kpi-card"><div class="kpi-icon">🚚</div><div class="kpi-value">'+numBR(totalViagens)+'</div><div class="kpi-label">Viagens nas Rotas</div></div>';

  // Build map
  if(mapaInstance){mapaInstance.remove();mapaInstance=null;}
  mapaInstance=L.map('mapContainer').setView([-9.5,-48.0],6);
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{
    attribution:'© Esri',maxZoom:18
  }).addTo(mapaInstance);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png',{
    maxZoom:18,pane:'overlayPane'
  }).addTo(mapaInstance);

  // Load Brazilian state boundaries
  fetch('https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/brazil-states.geojson')
    .then(function(r){return r.json()})
    .then(function(geojson){
      L.geoJSON(geojson,{
        style:{color:'#facc15',weight:1.5,opacity:0.6,fillColor:'transparent',fillOpacity:0,dashArray:'4 3'},
        onEachFeature:function(feature,layer){
          layer.bindTooltip(feature.properties.name,{permanent:false,direction:'center',className:'state-tooltip'});
        }
      }).addTo(mapaInstance);
    }).catch(function(){});

  // Custom icons
  var iconCarga=L.divIcon({className:'',html:'<div style="background:#22c55e;color:#fff;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;border:2px solid #fff;box-shadow:0 2px 10px rgba(34,197,94,0.5)">🌲</div>',iconSize:[30,30],iconAnchor:[15,15]});
  var iconDescarga=L.divIcon({className:'',html:'<div style="background:#3b82f6;color:#fff;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;border:2px solid #fff;box-shadow:0 2px 10px rgba(59,130,246,0.5)">🏭</div>',iconSize:[30,30],iconAnchor:[15,15]});

  // Add markers
  var bounds=[];
  Object.keys(LOCAIS_COORDS).forEach(function(name){
    var loc=LOCAIS_COORDS[name];
    if(filteredLocal&&name!==filteredLocal) {
      // Still show but dimmed if not the filtered one
    }
    var icon=loc.tipo==='carga'?iconCarga:iconDescarga;
    var marker=L.marker([loc.lat,loc.lng],{icon:icon}).addTo(mapaInstance);
    var popupHtml='<div style="font-family:Outfit,sans-serif;min-width:160px">'+
      '<strong style="font-size:13px;color:#1f2937">'+name+'</strong><br>'+
      '<span style="font-size:11px;color:#888;text-transform:uppercase">'+loc.tipo+'</span><br>'+
      '<span style="font-size:10px;color:#888;font-family:JetBrains Mono,monospace">'+loc.lat.toFixed(4)+', '+loc.lng.toFixed(4)+'</span></div>';
    marker.bindPopup(popupHtml);
    bounds.push([loc.lat,loc.lng]);
  });

  // Draw route lines using OpenRouteService
  var ORS_KEY='eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6Ijk4OWMwNWFhYTAxZDQ1OTlhZjAwMDNiNjg1NjJlZjQwIiwiaCI6Im11cm11cjY0In0=';
  var routes=Object.values(routeCount);
  var maxCount=Math.max.apply(null,routes.map(function(r){return r.count}).concat([1]));
  var routeCache={};

  function drawORSRoute(route,idx){
    var origCoord=LOCAIS_COORDS[route.orig];
    var destCoord=LOCAIS_COORDS[route.dest];
    if(!origCoord||!destCoord) return;
    var weight=Math.max(2,Math.min(8,(route.count/maxCount)*8));
    var opacity=Math.max(0.4,Math.min(0.9,(route.count/maxCount)*0.9));
    var volTxt=route.ton>0?numBR(route.ton,1)+' TON':'';
    if(route.m3>0) volTxt+=(volTxt?' + ':'')+numBR(route.m3,1)+' M³';
    var cacheKey=origCoord.lat+','+origCoord.lng+'→'+destCoord.lat+','+destCoord.lng;

    function drawLine(coords,dist,dur){
      var line=L.polyline(coords,{color:'#00e5ff',weight:weight,opacity:opacity,smoothFactor:1}).addTo(mapaInstance);
      var distTxt=dist?numBR(dist/1000,1)+' km':'';
      var durTxt=dur?Math.round(dur/3600)+'h'+Math.round((dur%3600)/60)+'min':'';
      line.bindPopup('<div style="font-family:Outfit,sans-serif;min-width:200px">'+
        '<strong style="font-size:12px;color:#1f2937">'+route.orig+' → '+route.dest+'</strong><br>'+
        '<span style="font-size:11px;color:#3b82f6;font-weight:600">'+route.count+' viagens</span><br>'+
        (distTxt?'<span style="font-size:11px;color:#22c55e">📏 '+distTxt+'</span><br>':'')+
        (durTxt?'<span style="font-size:11px;color:#f97316">⏱ '+durTxt+'</span><br>':'')+
        '<span style="font-size:10px;color:#888">'+volTxt+'</span></div>');
      route._dist=dist;route._dur=dur;
      updateRouteTable();
    }

    if(routeCache[cacheKey]){
      drawLine(routeCache[cacheKey].coords,routeCache[cacheKey].dist,routeCache[cacheKey].dur);
      return;
    }

    // Fallback: straight line while loading
    var fallbackLine=L.polyline([[origCoord.lat,origCoord.lng],[destCoord.lat,destCoord.lng]],{
      color:'#00e5ff',weight:weight,opacity:opacity*0.4,dashArray:'8 4'
    }).addTo(mapaInstance);

    // Fetch real route from ORS (with delay to respect rate limit)
    setTimeout(function(){
      fetch('https://api.openrouteservice.org/v2/directions/driving-hgv?start='+origCoord.lng+','+origCoord.lat+'&end='+destCoord.lng+','+destCoord.lat,{
        headers:{'Authorization':ORS_KEY}
      }).then(function(r){return r.json()}).then(function(data){
        if(data.features&&data.features[0]){
          var geom=data.features[0].geometry.coordinates;
          var coords=geom.map(function(c){return [c[1],c[0]]});
          var props=data.features[0].properties.summary;
          var dist=props?props.distance:null;
          var dur=props?props.duration:null;
          routeCache[cacheKey]={coords:coords,dist:dist,dur:dur};
          mapaInstance.removeLayer(fallbackLine);
          drawLine(coords,dist,dur);
        }
      }).catch(function(){
        // Keep fallback line on error
        fallbackLine.bindPopup('<div style="font-family:Outfit,sans-serif;min-width:180px">'+
          '<strong style="font-size:12px;color:#1f2937">'+route.orig+' → '+route.dest+'</strong><br>'+
          '<span style="font-size:11px;color:#3b82f6;font-weight:600">'+route.count+' viagens</span><br>'+
          '<span style="font-size:10px;color:#888">'+volTxt+'</span><br>'+
          '<span style="font-size:9px;color:#ef4444">⚠ Rota real indisponível</span></div>');
      });
    },idx*1600); // Stagger requests: 1.6s apart to respect 40/min limit
  }

  routes.forEach(function(route,idx){drawORSRoute(route,idx)});

  if(bounds.length>0) mapaInstance.fitBounds(bounds,{padding:[30,30]});

  // Table of routes (updated as real routes load)
  function updateRouteTable(){
    var tH='<div class="table-header"><h3>Rotas Registradas</h3><span class="chart-badge">'+routes.length+' rotas</span></div><div class="table-scroll"><table><thead><tr><th>Origem</th><th>Destino</th><th>Viagens</th><th>Distância</th><th>Tempo</th><th>Volume TON</th><th>Volume M³</th></tr></thead><tbody>';
    routes.sort(function(a,b){return b.count-a.count}).forEach(function(r){
      var distTxt=r._dist?numBR(r._dist/1000,1)+' km':'carregando...';
      var durTxt=r._dur?Math.round(r._dur/3600)+'h'+Math.round((r._dur%3600)/60)+'min':'—';
      tH+='<tr><td style="color:#22c55e;font-weight:500">'+r.orig+'</td><td style="color:#3b82f6;font-weight:500">'+r.dest+'</td><td style="font-family:JetBrains Mono,monospace;font-size:11px;font-weight:600">'+r.count+'</td><td style="font-family:JetBrains Mono,monospace;font-size:11px;color:#22c55e">'+distTxt+'</td><td style="font-family:JetBrains Mono,monospace;font-size:11px;color:#f97316">'+durTxt+'</td><td style="font-family:JetBrains Mono,monospace;font-size:11px">'+numBR(r.ton,1)+'</td><td style="font-family:JetBrains Mono,monospace;font-size:11px">'+numBR(r.m3,1)+'</td></tr>';
    });
    tH+='</tbody></table></div>';
    document.getElementById('tblMapa').innerHTML=tH;
  }
  updateRouteTable();

  // Fix map rendering after display
  setTimeout(function(){mapaInstance.invalidateSize()},200);
}

