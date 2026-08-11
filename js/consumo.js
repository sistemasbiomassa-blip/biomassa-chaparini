// ==================== CONSUMO ====================
var consumoFiltro={motorista:'',placa:'',mes:'',dtIni:'',dtFim:''};
var consumoMotModo='Ativos'; // filtro Ativos/Inativos/Todos do dropdown de motorista

function buildConsumo(){
  // Coletar opções de filtros
  var uMot=[],uPla=[],uMes=[];
  var motSet={},plaSet={},mesSet={};
  DB.cadastro.forEach(function(r){
    if(r.MOTORISTA&&!motSet[r.MOTORISTA]){motSet[r.MOTORISTA]=1;uMot.push(r.MOTORISTA)}
    if(r.PLACA){
      var p=String(r.PLACA).replace(/\s+/g,'');
      if(p&&!plaSet[p]){plaSet[p]=1;uPla.push(p)}
    }
    if(r.DATA){var my=getMonthYear(r.DATA);if(my&&!mesSet[my]){mesSet[my]=1;uMes.push(my)}}
  });
  uMot.sort();uPla.sort();uMes.sort();
  uMot=motoristasFiltrados(uMot, consumoMotModo); // filtro Ativos/Inativos/Todos

  // Renderizar filtros
  createFilters('filtersConsumo',[
    {id:'fcMot',label:'Motorista',options:uMot,onChange:onConsumoFilterChange},
    {id:'fcPla',label:'Placa',options:uPla,onChange:onConsumoFilterChange},
    {id:'fcMes',label:'Mês',options:uMes,optionLabels:uMes.map(getMonthLabel),onChange:onConsumoFilterChange},
    {type:'dateRange',idIni:'fcDtIni',idFim:'fcDtFim',onChange:onConsumoFilterChange}
  ],motoristaModoSelectHtml('consumoMotModo', consumoMotModo, 'buildConsumo'),function(){
    consumoFiltro={motorista:'',placa:'',mes:'',dtIni:'',dtFim:''};
    clearFilters(['fcMot','fcPla','fcMes','fcDtIni','fcDtFim'],buildConsumo);
  });

  // Restaurar valores salvos nos selects
  if(document.getElementById('fcMot')) document.getElementById('fcMot').value=consumoFiltro.motorista||'';
  if(document.getElementById('fcPla')) document.getElementById('fcPla').value=consumoFiltro.placa||'';
  if(document.getElementById('fcMes')) document.getElementById('fcMes').value=consumoFiltro.mes||'';
  if(document.getElementById('fcDtIni')) document.getElementById('fcDtIni').value=consumoFiltro.dtIni||'';
  if(document.getElementById('fcDtFim')) document.getElementById('fcDtFim').value=consumoFiltro.dtFim||'';

  renderConsumoGauge();
  renderConsumoPlacas();
  renderConsumoTops();
  renderConsumoAbastList();
}

function onConsumoFilterChange(){
  consumoFiltro.motorista=document.getElementById('fcMot')?document.getElementById('fcMot').value:'';
  consumoFiltro.placa=document.getElementById('fcPla')?document.getElementById('fcPla').value:'';
  consumoFiltro.mes=document.getElementById('fcMes')?document.getElementById('fcMes').value:'';
  consumoFiltro.dtIni=document.getElementById('fcDtIni')?document.getElementById('fcDtIni').value:'';
  consumoFiltro.dtFim=document.getElementById('fcDtFim')?document.getElementById('fcDtFim').value:'';
  renderConsumoGauge();
  renderConsumoPlacas();
  renderConsumoTops();
  renderConsumoAbastList();
}

// Faixas de km/L (caminhão): mesma régua usada na tabela por placa e no gauge da frota.
function kmLStatus(kmL){
  if(kmL>10) return {cor:'#ef4444', label:'Suspeito', icone:'🚨 ', tooltip:'Valor suspeito — caminhão geralmente faz entre 1 e 5 km/L. Verifique se há erro de digitação nos KMs lançados desta placa.'};
  if(kmL>2.5) return {cor:'#f59e0b', label:'Atenção', icone:'⚠️ ', tooltip:'Valor incomum — pode ser caminhão leve ou pequeno erro nos dados.'};
  if(kmL>=1.5) return {cor:'#22c55e', label:'Normal', icone:'', tooltip:''};
  return {cor:'#f59e0b', label:'Atenção', icone:'⚠️ ', tooltip:'Valor incomum — pode ser caminhão leve ou pequeno erro nos dados.'};
}

// Consumo médio da frota (ponderado por km rodado), aplicando os filtros ativos.
// Usa o mesmo método tanque-a-tanque de calcConsumoPlacasT2T: soma o km e o litro
// tanque-a-tanque de todas as placas do período, em vez de tirar média simples das
// médias — assim uma placa que rodou 10x mais não pesa igual a uma que rodou pouco.
function calcConsumoMedioGeral(){
  var placas=calcConsumoPlacasT2T();
  if(!placas.length) return null;
  var totalKm=0, totalLit=0;
  placas.forEach(function(p){ totalKm+=p.km; totalLit+=(p.km/p.kmL); });
  if(totalLit<=0) return null;
  return {kmL:totalKm/totalLit, km:totalKm, placas:placas.length};
}

// Gauge (meia-lua) com o consumo médio da frota, faixa de 0 a 5 km/L.
function renderConsumoGauge(){
  var el=document.getElementById('cnsGauge');
  if(!el) return;
  var g=calcConsumoMedioGeral();
  if(!g){
    el.innerHTML='<div style="padding:20px;text-align:center;color:var(--text2);font-size:12px">Sem dados suficientes para calcular o consumo médio da frota.</div>';
    return;
  }
  var st=kmLStatus(g.kmL);
  var SCALE_MAX=5; // faixa "normal" de caminhão vai até ~2,5 km/L; 5 dá folga visual
  var frac=Math.max(0,Math.min(1,g.kmL/SCALE_MAX));
  var r=90, len=Math.PI*r; // comprimento do semicírculo
  var filled=frac*len;
  var h='<div style="display:flex;flex-direction:column;align-items:center;gap:4px">';
  h+='<svg viewBox="0 0 220 130" style="width:100%;max-width:320px">';
  h+='<path d="M20,110 A90,90 0 0 1 200,110" fill="none" stroke="var(--border)" stroke-width="16" stroke-linecap="round"/>';
  h+='<path d="M20,110 A90,90 0 0 1 200,110" fill="none" stroke="'+st.cor+'" stroke-width="16" stroke-linecap="round" stroke-dasharray="'+filled.toFixed(1)+' '+len.toFixed(1)+'"/>';
  h+='<text x="20" y="126" font-size="10" fill="var(--text2)" text-anchor="start">0</text>';
  h+='<text x="200" y="126" font-size="10" fill="var(--text2)" text-anchor="end">'+SCALE_MAX+'+ km/L</text>';
  h+='</svg>';
  h+='<div style="text-align:center;margin-top:-30px">';
  h+='<div style="font-family:JetBrains Mono,monospace;font-size:28px;font-weight:700;color:'+st.cor+'">'+numBR(g.kmL,2)+'</div>';
  h+='<div style="font-size:11px;color:var(--text2)">km/L médio · '+g.placas+' placa'+(g.placas>1?'s':'')+' · '+numBR(Math.round(g.km))+' km rodados</div>';
  h+='<div style="font-size:12px;font-weight:600;color:'+st.cor+';margin-top:4px"'+(st.tooltip?' title="'+st.tooltip.replace(/"/g,'&quot;')+'"':'')+'>'+st.icone+st.label+'</div>';
  h+='</div>';
  h+='</div>';
  el.innerHTML=h;
}

// Calcula consumo médio por placa aplicando os 3 filtros
function calcConsumoPlacas(){
  var f=consumoFiltro;
  var hasRangeC=!!(f.dtIni||f.dtFim);
  var rows=DB.cadastro.filter(function(r){
    if(hasRangeC){
      if(!dateInRange(r.DATA,f.dtIni,f.dtFim)) return false;
    } else {
      if(f.mes && getMonthYear(r.DATA)!==f.mes) return false;
    }
    if(f.motorista && r.MOTORISTA!==f.motorista) return false;
    if(f.placa){
      var p=r.PLACA?String(r.PLACA).replace(/\s+/g,''):'';
      if(p!==f.placa) return false;
    }
    return true;
  });
  var placaRange={};
  var placaLit={};
  var placaVlr={};
  rows.forEach(function(r){
    if(!r.PLACA) return;
    var p=String(r.PLACA).replace(/\s+/g,'');
    var km=r.KM?parseKM(r.KM):NaN;
    if(!isNaN(km) && km>0){
      if(!placaRange[p]) placaRange[p]={min:km,max:km};
      if(km<placaRange[p].min) placaRange[p].min=km;
      if(km>placaRange[p].max) placaRange[p].max=km;
    }
    if(r['QTDADE LITROS']){
      placaLit[p]=(placaLit[p]||0)+num(r['QTDADE LITROS']);
    }
    if(r['VALOR TOTAL']){
      placaVlr[p]=(placaVlr[p]||0)+num(r['VALOR TOTAL']);
    }
  });
  var result=[];
  Object.keys(placaRange).forEach(function(p){
    var kmR=placaRange[p].max-placaRange[p].min;
    var lit=placaLit[p]||0;
    var vlr=placaVlr[p]||0;
    if(kmR>0 && lit>0){
      result.push({placa:p, km:kmR, lit:lit, kmL:kmR/lit, vlr:vlr});
    }
  });
  result.sort(function(a,b){return b.kmL-a.kmL});
  return result;
}

// Monta, para cada placa, os trechos entre abastecimentos consecutivos (de QUALQUER motorista,
// ordenados por KM). Cada trecho carrega quem fez o abastecimento que o fechou — é ele quem
// rodou aquele trecho e comprou o combustível que o cobriu. Usado tanto pelo ranking por
// motorista quanto pela tabela por placa, pra nunca "emprestar" km de folguista/substituto.
function calcSegmentosPorPlaca(rows){
  var porPlaca={};   // placa -> [{km, lit, mot}]
  rows.forEach(function(r){
    if(!r.PLACA) return;
    if(!r['QTDADE LITROS']) return;
    var km=r.KM?parseKM(r.KM):NaN;
    if(isNaN(km) || km<=0) return;
    var p=String(r.PLACA).replace(/\s+/g,'');
    if(!porPlaca[p]) porPlaca[p]=[];
    porPlaca[p].push({km:km, lit:num(r['QTDADE LITROS']), mot:r.MOTORISTA||''});
  });
  var segsPorPlaca={};
  Object.keys(porPlaca).forEach(function(p){
    var ab=porPlaca[p].sort(function(a,b){return a.km-b.km});
    var segs=[];
    for(var i=1;i<ab.length;i++){
      var trechoKm=ab[i].km-ab[i-1].km;
      var lit=ab[i].lit;
      if(trechoKm<=0 || lit<=0) continue;      // descarta trecho inválido (ex: erro de KM)
      segs.push({km:trechoKm, lit:lit, mot:ab[i].mot});
    }
    segsPorPlaca[p]=segs;
  });
  return segsPorPlaca;
}

// NOVA — Consumo por placa com método tanque-a-tanque por SEGMENTO (descarta litros do 1º
// abastecimento do período). Retorna mesmo formato {placa, km, lit, kmL, vlr}. 'lit' = total
// comprado (exibição); o km/L usa litros tanque-a-tanque somados por segmento.
// Importante: a sequência de KM da placa é montada com TODOS os motoristas, mesmo que o filtro
// de motorista esteja ativo — senão o km rodado por um substituto acaba sendo contado a mais
// (ou a menos) para quem só abasteceu antes/depois dele. O filtro de motorista só entra depois,
// selecionando quais trechos (já fechados corretamente) pertencem a ele.
function calcConsumoPlacasT2T(){
  var f=consumoFiltro;
  var hasRangeC=!!(f.dtIni||f.dtFim);
  var rowsPlaca=DB.cadastro.filter(function(r){
    if(hasRangeC){
      if(!dateInRange(r.DATA,f.dtIni,f.dtFim)) return false;
    } else {
      if(f.mes && getMonthYear(r.DATA)!==f.mes) return false;
    }
    if(f.placa){
      var p=r.PLACA?String(r.PLACA).replace(/\s+/g,''):'';
      if(p!==f.placa) return false;
    }
    return true;
  });
  // Litros comprados e valor gasto exibidos são informativos — aí sim respeitam o filtro de
  // motorista (é "quanto ele abasteceu/gastou"), sem entrar na conta do km/L.
  var placaLitCompra={}, placaVlr={};
  rowsPlaca.forEach(function(r){
    if(!r.PLACA) return;
    if(f.motorista && r.MOTORISTA!==f.motorista) return;
    var p=String(r.PLACA).replace(/\s+/g,'');
    if(r['QTDADE LITROS']) placaLitCompra[p]=(placaLitCompra[p]||0)+num(r['QTDADE LITROS']);
    if(r['VALOR TOTAL']) placaVlr[p]=(placaVlr[p]||0)+num(r['VALOR TOTAL']);
  });
  var segsPorPlaca=calcSegmentosPorPlaca(rowsPlaca);
  var result=[];
  Object.keys(segsPorPlaca).forEach(function(p){
    var km=0, litT2T=0;
    segsPorPlaca[p].forEach(function(s){
      if(f.motorista && s.mot!==f.motorista) return; // só os trechos fechados por ele
      km+=s.km; litT2T+=s.lit;
    });
    if(km>0 && litT2T>0){
      result.push({placa:p, km:km, lit:placaLitCompra[p]||litT2T, kmL:km/litT2T, vlr:placaVlr[p]||0});
    }
  });
  result.sort(function(a,b){return b.kmL-a.kmL});
  return result;
}

function renderConsumoPlacas(){
  var placas=calcConsumoPlacasT2T();
  document.getElementById('cnsPlacaCount').textContent=placas.length+(placas.length===1?' placa':' placas');
  if(!placas.length){
    document.getElementById('cnsPlacaList').innerHTML='<div style="padding:30px;text-align:center;color:var(--text2);font-size:13px">Nenhum dado de consumo disponível para os filtros aplicados.<br><span style="font-size:11px">É preciso ter pelo menos 2 abastecimentos com KM no período (método tanque-a-tanque).</span></div>';
    return;
  }
  // Contar quantas placas estão com consumo suspeito
  var suspeitas=0;
  placas.forEach(function(p){ if(p.kmL>10) suspeitas++; });
  var h='';
  h+='<div style="padding:8px 14px;background:var(--surface2);border-bottom:1px solid var(--border);font-size:11px;color:var(--text2)">ℹ️ km/L calculado pelo método <strong>tanque-a-tanque</strong> (descarta o 1º abastecimento do período). A coluna Litros mostra o total comprado.</div>';
  if(suspeitas>0){
    h+='<div style="padding:10px 14px;background:rgba(239,68,68,0.08);border-bottom:1px solid var(--border);font-size:12px;color:#ef4444;display:flex;align-items:center;gap:8px">';
    h+='<span style="font-size:16px">⚠️</span>';
    h+='<span><strong>'+suspeitas+' placa'+(suspeitas>1?'s':'')+' com consumo suspeito.</strong> Caminhões pesados geralmente fazem 1 a 5 km/L. Valores acima de 10 km/L podem indicar erro de digitação nos KMs lançados.</span>';
    h+='</div>';
  }
  h+='<table style="width:100%;border-collapse:collapse;font-size:12px"><thead style="background:var(--surface2);position:sticky;top:0;z-index:2"><tr>';
  h+='<th style="text-align:left;padding:10px 14px;font-weight:500;color:var(--text2);font-size:11px;text-transform:uppercase;letter-spacing:0.5px">Placa</th>';
  h+='<th style="text-align:right;padding:10px 14px;font-weight:500;color:var(--text2);font-size:11px;text-transform:uppercase;letter-spacing:0.5px">KM Rodados</th>';
  h+='<th style="text-align:right;padding:10px 14px;font-weight:500;color:var(--text2);font-size:11px;text-transform:uppercase;letter-spacing:0.5px">Litros</th>';
  h+='<th style="text-align:right;padding:10px 14px;font-weight:500;color:var(--text2);font-size:11px;text-transform:uppercase;letter-spacing:0.5px">km/L</th>';
  h+='<th style="text-align:right;padding:10px 14px;font-weight:500;color:var(--text2);font-size:11px;text-transform:uppercase;letter-spacing:0.5px">Vlr Combustível</th>';
  h+='</tr></thead><tbody>';
  placas.forEach(function(p){
    // Cor do km/L baseado em faixas
    var st=kmLStatus(p.kmL);
    var cor=st.cor, icone=st.icone, tooltip=st.tooltip;
    var rowBg=p.kmL>10?'background:rgba(239,68,68,0.06);':(cor==='#f59e0b'?'background:rgba(245,158,11,0.04);':'');
    var tipAttr=tooltip?' title="'+tooltip.replace(/"/g,'&quot;')+'"':'';
    h+='<tr style="border-top:1px solid var(--border);'+rowBg+'">';
    h+='<td style="padding:10px 14px;font-family:JetBrains Mono,monospace;font-size:12px;color:var(--accent);font-weight:600">'+p.placa+'</td>';
    h+='<td style="padding:10px 14px;text-align:right;font-family:JetBrains Mono,monospace;font-size:11px">'+numBR(Math.round(p.km))+'</td>';
    h+='<td style="padding:10px 14px;text-align:right;font-family:JetBrains Mono,monospace;font-size:11px">'+numBR(p.lit,1)+'</td>';
    h+='<td style="padding:10px 14px;text-align:right;font-family:JetBrains Mono,monospace;font-size:12px;color:'+cor+';font-weight:600;cursor:'+(tooltip?'help':'default')+'"'+tipAttr+'>'+icone+numBR(p.kmL,2)+'</td>';
    h+='<td style="padding:10px 14px;text-align:right;font-family:JetBrains Mono,monospace;font-size:11px">'+(p.vlr>0?'R$ '+numBR(p.vlr,2):'-')+'</td>';
    h+='</tr>';
  });
  h+='</tbody></table>';
  document.getElementById('cnsPlacaList').innerHTML=h;
}

// Ranking de consumo por motorista — método B: média dos km/L das placas que ele dirigiu
function calcRankingConsumoMotorista(mesFiltro, dtIni, dtFim){
  var hasRange = !!(dtIni||dtFim);
  // 1) Calcular km/L de cada placa no período (sem outros filtros)
  var rows=DB.cadastro.filter(function(r){
    if(hasRange){
      if(!dateInRange(r.DATA,dtIni,dtFim)) return false;
    } else if(mesFiltro && getMonthYear(r.DATA)!==mesFiltro){
      return false;
    }
    return true;
  });
  var placaRange={};
  var placaLit={};
  rows.forEach(function(r){
    if(!r.PLACA) return;
    var p=String(r.PLACA).replace(/\s+/g,'');
    var km=r.KM?parseKM(r.KM):NaN;
    if(!isNaN(km) && km>0){
      if(!placaRange[p]) placaRange[p]={min:km,max:km};
      if(km<placaRange[p].min) placaRange[p].min=km;
      if(km>placaRange[p].max) placaRange[p].max=km;
    }
    if(r['QTDADE LITROS']){
      placaLit[p]=(placaLit[p]||0)+num(r['QTDADE LITROS']);
    }
  });
  var placaKmL={};
  Object.keys(placaRange).forEach(function(p){
    var kmR=placaRange[p].max-placaRange[p].min;
    var lit=placaLit[p]||0;
    if(kmR>0 && lit>0) placaKmL[p]=kmR/lit;
  });
  // 2) Para cada motorista, quais placas dirigiu? Média dos km/L dessas placas
  var motPlacas={};
  rows.forEach(function(r){
    if(!r.MOTORISTA||!r.PLACA) return;
    var p=String(r.PLACA).replace(/\s+/g,'');
    if(!placaKmL[p]) return; // só placas com km/L calculado
    if(!motPlacas[r.MOTORISTA]) motPlacas[r.MOTORISTA]={};
    motPlacas[r.MOTORISTA][p]=1;
  });
  var ranking=[];
  Object.keys(motPlacas).forEach(function(m){
    var placas=Object.keys(motPlacas[m]);
    if(!placas.length) return;
    var soma=0;
    placas.forEach(function(p){soma+=placaKmL[p]});
    ranking.push({motorista:m, kmL:soma/placas.length, placas:placas.length});
  });
  ranking.sort(function(a,b){return b.kmL-a.kmL}); // maior km/L = melhor (1º)
  return ranking;
}

// NOVA — Ranking de consumo por motorista, método por SEGMENTO tanque-a-tanque.
// Para cada placa, ordena TODOS os abastecimentos (de qualquer motorista) por KM e monta
// trechos entre abastecimentos consecutivos. Cada trecho (km rodado + litros do abastecimento
// que o fechou) é atribuído a quem fez esse abastecimento final — é ele quem rodou aquele trecho
// e comprou o combustível que o cobriu. Isso evita "emprestar" km de folguista/substituto para
// quem só abasteceu antes e depois da folga: a soma dos trechos de todos os motoristas de uma
// placa sempre fecha exatamente com o total da placa (calcConsumoPlacasT2T). Mesmo formato
// {motorista, kmL, placas}.
function calcRankingConsumoMotoristaT2T(mesFiltro, dtIni, dtFim){
  var hasRange = !!(dtIni||dtFim);
  var rows=DB.cadastro.filter(function(r){
    if(hasRange){
      if(!dateInRange(r.DATA,dtIni,dtFim)) return false;
    } else if(mesFiltro && getMonthYear(r.DATA)!==mesFiltro){
      return false;
    }
    return true;
  });
  var segsPorPlaca=calcSegmentosPorPlaca(rows);
  var motAcc={};  // motorista -> {km, lit, placas:{placa:1}}
  Object.keys(segsPorPlaca).forEach(function(p){
    segsPorPlaca[p].forEach(function(s){
      if(!s.mot) return;
      if(!motAcc[s.mot]) motAcc[s.mot]={km:0, lit:0, placas:{}};
      motAcc[s.mot].km+=s.km;
      motAcc[s.mot].lit+=s.lit;
      motAcc[s.mot].placas[p]=1;
    });
  });
  var ranking=[];
  Object.keys(motAcc).forEach(function(m){
    var a=motAcc[m];
    if(a.lit>0) ranking.push({motorista:m, kmL:a.km/a.lit, placas:Object.keys(a.placas).length});
  });
  ranking.sort(function(a,b){return b.kmL-a.kmL});
  return ranking;
}

// Ranking de descargas por motorista — linhas com LOCAL DESCARGA + QUANTIDADE
function calcRankingDescargas(mesFiltro, dtIni, dtFim){
  var hasRange = !!(dtIni||dtFim);
  var contagem={};
  DB.cadastro.forEach(function(r){
    if(hasRange){
      if(!dateInRange(r.DATA,dtIni,dtFim)) return;
    } else if(mesFiltro && getMonthYear(r.DATA)!==mesFiltro){
      return;
    }
    if(!r.MOTORISTA) return;
    if(!r['LOCAL DESCARGA']) return;
    if(!r.QUANTIDADE) return;
    var q=num(r.QUANTIDADE);
    if(isNaN(q) || q<=0) return;
    contagem[r.MOTORISTA]=(contagem[r.MOTORISTA]||0)+1;
  });
  var ranking=[];
  Object.keys(contagem).forEach(function(m){
    ranking.push({motorista:m, qtd:contagem[m]});
  });
  ranking.sort(function(a,b){return b.qtd-a.qtd});
  return ranking;
}

// Mapeia ranking → posições, com empate (1,1,3)
function assignPositions(ranking, valueKey){
  var positions={};
  var lastVal=null;
  var lastPos=0;
  for(var i=0;i<ranking.length;i++){
    var v=ranking[i][valueKey];
    if(v===lastVal){
      positions[ranking[i].motorista]=lastPos;
    } else {
      lastPos=i+1;
      positions[ranking[i].motorista]=lastPos;
      lastVal=v;
    }
  }
  return positions;
}

function renderConsumoTops(){
  var mes=consumoFiltro.mes||'';
  var dtIni=consumoFiltro.dtIni||'';
  var dtFim=consumoFiltro.dtFim||'';
  var rankCons=calcRankingConsumoMotoristaT2T(mes,dtIni,dtFim);
  var rankDesc=calcRankingDescargas(mes,dtIni,dtFim);

  // --- Top 3 Melhor Consumo ---
  var hC='';
  if(!rankCons.length){
    hC='<div style="text-align:center;color:var(--text2);font-size:12px;padding:20px">Sem dados suficientes para calcular consumo médio.</div>';
  } else {
    var medals=['🥇','🥈','🥉'];
    var medalBg=['linear-gradient(135deg,#fbbf24,#f59e0b)','#9ca3af','#cd7f32'];
    var medalColor=['#422006','#1f2937','#3a2412'];
    rankCons.slice(0,3).forEach(function(r,i){
      hC+='<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border)">';
      hC+='<div style="width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;background:'+medalBg[i]+';color:'+medalColor[i]+';flex-shrink:0;font-family:JetBrains Mono,monospace">'+(i+1)+'</div>';
      hC+='<div style="flex:1;font-size:13px">'+r.motorista+'<div style="font-size:10px;color:var(--text2)">'+r.placas+' placa(s)</div></div>';
      hC+='<div style="font-family:JetBrains Mono,monospace;font-size:13px;color:#22c55e;font-weight:600">'+numBR(r.kmL,2)+' km/L</div>';
      hC+='</div>';
    });
    // Tirar borda do último
    hC=hC.replace(/(border-bottom:1px solid var\(--border\))(?=[\s\S]*?<\/div>\s*$)/, 'border-bottom:none');
  }
  document.getElementById('cnsTopConsumo').innerHTML=hC;

  // --- Top 3 Mais Descargas ---
  var hD='';
  if(!rankDesc.length){
    hD='<div style="text-align:center;color:var(--text2);font-size:12px;padding:20px">Sem descargas registradas no período.</div>';
  } else {
    var medals2=['🥇','🥈','🥉'];
    var medalBg2=['linear-gradient(135deg,#fbbf24,#f59e0b)','#9ca3af','#cd7f32'];
    var medalColor2=['#422006','#1f2937','#3a2412'];
    rankDesc.slice(0,3).forEach(function(r,i){
      hD+='<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border)">';
      hD+='<div style="width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;background:'+medalBg2[i]+';color:'+medalColor2[i]+';flex-shrink:0;font-family:JetBrains Mono,monospace">'+(i+1)+'</div>';
      hD+='<div style="flex:1;font-size:13px">'+r.motorista+'</div>';
      hD+='<div style="font-family:JetBrains Mono,monospace;font-size:13px;color:var(--accent);font-weight:600">'+r.qtd+' entrega'+(r.qtd>1?'s':'')+'</div>';
      hD+='</div>';
    });
    hD=hD.replace(/(border-bottom:1px solid var\(--border\))(?=[\s\S]*?<\/div>\s*$)/, 'border-bottom:none');
  }
  document.getElementById('cnsTopDescargas').innerHTML=hD;

  // --- Top 5 Mais Eficientes ---
  // Posições nos 2 rankings (com empate 1,1,3)
  var posCons=assignPositions(rankCons,'kmL');
  var posDesc=assignPositions(rankDesc,'qtd');
  // Motoristas precisam aparecer em AMBOS para entrar na pontuação
  var motSet={};
  Object.keys(posCons).forEach(function(m){motSet[m]=1});
  var motoristas=Object.keys(motSet).filter(function(m){return posDesc[m]!=null});
  var eficiente=[];
  motoristas.forEach(function(m){
    eficiente.push({
      motorista:m,
      posC:posCons[m],
      posD:posDesc[m],
      pts:posCons[m]+posDesc[m]
    });
  });
  eficiente.sort(function(a,b){return a.pts-b.pts});

  var hE='<table style="width:100%;border-collapse:collapse;font-size:12px;margin-top:8px"><thead style="background:var(--surface2)"><tr>';
  hE+='<th style="text-align:left;padding:10px 14px;font-weight:500;color:var(--text2);font-size:11px;text-transform:uppercase;letter-spacing:0.5px;width:60px">#</th>';
  hE+='<th style="text-align:left;padding:10px 14px;font-weight:500;color:var(--text2);font-size:11px;text-transform:uppercase;letter-spacing:0.5px">Motorista</th>';
  hE+='<th style="text-align:center;padding:10px 14px;font-weight:500;color:var(--text2);font-size:11px;text-transform:uppercase;letter-spacing:0.5px">Pos. Consumo</th>';
  hE+='<th style="text-align:center;padding:10px 14px;font-weight:500;color:var(--text2);font-size:11px;text-transform:uppercase;letter-spacing:0.5px">Pos. Descargas</th>';
  hE+='<th style="text-align:right;padding:10px 14px;font-weight:500;color:var(--text2);font-size:11px;text-transform:uppercase;letter-spacing:0.5px">Pontuação</th>';
  hE+='</tr></thead><tbody>';

  if(!eficiente.length){
    hE+='<tr><td colspan="5" style="text-align:center;color:var(--text2);font-size:12px;padding:20px">Sem motoristas com dados suficientes nos dois rankings.</td></tr>';
  } else {
    var medalIcons=['🥇','🥈','🥉','',''];
    eficiente.slice(0,5).forEach(function(e,i){
      var isFirst=i===0;
      var bg=isFirst?'background:rgba(251,191,36,0.08)':'';
      var color=isFirst?'color:#fbbf24':'';
      hE+='<tr style="border-top:1px solid var(--border);'+bg+'">';
      hE+='<td style="padding:10px 14px;font-weight:600;'+color+'">'+(medalIcons[i]||'')+' '+(i+1)+'º</td>';
      hE+='<td style="padding:10px 14px;'+(isFirst?'font-weight:600;color:#fbbf24':'')+'">'+e.motorista+'</td>';
      hE+='<td style="padding:10px 14px;text-align:center;font-family:JetBrains Mono,monospace;font-size:11px;'+color+'">'+e.posC+'º</td>';
      hE+='<td style="padding:10px 14px;text-align:center;font-family:JetBrains Mono,monospace;font-size:11px;'+color+'">'+e.posD+'º</td>';
      hE+='<td style="padding:10px 14px;text-align:right;font-family:JetBrains Mono,monospace;font-size:13px;font-weight:700;'+color+'">'+e.pts+'</td>';
      hE+='</tr>';
    });
  }
  hE+='</tbody></table>';
  document.getElementById('cnsTopEficientes').innerHTML=hE;
}

function renderConsumoAbastList(){
  var f=consumoFiltro;
  var hasRangeA=!!(f.dtIni||f.dtFim);
  var rows=DB.cadastro.filter(function(r){
    if(!r['QTDADE LITROS'] && !r.KM) return false; // só abastecimento ou linha com KM
    if(!r['QTDADE LITROS']) return false; // queremos só abastecimentos
    if(hasRangeA){
      if(!dateInRange(r.DATA,f.dtIni,f.dtFim)) return false;
    } else if(f.mes && getMonthYear(r.DATA)!==f.mes){
      return false;
    }
    if(f.motorista && r.MOTORISTA!==f.motorista) return false;
    if(f.placa){
      var p=r.PLACA?String(r.PLACA).replace(/\s+/g,''):'';
      if(p!==f.placa) return false;
    }
    return true;
  }).sort(function(a,b){return(b.DATA||'').localeCompare(a.DATA||'')});

  document.getElementById('cnsAbastCount').textContent=rows.length+(rows.length===1?' registro':' registros');
  if(!rows.length){
    document.getElementById('cnsAbastList').innerHTML='<div style="padding:30px;text-align:center;color:var(--text2);font-size:13px">Nenhum abastecimento encontrado para os filtros aplicados.</div>';
    return;
  }
  // Checa se o usuário pode ver a coluna de ações
  var podeEditarAlgo = !!(currentUserData && (currentUserData.perfil==='ADMIN' || currentUserData.perfil==='ANALISTA'));
  var h='<div class="table-scroll" style="max-height:60vh;overflow-y:auto"><table style="width:100%;border-collapse:collapse;font-size:11px"><thead style="background:var(--surface2);position:sticky;top:0;z-index:2"><tr>';
  h+='<th style="text-align:left;padding:8px 12px;font-weight:500;color:var(--text2);font-size:10px;text-transform:uppercase;letter-spacing:0.5px">Data</th>';
  h+='<th style="text-align:left;padding:8px 12px;font-weight:500;color:var(--text2);font-size:10px;text-transform:uppercase;letter-spacing:0.5px">Motorista</th>';
  h+='<th style="text-align:left;padding:8px 12px;font-weight:500;color:var(--text2);font-size:10px;text-transform:uppercase;letter-spacing:0.5px">Placa</th>';
  h+='<th style="text-align:left;padding:8px 12px;font-weight:500;color:var(--text2);font-size:10px;text-transform:uppercase;letter-spacing:0.5px">Posto</th>';
  h+='<th style="text-align:right;padding:8px 12px;font-weight:500;color:var(--text2);font-size:10px;text-transform:uppercase;letter-spacing:0.5px">Litros</th>';
  h+='<th style="text-align:right;padding:8px 12px;font-weight:500;color:var(--text2);font-size:10px;text-transform:uppercase;letter-spacing:0.5px">Vlr Unit.</th>';
  h+='<th style="text-align:right;padding:8px 12px;font-weight:500;color:var(--text2);font-size:10px;text-transform:uppercase;letter-spacing:0.5px">Vlr Total</th>';
  h+='<th style="text-align:right;padding:8px 12px;font-weight:500;color:var(--text2);font-size:10px;text-transform:uppercase;letter-spacing:0.5px">KM</th>';
  if(podeEditarAlgo) h+='<th style="text-align:center;padding:8px 12px;font-weight:500;color:var(--text2);font-size:10px;text-transform:uppercase;letter-spacing:0.5px;width:50px">Ações</th>';
  h+='</tr></thead><tbody>';
  var mono='font-family:JetBrains Mono,monospace;font-size:11px';
  rows.forEach(function(r){
    // Decide se mostra o botão editar nesta linha (ADMIN: sempre; ANALISTA: só próprios)
    var podeEditarLinha=false;
    if(currentUserData){
      if(currentUserData.perfil==='ADMIN') podeEditarLinha=true;
      else if(currentUserData.perfil==='ANALISTA'){
        var owner=r.USUARIO;
        if(owner===currentUserData.nome || owner===currentUserData.usuario) podeEditarLinha=true;
      }
    }
    h+='<tr style="border-top:1px solid var(--border)">';
    h+='<td style="padding:8px 12px;'+mono+'">'+formatDateBR(r.DATA)+'</td>';
    h+='<td style="padding:8px 12px">'+(r.MOTORISTA||'-')+'</td>';
    h+='<td style="padding:8px 12px;'+mono+';color:var(--accent)">'+(r.PLACA||'-')+'</td>';
    h+='<td style="padding:8px 12px">'+(r['LOCAL ABASTECIMENTO']||'-')+'</td>';
    h+='<td style="padding:8px 12px;text-align:right;'+mono+'">'+numBR(num(r['QTDADE LITROS']),1)+'</td>';
    h+='<td style="padding:8px 12px;text-align:right;'+mono+'">'+(r['VALOR UNITARIO']?'R$ '+numBR(r['VALOR UNITARIO'],2):'-')+'</td>';
    h+='<td style="padding:8px 12px;text-align:right;'+mono+';color:#22c55e">'+(r['VALOR TOTAL']?'R$ '+numBR(r['VALOR TOTAL'],2):'-')+'</td>';
    h+='<td style="padding:8px 12px;text-align:right;'+mono+'">'+(r.KM?numBR(parseKM(r.KM),0):'-')+'</td>';
    if(podeEditarAlgo){
      if(podeEditarLinha){
        h+='<td style="padding:8px 12px;text-align:center"><button onclick="openEditModal(&#39;'+rowKeyAttr(r)+'&#39;)" title="Editar este lançamento" style="background:transparent;border:1px solid var(--border);border-radius:6px;padding:4px 8px;cursor:pointer;font-size:13px">✏️</button></td>';
      } else {
        h+='<td style="padding:8px 12px"></td>';
      }
    }
    h+='</tr>';
  });
  h+='</tbody></table></div>';
  document.getElementById('cnsAbastList').innerHTML=h;
}

// Exportar a aba Consumo como PDF (paisagem, padrão do sistema)
function exportConsumoPDF(){
  var f=consumoFiltro;
  var filtrosTxt=[];
  if(f.motorista) filtrosTxt.push('Motorista: '+f.motorista);
  if(f.placa) filtrosTxt.push('Placa: '+f.placa);
  if(f.dtIni || f.dtFim){
    var de=f.dtIni?formatDateBR(f.dtIni):'(início)';
    var ate=f.dtFim?formatDateBR(f.dtFim):'(hoje)';
    filtrosTxt.push('Período: '+de+' até '+ate);
  } else if(f.mes){
    filtrosTxt.push('Mês: '+getMonthLabel(f.mes));
  }
  var filtrosLine=filtrosTxt.length?filtrosTxt.join(' · '):'Todos os dados';

  var placas=calcConsumoPlacasT2T();
  var rankCons=calcRankingConsumoMotoristaT2T(f.mes,f.dtIni,f.dtFim);
  var rankDesc=calcRankingDescargas(f.mes,f.dtIni,f.dtFim);
  var posCons=assignPositions(rankCons,'kmL');
  var posDesc=assignPositions(rankDesc,'qtd');
  var motSet={};
  Object.keys(posCons).forEach(function(m){motSet[m]=1});
  var motoristas=Object.keys(motSet).filter(function(m){return posDesc[m]!=null});
  var eficiente=[];
  motoristas.forEach(function(m){eficiente.push({motorista:m,posC:posCons[m],posD:posDesc[m],pts:posCons[m]+posDesc[m]})});
  eficiente.sort(function(a,b){return a.pts-b.pts});

  // Abastecimentos (mesma lógica de filtro)
  var hasRangeE=!!(f.dtIni||f.dtFim);
  var abast=DB.cadastro.filter(function(r){
    if(!r['QTDADE LITROS']) return false;
    if(hasRangeE){
      if(!dateInRange(r.DATA,f.dtIni,f.dtFim)) return false;
    } else if(f.mes && getMonthYear(r.DATA)!==f.mes){
      return false;
    }
    if(f.motorista && r.MOTORISTA!==f.motorista) return false;
    if(f.placa){
      var p=r.PLACA?String(r.PLACA).replace(/\s+/g,''):'';
      if(p!==f.placa) return false;
    }
    return true;
  }).sort(function(a,b){return(b.DATA||'').localeCompare(a.DATA||'')});

  var win=window.open('','_blank');
  var html='<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Relatório de Consumo</title>';
  html+='<style>';
  html+='body{font-family:Arial,sans-serif;padding:14px;color:#222;font-size:11px}';
  html+='h1{font-size:18px;margin:0 0 4px;color:#1f2937}';
  html+='h2{font-size:13px;margin:18px 0 8px;color:#374151;border-bottom:1px solid #ccc;padding-bottom:4px}';
  html+='.sub{font-size:10px;color:#666;margin-bottom:12px}';
  html+='table{width:100%;border-collapse:collapse;margin-bottom:12px}';
  html+='th,td{padding:5px 8px;border:1px solid #ddd;text-align:left;font-size:10px}';
  html+='th{background:#f3f4f6;font-weight:600;color:#374151}';
  html+='.num-right{text-align:right;font-family:Consolas,monospace}';
  html+='.num-center{text-align:center;font-family:Consolas,monospace}';
  html+='.tops-grid{display:flex;gap:12px;margin-bottom:12px}';
  html+='.tops-grid > div{flex:1}';
  html+='.gold-row{background:#fef3c7}';
  html+='@page{size:landscape;margin:8mm}';
  html+='@media print{body{padding:0}}';
  html+='</style></head><body>';
  html+='<h1>Relatório de Consumo</h1>';
  html+='<div class="sub">'+filtrosLine+' · Gerado em '+new Date().toLocaleString('pt-BR')+'</div>';

  // Consumo por placa
  html+='<h2>Consumo Médio por Placa ('+placas.length+')</h2>';
  if(placas.length){
    html+='<table><thead><tr><th>Placa</th><th class="num-right">KM Rodados</th><th class="num-right">Litros</th><th class="num-right">km/L</th><th class="num-right">Vlr Combustível</th></tr></thead><tbody>';
    placas.forEach(function(p){
      html+='<tr><td>'+p.placa+'</td><td class="num-right">'+numBR(Math.round(p.km))+'</td><td class="num-right">'+numBR(p.lit,1)+'</td><td class="num-right">'+numBR(p.kmL,2)+'</td><td class="num-right">'+(p.vlr>0?'R$ '+numBR(p.vlr,2):'-')+'</td></tr>';
    });
    html+='</tbody></table>';
  } else { html+='<div class="sub">Sem dados.</div>'; }

  // Tops 3
  html+='<div class="tops-grid"><div>';
  html+='<h2>Top 3 — Melhor Consumo</h2>';
  if(rankCons.length){
    html+='<table><thead><tr><th>#</th><th>Motorista</th><th class="num-right">km/L</th></tr></thead><tbody>';
    rankCons.slice(0,3).forEach(function(r,i){html+='<tr><td>'+(i+1)+'º</td><td>'+r.motorista+'</td><td class="num-right">'+numBR(r.kmL,2)+'</td></tr>'});
    html+='</tbody></table>';
  } else { html+='<div class="sub">Sem dados.</div>'; }
  html+='</div><div>';
  html+='<h2>Top 3 — Mais Descargas</h2>';
  if(rankDesc.length){
    html+='<table><thead><tr><th>#</th><th>Motorista</th><th class="num-right">Entregas</th></tr></thead><tbody>';
    rankDesc.slice(0,3).forEach(function(r,i){html+='<tr><td>'+(i+1)+'º</td><td>'+r.motorista+'</td><td class="num-right">'+r.qtd+'</td></tr>'});
    html+='</tbody></table>';
  } else { html+='<div class="sub">Sem dados.</div>'; }
  html+='</div></div>';

  // Top 5 Eficientes
  html+='<h2>Top 5 — Mais Eficientes (menor pontuação = melhor)</h2>';
  if(eficiente.length){
    html+='<table><thead><tr><th>#</th><th>Motorista</th><th class="num-center">Pos. Consumo</th><th class="num-center">Pos. Descargas</th><th class="num-right">Pontuação</th></tr></thead><tbody>';
    eficiente.slice(0,5).forEach(function(e,i){
      html+='<tr'+(i===0?' class="gold-row"':'')+'><td>'+(i+1)+'º</td><td>'+e.motorista+'</td><td class="num-center">'+e.posC+'º</td><td class="num-center">'+e.posD+'º</td><td class="num-right"><b>'+e.pts+'</b></td></tr>';
    });
    html+='</tbody></table>';
  } else { html+='<div class="sub">Sem dados.</div>'; }

  // Abastecimentos
  html+='<h2>Abastecimentos e KM ('+abast.length+')</h2>';
  if(abast.length){
    html+='<table><thead><tr><th>Data</th><th>Motorista</th><th>Placa</th><th>Posto</th><th class="num-right">Litros</th><th class="num-right">Vlr Unit.</th><th class="num-right">Vlr Total</th><th class="num-right">KM</th></tr></thead><tbody>';
    abast.forEach(function(r){
      html+='<tr><td>'+formatDateBR(r.DATA)+'</td><td>'+(r.MOTORISTA||'-')+'</td><td>'+(r.PLACA||'-')+'</td><td>'+(r['LOCAL ABASTECIMENTO']||'-')+'</td><td class="num-right">'+numBR(num(r['QTDADE LITROS']),1)+'</td><td class="num-right">'+(r['VALOR UNITARIO']?'R$ '+numBR(r['VALOR UNITARIO'],2):'-')+'</td><td class="num-right">'+(r['VALOR TOTAL']?'R$ '+numBR(r['VALOR TOTAL'],2):'-')+'</td><td class="num-right">'+(r.KM?numBR(parseKM(r.KM),0):'-')+'</td></tr>';
    });
    html+='</tbody></table>';
  } else { html+='<div class="sub">Sem abastecimentos.</div>'; }

  html+='<script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script>';
  html+='</body></html>';
  win.document.write(html);
  win.document.close();
}

