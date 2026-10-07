// ==================== MANUTENCAO ====================
var manutFiltro={placa:'',tipo:'',status:[],motorista:'',mesCons:'',dtIni:'',dtFim:''};
var manutMotModo='Ativos'; // filtro Ativos/Inativos/Todos do dropdown de motorista
var manutViewAtual='painel'; // 'painel', 'custos', 'historico' ou 'garantia'
var manutKmTipo=''; // tipo mostrado no painel KM & Próxima Troca ('' = troca de óleo)

// Dispatcher: constrói as duas visões (Fora de Garantia / Em Garantia) e o
// Detalhamento, que é comum às duas. Chamado por navigateTo/switchTab e por
// qualquer tela que altera dados de manutenção (garantia, catálogo de tipos, etc).
function buildManutencao(){
  buildManutencaoFora();
  buildManutencaoGarantia();
  buildManutDetalhamento();
  if(typeof buildNfRelatorio==='function') buildNfRelatorio();
  if(typeof buildManutCustos==='function') buildManutCustos();
}

function showManutView(view){
  manutViewAtual=view;
  ['painel','custos','historico','garantia'].forEach(function(v){
    var painel=document.getElementById('manutView'+v.charAt(0).toUpperCase()+v.slice(1));
    if(painel) painel.style.display=(v===view?'':'none');
    var btn=document.getElementById('manutTabBtn'+v.charAt(0).toUpperCase()+v.slice(1));
    if(btn) btn.classList.toggle('active',v===view);
  });
  // A consulta de pneu busca em TODOS os pneus lançados (js/pneus.js), sem olhar aba nem
  // garantia — então fica só na visão principal, em vez de repetida em cada aba.
  var pneu=document.getElementById('manutConsultaPneu');
  if(pneu) pneu.style.display='';
  if(view==='custos'){ buildManutCustos(); if(typeof buildNfRelatorio==='function') buildNfRelatorio(); }
  else if(view==='historico') buildManutDetalhamento();
}

// ---------- Helpers compartilhados entre Painel e Em Garantia ----------
// Ritmo de cada placa (km/dia) nos últimos 180 dias, a partir do odômetro dos
// abastecimentos. É o que traduz "faltam 8.000 km" em "vence em ~28 dias", que é o
// número que serve para agendar oficina.
function _manutKmPorDia(){
  var por={};
  DB.cadastro.forEach(function(r){
    if(!r.PLACA||!r.KM||!r.DATA) return;
    var km=parseKM(r.KM); if(isNaN(km)||km<=0) return;
    var p=String(r.PLACA).replace(/\s+/g,''), d=String(r.DATA).slice(0,10);
    if(!por[p]) por[p]={kmMin:km,kmMax:km,dtMin:d,dtMax:d,n:0};
    var o=por[p]; o.n++;
    if(km<o.kmMin)o.kmMin=km; if(km>o.kmMax)o.kmMax=km;
    if(d<o.dtMin)o.dtMin=d; if(d>o.dtMax)o.dtMax=d;
  });
  var out={};
  Object.keys(por).forEach(function(p){
    var o=por[p];
    if(o.n<4) return;
    var dias=(new Date(o.dtMax)-new Date(o.dtMin))/86400000;
    if(dias>0) out[p]=(o.kmMax-o.kmMin)/dias;
  });
  return out;
}
// "faltam 8.000 km" -> "em ~28 dias". Sem ritmo conhecido, devolve vazio.
function _manutPrevisao(kmRest,kmDia){
  if(kmRest==null||!kmDia||kmDia<=0) return '';
  var dias=Math.round(kmRest/kmDia);
  if(dias<0) return 'passou há ~'+Math.abs(dias)+' dia'+(Math.abs(dias)===1?'':'s');
  if(dias===0) return 'hoje';
  return 'em ~'+dias+' dia'+(dias===1?'':'s');
}

// ---------- Helpers de status ----------
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
    // Lançamento SEM KM não serve de âncora: a próxima manutenção é calculada a partir do
    // KM da última (KM da última + intervalo). Sem este filtro, um conserto avulso sem KM
    // viraria a "última" do tipo e o caminhão apareceria vencido sem ser.
    if(r.KM_NA_MANUTENCAO===null||r.KM_NA_MANUTENCAO===undefined||r.KM_NA_MANUTENCAO==='') return;
    // Lançamento HISTÓRICO (anterior ao corte de 01/07/2026, migration 0028) também não
    // serve de âncora: são registros de 2024/2025 em caminhões que rodaram 250 mil km
    // desde então, certamente revisados sem ninguém registrar. Usá-los faz a tela dizer
    // "vencido há 172.000 km", afirmando algo que não sabemos. Sem eles o item volta a ser
    // "sem registro", que é a verdade. Continuam inteiros no custo e no histórico.
    if(r.BASE_ALERTA===false) return;
    var key=r.PLACA+'|'+r.TIPO_MANUTENCAO;
    if(!lastManut[key]||(r.DATA_MANUTENCAO>lastManut[key].DATA_MANUTENCAO)) lastManut[key]=r;
  });
  return lastManut;
}
// KM só é usado para calcular quando vence a próxima manutenção — ou seja, só faz falta
// nos tipos que têm intervalo de KM cadastrado. Em "Outros" e "Troca de Óleo e Filtro"
// (sem intervalo) ele é opcional; obrigar levava a inventar número numa nota de conserto
// avulso, e número inventado vira base de cálculo errada depois.
function manutTipoTemAlertaKm(tipo){
  var p=(DB.manutProgramada||[]).filter(function(x){ return x.TIPO_MANUTENCAO===tipo; })[0];
  return !!(p && num(p.INTERVALO_KM)>0);
}
function manutKmObrigatorio(tipos){
  return (tipos||[]).some(manutTipoTemAlertaKm);
}
// Status de um item (placa+tipo) dado o programa (intervalo/alertas), o último
// registro de manutenção e o km atual da placa.
// Cinco estados, não três. "Vencido" (v) é separado de "Urgente" (r) porque são ações
// diferentes: um já passou do ponto, o outro dá tempo de agendar. Antes os dois eram o
// mesmo vermelho e não dava para priorizar.
function _manutStatusItem(prog,last,kmAtual){
  var status,kmRest,proxM;
  if(!last){status='x';kmRest=null;proxM=null;}
  else{
    proxM=num(last.KM_NA_MANUTENCAO)+num(prog.INTERVALO_KM);
    kmRest=proxM-kmAtual;
    if(kmRest<0) status='v';
    else if(kmRest<=num(prog.ALERTA_URGENTE)) status='r';
    else if(kmRest<=num(prog['ALERTA ATENCAO'])) status='y';
    else status='g';
  }
  return {status:status,kmRest:kmRest,proxM:proxM};
}

function buildManutencaoFora(){
  var colors=cc();
  var kmByPlaca=_manutCalcKmByPlaca();
  var lastManut=_manutCalcLastManut();

  // Lê o que está escolhido na tela ANTES de montar qualquer coisa. O filtro de tipo
  // recorta a lista de serviços logo abaixo, então ler depois faria os itens serem
  // montados com um valor e o resto da tela com outro.
  var savedPlaca=document.getElementById('fmDashPlaca')?document.getElementById('fmDashPlaca').value:manutFiltro.placa;
  var savedTipo=document.getElementById('fmDashTipo')?document.getElementById('fmDashTipo').value:manutFiltro.tipo;
  var savedMot=document.getElementById('fmDashMot')?document.getElementById('fmDashMot').value:manutFiltro.motorista;
  manutFiltro.placa=savedPlaca;manutFiltro.tipo=savedTipo;manutFiltro.motorista=savedMot;

  // Fora de garantia = todas as placas com km conhecido, exceto as com garantia ainda ativa
  var allPlacas=Object.keys(kmByPlaca).filter(function(p){return !placaEmGarantiaAtiva(p)}).sort();
  // Só serviço COM intervalo de KM entra no Painel: é o que tem como vencer. Pneus,
  // Corretiva e Outros não têm régua, então não aparecem aqui nem no filtro de tipo —
  // oferecê-los no filtro só produzia uma tela vazia sem explicação.
  var progsTodos=DB.manutProgramada.filter(function(p){return p.TIPO_MANUTENCAO&&p.INTERVALO_KM});
  var todosTipos=progsTodos.map(function(p){return p.TIPO_MANUTENCAO}).sort();
  // O filtro de tipo recorta aqui, na origem. Antes ele só pintava as colunas da matriz
  // de verde com "—" e não mexia em mais nada: com a matriz fechada por padrão, escolher
  // um tipo não mudava nada visível na tela.
  var progs=manutFiltro.tipo
    ? progsTodos.filter(function(p){return p.TIPO_MANUTENCAO===manutFiltro.tipo})
    : progsTodos;

  // Build alerts data
  var alertsData=[];
  allPlacas.forEach(function(placa){
    var kmAtual=kmByPlaca[placa];
    var items=[];var worst='g';var hasOnlyX=true;var pior=9;
    progs.forEach(function(prog){
      var key=placa+'|'+prog.TIPO_MANUTENCAO;
      var last=lastManut[key];
      var st=_manutStatusItem(prog,last,kmAtual);
      if(last) hasOnlyX=false;
      var ord={v:0,r:1,y:2,g:3,x:4}[st.status];
      if(ord<pior&&st.status!=='x'){pior=ord;worst=st.status;}
      items.push({tipo:prog.TIPO_MANUTENCAO,status:st.status,kmRest:st.kmRest,proxM:st.proxM,intervalo:num(prog.INTERVALO_KM)});
    });
    if(hasOnlyX&&worst==='g') worst='x';
    alertsData.push({placa:placa,kmAtual:kmAtual,items:items,worst:worst});
  });

  // Build filter bar
  var fb=document.getElementById('filtersManut');

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
  todosTipos.forEach(function(t){fbH+='<option value="'+t+'"'+(savedTipo===t?' selected':'')+'>'+t+'</option>'});
  fbH+='</select>';
  fbH+='<div class="filter-sep" style="width:1px;height:24px;background:var(--border);margin:0 6px"></div>';
  var vencTag=manutFiltro.status.indexOf('v')>=0;
  var urgTag=manutFiltro.status.indexOf('r')>=0;
  var attTag=manutFiltro.status.indexOf('y')>=0;
  var okTag=manutFiltro.status.indexOf('g')>=0;
  var xTag=manutFiltro.status.indexOf('x')>=0;
  fbH+='<div class="manut-filter-tag'+(vencTag?' active red':'')+'" onclick="toggleManutTag(&#39;v&#39;,this)"><span class="manut-tag-dot" style="background:var(--red)"></span>Vencido</div>';
  fbH+='<div class="manut-filter-tag'+(urgTag?' active red':'')+'" onclick="toggleManutTag(&#39;r&#39;,this)"><span class="manut-tag-dot" style="background:var(--orange)"></span>Urgente</div>';
  fbH+='<div class="manut-filter-tag'+(attTag?' active':'')+'" onclick="toggleManutTag(&#39;y&#39;,this)"><span class="manut-tag-dot" style="background:var(--yellow)"></span>Atenção</div>';
  fbH+='<div class="manut-filter-tag'+(okTag?' active green':'')+'" onclick="toggleManutTag(&#39;g&#39;,this)"><span class="manut-tag-dot" style="background:var(--green)"></span>OK</div>';
  fbH+='<div class="manut-filter-tag'+(xTag?' active':'')+'" onclick="toggleManutTag(&#39;x&#39;,this)"><span class="manut-tag-dot" style="background:var(--text2)"></span>Sem registro</div>';
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
  var vencCnt=0,urgCnt=0,attCnt=0,okCnt=0,semRegCnt=0,totalItens=0,urgPlacasSet={};
  filtered.forEach(function(a){
    totalItens+=a.items.length;
    if(a.items.some(function(i){return i.status==='r'||i.status==='v';})) urgPlacasSet[a.placa]=1;
    a.items.forEach(function(i){
      if(i.status==='v') vencCnt++;
      else if(i.status==='r') urgCnt++;
      else if(i.status==='x') semRegCnt++;
      else if(i.status==='y') attCnt++;
      else okCnt++;
    });
  });

  var urgPlacas=Object.keys(urgPlacasSet).length;

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
      if(i.status==='v'||i.status==='r') urgentItems.push({placa:a.placa,tipo:i.tipo,km:i.kmRest,st:i.status});
    });
  });
  var alertBar=document.getElementById('manutAlertBar');
  if(urgentItems.length>0){
    var nV=urgentItems.filter(function(u){return u.st==='v'}).length;
    var alertTxt='<strong>'+urgentItems.length+' manutenção(ões) '+(nV===urgentItems.length?'vencida(s)':(nV?nV+' vencida(s) e '+(urgentItems.length-nV)+' a vencer':'a vencer'))+'</strong> — ';
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
    '<div class="kpi-card red" title="Já passou do ponto de troca"><div class="kpi-icon">🔴</div><div class="kpi-value">'+vencCnt+'</div><div class="kpi-label">Vencidos'+(urgPlacas?' · '+urgPlacas+' '+(urgPlacas>1?'caminhões':'caminhão'):'')+'</div></div>'+
    '<div class="kpi-card red" title="Vence em breve — dá tempo de agendar"><div class="kpi-icon">🟠</div><div class="kpi-value">'+urgCnt+'</div><div class="kpi-label">Urgentes</div></div>'+
    '<div class="kpi-card yellow" title="Cada item é uma combinação caminhão + tipo de manutenção"><div class="kpi-icon">🟡</div><div class="kpi-value">'+attCnt+'</div><div class="kpi-label">Itens em atenção</div></div>'+
    '<div class="kpi-card" title="Combinações caminhão + tipo que nunca tiveram manutenção lançada — sem isso o sistema não sabe calcular a próxima"><div class="kpi-icon">⚪</div><div class="kpi-value">'+semRegCnt+'</div><div class="kpi-label">Itens sem registro'+(totalItens?' de '+totalItens:'')+'</div></div>'+
    '<div class="kpi-card green"><div class="kpi-icon">🚛</div><div class="kpi-value">'+filtered.length+'</div><div class="kpi-label">Caminhões</div></div>';

  // MATRIX TABLE
  var thead='<tr><th>Placa</th>';
  progs.forEach(function(p){
    var short=p.TIPO_MANUTENCAO.replace('Troca de ','').replace('Filtro de ','F.').replace('Alinhamento e Balanceamento','Alinha.').replace('Revisão de Freios','Freios').replace('Troca de Fluido de Arla 32','Arla 32');
    thead+='<th>'+short+'</th>';
  });
  thead+='</tr>';
  document.getElementById('manutMatrizHead').innerHTML=thead;

  var chipLabel={g:'OK',y:'Atenção',v:'Vencido',r:'Urgente',x:'Sem reg.'};
  // Ordem: urgente > atenção > ok > sem registro (placa em ordem alfabética dentro do grupo).
  // Só alfabética, com 31 caminhões e a maioria "sem registro", deixava o urgente perdido
  // no meio da lista — quem abre a tela quer ver primeiro o que precisa de ação.
  var ordStatus={v:0,r:1,y:2,g:3,x:4};
  var ordenados=filtered.slice().sort(function(a,b){
    return (ordStatus[a.worst]-ordStatus[b.worst]) || a.placa.localeCompare(b.placa,'pt-BR');
  });
  var tbody='';
  ordenados.forEach(function(a){
    tbody+='<tr><td><span class="manut-placa-tag">'+a.placa+'</span></td>';
    a.items.forEach(function(i){
      tbody+='<td><span class="manut-chip '+i.status+'"><span class="manut-chip-dot"></span>'+chipLabel[i.status]+'</span></td>';
    });
    tbody+='</tr>';
  });
  document.getElementById('manutMatrizBody').innerHTML=tbody;
  document.getElementById('manutBadgeTotal').textContent=filtered.length+' caminhões · '+
    (manutFiltro.tipo?'só '+manutFiltro.tipo:progs.length+' serviço'+(progs.length===1?'':'s'))+' · mais urgente primeiro';

  // KM & PRÓXIMA TROCA (óleo motor) — TODOS os caminhões, do mais urgente ao menos; a
  // caixa mostra ~5 linhas e rola para o resto (antes cortava em 5 e mandava usar o filtro).
  // O tipo é achado pelo NOME: antes pegava "o 1º do catálogo" presumindo que fosse o óleo,
  // e reordenar/apagar esse tipo trocaria o painel de assunto sem aviso.
  // Qual tipo o painel mostra: o escolhido no seletor do próprio painel; por padrão a
  // troca de óleo, achada pelo NOME (antes pegava "o 1º do catálogo" presumindo que fosse
  // o óleo, e reordenar/apagar esse tipo trocaria o painel de assunto sem aviso).
  var iOleo=-1, iSel=-1;
  progs.forEach(function(p,i){
    if(iOleo<0 && /OLEO\s+(DO\s+|DE\s+)?MOTOR/.test(String(p.TIPO_MANUTENCAO).normalize('NFD').replace(/[̀-ͯ]/g,'').toUpperCase())) iOleo=i;
    if(manutKmTipo && p.TIPO_MANUTENCAO===manutKmTipo) iSel=i;
  });
  if(iSel<0) iSel=(iOleo>=0?iOleo:(progs.length?0:-1));
  var tipoPainel=iSel>=0?progs[iSel].TIPO_MANUTENCAO:'';
  var kmListH;
  if(iSel<0){
    kmListH='<div style="padding:14px;color:var(--text2);font-size:12px;text-align:center">Nenhum tipo de manutenção com intervalo de KM cadastrado (Cadastro → Tipos de Manutenção).</div>';
  } else {
    var semReg=999999999;
    var sorted=filtered.slice().sort(function(a,b){
      var ra=a.items[iSel].kmRest, rb=b.items[iSel].kmRest;
      return (ra!=null?ra:semReg)-(rb!=null?rb:semReg);
    });
    var corTxt={g:'var(--green)',y:'var(--yellow)',v:'var(--red)',r:'var(--orange)',x:'var(--text2)'};
    kmListH='<div class="manut-km-scroll"><table class="manut-km-tbl"><thead><tr><th>Placa</th><th>KM atual</th><th>Próxima em</th><th>Faltam</th><th></th></tr></thead><tbody>';
    sorted.forEach(function(a){
      var it=a.items[iSel];
      // Barra = quanto do intervalo ainda resta, na cor do status (mesmos limites de
      // alerta da matriz). A conta antiga (100 − KM atual/próxima troca) dava ~20% e
      // amarelo para um caminhão que acabou de trocar o óleo.
      var pct=(it.kmRest!=null && it.intervalo>0)?Math.max(0,Math.min(100,Math.round(it.kmRest/it.intervalo*100))):0;
      kmListH+='<tr>'+
        '<td><span class="manut-placa-tag">'+a.placa+'</span></td>'+
        '<td class="manut-km-num">'+Math.round(a.kmAtual).toLocaleString('pt-BR')+' km</td>'+
        '<td class="manut-km-num">'+(it.proxM!=null?Math.round(it.proxM).toLocaleString('pt-BR')+' km':'<span style="color:var(--text2)">sem registro</span>')+'</td>'+
        '<td class="manut-km-num" style="color:'+corTxt[it.status]+'">'+(it.kmRest!=null?(it.kmRest<0?'vencido há '+Math.round(-it.kmRest).toLocaleString('pt-BR'):Math.round(it.kmRest).toLocaleString('pt-BR'))+' km':'—')+'</td>'+
        '<td><div class="manut-km-bg"><div class="manut-km-fill '+(it.status==='x'?'':it.status)+'" style="width:'+pct+'%"></div></div></td>'+
        '</tr>';
    });
    kmListH+='</tbody></table></div>';
  }
  // Seletor próprio do painel, usado quando NÃO há filtro de tipo no topo. Com o filtro
  // ativo quem manda é ele — dois controles para a mesma coisa, discordando entre si, é
  // o tipo de coisa que faz a tela parecer quebrada.
  var selH;
  if(manutFiltro.tipo){
    selH='<span class="manut-km-sel-lbl">tipo:</span><span class="manut-km-sel-fixo">'+tipoPainel+'</span>'+
      '<span class="manut-km-sel-n">pelo filtro do topo</span>';
  } else {
    selH='<span class="manut-km-sel-lbl">tipo:</span><select id="manutKmSel" onchange="manutKmTipo=this.value;buildManutencao()">';
    progs.forEach(function(p){ selH+='<option'+(p.TIPO_MANUTENCAO===tipoPainel?' selected':'')+'>'+p.TIPO_MANUTENCAO+'</option>'; });
    selH+='</select><span class="manut-km-sel-n">'+filtered.length+' caminhões</span>';
  }
  document.getElementById('manutKmBadge').innerHTML=selH;
  document.getElementById('manutKmList').innerHTML=kmListH;

  // ---------- O QUE PRECISA DE AÇÃO ----------
  // Primeira coisa da tela, ordenada por urgência. Antes o que aparecia primeiro era a
  // matriz, com a maioria das células cinza — quem abre a aba quer saber o que fazer hoje.
  var kmDia=_manutKmPorDia();
  var acoes=[];
  filtered.forEach(function(a){
    a.items.forEach(function(i){
      if(i.status==='v'||i.status==='r'||i.status==='y') acoes.push({placa:a.placa,kmAtual:a.kmAtual,it:i});
    });
  });
  acoes.sort(function(x,y){ return (ordStatus[x.it.status]-ordStatus[y.it.status]) || (x.it.kmRest-y.it.kmRest); });
  var acaoH='';
  if(!acoes.length){
    acaoH='<div class="manut-vazio-ok">✅ Nenhuma manutenção vencida ou próxima de vencer nesta seleção.</div>';
  } else {
    acoes.forEach(function(x){
      var prev=_manutPrevisao(x.it.kmRest,kmDia[x.placa]);
      var num2=x.it.kmRest<0
        ? '<b style="color:var(--red)">'+Math.round(-x.it.kmRest).toLocaleString('pt-BR')+' km atrás</b>'
        : '<b>faltam '+Math.round(x.it.kmRest).toLocaleString('pt-BR')+' km</b>';
      acaoH+='<div class="manut-acao">'+
        '<div class="manut-acao-st"><span class="manut-chip '+x.it.status+'"><span class="manut-chip-dot"></span>'+chipLabel[x.it.status]+'</span></div>'+
        '<div class="manut-acao-main"><div class="manut-acao-tipo"><span class="manut-placa-tag">'+x.placa+'</span> &nbsp;'+x.it.tipo+'</div>'+
        '<div class="manut-acao-sub">KM atual '+Math.round(x.kmAtual).toLocaleString('pt-BR')+
        (x.it.proxM!=null?' · próxima em '+Math.round(x.it.proxM).toLocaleString('pt-BR')+' km':'')+'</div></div>'+
        '<div class="manut-acao-num">'+num2+'<div class="manut-acao-quando">'+prev+'</div></div></div>';
    });
  }
  document.getElementById('manutAcaoList').innerHTML=acaoH;
  document.getElementById('manutAcaoBadge').textContent=acoes.length+' iten'+(acoes.length===1?'':'s')+
    (manutFiltro.tipo?' · só '+manutFiltro.tipo:'');

  // ---------- SITUAÇÃO POR CAMINHÃO ----------
  // A pergunta do gestor é "quais caminhões", não "quantos itens": um caminhão com 2 itens
  // vencidos é UM caminhão parado. Só entram os que já têm histórico; os sem registro
  // nenhum ficam no bloco de implantação, abaixo.
  var comHist=filtered.filter(function(a){ return a.worst!=='x'; });
  var frotaH='';
  comHist.slice().sort(function(a,b){
    return (ordStatus[a.worst]-ordStatus[b.worst]) || a.placa.localeCompare(b.placa,'pt-BR');
  }).forEach(function(a){
    var c={v:0,r:0,y:0,g:0,x:0};
    a.items.forEach(function(i){ c[i.status]++; });
    var det=[];
    if(c.v) det.push('<span style="color:var(--red)">'+c.v+' vencido'+(c.v>1?'s':'')+'</span>');
    if(c.r) det.push('<span style="color:var(--orange)">'+c.r+' urgente'+(c.r>1?'s':'')+'</span>');
    if(c.y) det.push('<span style="color:var(--yellow)">'+c.y+' em atenção</span>');
    if(c.g) det.push('<span style="color:var(--green)">'+c.g+' em dia</span>');
    if(c.x) det.push('<span style="color:var(--text2)">'+c.x+' sem registro</span>');
    // A linha abre: o resumo diz "1 vencido · 4 sem registro", mas não diz O QUÊ. Clicar
    // mostra serviço por serviço, do pior para o melhor, com quanto falta e a previsão
    // em dias — que é o que se precisa para ligar para a oficina.
    var itensOrd=a.items.slice().sort(function(x,y){
      return (ordStatus[x.status]-ordStatus[y.status]) ||
             ((x.kmRest==null?1e9:x.kmRest)-(y.kmRest==null?1e9:y.kmRest));
    });
    var detH='';
    itensOrd.forEach(function(i){
      var prev=_manutPrevisao(i.kmRest,kmDia[a.placa]);
      var falta=i.kmRest==null
        ? '<span class="manut-frota-sem">nunca registrada</span>'
        : (i.kmRest<0
            ? '<span style="color:var(--red)">'+Math.round(-i.kmRest).toLocaleString('pt-BR')+' km atrás</span>'
            : 'faltam '+Math.round(i.kmRest).toLocaleString('pt-BR')+' km');
      detH+='<div class="manut-frota-item">'+
        '<span class="manut-chip '+i.status+'"><span class="manut-chip-dot"></span>'+chipLabel[i.status]+'</span>'+
        '<span class="manut-frota-item-tipo">'+i.tipo+'</span>'+
        '<span class="manut-frota-item-num">'+falta+(prev?' <span class="manut-frota-prev">· '+prev+'</span>':'')+'</span>'+
        '<span class="manut-frota-item-prox">'+(i.proxM!=null?'próxima em '+Math.round(i.proxM).toLocaleString('pt-BR')+' km':'')+'</span>'+
        '</div>';
    });
    var idp='frt_'+a.placa.replace(/[^A-Za-z0-9]/g,'');
    frotaH+='<div class="manut-frota-linha" onclick="_toggleFrota(\''+idp+'\')" title="Clique para ver serviço por serviço">'+
      '<span class="manut-frota-seta" id="'+idp+'_s">▸</span>'+
      '<span class="manut-chip '+a.worst+'"><span class="manut-chip-dot"></span>'+chipLabel[a.worst]+'</span>'+
      '<span class="manut-placa-tag">'+a.placa+'</span>'+
      '<span class="manut-frota-km">'+Math.round(a.kmAtual).toLocaleString('pt-BR')+' km</span>'+
      '<span class="manut-frota-det">'+det.join(' · ')+'</span></div>'+
      '<div class="manut-frota-exp" id="'+idp+'" style="display:none">'+detH+'</div>';
  });
  document.getElementById('manutFrotaList').innerHTML=frotaH||'<div class="manut-vazio-ok">Nenhum caminhão com histórico nesta seleção.</div>';
  document.getElementById('manutFrotaBadge').textContent=comHist.length+' caminhõe'+(comHist.length===1?'':'s')+' no controle';

  // ---------- IMPLANTAÇÃO DO CONTROLE ----------
  // Caminhão sem nenhum histórico não está "em falta", está fora do controle ainda — e
  // isso é um estado diferente, que merece cor diferente. Em vermelho vira uma parede que
  // se aprende a ignorar; escondido, o painel mentiria por omissão. Aqui é um contador que
  // só diminui: cada revisão registrada tira um da lista, e a seção some quando zerar.
  var semHist=filtered.filter(function(a){ return a.worst==='x'; });
  var implPanel=document.getElementById('manutImplPanel');
  if(implPanel){
    if(!semHist.length){ implPanel.style.display='none'; }
    else{
      implPanel.style.display='';
      var totalP=filtered.length, dentro=totalP-semHist.length;
      var pct=totalP?Math.round(dentro/totalP*100):0;
      document.getElementById('manutImplResumo').innerHTML=
        '<div class="manut-impl-barra"><div class="manut-impl-fill" style="width:'+pct+'%"></div></div>'+
        '<div class="manut-impl-txt"><strong>'+dentro+' de '+totalP+' caminhões</strong> já no controle ('+pct+'%). '+
        'Os outros '+semHist.length+' entram na <strong>próxima revisão registrada</strong> — não há histórico para lançar.</div>';
      var implH='';
      semHist.slice().sort(function(a,b){ return b.kmAtual-a.kmAtual; }).forEach(function(a){
        implH+='<div class="manut-impl-linha"><span class="manut-placa-tag">'+a.placa+'</span>'+
          '<span class="manut-frota-km">'+Math.round(a.kmAtual).toLocaleString('pt-BR')+' km</span></div>';
      });
      document.getElementById('manutImplList').innerHTML=implH;
      document.getElementById('manutImplBadge').textContent=semHist.length+' aguardando';
    }
  }

  // CONSUMO MÉDIO movido para a aba Consumo (buildConsumo)
  // "Histórico Recente" (6 últimas) removido: o Detalhamento de Manutenção logo abaixo
  // mostra o histórico completo, com filtros próprios.
}

// Abre/fecha o detalhe de um caminhão no quadro "Situação por caminhão".
function _toggleFrota(id){
  var box=document.getElementById(id), seta=document.getElementById(id+'_s');
  if(!box) return;
  var aberto=box.style.display!=='none';
  box.style.display=aberto?'none':'';
  if(seta) seta.textContent=aberto?'▸':'▾';
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

// Atalho do aviso da aba Em Garantia para o cadastro (Cadastro → Garantia)
function irParaCadastroGarantia(){
  navigateTo('cadastro');
  var btn=document.getElementById('tabGarantiaBtn');
  if(btn) switchTab(btn,'tabGarantia');
}

// ==================== EM GARANTIA ====================
var manutGarFiltro={placa:'',tipo:'',status:[]};

function buildManutencaoGarantia(){
  var kmByPlaca=_manutCalcKmByPlaca();
  var lastManut=_manutCalcLastManut();
  var garantiasAtivas=DB.garantiaCaminhoes.filter(garantiaEstaAtiva);

  // A ABA só existe quando há garantia cadastrada — ou para ADMIN, que é quem cadastra e
  // precisa de um caminho para chegar lá. Assim ninguém vê uma aba permanentemente vazia,
  // e a funcionalidade não fica invisível: no dia em que a primeira garantia for cadastrada
  // a aba aparece sozinha, sem mexer em código.
  var admin=currentUserData&&currentUserData.perfil==='ADMIN';
  var btnGar=document.getElementById('manutTabBtnGarantia');
  if(btnGar) btnGar.style.display=(garantiasAtivas.length||admin)?'':'none';
  // se a aba sumiu debaixo do usuário (ex: garantia venceu), volta para o Painel
  if(!garantiasAtivas.length&&!admin&&manutViewAtual==='garantia') showManutView('painel');

  // Sem garantia cadastrada a aba fica só com a tabela vazia, idêntica à do Painel.
  // Este aviso explica para que serve e onde cadastrar.
  var vazio=document.getElementById('manutGarVazio');
  if(vazio){
    var temCadastro=DB.garantiaCaminhoes.length>0;
    if(!garantiasAtivas.length){
      vazio.innerHTML=temCadastro
        ? '<strong>Nenhuma garantia vigente.</strong><br>As '+DB.garantiaCaminhoes.length+' garantia(s) cadastrada(s) já venceram — por data ou por KM. Esses caminhões passam a aparecer em <em>Fora de Garantia</em>.'
        : '<strong>Nenhum caminhão em garantia cadastrado.</strong><br>Caminhão novo, dentro da garantia da fábrica, segue o plano de revisão da concessionária (intervalos e tipos próprios) em vez do plano de vocês. Cadastrando a garantia aqui, ele sai da matriz de fora de garantia e passa a ser cobrado pelo plano certo.'
          +(admin?'<br><button class="btn btn-secondary btn-sm" style="margin-top:12px" onclick="irParaCadastroGarantia()">Cadastrar garantia</button>':'<br><span style="font-size:11px">Só um ADMIN pode cadastrar (Cadastro → Garantia).</span>');
      vazio.style.display='';
    } else vazio.style.display='none';
    // com a aba vazia, filtros e tabela só poluem
    ['filtersManutGar','kpiManutGar'].forEach(function(id){ var e=document.getElementById(id); if(e) e.style.display=garantiasAtivas.length?'':'none'; });
    var tab=document.querySelector('#manutViewGarantia .table-container');
    if(tab) tab.style.display=garantiasAtivas.length?'':'none';
    if(!garantiasAtivas.length) return;
  }

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

  var chipLabel={g:'OK',y:'Atenção',v:'Vencido',r:'Urgente',x:'Sem reg.'};
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
  ], '<button class="filter-btn-pdf" onclick="exportManutDetPDF()">📄 Exportar PDF</button>',
     function(){ clearFilters(['fmdPlaca','fmdTipo','fmdDtIni','fmdDtFim'],buildManutDetalhamento); },
     true);   // noPdfBtn: o botão genérico exporta a PÁGINA inteira; aqui queremos só este quadro

  var fPlaca=(document.getElementById('fmdPlaca')||{}).value||'';
  var fTipo=(document.getElementById('fmdTipo')||{}).value||'';
  var fDtIni=(document.getElementById('fmdDtIni')||{}).value||'';
  var fDtFim=(document.getElementById('fmdDtFim')||{}).value||'';

  // O Detalhamento é o mesmo quadro nas duas visões; em "Em Garantia" ele mostra só os
  // caminhões com garantia vigente, senão as duas abas exibem exatamente a mesma lista.
  var soGarantia=manutViewAtual==='garantia';
  var placasGarantia={};
  if(soGarantia) DB.garantiaCaminhoes.filter(garantiaEstaAtiva).forEach(function(g){ placasGarantia[String(g.PLACA).replace(/\s+/g,'')]=1; });

  var rows=DB.manutRealizada.filter(function(r){
    if(soGarantia && !placasGarantia[String(r.PLACA||'').replace(/\s+/g,'')]) return false;
    if(fPlaca && r.PLACA!==fPlaca) return false;
    if(fTipo && r.TIPO_MANUTENCAO!==fTipo) return false;
    if((fDtIni||fDtFim) && !dateInRange(r.DATA_MANUTENCAO,fDtIni,fDtFim)) return false;
    return true;
  }).sort(function(a,b){return String(b.DATA_MANUTENCAO||'').localeCompare(String(a.DATA_MANUTENCAO||''))});

  var canEdit=currentUserData&&(currentUserData.perfil==='ADMIN'||currentUserData.perfil==='ANALISTA');
  var mono='font-family:JetBrains Mono,monospace;font-size:11px';
  var colCount=canEdit?11:10;
  var tH='<div class="table-header"><h3>Detalhamento de Manutenção'+(soGarantia?' — em garantia':'')+'</h3><span class="chart-badge">'+rows.length+' registros</span></div><div class="table-scroll"><table><thead><tr><th>Data</th><th>Placa</th><th>Tipo</th><th>KM</th><th>Motorista</th><th>Valor</th><th>Local do Serviço</th><th>Nota Fiscal</th><th>Observação</th><th>Pneus</th>'+(canEdit?'<th>Ações</th>':'')+'</tr></thead><tbody>';
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
      '<td style="'+mono+'">'+(r.KM_NA_MANUTENCAO?numBR(r.KM_NA_MANUTENCAO,2):'-')+'</td>'+
      '<td>'+(r.MOTORISTA||'-')+'</td>'+
      '<td style="'+mono+';color:#ef4444">'+(r.VALOR?'R$'+numBR(r.VALOR,2):'-')+'</td>'+
      '<td>'+(r.LOCAL_SERVICO||'-')+'</td>'+
      '<td style="'+mono+'">'+((typeof nfSeloNotas==='function'&&nfSeloNotas('caminhao',r.ID))||(r.NOTA_FISCAL||'-'))+'</td>'+
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
// PDF só do Detalhamento (o botão do topo da página continua exportando a página toda)
function exportManutDetPDF(){
  var v=function(id){ var e=document.getElementById(id); return e?e.value:''; };
  var f=[];
  if(v('fmdPlaca')) f.push('Placa: '+v('fmdPlaca'));
  if(v('fmdTipo')) f.push('Tipo: '+v('fmdTipo'));
  if(v('fmdDtIni')||v('fmdDtFim')) f.push('Período: '+(v('fmdDtIni')?formatDateBR(v('fmdDtIni')):'início')+' até '+(v('fmdDtFim')?formatDateBR(v('fmdDtFim')):'hoje'));
  exportSecaoPDF('tblManutDet','Detalhamento de Manutenção',f.join(' · ')||'nenhum (todos os registros)',true);
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
  var mo='<option value="">Selecione...</option>';
  motoristasFiltrados(BASE.motoristas||[],'Todos').slice().sort().forEach(function(m){mo+='<option value="'+m+'"'+(row.MOTORISTA===m?' selected':'')+'>'+m+'</option>'});
  return ''+
    '<div class="form-group"><label>Placa *</label><select id="mr_placa" onchange="_atualizarDiagramaPneuEdit(false)">'+po+'</select></div>'+
    '<div class="form-group"><label>Tipo *</label><select id="mr_tipo" onchange="_atualizarDiagramaPneuEdit(false)">'+to+'</select></div>'+
    '<div class="form-group"><label>Data *</label><input id="mr_data" type="date" value="'+(row.DATA_MANUTENCAO?String(row.DATA_MANUTENCAO).slice(0,10):'')+'"></div>'+
    '<div class="form-group"><label id="mr_kmLabel">KM *</label><input id="mr_km" type="number" value="'+(row.KM_NA_MANUTENCAO!=null?num(row.KM_NA_MANUTENCAO):'')+'"></div>'+
    '<div class="form-group"><label>Motorista</label><select id="mr_motorista">'+mo+'</select></div>'+
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
  var tipoLab=document.getElementById('mr_kmLabel'), tipoSel=document.getElementById('mr_tipo');
  if(tipoLab&&tipoSel){
    var obrig=!tipoSel.value||manutTipoTemAlertaKm(tipoSel.value);
    tipoLab.textContent=obrig?'KM *':'KM (opcional neste tipo)';
  }
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
  var kmObrig=manutKmObrigatorio([tipo]);
  if(!placa||!tipo||!data||(kmObrig&&!km)){showToast(kmObrig?'Placa, Tipo, Data e KM são obrigatórios':'Placa, Tipo e Data são obrigatórios',true);return;}
  var row={
    placa:placa, tipo_manutencao:tipo, data_manutencao:data, km:(km?num(km):null),
    valor:document.getElementById('mr_valor').value?num(document.getElementById('mr_valor').value):null,
    local_servico:document.getElementById('mr_local').value.trim()||null,
    nota_fiscal:document.getElementById('mr_nota').value.trim()||null,
    motorista:document.getElementById('mr_motorista').value||null,
    observacao:document.getElementById('mr_obs').value.trim()||null
  };
  var mostraDiagrama=document.getElementById('mrPneuWrap').style.display!=='none';
  var pneuIncompletos=mostraDiagrama?contarPneuLinhasIncompletas('mrPneuDiagram'):0;
  if(pneuIncompletos>0){
    showToast('⚠️ '+pneuIncompletos+' posição(ões) de pneu marcada(s) sem o "Pneu instalado (nº)" preenchido. Preencha ou desmarque a posição antes de salvar.',true);
    return;
  }
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
  document.getElementById('mrDelDetails').innerHTML='<div><strong>Placa:</strong> '+(r.PLACA||'-')+'</div><div><strong>Tipo:</strong> '+(r.TIPO_MANUTENCAO||'-')+'</div><div><strong>Data:</strong> '+formatDateBR(r.DATA_MANUTENCAO)+'</div>'+(typeof nfAvisoExclusao==='function'?nfAvisoExclusao('caminhao',id):'');
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

