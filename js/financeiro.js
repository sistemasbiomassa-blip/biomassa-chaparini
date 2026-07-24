// ==================== FINANCEIRO ====================
var finMotModo='Ativos'; // filtro Ativos/Inativos/Todos do dropdown de motorista
function buildFinanceiro(){
  var uMot=[],uPla=[],uAb=[],uDe=[],uMon=[];
  var motSet={},plaSet={},abSet={},deSet={},monSet={};
  DB.cadastro.forEach(function(r){
    if(r.MOTORISTA&&!motSet[r.MOTORISTA]){motSet[r.MOTORISTA]=1;uMot.push(r.MOTORISTA)}
    if(r.PLACA&&!plaSet[r.PLACA]){plaSet[r.PLACA]=1;uPla.push(r.PLACA)}
    if(r['LOCAL ABASTECIMENTO']&&!abSet[r['LOCAL ABASTECIMENTO']]){abSet[r['LOCAL ABASTECIMENTO']]=1;uAb.push(r['LOCAL ABASTECIMENTO'])}
    if(r['CLASSE DESPESA']&&!deSet[r['CLASSE DESPESA']]){deSet[r['CLASSE DESPESA']]=1;uDe.push(r['CLASSE DESPESA'])}
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
  var tComb=0,tLit=0,tArla=0,tDesp=0,tTON=0,tM3=0;
  data.forEach(function(r){
    tComb+=num(r['VALOR TOTAL']);tLit+=num(r['QTDADE LITROS']);tArla+=num(r['ARLA VALOR']);tDesp+=num(r['VALOR DESPESA']);
    if(r.ENTREGA&&r.QUANTIDADE){if(BASE.clientesM3.includes(r['LOCAL DESCARGA']))tM3+=r.QUANTIDADE;else tTON+=r.QUANTIDADE;}
  });
  var pMedio=tLit>0?tComb/tLit:0;
  var cTotal=tComb+tArla+tDesp;
  var cTON=tTON>0?cTotal/tTON:0;
  var cM3=tM3>0?cTotal/tM3:0;

  // Trends (comparing selected month vs previous month)
  var trendMonthF=fMes||null;
  var trendComb=calcMonthTrend(DB.cadastro,'VALOR TOTAL',function(r){return num(r['VALOR TOTAL'])>0},trendMonthF);
  var trendLit=calcMonthTrend(DB.cadastro,'QTDADE LITROS',function(r){return num(r['QTDADE LITROS'])>0},trendMonthF);
  var trendDesp=calcMonthTrend(DB.cadastro,'VALOR DESPESA',function(r){return num(r['VALOR DESPESA'])>0},trendMonthF);

  document.getElementById('kpiFin').innerHTML=
    '<div class="kpi-card"><div class="kpi-top"><div class="kpi-icon">⛽</div>'+trendBadge(trendComb.current,trendComb.previous)+'</div><div class="kpi-value">R$'+numBR(tComb,2)+'</div><div class="kpi-label">Total Combustível</div></div>'+
    '<div class="kpi-card"><div class="kpi-top"><div class="kpi-icon">🪣</div>'+trendBadge(trendLit.current,trendLit.previous)+'</div><div class="kpi-value">'+numBR(tLit,0)+' L</div><div class="kpi-label">Total Litros</div></div>'+
    '<div class="kpi-card"><div class="kpi-icon">📊</div><div class="kpi-value">R$'+numBR(pMedio,2)+'</div><div class="kpi-label">Preço Médio/Litro</div></div>'+
    '<div class="kpi-card"><div class="kpi-icon">🧴</div><div class="kpi-value">R$'+numBR(tArla,2)+'</div><div class="kpi-label">Total ARLA</div></div>'+
    '<div class="kpi-card"><div class="kpi-top"><div class="kpi-icon">💸</div>'+trendBadge(trendDesp.current,trendDesp.previous)+'</div><div class="kpi-value">R$'+numBR(tDesp,2)+'</div><div class="kpi-label">Total Despesas</div></div>'+
    '<div class="kpi-card"><div class="kpi-icon">💰</div><div class="kpi-value">R$'+numBR(cTotal,2)+'</div><div class="kpi-label">Custo Total</div></div>'+
    '<div class="kpi-card"><div class="kpi-icon">💰</div><div class="kpi-value">R$'+numBR(cTON,2)+'</div><div class="kpi-label">Custo/TON</div></div>'+
    '<div class="kpi-card"><div class="kpi-icon">💰</div><div class="kpi-value">R$'+numBR(cM3,2)+'</div><div class="kpi-label">Custo/M³</div></div>';

  var colors=cc();
  document.getElementById('chartsFin').innerHTML=
    '<div class="chart-card"><div class="chart-title">Combustível + ARLA por Mês <span class="chart-badge">R$</span></div><div class="chart-container"><canvas id="cFinMensal"></canvas></div></div>'+
    '<div class="chart-card"><div class="chart-title">Despesas por Categoria <span class="chart-badge">clique para detalhar</span></div><div class="chart-container"><canvas id="cFinDesp" style="cursor:pointer"></canvas></div></div>'+
    '<div class="chart-card"><div class="chart-title">Abastecimento por Posto <span class="chart-badge">R$</span></div><div class="chart-container"><canvas id="cFinPosto"></canvas></div></div>'+
    '<div class="chart-card"><div class="chart-title">Despesas por Motorista <span class="chart-badge">R$</span></div><div class="chart-container"><canvas id="cFinMotDesp"></canvas></div></div>';

  var mf={};data.forEach(function(r){var my=getMonthYear(r.DATA);if(!my)return;if(!mf[my])mf[my]={c:0,a:0};mf[my].c+=num(r['VALOR TOTAL']);mf[my].a+=num(r['ARLA VALOR'])});
  var mfL=Object.keys(mf).sort();
  destroyChart('cFinMensal');
  var ctxFM=document.getElementById('cFinMensal').getContext('2d');
  chartInstances['cFinMensal']=new Chart(ctxFM,{type:'bar',data:{labels:mfL.map(getMonthLabel),datasets:[{label:'Combustível',data:mfL.map(function(m){return mf[m].c}),backgroundColor:makeGrad(ctxFM,'rgba(59,130,246,0.8)','rgba(59,130,246,0.1)'),borderRadius:8,borderSkipped:false,barPercentage:0.5},{label:'ARLA',data:mfL.map(function(m){return mf[m].a}),backgroundColor:makeGrad(ctxFM,'rgba(168,85,247,0.8)','rgba(168,85,247,0.1)'),borderRadius:8,borderSkipped:false,barPercentage:0.5}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:colors.text}}},scales:{x:{ticks:{color:colors.text},grid:{display:false}},y:{ticks:{color:colors.text,callback:function(v){return 'R$'+numBR(v)}},grid:{color:colors.grid}}}}});

  var dc={};data.forEach(function(r){if(r['CLASSE DESPESA']&&r['VALOR DESPESA'])dc[r['CLASSE DESPESA']]=(dc[r['CLASSE DESPESA']]||0)+num(r['VALOR DESPESA'])});
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

  var md2={};data.forEach(function(r){if(r.MOTORISTA&&r['VALOR DESPESA'])md2[r.MOTORISTA]=(md2[r.MOTORISTA]||0)+num(r['VALOR DESPESA'])});
  var mde=Object.entries(md2).sort(function(a,b){return b[1]-a[1]});
  destroyChart('cFinMotDesp');
  var ctxFD=document.getElementById('cFinMotDesp').getContext('2d');
  chartInstances['cFinMotDesp']=new Chart(ctxFD,{type:'bar',data:{labels:mde.map(function(m){return m[0]}),datasets:[{data:mde.map(function(m){return m[1]}),backgroundColor:makeGradH(ctxFD,'rgba(239,68,68,0.85)','rgba(239,68,68,0.2)'),borderRadius:6,borderSkipped:false,barPercentage:0.55}]},options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{color:colors.text,callback:function(v){return 'R$'+numBR(v)}},grid:{color:colors.grid}},y:{ticks:{color:colors.text,font:{size:11,weight:'500'}},grid:{display:false}}}}});

  var finRows=data.filter(function(r){return r['VALOR TOTAL']||r['VALOR DESPESA']||r['ARLA VALOR']}).sort(function(a,b){return(b.DATA||'').localeCompare(a.DATA||'')});
  var canEditFin=currentUserData&&(currentUserData.perfil==='ADMIN'||currentUserData.perfil==='ANALISTA');
  var tH='<div class="table-header"><h3>Detalhamento Financeiro</h3><span class="chart-badge">'+finRows.length+' registros</span></div><div class="table-scroll"><table><thead><tr><th>Data</th><th>Motorista</th><th>Placa</th><th>Posto</th><th>Litros</th><th>Vlr Unit.</th><th>Vlr Total</th><th>ARLA</th><th>Classe</th><th>Vlr Desp.</th>'+(canEditFin?'<th>Ações</th>':'')+'</tr></thead><tbody>';
  finRows.forEach(function(r){
    var actCell='';
    if(canEditFin){
      var canEditThis=currentUserData.perfil==='ADMIN'||(r.USUARIO===currentUserData.nome||r.USUARIO===currentUserData.usuario);
      actCell='<td>'+(canEditThis?'<button class="btn-edit-row" onclick="openEditModal(\''+rowKeyAttr(r)+'\')" title="Editar">✏️</button>':'<span style="color:#888;font-size:11px">-</span>')+'</td>';
    }
    tH+='<tr><td style="font-family:JetBrains Mono,monospace;font-size:11px">'+formatDateBR(r.DATA)+'</td><td>'+(r.MOTORISTA||'-')+'</td><td style="font-family:JetBrains Mono,monospace;font-size:11px;color:var(--accent)">'+(r.PLACA||'-')+'</td><td>'+(r['LOCAL ABASTECIMENTO']||'-')+'</td><td style="font-family:JetBrains Mono,monospace;font-size:11px">'+(r['QTDADE LITROS']?numBR(r['QTDADE LITROS'],1):'-')+'</td><td style="font-family:JetBrains Mono,monospace;font-size:11px">'+(r['VALOR UNITARIO']?'R$'+numBR(r['VALOR UNITARIO'],2):'-')+'</td><td style="font-family:JetBrains Mono,monospace;font-size:11px;color:#22c55e">'+(r['VALOR TOTAL']?'R$'+numBR(r['VALOR TOTAL'],2):'-')+'</td><td style="font-family:JetBrains Mono,monospace;font-size:11px">'+(r['ARLA VALOR']?'R$'+numBR(r['ARLA VALOR'],2):'-')+'</td><td>'+(r['CLASSE DESPESA']||'-')+'</td><td style="font-family:JetBrains Mono,monospace;font-size:11px;color:#ef4444">'+(r['VALOR DESPESA']?'R$'+numBR(r['VALOR DESPESA'],2):'-')+'</td>'+actCell+'</tr>';
  });
  tH+='</tbody></table></div>';
  document.getElementById('tblFin').innerHTML=tH;
}

