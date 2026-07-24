// ==================== PRODUCAO ====================
var prodMotModo='Ativos'; // filtro Ativos/Inativos/Todos do dropdown de motorista
function buildProducao(){
  var uMot=[],uPla=[],uCar=[],uDes=[],uMon=[];
  var motSet={},plaSet={},carSet={},desSet={},monSet={};
  DB.cadastro.forEach(function(r){
    if(r.MOTORISTA&&!motSet[r.MOTORISTA]){motSet[r.MOTORISTA]=1;uMot.push(r.MOTORISTA)}
    if(r.PLACA&&!plaSet[r.PLACA]){plaSet[r.PLACA]=1;uPla.push(r.PLACA)}
    if(r['LOCAL CARGA']&&!carSet[r['LOCAL CARGA']]){carSet[r['LOCAL CARGA']]=1;uCar.push(r['LOCAL CARGA'])}
    if(r['LOCAL DESCARGA']&&!desSet[r['LOCAL DESCARGA']]){desSet[r['LOCAL DESCARGA']]=1;uDes.push(r['LOCAL DESCARGA'])}
    var my=getMonthYear(r.DATA);if(my&&!monSet[my]){monSet[my]=1;uMon.push(my)}
  });
  uMot.sort();uPla.sort();uCar.sort();uDes.sort();uMon.sort();
  uMot=motoristasFiltrados(uMot, prodMotModo); // filtro Ativos/Inativos/Todos
  var uSemP=[],semSetP={};
  DB.cadastro.forEach(function(r){var w=getWeekLabel(r.DATA);if(w&&!semSetP[w]){semSetP[w]=1;uSemP.push(w)}});
  uSemP.sort();
  // Build days per month
  var daysByMonth={};
  DB.cadastro.forEach(function(r){
    if(!r.DATA)return;var my=getMonthYear(r.DATA);var d=r.DATA.slice(0,10);
    if(!daysByMonth[my])daysByMonth[my]={};daysByMonth[my][d]=1;
  });
  var daysData={};uMon.forEach(function(my){daysData[my]=Object.keys(daysByMonth[my]||{}).sort()});

  createFilters('filtersProd',[
    {id:'fpMot',label:'Motorista',options:uMot,onChange:buildProducao},
    {id:'fpPlaca',label:'Placa',options:uPla,onChange:buildProducao},
    {id:'fpCarga',label:'Local Carga',options:uCar,onChange:buildProducao},
    {id:'fpDescarga',label:'Local Descarga',options:uDes,onChange:buildProducao},
    {id:'fpMes',label:'Mês',options:uMon,optionLabels:uMon.map(getMonthLabel),onChange:buildProducao,dayId:'fpDia',daysData:daysData},
    {id:'fpSemana',label:'Semana',options:uSemP,optionLabels:uSemP.map(getWeekDisplay),onChange:buildProducao,linkedMonthId:'fpMes',allWeeks:uSemP},
    {id:'fpUnid',label:'Unidade',options:['TON','M³'],onChange:buildProducao},
    {type:'dateRange',idIni:'fpDtIni',idFim:'fpDtFim',onChange:buildProducao}
  ], motoristaModoSelectHtml('prodMotModo', prodMotModo, 'buildProducao'), function(){ clearFilters(['fpMot','fpPlaca','fpCarga','fpDescarga','fpMes','fpDia','fpSemana','fpUnid','fpDtIni','fpDtFim'],buildProducao); });

  var fM=document.getElementById('fpMot')?document.getElementById('fpMot').value:'';
  var fP=document.getElementById('fpPlaca')?document.getElementById('fpPlaca').value:'';
  var fC=document.getElementById('fpCarga')?document.getElementById('fpCarga').value:'';
  var fD=document.getElementById('fpDescarga')?document.getElementById('fpDescarga').value:'';
  var fMes=document.getElementById('fpMes')?document.getElementById('fpMes').value:'';
  var fDia=document.getElementById('fpDia')?document.getElementById('fpDia').value:'';
  var fSemP=document.getElementById('fpSemana')?document.getElementById('fpSemana').value:'';
  var fUnid=document.getElementById('fpUnid')?document.getElementById('fpUnid').value:'';
  var fDtIni=document.getElementById('fpDtIni')?document.getElementById('fpDtIni').value:'';
  var fDtFim=document.getElementById('fpDtFim')?document.getElementById('fpDtFim').value:'';
  var hasRange = !!(fDtIni||fDtFim);

  var data=DB.cadastro.filter(function(r){
    if(fM&&r.MOTORISTA!==fM) return false;
    if(fP&&r.PLACA!==fP) return false;
    if(fC&&r['LOCAL CARGA']!==fC) return false;
    if(fD&&r['LOCAL DESCARGA']!==fD) return false;
    // Intervalo de datas tem PRIORIDADE sobre mês/semana/dia
    if(hasRange){
      if(!dateInRange(r.DATA,fDtIni,fDtFim)) return false;
    } else {
      if(fDia&&r.DATA){if(r.DATA.slice(0,10)!==fDia) return false;}
      else if(fMes&&getMonthYear(r.DATA)!==fMes) return false;
      if(fSemP&&getWeekLabel(r.DATA)!==fSemP) return false;
    }
    if(fUnid&&r['LOCAL DESCARGA']){
      var isM3=BASE.clientesM3.includes(r['LOCAL DESCARGA']);
      if(fUnid==='TON'&&isM3) return false;
      if(fUnid==='M³'&&!isM3) return false;
    }
    return true;
  });

  var entregas=data.filter(function(r){return r.ENTREGA && r.QUANTIDADE && r.QUANTIDADE>0});
  var totalViagens=entregas.length;
  var totalTON=0,totalM3=0;
  var motAtivos={},camAtivos={};
  entregas.forEach(function(r){
    if(r.QUANTIDADE){
      if(BASE.clientesM3.includes(r['LOCAL DESCARGA'])) totalM3+=r.QUANTIDADE;
      else totalTON+=r.QUANTIDADE;
    }
    if(r.MOTORISTA) motAtivos[r.MOTORISTA]=1;
    if(r.PLACA) camAtivos[r.PLACA]=1;
  });

  // Calculate month-over-month trends (from ALL data, comparing selected month vs previous)
  var allEntregas=DB.cadastro.filter(function(r){return r.ENTREGA && r.QUANTIDADE && r.QUANTIDADE>0});
  var trendMonth=fMes||null;
  var trendViagens=calcMonthTrend(allEntregas,null,null,trendMonth);
  var trendTON=calcMonthTrend(allEntregas,'QUANTIDADE',function(r){return r.QUANTIDADE&&!BASE.clientesM3.includes(r['LOCAL DESCARGA'])},trendMonth);
  var trendM3=calcMonthTrend(allEntregas,'QUANTIDADE',function(r){return r.QUANTIDADE&&BASE.clientesM3.includes(r['LOCAL DESCARGA'])},trendMonth);

  document.getElementById('kpiProd').innerHTML=
    '<div class="kpi-card"><div class="kpi-top"><div class="kpi-icon">🚚</div>'+trendBadge(trendViagens.current,trendViagens.previous)+'</div><div class="kpi-value">'+numBR(totalViagens)+'</div><div class="kpi-label">Total de Entregas</div></div>'+
    '<div class="kpi-card"><div class="kpi-top"><div class="kpi-icon">📦</div>'+trendBadge(trendTON.current,trendTON.previous)+'</div><div class="kpi-value">'+numBR(totalTON,1)+'</div><div class="kpi-label">Total (TON)</div></div>'+
    '<div class="kpi-card"><div class="kpi-top"><div class="kpi-icon">📦</div>'+trendBadge(trendM3.current,trendM3.previous)+'</div><div class="kpi-value">'+numBR(totalM3,1)+'</div><div class="kpi-label">Total (M³)</div></div>'+
    '<div class="kpi-card"><div class="kpi-icon">👷</div><div class="kpi-value">'+Object.keys(motAtivos).length+'</div><div class="kpi-label">Motoristas Ativos</div></div>'+
    '<div class="kpi-card"><div class="kpi-icon">🚛</div><div class="kpi-value">'+Object.keys(camAtivos).length+'</div><div class="kpi-label">Caminhões Ativos</div></div>';

  var colors=cc();
  document.getElementById('chartsProd').innerHTML=
    '<div class="chart-card full"><div class="chart-title">Quantidade Entregue por Mês <span class="chart-badge">TON + M³</span></div><div class="chart-container"><canvas id="cProdMensal"></canvas></div></div>'+
    '<div class="chart-card"><div class="chart-title">Top Motoristas <span class="chart-badge">por entregas</span></div><div class="chart-container"><canvas id="cProdMotoristas"></canvas></div></div>'+
    '<div class="chart-card"><div class="chart-title">Top 5 Clientes <span class="chart-badge">volume total</span></div><div class="chart-container"><canvas id="cProdPizza"></canvas></div></div>'+
    '<div class="chart-card full"><div class="chart-title">Quantidade por Cliente <span class="chart-badge">ranking</span></div><div class="chart-container"><canvas id="cProdClientes"></canvas></div></div>';

  // Monthly with gradients
  var md={};
  entregas.forEach(function(r){
    var my=getMonthYear(r.DATA);if(!my)return;
    if(!md[my])md[my]={ton:0,m3:0};
    if(r.QUANTIDADE){if(BASE.clientesM3.includes(r['LOCAL DESCARGA']))md[my].m3+=r.QUANTIDADE;else md[my].ton+=r.QUANTIDADE;}
  });
  var mL=Object.keys(md).sort();
  destroyChart('cProdMensal');
  var ctxM=document.getElementById('cProdMensal').getContext('2d');
  chartInstances['cProdMensal']=new Chart(ctxM,{type:'bar',data:{labels:mL.map(getMonthLabel),datasets:[{label:'TON',data:mL.map(function(m){return md[m].ton}),backgroundColor:makeGrad(ctxM,'rgba(59,130,246,0.85)','rgba(59,130,246,0.1)'),borderRadius:8,borderSkipped:false,barPercentage:0.6},{label:'M³',data:mL.map(function(m){return md[m].m3}),backgroundColor:makeGrad(ctxM,'rgba(249,115,22,0.85)','rgba(249,115,22,0.1)'),borderRadius:8,borderSkipped:false,barPercentage:0.6}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:colors.text}}},scales:{x:{ticks:{color:colors.text},grid:{display:false}},y:{ticks:{color:colors.text,callback:function(v){return numBR(v)}},grid:{color:colors.grid}}}}});

  // Top Drivers with horizontal gradient
  var mc={};entregas.forEach(function(r){if(r.MOTORISTA)mc[r.MOTORISTA]=(mc[r.MOTORISTA]||0)+1});
  var ms=Object.entries(mc).sort(function(a,b){return b[1]-a[1]}).slice(0,10);
  destroyChart('cProdMotoristas');
  var ctxD=document.getElementById('cProdMotoristas').getContext('2d');
  chartInstances['cProdMotoristas']=new Chart(ctxD,{type:'bar',data:{labels:ms.map(function(m){return m[0]}),datasets:[{data:ms.map(function(m){return m[1]}),backgroundColor:makeGradH(ctxD,'rgba(0,229,255,0.9)','rgba(59,130,246,0.3)'),borderRadius:6,borderSkipped:false,barPercentage:0.55}]},options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{color:colors.text},grid:{color:colors.grid}},y:{ticks:{color:colors.text,font:{size:11,weight:'500',family:"'Outfit',sans-serif"}},grid:{display:false}}}}});

  // Clients
  var cv={};
  entregas.forEach(function(r){
    if(r['LOCAL DESCARGA']&&r.QUANTIDADE){
      var c=r['LOCAL DESCARGA'];
      if(!cv[c])cv[c]={ton:0,m3:0};
      if(BASE.clientesM3.includes(c))cv[c].m3+=r.QUANTIDADE;else cv[c].ton+=r.QUANTIDADE;
    }
  });
  var cs=Object.entries(cv).sort(function(a,b){return(b[1].ton+b[1].m3)-(a[1].ton+a[1].m3)});

  // Doughnut Top 5
  var t5=cs.slice(0,5);
  destroyChart('cProdPizza');
  chartInstances['cProdPizza']=new Chart(document.getElementById('cProdPizza'),{type:'doughnut',data:{labels:t5.map(function(c){return c[0]}),datasets:[{data:t5.map(function(c){return c[1].ton+c[1].m3}),backgroundColor:modernColors.slice(0,5),borderWidth:0,spacing:3,borderRadius:4}]},options:{cutout:'72%',responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'right',labels:{color:colors.text,font:{size:11}}}}}});

  // Clients horizontal stacked with gradient
  destroyChart('cProdClientes');
  var ctxC=document.getElementById('cProdClientes').getContext('2d');
  chartInstances['cProdClientes']=new Chart(ctxC,{type:'bar',data:{labels:cs.map(function(c){return c[0]}),datasets:[{label:'TON',data:cs.map(function(c){return c[1].ton}),backgroundColor:makeGradH(ctxC,'rgba(59,130,246,0.85)','rgba(59,130,246,0.2)'),borderRadius:6,borderSkipped:false},{label:'M³',data:cs.map(function(c){return c[1].m3}),backgroundColor:makeGradH(ctxC,'rgba(249,115,22,0.85)','rgba(249,115,22,0.2)'),borderRadius:6,borderSkipped:false}]},options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:colors.text}}},scales:{x:{stacked:true,ticks:{color:colors.text,callback:function(v){return numBR(v)}},grid:{color:colors.grid}},y:{stacked:true,ticks:{color:colors.text,font:{size:11,weight:'500'}},grid:{display:false}}}}});

  // Table with modern styling
  var canEditEnt=currentUserData&&(currentUserData.perfil==='ADMIN'||currentUserData.perfil==='ANALISTA');
  var tH='<div class="table-header"><h3>Detalhamento de Entregas</h3><span class="chart-badge">'+entregas.length+' registros</span></div><div class="table-scroll"><table><thead><tr><th>Data</th><th>Motorista</th><th>Placa</th><th>Carga</th><th>Descarga</th><th>Qtd</th><th>Und</th><th>Nota</th>'+(canEditEnt?'<th>Ações</th>':'')+'</tr></thead><tbody>';
  entregas.sort(function(a,b){return(b.DATA||'').localeCompare(a.DATA||'')}).forEach(function(r){
    var u=r['LOCAL DESCARGA']?getUnit(r['LOCAL DESCARGA']):'';
    var tagClass=u==='M³'?'style="color:#f97316"':'style="color:#3b82f6"';
    var actCell='';
    if(canEditEnt){
      var canEditThis=currentUserData.perfil==='ADMIN'||(r.USUARIO===currentUserData.nome||r.USUARIO===currentUserData.usuario);
      actCell='<td>'+(canEditThis?'<button class="btn-edit-row" onclick="openEditModal(\''+rowKeyAttr(r)+'\')" title="Editar">✏️</button>':'<span style="color:#888;font-size:11px">-</span>')+'</td>';
    }
    tH+='<tr><td style="font-family:JetBrains Mono,monospace;font-size:11px">'+formatDateBR(r.DATA)+'</td><td>'+(r.MOTORISTA||'-')+'</td><td style="font-family:JetBrains Mono,monospace;font-size:11px;color:var(--accent)">'+(r.PLACA||'-')+'</td><td>'+(r['LOCAL CARGA']||'-')+'</td><td>'+(r['LOCAL DESCARGA']||'-')+'</td><td style="font-family:JetBrains Mono,monospace;font-size:11px">'+(r.QUANTIDADE?numBR(r.QUANTIDADE,2):'-')+'</td><td '+tagClass+'>'+u+'</td><td>'+(r.NOTA||'-')+'</td>'+actCell+'</tr>';
  });
  tH+='</tbody></table></div>';
  document.getElementById('tblProd').innerHTML=tH;
}

