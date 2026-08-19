// ==================== MANUTENCAO ====================
var manutFiltro={placa:'',tipo:'',status:[],motorista:'',mesCons:'',dtIni:'',dtFim:''};
var manutMotModo='Ativos'; // filtro Ativos/Inativos/Todos do dropdown de motorista
var manutViewAtual='fora'; // 'fora' ou 'garantia'

// Dispatcher: constrói as duas visões (Fora de Garantia / Em Garantia) e o
// Detalhamento, que é comum às duas. Chamado por navigateTo/switchTab e por
// qualquer tela que altera dados de manutenção (garantia, catálogo de tipos, etc).
function buildManutencao(){
  buildManutencaoFora();
  buildManutencaoGarantia();
  buildManutDetalhamento();
}

function showManutView(view){
  manutViewAtual=view;
  document.getElementById('manutViewFora').style.display=view==='fora'?'':'none';
  document.getElementById('manutViewGarantia').style.display=view==='garantia'?'':'none';
  document.getElementById('manutTabBtnFora').classList.toggle('active',view==='fora');
  document.getElementById('manutTabBtnGarantia').classList.toggle('active',view==='garantia');
}

// ---------- Helpers compartilhados entre Fora de Garantia e Em Garantia ----------
function _manutCalcKmByPlaca(){
  var kmByPlaca={};
  DB.cadastro.forEach(function(r){
    if(!r.PLACA) return;
    var placa=String(r.PLACA).replace(/\s+/g,'');
    if(kmByPlaca[placa]!==undefined) return;
    var km=kmAtualPorPlaca(placa);
    if(km!==null) kmByPlaca[placa]=km;
  });
  return kmByPlaca;
}
function _manutCalcLastManut(){
  var lastManut={};
  DB.manutRealizada.forEach(function(r){
    var key=r.PLACA+'|'+r.TIPO_MANUTENCAO;
    if(!lastManut[key]||(r.DATA_MANUTENCAO>lastManut[key].DATA_MANUTENCAO)) lastManut[key]=r;
  });
  return lastManut;
}
// Status de um item (placa+tipo) dado o programa (intervalo/alertas), o último
// registro de manutenção e o km atual da placa.
function _manutStatusItem(prog,last,kmAtual){
  var status,kmRest,proxM;
  if(!last){status='x';kmRest=null;proxM=null;}
  else{
    proxM=num(last.KM_NA_MANUTENCAO)+num(prog.INTERVALO_KM);
    kmRest=proxM-kmAtual;
    if(kmRest<=num(prog.ALERTA_URGENTE)) status='r';
    else if(kmRest<=num(prog['ALERTA ATENCAO'])) status='y';
    else status='g';
  }
  return {status:status,kmRest:kmRest,proxM:proxM};
}

function buildManutencaoFora(){
  var colors=cc();
  var kmByPlaca=_manutCalcKmByPlaca();
  var lastManut=_manutCalcLastManut();
  // Fora de garantia = todas as placas com km conhecido, exceto as com garantia ainda ativa
  var allPlacas=Object.keys(kmByPlaca).filter(function(p){return !placaEmGarantiaAtiva(p)}).sort();
  var progs=DB.manutProgramada.filter(function(p){return p.TIPO_MANUTENCAO&&p.INTERVALO_KM});

  // Build alerts data
  var alertsData=[];
  allPlacas.forEach(function(placa){
    var kmAtual=kmByPlaca[placa];
    var items=[];var worst='g';var hasOnlyX=true;
    progs.forEach(function(prog){
      var key=placa+'|'+prog.TIPO_MANUTENCAO;
      var last=lastManut[key];
      var st=_manutStatusItem(prog,last,kmAtual);
      if(last) hasOnlyX=false;
      if(st.status==='r'){worst='r';}
      else if(st.status==='y'&&worst!=='r'){worst='y';}
      items.push({tipo:prog.TIPO_MANUTENCAO,status:st.status,kmRest:st.kmRest,proxM:st.proxM,intervalo:num(prog.INTERVALO_KM)});
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
  buildManutencaoFora();
}

function resetManutFiltros(){
  manutFiltro={placa:'',tipo:'',status:[],motorista:'',mesCons:'',dtIni:'',dtFim:''};
  buildManutencaoFora();
}

// ==================== EM GARANTIA ====================
var manutGarFiltro={placa:'',tipo:'',status:[]};

function buildManutencaoGarantia(){
  var kmByPlaca=_manutCalcKmByPlaca();
  var lastManut=_manutCalcLastManut();
  var garantiasAtivas=DB.garantiaCaminhoes.filter(garantiaEstaAtiva);

  var fb=document.getElementById('filtersManutGar');
  var savedPlaca=document.getElementById('fgDashPlaca')?document.getElementById('fgDashPlaca').value:manutGarFiltro.placa;
  var savedTipo=document.getElementById('fgDashTipo')?document.getElementById('fgDashTipo').value:manutGarFiltro.tipo;
  manutGarFiltro.placa=savedPlaca; manutGarFiltro.tipo=savedTipo;

  var placasGar=garantiasAtivas.map(function(g){return g.PLACA}).sort();
  var tiposGar=[],tipoSet={};
  DB.manutProgramadaGarantia.forEach(function(m){ if(!tipoSet[m.TIPO_MANUTENCAO]){tipoSet[m.TIPO_MANUTENCAO]=1;tiposGar.push(m.TIPO_MANUTENCAO);} });
  tiposGar.sort();

  var fbH='<span class="filter-label">Filtros</span>';
  fbH+='<select class="filter-select" id="fgDashPlaca" onchange="manutGarFiltro.placa=this.value;buildManutencaoGarantia()"><option value="">🚛 Todas as placas</option>';
  placasGar.forEach(function(p){fbH+='<option value="'+p+'"'+(savedPlaca===p?' selected':'')+'>'+p+'</option>'});
  fbH+='</select>';
  fbH+='<select class="filter-select" id="fgDashTipo" onchange="manutGarFiltro.tipo=this.value;buildManutencaoGarantia()"><option value="">🔧 Todos os tipos</option>';
  tiposGar.forEach(function(t){fbH+='<option value="'+t+'"'+(savedTipo===t?' selected':'')+'>'+t+'</option>'});
  fbH+='</select>';
  fbH+='<div class="filter-sep" style="width:1px;height:24px;background:var(--border);margin:0 6px"></div>';
  var urgTag=manutGarFiltro.status.indexOf('r')>=0;
  var attTag=manutGarFiltro.status.indexOf('y')>=0;
  var okTag=manutGarFiltro.status.indexOf('g')>=0;
  fbH+='<div class="manut-filter-tag'+(urgTag?' active red':'')+'" onclick="toggleManutGarTag(&#39;r&#39;,this)"><span class="manut-tag-dot" style="background:var(--red)"></span>Urgente</div>';
  fbH+='<div class="manut-filter-tag'+(attTag?' active':'')+'" onclick="toggleManutGarTag(&#39;y&#39;,this)"><span class="manut-tag-dot" style="background:var(--yellow)"></span>Atenção</div>';
  fbH+='<div class="manut-filter-tag'+(okTag?' active green':'')+'" onclick="toggleManutGarTag(&#39;g&#39;,this)"><span class="manut-tag-dot" style="background:var(--green)"></span>OK</div>';
  fbH+='<button class="manut-filter-reset" onclick="resetManutGarFiltros()">↺ Limpar filtros</button>';
  fbH+='<button class="filter-btn-pdf" onclick="exportPagePDF(&#39;filtersManutGar&#39;)">📄 Exportar PDF</button>';
  fb.innerHTML=fbH;

  var rows=[];
  garantiasAtivas.forEach(function(g){
    if(manutGarFiltro.placa && g.PLACA!==manutGarFiltro.placa) return;
    var kmAtual=kmByPlaca[g.PLACA]||0;
    var intervals=DB.manutProgramadaGarantia.filter(function(m){return m.PLACA===g.PLACA});
    intervals.forEach(function(prog){
      if(manutGarFiltro.tipo && prog.TIPO_MANUTENCAO!==manutGarFiltro.tipo) return;
      var key=g.PLACA+'|'+prog.TIPO_MANUTENCAO;
      var last=lastManut[key];
      var st=_manutStatusItem(prog,last,kmAtual);
      if(manutGarFiltro.status.length>0 && manutGarFiltro.status.indexOf(st.status)<0) return;
      rows.push({placa:g.PLACA,garantia:g,kmAtual:kmAtual,tipo:prog.TIPO_MANUTENCAO,intervalo:num(prog.INTERVALO_KM),status:st.status,kmRest:st.kmRest,proxM:st.proxM});
    });
  });

  var urgCnt=rows.filter(function(r){return r.status==='r'}).length;
  var attCnt=rows.filter(function(r){return r.status==='y'}).length;
  var okCnt=rows.filter(function(r){return r.status==='g'}).length;
  document.getElementById('kpiManutGar').innerHTML=
    '<div class="kpi-card red"><div class="kpi-icon">🔴</div><div class="kpi-value">'+urgCnt+'</div><div class="kpi-label">Urgentes</div></div>'+
    '<div class="kpi-card yellow"><div class="kpi-icon">🟡</div><div class="kpi-value">'+attCnt+'</div><div class="kpi-label">Em Atenção</div></div>'+
    '<div class="kpi-card green"><div class="kpi-icon">🟢</div><div class="kpi-value">'+okCnt+'</div><div class="kpi-label">OK</div></div>'+
    '<div class="kpi-card"><div class="kpi-icon">🛡️</div><div class="kpi-value">'+garantiasAtivas.length+'</div><div class="kpi-label">Caminhões em Garantia</div></div>';

  var chipLabel={g:'OK',y:'Atenção',r:'Urgente',x:'Sem reg.'};
  var mono='font-family:JetBrains Mono,monospace;font-size:11px';
  rows.sort(function(a,b){ return (a.placa+a.tipo).localeCompare(b.placa+b.tipo); });
  var tbody='';
  rows.forEach(function(r){
    var g=r.garantia;
    var faltamTxt=r.kmRest!=null?Number(r.kmRest).toLocaleString('pt-BR')+' km':'N/A';
    tbody+='<tr><td><span class="manut-placa-tag">'+r.placa+'</span></td>'+
      '<td style="'+mono+'">'+formatDateBR(g.DATA_FIM)+' · '+Number(g.KM_LIMITE).toLocaleString('pt-BR')+' km</td>'+
      '<td>'+r.tipo+'</td>'+
      '<td style="'+mono+'">'+r.intervalo.toLocaleString('pt-BR')+' km</td>'+
      '<td style="'+mono+'">'+Number(r.kmAtual).toLocaleString('pt-BR')+'</td>'+
      '<td style="'+mono+'">'+(r.proxM?Number(r.proxM).toLocaleString('pt-BR'):'N/A')+'</td>'+
      '<td style="'+mono+'">'+faltamTxt+'</td>'+
      '<td><span class="manut-chip '+r.status+'"><span class="manut-chip-dot"></span>'+chipLabel[r.status]+'</span></td></tr>';
  });
  document.getElementById('manutGarTableBody').innerHTML=tbody||'<tr><td colspan="8" style="text-align:center;padding:20px;color:var(--text2)">Nenhum caminhão em garantia com intervalo cadastrado.</td></tr>';
  document.getElementById('manutGarBadgeTotal').textContent=garantiasAtivas.length+' caminhões';
}
function toggleManutGarTag(cor,el){
  var idx=manutGarFiltro.status.indexOf(cor);
  if(idx>=0) manutGarFiltro.status.splice(idx,1);
  else manutGarFiltro.status.push(cor);
  buildManutencaoGarantia();
}
function resetManutGarFiltros(){
  manutGarFiltro={placa:'',tipo:'',status:[]};
  buildManutencaoGarantia();
}

// ==================== DETALHAMENTO DE MANUTENÇÃO ====================
function buildManutDetalhamento(){
  var uPlaca=[],uTipo=[],plaSet={},tipoSet={};
  DB.manutRealizada.forEach(function(r){
    if(r.PLACA&&!plaSet[r.PLACA]){plaSet[r.PLACA]=1;uPlaca.push(r.PLACA)}
    if(r.TIPO_MANUTENCAO&&!tipoSet[r.TIPO_MANUTENCAO]){tipoSet[r.TIPO_MANUTENCAO]=1;uTipo.push(r.TIPO_MANUTENCAO)}
  });
  uPlaca.sort();uTipo.sort();

  createFilters('filtersManutDet',[
    {id:'fmdPlaca',label:'Placa',options:uPlaca,onChange:buildManutDetalhamento},
    {id:'fmdTipo',label:'Tipo',options:uTipo,onChange:buildManutDetalhamento},
    {type:'dateRange',idIni:'fmdDtIni',idFim:'fmdDtFim',onChange:buildManutDetalhamento}
  ], '', function(){ clearFilters(['fmdPlaca','fmdTipo','fmdDtIni','fmdDtFim'],buildManutDetalhamento); });

  var fPlaca=(document.getElementById('fmdPlaca')||{}).value||'';
  var fTipo=(document.getElementById('fmdTipo')||{}).value||'';
  var fDtIni=(document.getElementById('fmdDtIni')||{}).value||'';
  var fDtFim=(document.getElementById('fmdDtFim')||{}).value||'';

  var rows=DB.manutRealizada.filter(function(r){
    if(fPlaca && r.PLACA!==fPlaca) return false;
    if(fTipo && r.TIPO_MANUTENCAO!==fTipo) return false;
    if((fDtIni||fDtFim) && !dateInRange(r.DATA_MANUTENCAO,fDtIni,fDtFim)) return false;
    return true;
  }).sort(function(a,b){return String(b.DATA_MANUTENCAO||'').localeCompare(String(a.DATA_MANUTENCAO||''))});

  var canEdit=currentUserData&&(currentUserData.perfil==='ADMIN'||currentUserData.perfil==='ANALISTA');
  var mono='font-family:JetBrains Mono,monospace;font-size:11px';
  var colCount=canEdit?10:9;
  var tH='<div class="table-header"><h3>Detalhamento de Manutenção</h3><span class="chart-badge">'+rows.length+' registros</span></div><div class="table-scroll"><table><thead><tr><th>Data</th><th>Placa</th><th>Tipo</th><th>KM</th><th>Valor</th><th>Local do Serviço</th><th>Nota Fiscal</th><th>Observação</th><th>Pneus</th>'+(canEdit?'<th>Ações</th>':'')+'</tr></thead><tbody>';
  rows.forEach(function(r){
    var actCell='';
    if(canEdit){
      var canEditThis=currentUserData.perfil==='ADMIN'||(r.USUARIO===currentUserData.nome||r.USUARIO===currentUserData.usuario);
      actCell='<td>'+(canEditThis?'<button class="btn-edit-row" onclick="openManutRealModal(\''+r.ID+'\')" title="Editar">✏️</button>':'<span style="color:#888;font-size:11px">-</span>')+
        (currentUserData.perfil==='ADMIN'?' <button class="btn-delete-row" onclick="openManutRealDelete(\''+r.ID+'\')" title="Excluir">🗑️</button>':'')+'</td>';
    }
    var itensPneu=DB.manutPneusItens.filter(function(it){return String(it.MANUT_REALIZADA_ID)===String(r.ID)});
    var pneuCell=itensPneu.length?'<span class="pneu-count-badge" onclick="_toggleManutDetPneu(\''+r.ID+'\')">🛞 '+itensPneu.length+' ▾</span>':'<span style="color:var(--text2)">—</span>';
    tH+='<tr><td style="'+mono+'">'+formatDateBR(r.DATA_MANUTENCAO)+'</td>'+
      '<td style="'+mono+';color:var(--accent)">'+(r.PLACA||'-')+'</td>'+
      '<td>'+(r.TIPO_MANUTENCAO||'-')+'</td>'+
      '<td style="'+mono+'">'+(r.KM_NA_MANUTENCAO?Number(r.KM_NA_MANUTENCAO).toLocaleString('pt-BR'):'-')+'</td>'+
      '<td style="'+mono+';color:#ef4444">'+(r.VALOR?'R$'+numBR(r.VALOR,2):'-')+'</td>'+
      '<td>'+(r.LOCAL_SERVICO||'-')+'</td>'+
      '<td style="'+mono+'">'+(r.NOTA_FISCAL||'-')+'</td>'+
      '<td>'+(r['OBSERVAÇÃO']||'-')+'</td>'+
      '<td>'+pneuCell+'</td>'+actCell+'</tr>';
    if(itensPneu.length){
      tH+='<tr id="mdPneuExp_'+r.ID+'" style="display:none"><td colspan="'+colCount+'" style="background:var(--surface2);padding:14px 20px">'+
        '<table class="pneu-mini-tbl"><thead><tr><th>Posição</th><th>Pneu removido</th><th>Pneu instalado</th><th>Marca/Modelo</th></tr></thead><tbody>'+
        itensPneu.map(function(it){return '<tr><td>'+_pneuPosLabel(it)+'</td><td style="'+mono+'">'+(it.PNEU_REMOVIDO||'-')+'</td><td style="'+mono+';color:var(--green)">'+(it.PNEU_INSTALADO||'-')+'</td><td>'+(it.MARCA_MODELO||'-')+'</td></tr>';}).join('')+
        '</tbody></table></td></tr>';
    }
  });
  tH+='</tbody></table></div>';
  document.getElementById('tblManutDet').innerHTML=tH;
}
function _toggleManutDetPneu(id){
  var row=document.getElementById('mdPneuExp_'+id);
  if(row) row.style.display=row.style.display==='none'?'table-row':'none';
}

function findManutRealById(id){ id=String(id); for(var i=0;i<DB.manutRealizada.length;i++){ if(String(DB.manutRealizada[i].ID)===id) return DB.manutRealizada[i]; } return null; }
var _mrEditId=null,_mrDelId=null;
function _mrBuildForm(row){
  row=row||{};
  var po='<option value="">Selecione...</option>';
  (BASE.placas||[]).slice().sort().forEach(function(p){po+='<option value="'+p+'"'+(row.PLACA===p?' selected':'')+'>'+p+'</option>'});
  var to='<option value="">Selecione...</option>';
  (BASE.tipoManut||[]).slice().sort().forEach(function(t){to+='<option value="'+t+'"'+(row.TIPO_MANUTENCAO===t?' selected':'')+'>'+t+'</option>'});
  return ''+
    '<div class="form-group"><label>Placa *</label><select id="mr_placa" onchange="_atualizarDiagramaPneuEdit(false)">'+po+'</select></div>'+
    '<div class="form-group"><label>Tipo *</label><select id="mr_tipo" onchange="_atualizarDiagramaPneuEdit(false)">'+to+'</select></div>'+
    '<div class="form-group"><label>Data *</label><input id="mr_data" type="date" value="'+(row.DATA_MANUTENCAO?String(row.DATA_MANUTENCAO).slice(0,10):'')+'"></div>'+
    '<div class="form-group"><label>KM *</label><input id="mr_km" type="number" value="'+(row.KM_NA_MANUTENCAO!=null?num(row.KM_NA_MANUTENCAO):'')+'"></div>'+
    '<div class="form-group"><label>Valor (R$)</label><input id="mr_valor" type="number" step="0.01" value="'+(row.VALOR!=null&&row.VALOR!==''?num(row.VALOR):'')+'"></div>'+
    '<div class="form-group"><label>Local do Serviço</label><input id="mr_local" type="text" value="'+(row.LOCAL_SERVICO?String(row.LOCAL_SERVICO).replace(/"/g,'&quot;'):'')+'"></div>'+
    '<div class="form-group"><label>Nota Fiscal</label><input id="mr_nota" type="text" value="'+(row.NOTA_FISCAL?String(row.NOTA_FISCAL).replace(/"/g,'&quot;'):'')+'"></div>'+
    '<div id="mrPneuAviso" style="display:none;grid-column:1/-1;font-size:12px;color:var(--yellow);background:rgba(210,153,34,0.08);border:1px solid rgba(210,153,34,0.25);border-radius:8px;padding:9px 12px">⚠️ Cadastre o Tipo de Veículo dessa placa em Cadastro → Caminhões pra habilitar o diagrama de pneus.</div>'+
    '<div id="mrPneuWrap" style="display:none;grid-column:1/-1">'+
      '<label style="font-size:10.5px;color:var(--text2);text-transform:uppercase;letter-spacing:.05em;font-weight:600;display:block;margin-bottom:8px">🛞 Posições trocadas</label>'+
      '<div id="mrPneuDiagram"></div>'+
    '</div>'+
    '<div class="form-group" style="grid-column:1/-1"><label>Observação</label><textarea id="mr_obs" rows="2">'+(row['OBSERVAÇÃO']?String(row['OBSERVAÇÃO']).replace(/</g,'&lt;'):'')+'</textarea></div>';
}
function _atualizarDiagramaPneuEdit(carregarExistentes){
  var placaEl=document.getElementById('mr_placa'), tipoEl=document.getElementById('mr_tipo');
  var wrap=document.getElementById('mrPneuWrap'), aviso=document.getElementById('mrPneuAviso');
  if(!placaEl||!tipoEl||!wrap||!aviso) return;
  var placa=placaEl.value, tipoNome=tipoEl.value;
  var tipoProg=DB.manutProgramada.filter(function(p){return p.TIPO_MANUTENCAO===tipoNome})[0];
  if(!tipoProg||!tipoProg.CONTROLA_PNEUS||!placa){ wrap.style.display='none'; aviso.style.display='none'; return; }
  var cam=CAMINHOES_DATA.filter(function(c){return c.PLACA===placa})[0];
  var tipoVeiculo=cam?cam.TIPO_VEICULO:null;
  if(!tipoVeiculo){ wrap.style.display='none'; aviso.style.display=''; return; }
  aviso.style.display='none';
  wrap.style.display='';
  var itensExistentes=(carregarExistentes&&_mrEditId)?DB.manutPneusItens.filter(function(it){return String(it.MANUT_REALIZADA_ID)===String(_mrEditId)}):[];
  renderDiagramaEixos('mrPneuDiagram',tipoVeiculo,itensExistentes);
}
function openManutRealModal(id){
  var row=findManutRealById(id);
  if(!row){showToast('Registro não encontrado',true);return;}
  if(!currentUserData) return;
  if(currentUserData.perfil!=='ADMIN'){
    var owner=row.USUARIO;
    if(currentUserData.perfil!=='ANALISTA'||(owner!==currentUserData.nome&&owner!==currentUserData.usuario)){
      showToast('❌ Você só pode editar os seus próprios lançamentos',true); return;
    }
  }
  _mrEditId=String(id);
  document.getElementById('mrModalGrid').innerHTML=_mrBuildForm(row);
  _atualizarDiagramaPneuEdit(true);
  document.getElementById('mrModalOverlay').classList.add('show');
}
function closeManutRealModal(){ document.getElementById('mrModalOverlay').classList.remove('show'); _mrEditId=null; }
function salvarManutRealEdit(){
  if(!_mrEditId) return;
  var placa=document.getElementById('mr_placa').value;
  var tipo=document.getElementById('mr_tipo').value;
  var data=document.getElementById('mr_data').value;
  var km=document.getElementById('mr_km').value;
  if(!placa||!tipo||!data||!km){showToast('Placa, Tipo, Data e KM são obrigatórios',true);return;}
  var row={
    placa:placa, tipo_manutencao:tipo, data_manutencao:data, km:num(km),
    valor:document.getElementById('mr_valor').value?num(document.getElementById('mr_valor').value):null,
    local_servico:document.getElementById('mr_local').value.trim()||null,
    nota_fiscal:document.getElementById('mr_nota').value.trim()||null,
    observacao:document.getElementById('mr_obs').value.trim()||null
  };
  var mostraDiagrama=document.getElementById('mrPneuWrap').style.display!=='none';
  var itensPneu=mostraDiagrama?coletarItensPneu('mrPneuDiagram'):null;
  var editId=_mrEditId;
  var btn=document.getElementById('mrSalvarBtn'); if(btn){btn.disabled=true;btn.textContent='Salvando...';}
  saveToSheets('updateManutR',{id:editId,row:row},function(ok,res){
    if(!ok){ if(btn){btn.disabled=false;btn.textContent='💾 Salvar';} showToast('❌ Erro: '+((res&&res.error)||'desconhecido'),true); return; }
    function finalizar(){
      if(btn){btn.disabled=false;btn.textContent='💾 Salvar';}
      showToast('✅ Manutenção atualizada!');
      closeManutRealModal();
      loadFromSheets(function(){ renderManutRealTable(); if(document.getElementById('pageManutencao').classList.contains('active')) buildManutencao(); });
    }
    if(itensPneu!==null){
      saveToSheets('setManutPneuItens',{manutRealizadaId:editId,itens:itensPneu},function(ok2,res2){
        if(!ok2) showToast('⚠️ Manutenção atualizada, mas falha ao salvar as posições de pneu: '+((res2&&res2.error)||'desconhecido'),true);
        finalizar();
      });
    } else {
      finalizar();
    }
  });
}
function openManutRealDelete(id){
  if(!currentUserData||currentUserData.perfil!=='ADMIN'){showToast('Apenas ADMIN pode excluir',true);return;}
  var r=findManutRealById(id); if(!r){showToast('Registro não encontrado',true);return;}
  _mrDelId=String(id);
  document.getElementById('mrDelDetails').innerHTML='<div><strong>Placa:</strong> '+(r.PLACA||'-')+'</div><div><strong>Tipo:</strong> '+(r.TIPO_MANUTENCAO||'-')+'</div><div><strong>Data:</strong> '+formatDateBR(r.DATA_MANUTENCAO)+'</div>';
  document.getElementById('mrDelOverlay').classList.add('show');
}
function closeManutRealDelete(){ document.getElementById('mrDelOverlay').classList.remove('show'); _mrDelId=null; }
function confirmManutRealDelete(){
  if(!_mrDelId) return;
  var btn=document.getElementById('mrDelBtn'); if(btn){btn.disabled=true;btn.textContent='Excluindo...';}
  saveToSheets('deleteManutR',{id:_mrDelId},function(ok,res){
    if(btn){btn.disabled=false;btn.textContent='🗑️ Excluir';}
    if(!ok){showToast('❌ Erro: '+((res&&res.error)||'desconhecido'),true);return;}
    showToast('✅ Manutenção excluída');
    closeManutRealDelete();
    loadFromSheets(function(){ renderManutRealTable(); if(document.getElementById('pageManutencao').classList.contains('active')) buildManutencao(); });
  });
}

