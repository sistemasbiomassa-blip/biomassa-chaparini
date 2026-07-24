// ==================== MANUTENCAO ====================
var manutFiltro={placa:'',tipo:'',status:[],motorista:'',mesCons:'',dtIni:'',dtFim:''};
var manutMotModo='Ativos'; // filtro Ativos/Inativos/Todos do dropdown de motorista

function buildManutencao(){
  var colors=cc();
  // Compute KM by placa
  var kmByPlaca={};
  DB.cadastro.forEach(function(r){
    if(!r.PLACA||!r.KM) return;
    var placa=String(r.PLACA).replace(/\s+/g,'');
    var km=parseKM(r.KM);
    if(isNaN(km)||km<=0) return;
    if(!kmByPlaca[placa]||km>kmByPlaca[placa]) kmByPlaca[placa]=km;
  });
  // Last maintenance per placa+type
  var lastManut={};
  DB.manutRealizada.forEach(function(r){
    var key=r.PLACA+'|'+r.TIPO_MANUTENCAO;
    if(!lastManut[key]||(r.DATA_MANUTENCAO>lastManut[key].DATA_MANUTENCAO)) lastManut[key]=r;
  });
  var allPlacas=Object.keys(kmByPlaca).sort();
  var progs=DB.manutProgramada.filter(function(p){return p.TIPO_MANUTENCAO&&p.INTERVALO_KM});

  // Build alerts data
  var alertsData=[];
  allPlacas.forEach(function(placa){
    var kmAtual=kmByPlaca[placa];
    var items=[];var worst='g';var hasOnlyX=true;
    progs.forEach(function(prog){
      var key=placa+'|'+prog.TIPO_MANUTENCAO;
      var last=lastManut[key];
      var status,kmRest,proxM;
      if(!last){status='x';kmRest=null;proxM=null;}
      else{
        hasOnlyX=false;
        proxM=num(last.KM_NA_MANUTENCAO)+num(prog.INTERVALO_KM);
        kmRest=proxM-kmAtual;
        if(kmRest<=num(prog.ALERTA_URGENTE)) status='r';
        else if(kmRest<=num(prog['ALERTA ATENCAO'])) status='y';
        else status='g';
      }
      if(status==='r'){worst='r';}
      else if(status==='y'&&worst!=='r'){worst='y';}
      items.push({tipo:prog.TIPO_MANUTENCAO,status:status,kmRest:kmRest,proxM:proxM,intervalo:num(prog.INTERVALO_KM)});
    });
    if(hasOnlyX&&worst==='g') worst='x';
    alertsData.push({placa:placa,kmAtual:kmAtual,items:items,worst:worst});
  });

  // Build filter bar
  var fb=document.getElementById('filtersManut');
  var savedPlaca=document.getElementById('fmDashPlaca')?document.getElementById('fmDashPlaca').value:manutFiltro.placa;
  var savedTipo=document.getElementById('fmDashTipo')?document.getElementById('fmDashTipo').value:manutFiltro.tipo;
  var savedMot=document.getElementById('fmDashMot')?document.getElementById('fmDashMot').value:manutFiltro.motorista;
  var savedDtIni=document.getElementById('fmDashDtIni')?document.getElementById('fmDashDtIni').value:manutFiltro.dtIni;
  var savedDtFim=document.getElementById('fmDashDtFim')?document.getElementById('fmDashDtFim').value:manutFiltro.dtFim;
  manutFiltro.placa=savedPlaca;manutFiltro.tipo=savedTipo;manutFiltro.motorista=savedMot;
  manutFiltro.dtIni=savedDtIni;manutFiltro.dtFim=savedDtFim;

  var motPlacas={};
  DB.cadastro.forEach(function(r){
    if(!r.MOTORISTA||!r.PLACA) return;
    var mot=String(r.MOTORISTA).trim();
    var pl=String(r.PLACA).replace(/\s+/g,'');
    if(!motPlacas[mot]) motPlacas[mot]={};
    motPlacas[mot][pl]=1;
  });
  var allMotManut=Object.keys(motPlacas).sort();
  allMotManut=motoristasFiltrados(allMotManut, manutMotModo); // filtro Ativos/Inativos/Todos

  var fbH='<span class="filter-label">Filtros</span>';
  fbH+=motoristaModoSelectHtml('manutMotModo', manutMotModo, 'buildManutencao');
  fbH+='<select class="filter-select" id="fmDashMot" onchange="manutFiltro.motorista=this.value;buildManutencao()"><option value="">👤 Todos motoristas</option>';
  allMotManut.forEach(function(m){fbH+='<option value="'+m+'"'+(savedMot===m?' selected':'')+'>'+m+'</option>'});
  fbH+='</select>';
  fbH+='<select class="filter-select" id="fmDashPlaca" onchange="manutFiltro.placa=this.value;buildManutencao()"><option value="">🚛 Todas as placas</option>';
  allPlacas.forEach(function(p){fbH+='<option value="'+p+'"'+(savedPlaca===p?' selected':'')+'>'+p+'</option>'});
  fbH+='</select>';
  fbH+='<select class="filter-select" id="fmDashTipo" onchange="manutFiltro.tipo=this.value;buildManutencao()"><option value="">🔧 Todos os tipos</option>';
  progs.forEach(function(p){fbH+='<option value="'+p.TIPO_MANUTENCAO+'"'+(savedTipo===p.TIPO_MANUTENCAO?' selected':'')+'>'+p.TIPO_MANUTENCAO+'</option>'});
  fbH+='</select>';
  fbH+='<div class="filter-sep" style="width:1px;height:24px;background:var(--border);margin:0 6px"></div>';
  var urgTag=manutFiltro.status.indexOf('r')>=0;
  var attTag=manutFiltro.status.indexOf('y')>=0;
  var okTag=manutFiltro.status.indexOf('g')>=0;
  var xTag=manutFiltro.status.indexOf('x')>=0;
  fbH+='<div class="manut-filter-tag'+(urgTag?' active red':'')+'" onclick="toggleManutTag(&#39;r&#39;,this)"><span class="manut-tag-dot" style="background:var(--red)"></span>Urgente</div>';
  fbH+='<div class="manut-filter-tag'+(attTag?' active':'')+'" onclick="toggleManutTag(&#39;y&#39;,this)"><span class="manut-tag-dot" style="background:var(--yellow)"></span>Atenção</div>';
  fbH+='<div class="manut-filter-tag'+(okTag?' active green':'')+'" onclick="toggleManutTag(&#39;g&#39;,this)"><span class="manut-tag-dot" style="background:var(--green)"></span>OK</div>';
  fbH+='<div class="manut-filter-tag'+(xTag?' active':'')+'" onclick="toggleManutTag(&#39;x&#39;,this)"><span class="manut-tag-dot" style="background:var(--text2)"></span>Sem registro</div>';
  fbH+='<div class="filter-sep" style="width:1px;height:24px;background:var(--border);margin:0 6px"></div>';
  fbH+='<div style="display:inline-flex;align-items:center;gap:4px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:2px 6px;font-size:11px;color:var(--text2)">📅 De <input type="date" id="fmDashDtIni" value="'+(savedDtIni||'')+'" onchange="manutFiltro.dtIni=this.value;buildManutencao()" style="border:none;background:transparent;font-size:11px;color:var(--text);font-family:inherit"> até <input type="date" id="fmDashDtFim" value="'+(savedDtFim||'')+'" onchange="manutFiltro.dtFim=this.value;buildManutencao()" style="border:none;background:transparent;font-size:11px;color:var(--text);font-family:inherit"></div>';
  fbH+='<button class="manut-filter-reset" onclick="resetManutFiltros()">↺ Limpar filtros</button>';
  fbH+='<button class="filter-btn-pdf" onclick="exportPagePDF(&#39;filtersManut&#39;)">📄 Exportar PDF</button>';
  fb.innerHTML=fbH;

  // Apply filters
  var filtered=alertsData;
  if(manutFiltro.motorista){
    var motPlacaList=motPlacas[manutFiltro.motorista]||{};
    filtered=filtered.filter(function(a){return motPlacaList[a.placa]});
  }
  if(manutFiltro.placa) filtered=filtered.filter(function(a){return a.placa===manutFiltro.placa});
  if(manutFiltro.status.length>0) filtered=filtered.filter(function(a){return manutFiltro.status.indexOf(a.worst)>=0});

  // Count totals from filtered
  var urgCnt=0,attCnt=0,okCnt=0,semRegCnt=0;
  filtered.forEach(function(a){
    a.items.forEach(function(i){
      if(i.status==='r') urgCnt++;
      else if(i.status==='x') semRegCnt++;
      else if(i.status==='y') attCnt++;
      else okCnt++;
    });
  });

  // Compute fleet km/L
  var totalKm=0,totalLit=0;
  DB.cadastro.forEach(function(r){
    if(r.KM&&r['QTDADE LITROS']&&num(r['QTDADE LITROS'])>0){
      var km=parseKM(r.KM);
      if(!isNaN(km)&&km>0) totalLit+=num(r['QTDADE LITROS']);
    }
  });
  // Simplified: total km range / total liters
  var placaKmRange={};
  DB.cadastro.forEach(function(r){
    if(!r.PLACA||!r.KM) return;
    var placa=String(r.PLACA).replace(/\s+/g,'');
    var km=parseKM(r.KM);
    if(isNaN(km)||km<=0) return;
    if(!placaKmRange[placa]) placaKmRange[placa]={min:km,max:km};
    if(km<placaKmRange[placa].min) placaKmRange[placa].min=km;
    if(km>placaKmRange[placa].max) placaKmRange[placa].max=km;
  });
  Object.keys(placaKmRange).forEach(function(p){totalKm+=placaKmRange[p].max-placaKmRange[p].min});
  var kmPerL=totalLit>0?(totalKm/totalLit):0;

  // Alert bar — only real urgents (KM vencido), not sem registro
  var urgentItems=[];
  filtered.forEach(function(a){
    a.items.forEach(function(i){
      if(i.status==='r') urgentItems.push({placa:a.placa,tipo:i.tipo,km:i.kmRest});
    });
  });
  var alertBar=document.getElementById('manutAlertBar');
  if(urgentItems.length>0){
    var alertTxt='<strong>'+urgentItems.length+' manutenção(ões) com KM vencido</strong> — ';
    alertTxt+=urgentItems.slice(0,3).map(function(u){return '<em>'+u.placa+'</em> '+u.tipo+' ('+Number(u.km).toLocaleString('pt-BR')+' km)'}).join(' · ');
    if(urgentItems.length>3) alertTxt+=' · <em>+'+(urgentItems.length-3)+' mais</em>';
    alertBar.innerHTML='<div class="manut-alert-ico">⚠️</div><div class="manut-alert-txt">'+alertTxt+'</div>';
    alertBar.style.display='flex';
  } else if(semRegCnt>0){
    alertBar.innerHTML='<div class="manut-alert-ico">ℹ️</div><div class="manut-alert-txt"><strong>'+semRegCnt+' itens sem registro</strong> de manutenção — registre em Cadastro → Manutenção Realizada para ativar os alertas.</div>';
    alertBar.style.display='flex';
    alertBar.style.background='rgba(210,153,34,0.08)';alertBar.style.borderColor='rgba(210,153,34,0.25)';
  } else { alertBar.style.display='none'; }

  // KPIs
  document.getElementById('kpiManut').innerHTML=
    '<div class="kpi-card red"><div class="kpi-icon">🔴</div><div class="kpi-value">'+urgCnt+'</div><div class="kpi-label">Urgentes</div></div>'+
    '<div class="kpi-card yellow"><div class="kpi-icon">🟡</div><div class="kpi-value">'+attCnt+'</div><div class="kpi-label">Em Atenção</div></div>'+
    '<div class="kpi-card"><div class="kpi-icon">⚪</div><div class="kpi-value">'+semRegCnt+'</div><div class="kpi-label">Sem Registro</div></div>'+
    '<div class="kpi-card green"><div class="kpi-icon">🚛</div><div class="kpi-value">'+filtered.length+'</div><div class="kpi-label">Caminhões</div></div>';

  // MATRIX TABLE
  var thead='<tr><th>Placa</th>';
  progs.forEach(function(p){
    var short=p.TIPO_MANUTENCAO.replace('Troca de ','').replace('Filtro de ','F.').replace('Alinhamento e Balanceamento','Alinha.').replace('Revisão de Freios','Freios').replace('Troca de Fluido de Arla 32','Arla 32');
    thead+='<th>'+short+'</th>';
  });
  thead+='</tr>';
  document.getElementById('manutMatrizHead').innerHTML=thead;

  var chipLabel={g:'OK',y:'Atenção',r:'Urgente',x:'Sem reg.'};
  var tbody='';
  filtered.forEach(function(a){
    tbody+='<tr><td><span class="manut-placa-tag">'+a.placa+'</span></td>';
    a.items.forEach(function(i){
      // Filter by tipo if active
      if(manutFiltro.tipo&&i.tipo!==manutFiltro.tipo){
        tbody+='<td><span class="manut-chip g"><span class="manut-chip-dot"></span>—</span></td>';
        return;
      }
      tbody+='<td><span class="manut-chip '+i.status+'"><span class="manut-chip-dot"></span>'+chipLabel[i.status]+'</span></td>';
    });
    tbody+='</tr>';
  });
  document.getElementById('manutMatrizBody').innerHTML=tbody;
  document.getElementById('manutBadgeTotal').textContent=filtered.length+' caminhões';

  // KM & PRÓXIMA TROCA (top 5 most urgent for oil change)
  var kmListH='';
  var sorted=filtered.slice().sort(function(a,b){
    var aOil=a.items[0];var bOil=b.items[0];
    var aR=(aOil&&aOil.kmRest!=null)?aOil.kmRest:999999;
    var bR=(bOil&&bOil.kmRest!=null)?bOil.kmRest:999999;
    return aR-bR;
  });
  sorted.slice(0,5).forEach(function(a){
    var oil=a.items[0];
    var prox=oil&&oil.proxM?oil.proxM:0;
    var faltam=oil&&oil.kmRest!=null?oil.kmRest:0;
    var barPct=prox>0?Math.min(Math.max(100-Math.round((a.kmAtual/prox)*100),5),100):5;
    var cor=barPct>40?'g':barPct>15?'y':'r';
    kmListH+='<div class="manut-km-item">';
    kmListH+='<div class="manut-km-placa">'+a.placa+'</div>';
    kmListH+='<div class="manut-km-body"><div class="manut-km-val">'+Number(a.kmAtual).toLocaleString('pt-BR')+' km</div>';
    kmListH+='<div class="manut-km-meta">Próx. troca: '+(prox>0?Number(prox).toLocaleString('pt-BR')+' km':'N/A')+'</div></div>';
    kmListH+='<div class="manut-km-bar-wrap"><div class="manut-km-bar-lbl">faltam</div>';
    kmListH+='<div class="manut-km-bg"><div class="manut-km-fill '+cor+'" style="width:'+barPct+'%"></div></div>';
    kmListH+='<div class="manut-km-rest">'+(faltam!=null?Number(faltam).toLocaleString('pt-BR')+' km':'N/A')+'</div></div>';
    kmListH+='</div>';
  });
  if(filtered.length>5) kmListH+='<div style="text-align:center;padding:10px 0;font-size:11px;color:var(--text2)">+ '+(filtered.length-5)+' caminhões — use o filtro de placa para ver todos</div>';
  document.getElementById('manutKmList').innerHTML=kmListH;

  // CONSUMO MÉDIO movido para a aba Consumo (buildConsumo)

  // HISTÓRICO RECENTE
  var histH='';
  var icons={'Troca de Óleo Motor':'🔧','Filtro de Óleo':'🛢️','Filtro de Ar':'🌬️','Filtro de Combustível':'⛽','Alinhamento e Balanceamento':'🛞','Revisão de Freios':'🛞','Troca de Correia Dentada':'⚙️','Troca de Fluido de Arla 32':'💧'};
  var histFiltrado=DB.manutRealizada.slice();
  // Aplica filtros vigentes ao histórico
  if(manutFiltro.placa) histFiltrado=histFiltrado.filter(function(r){return String(r.PLACA||'').replace(/\s+/g,'')===manutFiltro.placa;});
  if(manutFiltro.tipo) histFiltrado=histFiltrado.filter(function(r){return r.TIPO_MANUTENCAO===manutFiltro.tipo;});
  if(manutFiltro.dtIni || manutFiltro.dtFim){
    histFiltrado=histFiltrado.filter(function(r){return dateInRange(r.DATA_MANUTENCAO,manutFiltro.dtIni,manutFiltro.dtFim);});
  }
  histFiltrado.sort(function(a,b){return(b.DATA_MANUTENCAO||'').localeCompare(a.DATA_MANUTENCAO||'')}).slice(0,6).forEach(function(r){
    var ico=icons[r.TIPO_MANUTENCAO]||'🔧';
    var dt=r.DATA_MANUTENCAO||'';
    if(dt.indexOf('-')>0){var dp=dt.split('-');dt=dp[2]+'/'+dp[1]+'/'+dp[0];}
    histH+='<div class="manut-hist-item">';
    histH+='<div class="manut-hist-ico">'+ico+'</div>';
    histH+='<div class="manut-hist-body"><div class="manut-hist-tipo">'+r.TIPO_MANUTENCAO+'</div>';
    histH+='<div class="manut-hist-meta"><span class="manut-hist-placa-tag">'+r.PLACA+'</span> · '+dt+'</div></div>';
    histH+='<div class="manut-hist-km">'+Number(r.KM_NA_MANUTENCAO).toLocaleString('pt-BR')+' km</div>';
    histH+='</div>';
  });
  if(histH==='') histH='<div style="padding:14px;color:var(--text2);font-size:12px;text-align:center">Sem registros no período/filtro selecionado</div>';
  document.getElementById('manutHistList').innerHTML=histH;
}

function toggleManutTag(cor,el){
  var idx=manutFiltro.status.indexOf(cor);
  if(idx>=0) manutFiltro.status.splice(idx,1);
  else manutFiltro.status.push(cor);
  buildManutencao();
}

function resetManutFiltros(){
  manutFiltro={placa:'',tipo:'',status:[],motorista:'',mesCons:'',dtIni:'',dtFim:''};
  buildManutencao();
}

