// ==================== FINANCEIRO ====================
var finMotModo='Ativos'; // filtro Ativos/Inativos/Todos do dropdown de motorista
function buildFinanceiro(){
  var uMot=[],uPla=[],uAb=[],uDe=[],uMon=[];
  var motSet={},plaSet={},abSet={},deSet={},monSet={};
  DB.cadastro.forEach(function(r){
    if(r.MOTORISTA&&!motSet[r.MOTORISTA]){motSet[r.MOTORISTA]=1;uMot.push(r.MOTORISTA)}
    if(r.PLACA&&!plaSet[r.PLACA]){plaSet[r.PLACA]=1;uPla.push(r.PLACA)}
    if(r['LOCAL ABASTECIMENTO']&&!abSet[r['LOCAL ABASTECIMENTO']]){abSet[r['LOCAL ABASTECIMENTO']]=1;uAb.push(r['LOCAL ABASTECIMENTO'])}
    // só as classes que continuam no Financeiro — manutenção tem filtro próprio na aba dela
    if(r['CLASSE DESPESA']&&!deSet[r['CLASSE DESPESA']]&&!classeEhManutencao(r['CLASSE DESPESA'])){deSet[r['CLASSE DESPESA']]=1;uDe.push(r['CLASSE DESPESA'])}
    var my=getMonthYear(r.DATA);if(my&&!monSet[my]){monSet[my]=1;uMon.push(my)}
  });
  uMot.sort();uPla.sort();uAb.sort();uDe.sort();uMon.sort();
  uMot=motoristasFiltrados(uMot, finMotModo); // filtro Ativos/Inativos/Todos
  var uSemF=[],semSetF={};
  DB.cadastro.forEach(function(r){var w=getWeekLabel(r.DATA);if(w&&!semSetF[w]){semSetF[w]=1;uSemF.push(w)}});
  uSemF.sort();
  var daysByMonthF={};
  DB.cadastro.forEach(function(r){if(!r.DATA)return;var my=getMonthYear(r.DATA);var d=r.DATA.slice(0,10);if(!daysByMonthF[my])daysByMonthF[my]={};daysByMonthF[my][d]=1});
  var daysDataF={};uMon.forEach(function(my){daysDataF[my]=Object.keys(daysByMonthF[my]||{}).sort()});

  createFilters('filtersFin',[
    {id:'ffMot',label:'Motorista',options:uMot,onChange:buildFinanceiro},
    {id:'ffPlaca',label:'Placa',options:uPla,onChange:buildFinanceiro},
    {id:'ffAbast',label:'Local Abast.',options:uAb,onChange:buildFinanceiro},
    {id:'ffDesp',label:'Classe Despesa',options:uDe,onChange:buildFinanceiro},
    {id:'ffMes',label:'Mês',options:uMon,optionLabels:uMon.map(getMonthLabel),onChange:buildFinanceiro,dayId:'ffDia',daysData:daysDataF},
    {id:'ffSemana',label:'Semana',options:uSemF,optionLabels:uSemF.map(getWeekDisplay),onChange:buildFinanceiro,linkedMonthId:'ffMes',allWeeks:uSemF},
    {id:'ffUnid',label:'Unidade',options:['TON','M³'],onChange:buildFinanceiro},
    {type:'dateRange',idIni:'ffDtIni',idFim:'ffDtFim',onChange:buildFinanceiro}
  ], motoristaModoSelectHtml('finMotModo', finMotModo, 'buildFinanceiro'), function(){ clearFilters(['ffMot','ffPlaca','ffAbast','ffDesp','ffMes','ffDia','ffUnid','ffSemana','ffDtIni','ffDtFim'],buildFinanceiro); });

  var fM=document.getElementById('ffMot')?document.getElementById('ffMot').value:'';
  var fP=document.getElementById('ffPlaca')?document.getElementById('ffPlaca').value:'';
  var fA=document.getElementById('ffAbast')?document.getElementById('ffAbast').value:'';
  var fD=document.getElementById('ffDesp')?document.getElementById('ffDesp').value:'';
  var fMes=document.getElementById('ffMes')?document.getElementById('ffMes').value:'';
  var fDia=document.getElementById('ffDia')?document.getElementById('ffDia').value:'';
  var fSemF=document.getElementById('ffSemana')?document.getElementById('ffSemana').value:'';
  var fDtIni=document.getElementById('ffDtIni')?document.getElementById('ffDtIni').value:'';
  var fDtFim=document.getElementById('ffDtFim')?document.getElementById('ffDtFim').value:'';
  var fUnid=document.getElementById('ffUnid')?document.getElementById('ffUnid').value:'';
  var hasRangeF=!!(fDtIni||fDtFim);

  var data=DB.cadastro.filter(function(r){
    if(fM&&r.MOTORISTA!==fM) return false;
    if(fP&&r.PLACA!==fP) return false;
    if(fA&&r['LOCAL ABASTECIMENTO']!==fA) return false;
    if(fD&&r['CLASSE DESPESA']!==fD) return false;
    if(hasRangeF){
      if(!dateInRange(r.DATA,fDtIni,fDtFim)) return false;
    } else {
      if(fDia&&r.DATA){if(r.DATA.slice(0,10)!==fDia) return false;}
      else if(fMes&&getMonthYear(r.DATA)!==fMes) return false;
      if(fSemF&&getWeekLabel(r.DATA)!==fSemF) return false;
    }
    return true;
  });

  finFilteredData=data;

  // O gasto de manutenção fica na aba Manutenção (classes marcadas em classes_despesa).
  // Sem este aviso, quem acabou de lançar uma despesa de oficina acha que ela sumiu.
  var nManut=0,vManut=0;
  data.forEach(function(r){ var v=despesaManutencao(r); if(v>0){ nManut++; vManut+=v; } });
  var notaEl=document.getElementById('finManutNota');
  if(notaEl){
    if(nManut>0){
      notaEl.innerHTML='<span class="fin-manut-ico">🔧</span><span><strong>'+nManut+' lançamento'+(nManut>1?'s':'')+' de manutenção</strong> no período, somando R$'+numBR(vManut,2)+
        ' — não entra'+(nManut>1?'m':'')+' nos números abaixo.</span>'+
        '<button class="fin-manut-btn" onclick="navigateTo(&#39;manutencao&#39;)">Ver na aba Manutenção →</button>';
      notaEl.style.display='';
    } else notaEl.style.display='none';
  }

  var tComb=0,tLit=0,tArla=0,tDesp=0,tTON=0,tM3=0,nEntregas=0;
  var placaEntregas={}; // placa -> {ton:qtd, m3:qtd}, pra classificar cada placa pelo tipo predominante
  data.forEach(function(r){
    tComb+=num(r['VALOR TOTAL']);tLit+=num(r['QTDADE LITROS']);tArla+=num(r['ARLA VALOR']);tDesp+=despesaFinanceira(r);
    if(r.ENTREGA&&r.QUANTIDADE){
      nEntregas++;
      var isM3=BASE.clientesM3.includes(r['LOCAL DESCARGA']);
      if(isM3)tM3+=r.QUANTIDADE;else tTON+=r.QUANTIDADE;
      if(r.PLACA){
        if(!placaEntregas[r.PLACA])placaEntregas[r.PLACA]={ton:0,m3:0};
        if(isM3)placaEntregas[r.PLACA].m3+=r.QUANTIDADE;else placaEntregas[r.PLACA].ton+=r.QUANTIDADE;
      }
    }
  });
  var pMedio=tLit>0?tComb/tLit:0;
  var cTotal=tComb+tArla+tDesp;

  // Combustível não é rastreado por entrega — não dá pra saber qual litro abasteceu
  // qual viagem. Em vez de dividir o mesmo custo total pelas toneladas e de novo
  // pelos m³ (dobrando a conta), cada placa é classificada pelo tipo que ela mais
  // entregou no período e seu custo (combustível+arla+despesa) entra só naquele grupo.
  var placasTON={},placasM3={};
  Object.keys(placaEntregas).forEach(function(p){
    var d=placaEntregas[p];
    if(d.m3>d.ton) placasM3[p]=true; else placasTON[p]=true;
  });
  var custoTONGrupo=0,custoM3Grupo=0,qtdTONGrupo=0,qtdM3Grupo=0;
  data.forEach(function(r){
    if(!r.PLACA) return;
    var custoLinha=num(r['VALOR TOTAL'])+num(r['ARLA VALOR'])+despesaFinanceira(r);
    if(placasTON[r.PLACA]) custoTONGrupo+=custoLinha;
    else if(placasM3[r.PLACA]) custoM3Grupo+=custoLinha;
  });
  Object.keys(placaEntregas).forEach(function(p){
    var d=placaEntregas[p];
    if(placasTON[p]) qtdTONGrupo+=d.ton;
    else if(placasM3[p]) qtdM3Grupo+=d.m3;
  });
  var cTON=qtdTONGrupo>0?custoTONGrupo/qtdTONGrupo:0;
  var cM3=qtdM3Grupo>0?custoM3Grupo/qtdM3Grupo:0;
  var qtdPlacasMistas=Object.keys(placaEntregas).filter(function(p){var d=placaEntregas[p];return d.ton>0&&d.m3>0;}).length;
  var cEntrega=nEntregas>0?cTotal/nEntregas:0;

  // Card de custo unitário: por padrão mostra Custo/Entrega (exato, não depende de
  // unidade). Só quando o usuário filtra Unidade que mostramos Custo/TON ou Custo/M³
  // (estimados pela placa dominante, ver comentário acima).
  var cardUnid;
  if(fUnid==='TON'){
    cardUnid='<div class="kpi-card" title="Custo (combustível+arla+despesa) das placas cuja maioria das entregas no período foi em toneladas, dividido pelas toneladas entregues por elas"><div class="kpi-icon">💰</div><div class="kpi-value">R$'+numBR(cTON,2)+'</div><div class="kpi-label">Custo/TON</div></div>';
  } else if(fUnid==='M³'){
    cardUnid='<div class="kpi-card" title="Combustível não é rastreado por entrega. Estimativa: custo das placas cuja maioria das entregas no período foi em m³'+(qtdPlacasMistas?' ('+qtdPlacasMistas+' placa'+(qtdPlacasMistas>1?'s':'')+' com uso misto no período)':'')+', dividido pelos m³ entregues por elas"><div class="kpi-icon">💰</div><div class="kpi-value">≈&nbsp;R$'+numBR(cM3,2)+'</div><div class="kpi-label">Custo/M³</div></div>';
  } else {
    cardUnid='<div class="kpi-card" title="Custo total (combustível+arla+despesa) dividido pelo número de entregas do período. Combustível não é rastreado por entrega, então não dá pra separar por TON/M³ sem filtrar a Unidade"><div class="kpi-icon">💰</div><div class="kpi-value">R$'+numBR(cEntrega,2)+'</div><div class="kpi-label">Custo/Entrega</div></div>';
  }

  // Trends (comparing selected month vs previous month)
  var trendMonthF=fMes||null;
  var trendComb=calcMonthTrend(DB.cadastro,'VALOR TOTAL',function(r){return num(r['VALOR TOTAL'])>0},trendMonthF);
  var trendLit=calcMonthTrend(DB.cadastro,'QTDADE LITROS',function(r){return num(r['QTDADE LITROS'])>0},trendMonthF);
  var trendDesp=calcMonthTrend(DB.cadastro,'VALOR DESPESA',function(r){return despesaFinanceira(r)>0},trendMonthF);

  document.getElementById('kpiFin').innerHTML=
    '<div class="kpi-card"><div class="kpi-top"><div class="kpi-icon">⛽</div>'+trendBadge(trendComb.current,trendComb.previous)+'</div><div class="kpi-value">R$'+numBR(tComb,2)+'</div><div class="kpi-label">Total Combustível</div></div>'+
    '<div class="kpi-card"><div class="kpi-top"><div class="kpi-icon">🪣</div>'+trendBadge(trendLit.current,trendLit.previous)+'</div><div class="kpi-value">'+numBR(tLit,0)+' L</div><div class="kpi-label">Total Litros</div></div>'+
    '<div class="kpi-card"><div class="kpi-icon">📊</div><div class="kpi-value">R$'+numBR(pMedio,2)+'</div><div class="kpi-label">Preço Médio/Litro</div></div>'+
    '<div class="kpi-card"><div class="kpi-icon">🧴</div><div class="kpi-value">R$'+numBR(tArla,2)+'</div><div class="kpi-label">Total ARLA</div></div>'+
    '<div class="kpi-card"><div class="kpi-top"><div class="kpi-icon">💸</div>'+trendBadge(trendDesp.current,trendDesp.previous)+'</div><div class="kpi-value">R$'+numBR(tDesp,2)+'</div><div class="kpi-label">Total Despesas</div></div>'+
    '<div class="kpi-card"><div class="kpi-icon">💰</div><div class="kpi-value">R$'+numBR(cTotal,2)+'</div><div class="kpi-label">Custo Total</div></div>'+
    cardUnid;

  var colors=cc();
  document.getElementById('chartsFin').innerHTML=
    '<div class="chart-card"><div class="chart-title">Combustível + ARLA por Mês <span class="chart-badge">R$</span></div><div class="chart-container"><canvas id="cFinMensal"></canvas></div></div>'+
    '<div class="chart-card"><div class="chart-title">Despesas por Categoria <span class="chart-badge">clique para detalhar</span></div><div class="chart-container"><canvas id="cFinDesp" style="cursor:pointer"></canvas></div></div>'+
    '<div class="chart-card"><div class="chart-title">Abastecimento por Posto <span class="chart-title-dir"><span class="chart-badge">R$</span><button class="chart-btn-rel" onclick="exportFinPostoPDF()" title="Gerar o relatório deste gráfico em tabela">📋 Relatório</button></span></div><div class="chart-container"><canvas id="cFinPosto"></canvas></div></div>'+
    '<div class="chart-card"><div class="chart-title">Despesas por Motorista <span class="chart-badge">R$</span></div><div class="chart-container"><canvas id="cFinMotDesp"></canvas></div></div>';

  var mf={};data.forEach(function(r){var my=getMonthYear(r.DATA);if(!my)return;if(!mf[my])mf[my]={c:0,a:0};mf[my].c+=num(r['VALOR TOTAL']);mf[my].a+=num(r['ARLA VALOR'])});
  var mfL=Object.keys(mf).sort();
  destroyChart('cFinMensal');
  var ctxFM=document.getElementById('cFinMensal').getContext('2d');
  chartInstances['cFinMensal']=new Chart(ctxFM,{type:'bar',data:{labels:mfL.map(getMonthLabel),datasets:[{label:'Combustível',data:mfL.map(function(m){return mf[m].c}),backgroundColor:makeGrad(ctxFM,'rgba(59,130,246,0.8)','rgba(59,130,246,0.1)'),borderRadius:8,borderSkipped:false,barPercentage:0.5},{label:'ARLA',data:mfL.map(function(m){return mf[m].a}),backgroundColor:makeGrad(ctxFM,'rgba(168,85,247,0.8)','rgba(168,85,247,0.1)'),borderRadius:8,borderSkipped:false,barPercentage:0.5}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:colors.text}}},scales:{x:{ticks:{color:colors.text},grid:{display:false}},y:{ticks:{color:colors.text,callback:function(v){return 'R$'+numBR(v)}},grid:{color:colors.grid}}}}});

  var dc={};data.forEach(function(r){if(r['CLASSE DESPESA']&&despesaFinanceira(r)>0)dc[r['CLASSE DESPESA']]=(dc[r['CLASSE DESPESA']]||0)+despesaFinanceira(r)});
  var dce=Object.entries(dc).sort(function(a,b){return b[1]-a[1]});
  destroyChart('cFinDesp');
  var despLabels=dce.map(function(d){return d[0]});
  chartInstances['cFinDesp']=new Chart(document.getElementById('cFinDesp'),{type:'polarArea',data:{labels:despLabels,datasets:[{data:dce.map(function(d){return d[1]}),backgroundColor:modernColors.map(function(c){return c+'99'}),borderWidth:0}]},options:{responsive:true,maintainAspectRatio:false,onClick:function(evt,elements){
    if(elements.length>0){var idx=elements[0].index;showDespesaDetail(despLabels[idx]);}
  },plugins:{legend:{position:'right',labels:{color:colors.text,font:{size:11},generateLabels:function(chart){
    var ds=chart.data.datasets[0];var txtC=document.body.classList.contains('light')?'#1f2937':'#8b95a8';return chart.data.labels.map(function(l,i){return{text:l+' (R$ '+numBR(ds.data[i],2)+')',fillStyle:ds.backgroundColor[i],fontColor:txtC,strokeStyle:'transparent',index:i}});}
  }}},scales:{r:{ticks:{display:false},grid:{color:'rgba(255,255,255,0.04)'}}}}});

  var pv={};data.forEach(function(r){var labast=r['LOCAL ABASTECIMENTO']||r['LOCAL ABASTECIEMNTO'];if(labast&&r['VALOR TOTAL'])pv[labast]=(pv[labast]||0)+num(r['VALOR TOTAL'])});
  var pve=Object.entries(pv).sort(function(a,b){return b[1]-a[1]});
  destroyChart('cFinPosto');
  var ctxFP=document.getElementById('cFinPosto').getContext('2d');
  chartInstances['cFinPosto']=new Chart(ctxFP,{type:'bar',data:{labels:pve.map(function(p){return p[0]}),datasets:[{data:pve.map(function(p){return p[1]}),backgroundColor:makeGrad(ctxFP,'rgba(0,229,255,0.85)','rgba(0,229,255,0.1)'),borderRadius:8,borderSkipped:false,barPercentage:0.6}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{color:colors.text,font:{size:10}},grid:{display:false}},y:{ticks:{color:colors.text,callback:function(v){return 'R$'+numBR(v)}},grid:{color:colors.grid}}}}});

  var md2={};data.forEach(function(r){if(r.MOTORISTA&&despesaFinanceira(r)>0)md2[r.MOTORISTA]=(md2[r.MOTORISTA]||0)+despesaFinanceira(r)});
  var mde=Object.entries(md2).sort(function(a,b){return b[1]-a[1]});
  destroyChart('cFinMotDesp');
  var ctxFD=document.getElementById('cFinMotDesp').getContext('2d');
  chartInstances['cFinMotDesp']=new Chart(ctxFD,{type:'bar',data:{labels:mde.map(function(m){return m[0]}),datasets:[{data:mde.map(function(m){return m[1]}),backgroundColor:makeGradH(ctxFD,'rgba(239,68,68,0.85)','rgba(239,68,68,0.2)'),borderRadius:6,borderSkipped:false,barPercentage:0.55}]},options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{color:colors.text,callback:function(v){return 'R$'+numBR(v)}},grid:{color:colors.grid}},y:{ticks:{color:colors.text,font:{size:11,weight:'500'}},grid:{display:false}}}}});

  var finRows=data.filter(function(r){return r['VALOR TOTAL']||despesaFinanceira(r)>0||r['ARLA VALOR']}).sort(function(a,b){return(b.DATA||'').localeCompare(a.DATA||'')});
  var canEditFin=currentUserData&&(currentUserData.perfil==='ADMIN'||currentUserData.perfil==='ANALISTA');
  var tH='<div class="table-header"><h3>Detalhamento Financeiro</h3><span class="chart-badge">'+finRows.length+' registros</span></div><div class="table-scroll"><table><thead><tr><th>Data</th><th>Motorista</th><th>Placa</th><th>Posto</th><th>Litros</th><th>Vlr Unit.</th><th>Vlr Total</th><th>ARLA</th><th>Classe</th><th>Vlr Desp.</th>'+(canEditFin?'<th>Ações</th>':'')+'</tr></thead><tbody>';
  finRows.forEach(function(r){
    var actCell='';
    if(canEditFin){
      var canEditThis=currentUserData.perfil==='ADMIN'||(r.USUARIO===currentUserData.nome||r.USUARIO===currentUserData.usuario);
      actCell='<td>'+(canEditThis?'<button class="btn-edit-row" onclick="openEditModal(\''+rowKeyAttr(r)+'\')" title="Editar">✏️</button>':'<span style="color:#888;font-size:11px">-</span>')+'</td>';
    }
    tH+='<tr><td style="font-family:JetBrains Mono,monospace;font-size:11px">'+formatDateBR(r.DATA)+'</td><td>'+(r.MOTORISTA||'-')+'</td><td style="font-family:JetBrains Mono,monospace;font-size:11px;color:var(--accent)">'+(r.PLACA||'-')+'</td><td>'+(r['LOCAL ABASTECIMENTO']||'-')+'</td><td style="font-family:JetBrains Mono,monospace;font-size:11px">'+(r['QTDADE LITROS']?numBR(r['QTDADE LITROS'],1):'-')+'</td><td style="font-family:JetBrains Mono,monospace;font-size:11px">'+(r['VALOR UNITARIO']?'R$'+numBR(r['VALOR UNITARIO'],2):'-')+'</td><td style="font-family:JetBrains Mono,monospace;font-size:11px;color:#22c55e">'+(r['VALOR TOTAL']?'R$'+numBR(r['VALOR TOTAL'],2):'-')+'</td><td style="font-family:JetBrains Mono,monospace;font-size:11px">'+(r['ARLA VALOR']?'R$'+numBR(r['ARLA VALOR'],2):'-')+'</td><td>'+(despesaFinanceira(r)>0?(r['CLASSE DESPESA']||'-'):'-')+'</td><td style="font-family:JetBrains Mono,monospace;font-size:11px;color:#ef4444">'+(despesaFinanceira(r)>0?'R$'+numBR(despesaFinanceira(r),2):'-')+'</td>'+actCell+'</tr>';
  });
  tH+='</tbody></table></div>';
  document.getElementById('tblFin').innerHTML=tH;
}

// ==================== RELATÓRIOS EM PDF DO FINANCEIRO ====================
// Dois relatórios saem desta aba (o analítico geral e o de abastecimento por posto) e
// os dois usam a mesma folha: retrato, cabeçalho verde com logo, filtros aplicados,
// uma linha de cards e tabela. O cabeçalho e o estilo ficam aqui para não virarem duas
// cópias que vão divergindo a cada ajuste. Mesma aparência do Relatório Analítico de
// Entregas da Produção (js/producao.js).
function _finRelEsc(t){ return String(t==null?'':t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function _finRelCabecalho(titulo,filtrosTxt){
  var logoEl=document.querySelector('.sidebar-logo img');
  var logoSrc=logoEl?logoEl.src:'';
  var html='<!DOCTYPE html><html><head><meta charset="UTF-8"><title>'+_finRelEsc(titulo)+'</title><style>';
  html+='*{margin:0;padding:0;box-sizing:border-box}';
  html+='body{font-family:Arial,sans-serif;padding:14px;color:#222;font-size:10px}';
  html+='.rep-head{display:flex;align-items:center;gap:14px;border-bottom:2px solid #0D692C;padding-bottom:10px;margin-bottom:12px}';
  html+='.rep-head img{width:54px;height:54px;border-radius:8px;object-fit:cover}';
  html+='.rep-head h1{font-size:18px;color:#085425;line-height:1.1}';
  html+='.rep-head .sub{font-size:11px;color:#444;margin-top:2px}';
  html+='.rep-head .gen{font-size:9px;color:#888;margin-top:3px}';
  html+='.aviso{border:1px solid #d9b382;background:#fdf6ec;border-radius:6px;padding:6px 9px;font-size:9px;color:#6b4e16;margin-bottom:12px}';
  html+='.kpi-row{display:grid;gap:6px;margin-bottom:14px}';
  html+='.kpi-card{border:1px solid #ccc;border-radius:8px;padding:6px 3px;text-align:center}';
  html+='.kpi-icon{font-size:12px;margin-bottom:2px}';
  html+='.kpi-value{font-size:13px;font-weight:700;color:#085425}';
  html+='.kpi-label{font-size:7px;text-transform:uppercase;color:#666;margin-top:2px;letter-spacing:.2px}';
  html+='table{width:100%;border-collapse:collapse;table-layout:fixed}';
  html+='th,td{border:1px solid #ccc;padding:3px 4px;font-size:8px;text-align:center;vertical-align:middle;overflow-wrap:anywhere}';
  html+='th{background:#0D692C;color:#fff;font-weight:600;font-size:7.5px;text-transform:uppercase}';
  html+='tbody tr:nth-child(even){background:#f4f8fb}';
  html+='td.num{text-align:right;font-variant-numeric:tabular-nums}';
  html+='td.esq{text-align:left}';
  html+='tfoot td{background:#eaf2ea;font-weight:700;font-size:8.5px;border-top:2px solid #0D692C}';
  html+='thead{display:table-header-group}tr{page-break-inside:avoid}';
  html+='.foot{margin-top:10px;font-size:9px;color:#666;text-align:center}';
  html+='@page{size:portrait;margin:10mm}';
  html+='@media print{body{padding:0}}';
  html+='</style></head><body>';
  html+='<div class="rep-head">';
  if(logoSrc) html+='<img src="'+logoSrc+'" alt="Logo">';
  html+='<div><h1>BIOMASSA CHAPARINI</h1>';
  html+='<div class="sub">'+_finRelEsc(titulo)+'</div>';
  html+='<div class="sub"><b>Filtros:</b> '+_finRelEsc(filtrosTxt)+'</div>';
  html+='<div class="gen">Gerado em '+new Date().toLocaleString('pt-BR')+'</div>';
  html+='</div></div>';
  return html;
}

// cards numa linha só, largura dividida igualmente: [[icone, valor, rótulo], ...]
function _finRelCards(cards){
  var html='<div class="kpi-row" style="grid-template-columns:repeat('+cards.length+',1fr)">';
  cards.forEach(function(c){
    html+='<div class="kpi-card"><div class="kpi-icon">'+c[0]+'</div><div class="kpi-value">'+c[1]+'</div><div class="kpi-label">'+c[2]+'</div></div>';
  });
  return html+'</div>';
}

function _finRelFechar(win,html){
  html+='<script>window.onload=function(){setTimeout(function(){window.print()},300)}<'+'/script>';
  html+='</body></html>';
  win.document.write(html);
  win.document.close();
}

// Descrição dos filtros da aba, do jeito que vai impressa no cabeçalho. A Unidade fica
// de fora de propósito: no Financeiro ela só troca o card de custo unitário, não filtra
// linha nenhuma (ver buildFinanceiro) — listá-la faria o relatório prometer um recorte
// que não existe.
function _finRelFiltrosTxt(){
  var v=function(id){ var e=document.getElementById(id); return e?e.value:''; };
  var fDtIni=v('ffDtIni'), fDtFim=v('ffDtFim'), fDia=v('ffDia'), fSem=v('ffSemana'), fMes=v('ffMes');
  var fl=[];
  if(fDtIni||fDtFim) fl.push('Período: '+(fDtIni?formatDateBR(fDtIni):'(início)')+' até '+(fDtFim?formatDateBR(fDtFim):'(hoje)'));
  else if(fDia) fl.push('Dia: '+formatDateBR(fDia));
  else if(fSem) fl.push('Semana: '+getWeekDisplay(fSem));
  else if(fMes) fl.push('Mês: '+getMonthLabel(fMes));
  if(v('ffMot')) fl.push('Motorista: '+v('ffMot'));
  if(v('ffPlaca')) fl.push('Placa: '+v('ffPlaca'));
  if(v('ffAbast')) fl.push('Local Abast.: '+v('ffAbast'));
  if(v('ffDesp')) fl.push('Classe Despesa: '+v('ffDesp'));
  return fl.join(' · ')||'Todos os períodos';
}

// Relatório Analítico Financeiro — mesmo molde do Relatório Analítico de Entregas
// (js/producao.js): folha em retrato, cabeçalho com logo, uma linha de cards e o
// detalhamento embaixo. Aqui os cards são os cinco que interessam no fechamento:
// combustível, preço médio/litro, arla, despesas e custo total.
//
// Lê o MESMO recorte que está na tela (finFilteredData, preenchido por buildFinanceiro),
// em vez de refiltrar DB.cadastro por conta própria — assim o papel nunca discorda do
// que a pessoa está vendo. Despesa sai por despesaFinanceira(), que tira a manutenção;
// se houver manutenção no período, o cabeçalho avisa, senão o custo total do relatório
// parece menor que o gasto real do mês sem explicação nenhuma.
function exportFinAnaliticoPDF(){
  // a janela abre já no clique: se esperar o processamento, o navegador bloqueia calado
  var win=window.open('','_blank');
  if(!win){ showToast('Seu navegador bloqueou a janela do PDF. Permita pop-ups para este site.',true); return; }

  var data=finFilteredData||[];

  var tComb=0,tLit=0,tArla=0,tDesp=0,vManut=0,nManut=0;
  data.forEach(function(r){
    tComb+=num(r['VALOR TOTAL']);
    tLit+=num(r['QTDADE LITROS']);
    tArla+=num(r['ARLA VALOR']);
    tDesp+=despesaFinanceira(r);
    var m=despesaManutencao(r);
    if(m>0){ vManut+=m; nManut++; }
  });
  var pMedio=tLit>0?tComb/tLit:0;
  var cTotal=tComb+tArla+tDesp;

  // as mesmas linhas da tabela da tela: só o que tem algum valor financeiro
  var rows=data.filter(function(r){ return r['VALOR TOTAL']||despesaFinanceira(r)>0||r['ARLA VALOR']; })
               .sort(function(a,b){ return String(b.DATA||'').localeCompare(String(a.DATA||'')); });

  var esc=_finRelEsc;
  var html=_finRelCabecalho('Relatório Analítico Financeiro',_finRelFiltrosTxt());

  if(nManut>0){
    html+='<div class="aviso">🔧 <b>'+nManut+' lançamento'+(nManut>1?'s':'')+' de manutenção</b> no período, somando R$'+numBR(vManut,2)+
          ', não entra'+(nManut>1?'m':'')+' neste relatório — esse gasto é apresentado na aba Manutenção.</div>';
  }

  html+=_finRelCards([
    ['⛽','R$'+numBR(tComb,2),'Total Combustível'],
    ['📊','R$'+numBR(pMedio,2),'Preço Médio/Litro'],
    ['🧴','R$'+numBR(tArla,2),'Total ARLA'],
    ['💸','R$'+numBR(tDesp,2),'Total Despesas'],
    ['💰','R$'+numBR(cTotal,2),'Custo Total']
  ]);

  if(!rows.length){
    html+='<p style="padding:20px;text-align:center;color:#888">Nenhum lançamento financeiro encontrado para os filtros aplicados.</p>';
  } else {
    html+='<table><colgroup><col style="width:8%"><col style="width:16%"><col style="width:9%"><col style="width:15%">'+
          '<col style="width:7%"><col style="width:8%"><col style="width:9%"><col style="width:8%"><col style="width:12%"><col style="width:8%"></colgroup>';
    html+='<thead><tr><th>Data</th><th>Motorista</th><th>Placa</th><th>Posto</th><th>Litros</th><th>Vlr Unit.</th><th>Vlr Total</th><th>ARLA</th><th>Classe</th><th>Vlr Desp.</th></tr></thead><tbody>';
    rows.forEach(function(r){
      var dsp=despesaFinanceira(r);
      html+='<tr><td>'+formatDateBR(r.DATA)+'</td>'+
        '<td>'+esc(r.MOTORISTA||'-')+'</td>'+
        '<td>'+esc(r.PLACA||'-')+'</td>'+
        '<td>'+esc(r['LOCAL ABASTECIMENTO']||'-')+'</td>'+
        '<td class="num">'+(r['QTDADE LITROS']?numBR(r['QTDADE LITROS'],1):'-')+'</td>'+
        '<td class="num">'+(r['VALOR UNITARIO']?'R$'+numBR(r['VALOR UNITARIO'],2):'-')+'</td>'+
        '<td class="num">'+(r['VALOR TOTAL']?'R$'+numBR(r['VALOR TOTAL'],2):'-')+'</td>'+
        '<td class="num">'+(r['ARLA VALOR']?'R$'+numBR(r['ARLA VALOR'],2):'-')+'</td>'+
        '<td>'+(dsp>0?esc(r['CLASSE DESPESA']||'-'):'-')+'</td>'+
        '<td class="num">'+(dsp>0?'R$'+numBR(dsp,2):'-')+'</td></tr>';
    });
    html+='</tbody></table>';
    html+='<div class="foot">'+rows.length+' lançamento(s) · '+numBR(tLit,0)+' L abastecidos · Custo total do período: R$'+numBR(cTotal,2)+'</div>';
  }

  _finRelFechar(win,html);
}

// Relatório do gráfico "Abastecimento por Posto": a mesma informação da barra, em tabela.
// Botão pequeno no título do card (ver chartsFin em buildFinanceiro).
//
// A soma por posto repete exatamente a do gráfico, inclusive o fallback da chave com o
// nome errado ('LOCAL ABASTECIEMNTO'), que existe em lançamento antigo — sem ele a tabela
// não fecharia com a barra. A tabela acrescenta o que o gráfico não mostra mas vem das
// mesmas linhas: nº de abastecimentos, litros, preço médio por litro e o % do total.
function exportFinPostoPDF(){
  var win=window.open('','_blank');
  if(!win){ showToast('Seu navegador bloqueou a janela do PDF. Permita pop-ups para este site.',true); return; }

  var data=finFilteredData||[];
  var por={}, tVal=0, tLit=0, tN=0, litSemValor=0;
  data.forEach(function(r){
    var posto=r['LOCAL ABASTECIMENTO']||r['LOCAL ABASTECIEMNTO'];
    if(!posto) return;
    var val=num(r['VALOR TOTAL']), lit=num(r['QTDADE LITROS']);
    if(val<=0&&lit<=0) return;   // linha sem abastecimento nenhum
    posto=String(posto).trim();
    if(!por[posto]) por[posto]={n:0,lit:0,val:0,litSemValor:0};
    var p=por[posto];
    p.n++; p.lit+=lit; p.val+=val;
    tN++; tLit+=lit; tVal+=val;
    // litro sem preço lançado (abastecimento em tanque antigo) puxa o preço médio pra
    // baixo; fica contado à parte pra poder avisar embaixo da tabela.
    if(val<=0&&lit>0){ p.litSemValor+=lit; litSemValor+=lit; }
  });
  var postos=Object.keys(por).sort(function(a,b){ return por[b].val-por[a].val; }); // mesma ordem da barra
  var pMedioGeral=tLit>0?tVal/tLit:0;

  var html=_finRelCabecalho('Abastecimento por Posto',_finRelFiltrosTxt());
  html+=_finRelCards([
    ['⛽','R$'+numBR(tVal,2),'Total Combustível'],
    ['🪣',numBR(tLit,0)+' L','Total Litros'],
    ['📊','R$'+numBR(pMedioGeral,2),'Preço Médio/Litro'],
    ['🏪',String(postos.length),postos.length===1?'Posto':'Postos']
  ]);

  if(!postos.length){
    html+='<p style="padding:20px;text-align:center;color:#888">Nenhum abastecimento encontrado para os filtros aplicados.</p>';
  } else {
    html+='<table><colgroup><col style="width:34%"><col style="width:10%"><col style="width:13%"><col style="width:14%"><col style="width:17%"><col style="width:12%"></colgroup>';
    html+='<thead><tr><th>Posto</th><th>Abast.</th><th>Litros</th><th>Preço Médio/L</th><th>Valor Total</th><th>% do Total</th></tr></thead><tbody>';
    postos.forEach(function(nome){
      var p=por[nome];
      var pm=p.lit>0?p.val/p.lit:0;
      var pct=tVal>0?(p.val/tVal*100):0;
      html+='<tr><td class="esq">'+_finRelEsc(nome)+(p.litSemValor>0?' *':'')+'</td>'+
        '<td class="num">'+p.n+'</td>'+
        '<td class="num">'+numBR(p.lit,1)+'</td>'+
        '<td class="num">'+(p.lit>0?'R$'+numBR(pm,2):'-')+'</td>'+
        '<td class="num">R$'+numBR(p.val,2)+'</td>'+
        '<td class="num">'+numBR(pct,1)+'%</td></tr>';
    });
    html+='</tbody><tfoot><tr><td class="esq">TOTAL</td>'+
      '<td class="num">'+tN+'</td>'+
      '<td class="num">'+numBR(tLit,1)+'</td>'+
      '<td class="num">R$'+numBR(pMedioGeral,2)+'</td>'+
      '<td class="num">R$'+numBR(tVal,2)+'</td>'+
      '<td class="num">100,0%</td></tr></tfoot></table>';
    if(litSemValor>0){
      html+='<div class="aviso" style="margin-top:10px">* '+numBR(litSemValor,0)+' L abastecidos sem preço lançado '+
            '(abastecimento em tanque sem preço de compra registrado). Esses litros entram na coluna Litros, '+
            'mas não no Valor Total — o preço médio dos postos marcados fica abaixo do real.</div>';
    }
    html+='<div class="foot">'+postos.length+' posto(s) · '+tN+' abastecimento(s) · '+numBR(tLit,0)+' L · R$'+numBR(tVal,2)+'</div>';
  }

  _finRelFechar(win,html);
}

