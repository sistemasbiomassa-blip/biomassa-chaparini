// ==================== TEMPO ESPERA ====================
var teMotModo='Ativos'; // filtro Ativos/Inativos/Todos do dropdown de motorista
function buildTempoEspera(){
  var colors=cc();
  var uMot=[],uPla=[],uMon=[],uLoc=[];
  var motSet={},plaSet={},monSet={},locSet={};
  DB.cadastro.forEach(function(r){
    if(r.MOTORISTA&&!motSet[r.MOTORISTA]){motSet[r.MOTORISTA]=1;uMot.push(r.MOTORISTA)}
    if(r.PLACA&&!plaSet[r.PLACA]){plaSet[r.PLACA]=1;uPla.push(r.PLACA)}
    var my=getMonthYear(r.DATA);if(my&&!monSet[my]){monSet[my]=1;uMon.push(my)}
    if(r['LOCAL CARGA']&&!locSet[r['LOCAL CARGA']]){locSet[r['LOCAL CARGA']]=1;uLoc.push(r['LOCAL CARGA'])}
    if(r['LOCAL DESCARGA']&&!locSet[r['LOCAL DESCARGA']]){locSet[r['LOCAL DESCARGA']]=1;uLoc.push(r['LOCAL DESCARGA'])}
  });
  uMot.sort();uPla.sort();uMon.sort();uLoc.sort();
  uMot=motoristasFiltrados(uMot, teMotModo); // filtro Ativos/Inativos/Todos
  var daysByMonthT={};
  DB.cadastro.forEach(function(r){if(!r.DATA)return;var my=getMonthYear(r.DATA);var d=r.DATA.slice(0,10);if(!daysByMonthT[my])daysByMonthT[my]={};daysByMonthT[my][d]=1});
  var daysDataT={};uMon.forEach(function(my){daysDataT[my]=Object.keys(daysByMonthT[my]||{}).sort()});
  var uSem=[];var semSet={};
  DB.cadastro.forEach(function(r){var w=getWeekLabel(r.DATA);if(w&&!semSet[w]){semSet[w]=1;uSem.push(w)}});
  uSem.sort();

  createFilters('filtersTempo',[
    {id:'ftMot',label:'Motorista',options:uMot,onChange:buildTempoEspera},
    {id:'ftPlaca',label:'Placa',options:uPla,onChange:buildTempoEspera},
    {id:'ftMes',label:'Mes',options:uMon,optionLabels:uMon.map(getMonthLabel),onChange:buildTempoEspera,dayId:'ftDia',daysData:daysDataT},
    {id:'ftSemana',label:'Semana',options:uSem,optionLabels:uSem.map(getWeekDisplay),onChange:buildTempoEspera,linkedMonthId:'ftMes',allWeeks:uSem},
    {id:'ftLocal',label:'Local',options:uLoc,onChange:buildTempoEspera},
    {id:'ftTipoLocal',label:'Tipo Local',options:['Carga (Floresta)','Descarga (Cliente)'],onChange:buildTempoEspera},
    {type:'dateRange',idIni:'ftDtIni',idFim:'ftDtFim',onChange:buildTempoEspera}
  ], motoristaModoSelectHtml('teMotModo', teMotModo, 'buildTempoEspera'), function(){ clearFilters(['ftMot','ftPlaca','ftMes','ftDia','ftSemana','ftLocal','ftTipoLocal','ftDtIni','ftDtFim'],buildTempoEspera); });

  var fM=document.getElementById('ftMot')?document.getElementById('ftMot').value:'';
  var fP=document.getElementById('ftPlaca')?document.getElementById('ftPlaca').value:'';
  var fMes=document.getElementById('ftMes')?document.getElementById('ftMes').value:'';
  var fDia=document.getElementById('ftDia')?document.getElementById('ftDia').value:'';
  var fSem=document.getElementById('ftSemana')?document.getElementById('ftSemana').value:'';
  var fLocal=document.getElementById('ftLocal')?document.getElementById('ftLocal').value:'';
  var fTipo=document.getElementById('ftTipoLocal')?document.getElementById('ftTipoLocal').value:'';
  var fDtIni=document.getElementById('ftDtIni')?document.getElementById('ftDtIni').value:'';
  var fDtFim=document.getElementById('ftDtFim')?document.getElementById('ftDtFim').value:'';
  var hasRangeT=!!(fDtIni||fDtFim);

  var data=DB.cadastro.filter(function(r){
    if(fM&&r.MOTORISTA!==fM) return false;
    if(fP&&r.PLACA!==fP) return false;
    if(hasRangeT){
      if(!dateInRange(r.DATA,fDtIni,fDtFim)) return false;
    } else {
      if(fDia&&r.DATA){if(r.DATA.slice(0,10)!==fDia) return false;}
      else if(fMes&&getMonthYear(r.DATA)!==fMes) return false;
      if(fSem&&getWeekLabel(r.DATA)!==fSem) return false;
    }
    if(fLocal&&r['LOCAL CARGA']!==fLocal&&r['LOCAL DESCARGA']!==fLocal) return false;
    return true;
  });

  var tempos=[];
  data.forEach(function(r){
    var tF=timeDiff(r['CHEGADA FLORESTA'],r['SAIDA FLORESTA']);
    var tC=timeDiff(r['CHEGADA CLIENTE'],r['SAIDA CLIENTE']);
    // Pendentes: chegada lançada mas saída ainda não (aguardando saída)
    var pendF=(parseTime(r['CHEGADA FLORESTA'])!=null && parseTime(r['SAIDA FLORESTA'])==null);
    var pendC=(parseTime(r['CHEGADA CLIENTE'])!=null && parseTime(r['SAIDA CLIENTE'])==null);
    if(tF!=null||tC!=null||pendF||pendC){var t=Object.assign({},r);t.tF=tF;t.tC=tC;t.pendF=pendF;t.pendC=pendC;tempos.push(t);}
  });

  var cF=tempos.filter(function(t){return t.tF!=null});
  var cC=tempos.filter(function(t){return t.tC!=null});
  var avgF=cF.length?cF.reduce(function(s,t){return s+t.tF},0)/cF.length:0;
  var avgC=cC.length?cC.reduce(function(s,t){return s+t.tC},0)/cC.length:0;
  var avgG=(cF.length+cC.length)>0?(cF.reduce(function(s,t){return s+t.tF},0)+cC.reduce(function(s,t){return s+t.tC},0))/(cF.length+cC.length):0;

  var nComTempo = tempos.filter(function(t){return t.tF!=null||t.tC!=null}).length; // exclui pendentes do KPI
  var kpiValG  = !fTipo                          ? minToHHMM(avgG) : ' - ';
  var kpiValF  = (!fTipo||fTipo==='Carga (Floresta)')    ? minToHHMM(avgF) : ' - ';
  var kpiValC  = (!fTipo||fTipo==='Descarga (Cliente)')  ? minToHHMM(avgC) : ' - ';
  document.getElementById('kpiTempo').innerHTML=
    '<div class="kpi-card"><div class="kpi-icon">\u23F1\uFE0F</div><div class="kpi-value">'+kpiValG+'</div><div class="kpi-label">Tempo Medio Geral</div></div>'+
    '<div class="kpi-card"><div class="kpi-icon">\ud83c\udf32</div><div class="kpi-value">'+kpiValF+'</div><div class="kpi-label">Tempo Medio Carga</div></div>'+
    '<div class="kpi-card"><div class="kpi-icon">\ud83c\udfed</div><div class="kpi-value">'+kpiValC+'</div><div class="kpi-label">Tempo Medio Descarga</div></div>'+
    '<div class="kpi-card"><div class="kpi-icon">\ud83d\ude9a</div><div class="kpi-value">'+nComTempo+'</div><div class="kpi-label">Viagens com Tempo</div></div>';

  var showCarga=!fTipo||fTipo==='Carga (Floresta)';
  var showDescarga=!fTipo||fTipo==='Descarga (Cliente)';
  var chartTitle=!fTipo?'Tempo Medio por Motorista':(fTipo==='Carga (Floresta)'?'Tempo Medio Carga por Motorista':'Tempo Medio Descarga por Motorista');

  document.getElementById('chartsTempo').innerHTML=
    '<div class="chart-card full"><div class="chart-title">'+chartTitle+' <span class="chart-badge">HH:MM</span></div><div class="chart-container"><canvas id="cTempoMot"></canvas></div></div>'+
    '<div class="chart-card full"><div class="chart-title">Tempo Medio por Local <span class="chart-badge">HH:MM</span></div><div class="chart-container"><canvas id="cTempoLocal"></canvas></div></div>';

  var mt={};
  tempos.forEach(function(t){
    if(!t.MOTORISTA)return;
    if(!mt[t.MOTORISTA])mt[t.MOTORISTA]={fC:0,fS:0,cC:0,cS:0};
    if(t.tF!=null&&showCarga){mt[t.MOTORISTA].fS+=t.tF;mt[t.MOTORISTA].fC++}
    if(t.tC!=null&&showDescarga){mt[t.MOTORISTA].cS+=t.tC;mt[t.MOTORISTA].cC++}
  });
  var mtL=Object.keys(mt).filter(function(m){return mt[m].fC>0||mt[m].cC>0}).sort();
  destroyChart('cTempoMot');
  var ctxTM=document.getElementById('cTempoMot').getContext('2d');
  var ds=[];
  if(showCarga) ds.push({label:'Carga/Floresta',data:mtL.map(function(m){return mt[m].fC?Math.round(mt[m].fS/mt[m].fC):0}),backgroundColor:makeGrad(ctxTM,'rgba(34,197,94,0.8)','rgba(34,197,94,0.1)'),borderRadius:6,borderSkipped:false,barPercentage:0.5});
  if(showDescarga) ds.push({label:'Descarga/Cliente',data:mtL.map(function(m){return mt[m].cC?Math.round(mt[m].cS/mt[m].cC):0}),backgroundColor:makeGrad(ctxTM,'rgba(59,130,246,0.8)','rgba(59,130,246,0.1)'),borderRadius:6,borderSkipped:false,barPercentage:0.5});
  chartInstances['cTempoMot']=new Chart(ctxTM,{type:'bar',data:{labels:mtL,datasets:ds},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:colors.text}},tooltip:{callbacks:{label:function(ctx){return ctx.dataset.label+': '+minToHHMM(ctx.raw)}}}},scales:{x:{ticks:{color:colors.text,font:{size:9}},grid:{display:false}},y:{ticks:{color:colors.text,callback:function(v){return minToHHMM(v)}},grid:{color:colors.grid}}}}});

  var locData={};
  if(showCarga) cF.forEach(function(t){var loc=t['LOCAL CARGA']||'N/I';if(!locData[loc])locData[loc]={s:0,c:0};locData[loc].s+=t.tF;locData[loc].c++});
  if(showDescarga) cC.forEach(function(t){var loc=t['LOCAL DESCARGA']||'N/I';if(!locData[loc])locData[loc]={s:0,c:0};locData[loc].s+=t.tC;locData[loc].c++});
  var locL=Object.entries(locData).sort(function(a,b){return(b[1].s/b[1].c)-(a[1].s/a[1].c)}).map(function(d){return d[0]});
  var locClr=showCarga&&!showDescarga?'rgba(34,197,94,':'rgba(0,229,255,';
  destroyChart('cTempoLocal');
  var ctxTL=document.getElementById('cTempoLocal').getContext('2d');
  chartInstances['cTempoLocal']=new Chart(ctxTL,{type:'bar',data:{labels:locL,datasets:[{data:locL.map(function(d){return Math.round(locData[d].s/locData[d].c)}),backgroundColor:makeGradH(ctxTL,locClr+'0.9)',locClr+'0.3)'),borderRadius:6,borderSkipped:false,barPercentage:0.55}]},options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:function(ctx){return minToHHMM(ctx.raw)}}}},scales:{x:{ticks:{color:colors.text,callback:function(v){return minToHHMM(v)}},grid:{color:colors.grid}},y:{ticks:{color:colors.text,font:{size:11,weight:'500'}},grid:{display:false}}}}});

  var tempoRows=tempos.sort(function(a,b){return(b.DATA||'').localeCompare(a.DATA||'')});
  var canEditTmp=currentUserData&&(currentUserData.perfil==='ADMIN'||currentUserData.perfil==='ANALISTA');

  // Define colunas visiveis conforme filtro de tipo
  var somenteCarga    = fTipo==='Carga (Floresta)';
  var somenteDescarga = fTipo==='Descarga (Cliente)';
  var monoStyle='font-family:JetBrains Mono,monospace;font-size:11px';

  // Cabeçalho condicional
  var thead='<tr><th>Data</th><th>Motorista</th><th>Placa</th>';
  if(!somenteDescarga) thead+='<th>Carga</th><th>Cheg.Flor.</th><th>Saida Flor.</th><th>Tempo Flor.</th>';
  if(!somenteCarga)    thead+='<th>Descarga</th><th>Cheg.Cli.</th><th>Saida Cli.</th><th style="font-weight:700">Tempo Cli.</th>';
  if(canEditTmp)       thead+='<th>Ações</th>';
  thead+='</tr>';

  var tH='<div class="table-header"><h3>Detalhamento de Tempos</h3><span class="chart-badge">'+tempoRows.length+' registros</span></div><div class="table-scroll"><table><thead>'+thead+'</thead><tbody>';

  tempoRows.forEach(function(t){
    var actCell='';
    if(canEditTmp){
      var canEditThis=currentUserData.perfil==='ADMIN'||(t.USUARIO===currentUserData.nome||t.USUARIO===currentUserData.usuario);
      if(canEditThis){
        var btnsTmp='';
        if(t.pendF||t.pendC){ btnsTmp+='<button class="btn-edit-row" onclick="openEditModal(\''+rowKeyAttr(t)+'\')" title="Lançar saída" style="background:#f59e0b;color:#1a1a1a;font-size:10px;font-weight:700;padding:4px 8px;white-space:nowrap">\u23F0 Lançar saída</button> '; }
        btnsTmp+='<button class="btn-edit-row" onclick="openEditModal(\''+rowKeyAttr(t)+'\')" title="Editar">✏️</button>';
        actCell='<td style="white-space:nowrap">'+btnsTmp+'</td>';
      } else {
        actCell='<td><span style="color:#888;font-size:11px">-</span></td>';
      }
    }
    var isPend=(t.pendF||t.pendC);
    var row='<tr'+(isPend?' style="background:rgba(245,158,11,0.12)"':'')+'>';
    row+='<td style="'+monoStyle+'">'+formatDateBR(t.DATA)+'</td>';
    row+='<td>'+(t.MOTORISTA||'-')+'</td>';
    row+='<td style="'+monoStyle+';color:var(--accent)">'+(t.PLACA||'-')+'</td>';
    if(!somenteDescarga){
      row+='<td>'+(t['LOCAL CARGA']||'-')+'</td>';
      row+='<td style="'+monoStyle+'">'+normalizeTimeDisplay(t['CHEGADA FLORESTA'])+'</td>';
      row+='<td style="'+monoStyle+'">'+normalizeTimeDisplay(t['SAIDA FLORESTA'])+'</td>';
      row+='<td style="'+monoStyle+';color:#22c55e;font-weight:600">'+(t.tF!=null?minToHHMM(t.tF):(t.pendF?'<span style="color:#f59e0b;font-size:10px;font-weight:700">aguardando saída</span>':'-'))+'</td>';
    }
    if(!somenteCarga){
      row+='<td>'+(t['LOCAL DESCARGA']||'-')+'</td>';
      row+='<td style="'+monoStyle+'">'+normalizeTimeDisplay(t['CHEGADA CLIENTE'])+'</td>';
      row+='<td style="'+monoStyle+'">'+normalizeTimeDisplay(t['SAIDA CLIENTE'])+'</td>';
      row+='<td style="'+monoStyle+';color:#3b82f6;font-weight:700;font-size:12px">'+(t.tC!=null?minToHHMM(t.tC):(t.pendC?'<span style="color:#f59e0b;font-size:10px;font-weight:700">aguardando saída</span>':'-'))+'</td>';
    }
    row+=actCell+'</tr>';
    tH+=row;
  });
  tH+='</tbody></table></div>';
  document.getElementById('tblTempo').innerHTML=tH;
}


