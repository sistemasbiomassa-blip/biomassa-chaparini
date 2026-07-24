// ============================================================
// ===== MÓDULO MAQUINÁRIOS (Fase 3 - parte 5: Custo Floresta) =
// 100% leitura. Junta abastecimento + manutenção e agrupa por floresta
// (atribuída pela data via localização). Gráficos com Chart.js já carregado.
// ============================================================
function _maqCuPopSelects(){
  var sf=document.getElementById('maqCuFloresta');
  if(sf && sf.options.length<=1){ (BASE.localCarga||[]).forEach(function(fl){ var o=document.createElement('option'); o.textContent=fl; sf.appendChild(o); }); }
  var sm=document.getElementById('maqCuMaq');
  if(sm && sm.options.length<=1){ DB.maquinas.forEach(function(m){ var o=document.createElement('option'); o.value=String(m.ID); o.textContent=m.IDENTIFICACAO||('#'+m.ID); sm.appendChild(o); }); }
}
function _maqCustoLancamentos(){
  var out=[];
  DB.maqAbastecimento.forEach(function(r){ out.push({data:r.DATA,idMaq:r.ID_MAQUINA,floresta:maqFlorestaDoLancamento(r),tipo:'Abastecimento',valor:num(r.VALOR_TOTAL),desc:'Diesel'+(r.LITROS?(' '+fmt(num(r.LITROS),0)+' L'):'')}); });
  DB.maqManutencao.forEach(function(r){ out.push({data:r.DATA,idMaq:r.ID_MAQUINA,floresta:maqFlorestaDoLancamento(r),tipo:'Manutenção',valor:num(r.CUSTO_TOTAL),desc:((r.TIPO||'')+(r.SERVICO?(' — '+r.SERVICO):'')).trim()||'-'}); });
  return out;
}
function _maqCustoCompute(){
  var di=(document.getElementById('maqCuIni')||{}).value||'';
  var df=(document.getElementById('maqCuFim')||{}).value||'';
  var fFl=(document.getElementById('maqCuFloresta')||{}).value||'';
  var fMaq=(document.getElementById('maqCuMaq')||{}).value||'';
  var fTipo=(document.getElementById('maqCuTipo')||{}).value||'';
  var rows=_maqCustoLancamentos().filter(function(l){
    if(di && String(l.data||'')<di) return false;
    if(df && String(l.data||'')>df) return false;
    if(fFl && (l.floresta||'')!==fFl) return false;
    if(fMaq && String(l.idMaq)!==fMaq) return false;
    if(fTipo && l.tipo!==fTipo) return false;
    return true;
  });
  var fmap={},totC=0,totM=0,allMaq={};
  rows.forEach(function(l){
    var key=l.floresta||'— Sem localização';
    if(!fmap[key]) fmap[key]={comb:0,manut:0,maq:{}};
    if(l.tipo==='Abastecimento'){ fmap[key].comb+=l.valor; totC+=l.valor; } else { fmap[key].manut+=l.valor; totM+=l.valor; }
    if(l.idMaq){ fmap[key].maq[String(l.idMaq)]=1; allMaq[String(l.idMaq)]=1; }
  });
  var florestas=Object.keys(fmap).sort(function(a,b){ return (fmap[b].comb+fmap[b].manut)-(fmap[a].comb+fmap[a].manut); });
  return {di:di,df:df,fFl:fFl,fMaq:fMaq,fTipo:fTipo,rows:rows,fmap:fmap,florestas:florestas,totC:totC,totM:totM,total:totC+totM,maqCount:Object.keys(allMaq).length};
}
function _maqKpi(ic,val,lab){ return '<div class="kpi-card"><div class="kpi-icon">'+ic+'</div><div class="kpi-value">'+val+'</div><div class="kpi-label">'+lab+'</div></div>'; }

function renderMaqCusto(){
  if(!document.getElementById('tabMaqCusto')) return;
  _maqCuPopSelects();
  var D=_maqCustoCompute();
  document.getElementById('maqCuKpis').innerHTML=
    _maqKpi('💰',fmtR(D.total),'Gasto total no período')+
    _maqKpi('🌲',D.florestas.length?_maqEsc(D.florestas[0]):'—','Floresta mais cara')+
    _maqKpi('⛽',fmtR(D.totC),'Total combustível')+
    _maqKpi('🔧',fmtR(D.totM),'Total manutenção');
  _maqCuCharts(D);
  // resumo
  document.getElementById('maqCuResumoCount').textContent=D.florestas.length+(D.florestas.length===1?' floresta':' florestas');
  var rc=document.getElementById('maqCuResumo');
  if(!D.florestas.length){ rc.innerHTML='<div style="padding:24px;text-align:center;color:var(--text2)">Sem lançamentos no filtro.</div>'; }
  else {
    var hr='<table class="maq-table"><thead><tr><th>Floresta</th><th>Máquinas</th><th>Combustível</th><th>Manutenção</th><th>Total</th></tr></thead><tbody>';
    D.florestas.forEach(function(f){ var o=D.fmap[f]; hr+='<tr><td>'+_maqEsc(f)+'</td><td class="maq-mono">'+Object.keys(o.maq).length+'</td><td class="maq-mono">'+(o.comb?fmtR(o.comb):'—')+'</td><td class="maq-mono">'+(o.manut?fmtR(o.manut):'—')+'</td><td class="maq-mono"><strong>'+fmtR(o.comb+o.manut)+'</strong></td></tr>'; });
    hr+='</tbody><tfoot><tr style="font-weight:700;background:var(--surface2)"><td>TOTAL</td><td class="maq-mono">'+D.maqCount+'</td><td class="maq-mono">'+fmtR(D.totC)+'</td><td class="maq-mono">'+fmtR(D.totM)+'</td><td class="maq-mono">'+fmtR(D.total)+'</td></tr></tfoot></table>';
    rc.innerHTML=hr;
  }
  // detalhado
  var det=D.rows.slice().sort(function(a,b){ return String(a.data||'').localeCompare(String(b.data||'')); });
  document.getElementById('maqCuDetCount').textContent=det.length+(det.length===1?' lançamento':' lançamentos');
  var dc=document.getElementById('maqCuDetalhe');
  if(!det.length){ dc.innerHTML='<div style="padding:24px;text-align:center;color:var(--text2)">Sem lançamentos no filtro.</div>'; }
  else {
    var hd='<table class="maq-table"><thead><tr><th>Data</th><th>Floresta</th><th>Máquina</th><th>Tipo</th><th>Descrição</th><th>Valor</th></tr></thead><tbody>';
    det.forEach(function(l){ var chip=l.tipo==='Abastecimento'?'<span class="maq-chip maq-chip-b">Abastecimento</span>':'<span class="maq-chip maq-chip-o">Manutenção</span>'; hd+='<tr><td class="maq-mono">'+_maqEsc(formatDateBR(l.data))+'</td><td>'+(l.floresta?_maqEsc(l.floresta):'<span style="color:var(--text2)">— sem localização</span>')+'</td><td>'+_maqEsc(maqNome(l.idMaq))+'</td><td>'+chip+'</td><td>'+_maqEsc(l.desc)+'</td><td class="maq-mono">'+fmtR(l.valor)+'</td></tr>'; });
    hd+='</tbody></table>';
    dc.innerHTML=hd;
  }
}

function _maqCuCharts(D){
  var grid=document.getElementById('maqCuCharts'); if(!grid) return;
  grid.className='charts-grid';
  if(typeof Chart==='undefined' || !D.florestas.length){
    grid.innerHTML='<div class="chart-card full" style="text-align:center;color:var(--text2);padding:30px">'+(typeof Chart==='undefined'?'Gráficos indisponíveis.':'Sem dados para gráficos no filtro.')+'</div>';
    return;
  }
  grid.innerHTML=''+
    '<div class="chart-card full"><div class="chart-title">Comparação entre florestas <span class="chart-badge">combustível + manutenção</span></div><div class="chart-container"><canvas id="cMaqCustoFl"></canvas></div></div>'+
    '<div class="chart-card"><div class="chart-title">Custo por máquina <span class="chart-badge">ranking</span></div><div class="chart-container"><canvas id="cMaqCustoMaq"></canvas></div></div>'+
    '<div class="chart-card"><div class="chart-title">Por categoria <span class="chart-badge">combustível × manutenção</span></div><div class="chart-container"><canvas id="cMaqCustoCat"></canvas></div></div>';
  var colors=(typeof cc==='function')?cc():{text:'#888',grid:'rgba(128,128,128,0.15)'};
  // 1 - comparação empilhada
  destroyChart('cMaqCustoFl');
  var ctx1=document.getElementById('cMaqCustoFl').getContext('2d');
  chartInstances['cMaqCustoFl']=new Chart(ctx1,{type:'bar',data:{labels:D.florestas,datasets:[
    {label:'Combustível',data:D.florestas.map(function(f){return D.fmap[f].comb}),backgroundColor:'#00b4d8',borderRadius:6,maxBarThickness:70},
    {label:'Manutenção',data:D.florestas.map(function(f){return D.fmap[f].manut}),backgroundColor:'#db6d28',borderRadius:6,maxBarThickness:70}
  ]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:colors.text}},tooltip:{callbacks:{label:function(c){return ' '+c.dataset.label+': '+fmtR(c.parsed.y)}}}},scales:{x:{stacked:true,ticks:{color:colors.text},grid:{display:false}},y:{stacked:true,ticks:{color:colors.text,callback:function(v){return 'R$ '+numBR(v)}},grid:{color:colors.grid}}}}});
  // 2 - por máquina (horizontal)
  var mmap={}; D.rows.forEach(function(l){ if(l.idMaq) mmap[l.idMaq]=(mmap[l.idMaq]||0)+l.valor; });
  var ma=Object.keys(mmap).map(function(k){ return [maqNome(k),mmap[k]]; }).sort(function(a,b){return b[1]-a[1];});
  destroyChart('cMaqCustoMaq');
  var ctx2=document.getElementById('cMaqCustoMaq').getContext('2d');
  chartInstances['cMaqCustoMaq']=new Chart(ctx2,{type:'bar',data:{labels:ma.map(function(m){return m[0]}),datasets:[{data:ma.map(function(m){return m[1]}),backgroundColor:ma.map(function(_,i){return modernColors[i%modernColors.length]}),borderRadius:6,maxBarThickness:46}]},options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:function(c){return ' '+fmtR(c.parsed.x)}}}},scales:{x:{ticks:{color:colors.text,callback:function(v){return 'R$ '+numBR(v)}},grid:{color:colors.grid}},y:{ticks:{color:colors.text},grid:{display:false}}}}});
  // 3 - categoria (rosca)
  destroyChart('cMaqCustoCat');
  chartInstances['cMaqCustoCat']=new Chart(document.getElementById('cMaqCustoCat'),{type:'doughnut',data:{labels:['Combustível','Manutenção'],datasets:[{data:[D.totC,D.totM],backgroundColor:['#00b4d8','#db6d28'],borderWidth:0,spacing:3,borderRadius:4}]},options:{cutout:'68%',responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{color:colors.text}},tooltip:{callbacks:{label:function(c){return ' '+c.label+': '+fmtR(c.parsed)}}}}}});
}

function exportMaqCustoPDF(){
  var D=_maqCustoCompute();
  var periodoTxt=(D.di||D.df)?((D.di?formatDateBR(D.di):'(início)')+' até '+(D.df?formatDateBR(D.df):'(hoje)')):'Todos os períodos';
  var extra=[]; if(D.fFl) extra.push('Floresta: '+D.fFl); if(D.fMaq) extra.push('Máquina: '+maqNome(D.fMaq)); if(D.fTipo) extra.push('Tipo: '+D.fTipo);
  var logoEl=document.querySelector('.sidebar-logo img'); var logoSrc=logoEl?logoEl.src:'';
  var win=window.open('','_blank');
  var html='<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Custo por Floresta</title><style>';
  html+='*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;padding:14px;color:#222;font-size:10px}';
  html+='.rep-head{display:flex;align-items:center;gap:14px;border-bottom:2px solid #0D692C;padding-bottom:10px;margin-bottom:10px}';
  html+='.rep-head img{width:54px;height:54px;border-radius:8px;object-fit:cover}.rep-head h1{font-size:18px;color:#085425;line-height:1.1}';
  html+='.rep-head .sub{font-size:11px;color:#444;margin-top:2px}.rep-head .gen{font-size:9px;color:#888;margin-top:3px}';
  html+='h2{font-size:12px;color:#0D692C;margin:14px 0 4px}';
  html+='table{width:100%;border-collapse:collapse;margin-top:4px}th,td{border:1px solid #ccc;padding:4px 6px;font-size:9px;text-align:center}';
  html+='th{background:#0D692C;color:#fff;text-transform:uppercase;font-size:8.5px}td.l{text-align:left}tbody tr:nth-child(even){background:#f4f8fb}';
  html+='tfoot td{font-weight:bold;background:#eef5ef}.foot{margin-top:10px;font-size:9px;color:#666;text-align:center}@page{size:landscape;margin:8mm}</style></head><body>';
  html+='<div class="rep-head">'+(logoSrc?'<img src="'+logoSrc+'">':'')+'<div><h1>BIOMASSA CHAPARINI</h1><div class="sub">Custo por Floresta — Maquinários</div><div class="sub"><b>Período:</b> '+periodoTxt+(extra.length?' &nbsp;|&nbsp; '+extra.join(' · '):'')+'</div><div class="gen">Gerado em '+new Date().toLocaleString('pt-BR')+'</div></div></div>';
  if(!D.florestas.length){ html+='<p style="padding:20px;text-align:center;color:#888">Nenhum lançamento para os filtros aplicados.</p>'; }
  else {
    html+='<h2>Resumo por floresta</h2><table><thead><tr><th class="l">Floresta</th><th>Máquinas</th><th>Combustível</th><th>Manutenção</th><th>Total</th></tr></thead><tbody>';
    D.florestas.forEach(function(f){ var o=D.fmap[f]; html+='<tr><td class="l">'+f+'</td><td>'+Object.keys(o.maq).length+'</td><td>R$ '+numBR(o.comb,2)+'</td><td>R$ '+numBR(o.manut,2)+'</td><td>R$ '+numBR(o.comb+o.manut,2)+'</td></tr>'; });
    html+='</tbody><tfoot><tr><td class="l">TOTAL</td><td>'+D.maqCount+'</td><td>R$ '+numBR(D.totC,2)+'</td><td>R$ '+numBR(D.totM,2)+'</td><td>R$ '+numBR(D.total,2)+'</td></tr></tfoot></table>';
    html+='<h2>Detalhado</h2><table><thead><tr><th>Data</th><th class="l">Floresta</th><th class="l">Máquina</th><th>Tipo</th><th class="l">Descrição</th><th>Valor</th></tr></thead><tbody>';
    D.rows.slice().sort(function(a,b){return String(a.data||'').localeCompare(String(b.data||''))}).forEach(function(l){ html+='<tr><td>'+formatDateBR(l.data)+'</td><td class="l">'+(l.floresta||'— sem localização')+'</td><td class="l">'+maqNome(l.idMaq)+'</td><td>'+l.tipo+'</td><td class="l">'+(l.desc||'-')+'</td><td>R$ '+numBR(l.valor,2)+'</td></tr>'; });
    html+='</tbody></table>';
    html+='<div class="foot">'+D.florestas.length+' floresta(s) · '+D.rows.length+' lançamento(s) · Período: '+periodoTxt+'</div>';
  }
  html+='<script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script></body></html>';
  win.document.write(html); win.document.close();
}
// ===== FIM MÓDULO MAQUINÁRIOS (parte 5) =====

