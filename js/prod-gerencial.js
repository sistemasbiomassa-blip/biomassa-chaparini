// ==================== RELATORIO GERENCIAL — DESENHO ====================
// Visao "Diretoria" da aba Producao: os mesmos lancamentos, arrumados pra apresentar.
// Entra por buildProdGerencial(), chamado pelo buildProducao() quando prodVista==='gerencial',
// e sai em PDF por exportProdGerencialPDF(). Toda conta mora em js/prod-gerencial-calc.js (GER).
//
// Os graficos registram o chartjs-plugin-datalabels POR GRAFICO (plugins:[ChartDataLabels]),
// nao global: registrar global ligaria rotulo de valor em todo grafico do sistema de uma vez.

var gerEstado = {
  unidade:'ambos',   // ambos | TON | M³ — vem do filtro Unidade da aba
  eixo:'combo'       // combo (barras + linha, 2 eixos) | paineis (dois quadros, 1 eixo cada)
                     // vale pros dois graficos de local; a evolucao e sempre em paineis
};
var gerUltimo = null;   // ultimo resultado calculado, pro PDF nao recalcular

// ---------- formatacao ----------
function gerN(v, d){ d=d||0; return Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d}); }
function gerVol(v){ v=Number(v||0); return v>=1000 ? gerN(v,0) : gerN(v,1); }
function gerVolCheio(v){ return gerN(v,1); }
function gerPct(v){ return (v>0?'+':'')+gerN(v,1)+'%'; }
function gerEsc(s){ return String(s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }

// ---------- paleta ----------
// Na tela le os tokens do tema; no papel usa a versao clara, que e a validada pra fundo branco.
// Le do BODY, nao do :root — o tema claro do sistema e a classe .light no body.
function gerPaleta(impresso){
  if(impresso) return {ton:'#2a78d6', m3:'#eb6834', ent:'#1baf7a',
    texto:'#111111', texto2:'#55606b', grid:'rgba(0,0,0,.09)', fundo:'#ffffff'};
  var cs=getComputedStyle(document.body);
  var p=function(nome){ return cs.getPropertyValue(nome).trim(); };
  return {ton:p('--ton')||'#3987e5', m3:p('--m3')||'#d95926', ent:p('--ent')||'#199e70',
    texto:p('--text'), texto2:p('--text2'), grid:p('--grid')||'rgba(255,255,255,.07)', fundo:p('--surface')};
}

// ---------- KPIs ----------
function gerCardKpi(rot, valor, unidade, delta, textoBase){
  var d='';
  if(delta==null) d='<span class="ger-delta igual">—</span>';
  else {
    var cls = delta>0.05?'sobe' : (delta<-0.05?'desce':'igual');
    var seta = delta>0.05?'▲' : (delta<-0.05?'▼':'=');
    d='<span class="ger-delta '+cls+'">'+seta+' '+gerPct(delta)+'</span>';
  }
  return '<div class="ger-kpi"><div class="ger-kpi-rot">'+gerEsc(rot)+'</div>'+
    '<div class="ger-kpi-val">'+valor+(unidade?'<span class="un">'+gerEsc(unidade)+'</span>':'')+'</div>'+
    '<div class="ger-kpi-pe">'+d+'<span>'+gerEsc(textoBase)+'</span></div></div>';
}

function gerBlocoKpis(res, impresso){
  var k=res.kpis, v=res.variacao||{};
  var base = res.anterior ? 'vs. '+res.anterior.rotulo : 'sem período anterior';
  var temTon = gerEstado.unidade!=='M³', temM3 = gerEstado.unidade!=='TON';
  var cards=[ gerCardKpi('Entregas realizadas', gerN(k.entregas), '', v.entregas, base) ];
  if(temTon) cards.push(gerCardKpi('Volume em tonelada', gerVol(k.ton), 'TON', v.ton, base));
  if(temM3)  cards.push(gerCardKpi('Volume em metro cúbico', gerVol(k.m3), 'm³', v.m3, base));
  cards.push(gerCardKpi('Motoristas', gerN(k.motoristas), '', v.motoristas, base));
  cards.push(gerCardKpi('Caminhões', gerN(k.caminhoes), '', v.caminhoes, base));
  cards.push(gerCardKpi('Entregas por dia', gerN(k.entregasDia,1), '', v.entregasDia, k.diasOperados+' dias com entrega'));
  // Cada media usa so as entregas da PROPRIA unidade como divisor — misturar os dois
  // divisores daria media errada (as entregas em m³ nao tem tonelada nenhuma).
  if(temTon) cards.push(gerCardKpi('Média TON por entrega', gerN(k.mediaTon,1), 'TON', v.mediaTon, gerN(k.entTon)+' entregas'));
  if(temM3)  cards.push(gerCardKpi('Média m³ por entrega', gerN(k.mediaM3,1), 'm³', v.mediaM3, gerN(k.entM3)+' entregas'));
  // no papel a faixa e de largura fixa: 8 cartoes fecham 2 linhas de 4; 6 fecham 2 de 3
  var colunas = impresso ? (cards.length % 4 === 0 ? 4 : 3) : 0;
  var estilo = colunas ? ' style="grid-template-columns:repeat('+colunas+',1fr)"' : '';
  return '<div class="ger-kpis"'+estilo+'>'+cards.join('')+'</div>';
}

// ---------- graficos ----------
function gerLegenda(mostraTon, mostraM3, pal){
  var f=function(cor,txt,linha){ return '<span><i class="ger-chave'+(linha?' linha':'')+'" style="background:'+cor+'"></i>'+txt+'</span>'; };
  return '<div class="ger-leg">'+(mostraTon?f(pal.ton,'Volume (TON)'):'')+(mostraM3?f(pal.m3,'Volume (m³)'):'')+
    f(pal.ent,'Nº de entregas',true)+'</div>';
}

function gerNovoGrafico(canvas, cfg){
  destroyChart(canvas.id);
  // registro local do plugin de rotulo: fora destes graficos nada muda no sistema
  cfg.plugins = (cfg.plugins||[]).concat(typeof ChartDataLabels!=='undefined' ? [ChartDataLabels] : []);
  chartInstances[canvas.id]=new Chart(canvas, cfg);
  return chartInstances[canvas.id];
}

// Destroi so os graficos desta visao (todos os ids comecam com cGer).
function gerLimparGraficos(){
  Object.keys(chartInstances).forEach(function(id){ if(id.indexOf('cGer')===0) destroyChart(id); });
}

function gerEixoVolume(pal, titulo){
  return {type:'linear', position:'left', beginAtZero:true,
    title:{display:!!titulo, text:titulo, color:pal.texto2, font:{size:10}},
    ticks:{color:pal.texto2, font:{size:10}, callback:function(v){ return gerN(v); }},
    grid:{color:pal.grid, drawTicks:false}, border:{display:false}};
}
function gerEixoEntregas(pal, direita){
  return {type:'linear', position:direita?'right':'left', beginAtZero:true,
    title:{display:true, text:'Nº de entregas', color:pal.texto2, font:{size:10}},
    ticks:{color:pal.texto2, font:{size:10}, precision:0},
    grid:{drawOnChartArea:!direita, color:pal.grid, drawTicks:false}, border:{display:false}};
}
function gerEixoCategoria(pal, mostrarRotulos, giro, curto){
  var lim = curto ? 22 : 30;
  return {ticks:{display:mostrarRotulos, color:pal.texto2, font:{size:curto?9:10},
      maxRotation:giro==null?50:giro, minRotation:0, autoSkip:false,
      callback:function(v){ var s=this.getLabelForValue(v); return s.length>lim?s.slice(0,lim-1)+'…':s; }},
    grid:{display:false}, border:{color:pal.grid}};
}
function gerRotulo(pal, cfg){
  return Object.assign({color:pal.texto, font:{size:cfg.tam||10, weight:'600', family:'JetBrains Mono, monospace'},
    clamp:true, clip:false, display:cfg.display==null?'auto':cfg.display}, cfg);
}

function gerBarraVol(rot, dados, cor, pal, denso, impresso, topoLivre){
  // Com muitas categorias (31 dias x 2 series = 62 numeros) o rotulo deitado vira borrao, e acima
  // da barra ele disputa espaco com a linha de entregas — o 'auto' escondia dois tercos deles.
  // Girado 90deg e DENTRO da barra ele tem o vao so pra ele; so quando a barra e baixa demais pra
  // conter o numero ele sobe pra fora, e ai troca pra cor do texto (branco sumiria no fundo).
  var precisaPx = impresso ? 34 : 46;   // altura minima pra caber o numero + o recuo
  function cabeDentro(ctx){
    if(!denso || topoLivre) return false;   // quadro sem a linha de entregas: o rotulo cabe acima
    var y = ctx.chart.scales[ctx.dataset.yAxisID || 'y'];
    if(!y) return false;
    var v = ctx.dataset.data[ctx.dataIndex];
    return (y.getPixelForValue(Math.max(0, y.min)) - y.getPixelForValue(v)) >= precisaPx;
  }
  return {label:rot, data:dados, backgroundColor:cor, borderRadius:4, borderSkipped:false,
    maxBarThickness:46, order:3,
    datalabels:gerRotulo(pal,{
      anchor:'end',
      align: denso ? function(ctx){ return cabeDentro(ctx) ? 'start' : 'end'; } : 'end',
      color: denso ? function(ctx){ return cabeDentro(ctx) ? '#ffffff' : pal.texto; } : pal.texto,
      // dentro da barra o rotulo desce um pouco mais, pra sair de baixo do chip de entregas
      offset: denso ? function(ctx){ return cabeDentro(ctx) ? (impresso?7:10) : 2; } : 1,
      tam: denso?(impresso?6.5:8.5):9.5, rotation: denso?-90:0, display:'auto',
      // o preenchimento padrao do rotulo (4px de cada lado) engorda a caixa em 8px; num mes
      // cada barra tem ~10px de vao, entao era ele que fazia o 'auto' derrubar os vizinhos
      padding: denso ? {top:0, bottom:0, left:1, right:1} : 4,
      formatter:function(v){ return v>0 ? gerVol(v) : ''; }})};
}

function gerLinhaEnt(dados, pal, eixoId, denso){
  return {label:'Nº de entregas', type:'line', data:dados, yAxisID:eixoId,
    borderColor:pal.ent, backgroundColor:pal.ent, borderWidth:2,
    pointRadius:4, pointHoverRadius:6, pointBackgroundColor:pal.ent,
    pointBorderColor:pal.fundo, pointBorderWidth:2, tension:.25, order:1,
    // O numero de entregas nao pode sumir. Em cima do ponto ele colide com o rotulo de volume
    // (no Cargill os dois caem na mesma altura) e o 'auto' escondia um dos dois — por isso ele
    // sai ao LADO do ponto, num chip, com display fixo. No quadro denso (dia a dia) nao ha
    // espaco lateral: ali volta pra cima do ponto, so com o fundo separando das barras.
    datalabels:gerRotulo(pal,{anchor:'center', align:denso?'top':'right', offset:denso?5:7, tam:10,
      color:pal.ent, display:true,
      backgroundColor:pal.fundo, borderColor:denso?null:pal.ent, borderWidth:denso?0:1, borderRadius:4,
      padding:denso?{top:1,bottom:0,left:2,right:2}:{top:1,bottom:1,left:3,right:3},
      formatter:function(v){ return v>0?gerN(v):''; }})};
}

// Desenha o bloco "volume + entregas".
// combo   = barras de volume + linha de entregas, dois eixos
// paineis = dois quadros empilhados, um eixo cada, mesma ordem de categorias (forcaPaineis=true
//           na evolucao: com 31 dias os valores nao cabem num quadro so)
function gerBlocoGrafico(host, id, labels, serie, impresso, altura, forcaPaineis){
  var pal=gerPaleta(impresso);
  var mostraTon = gerEstado.unidade!=='M³', mostraM3 = gerEstado.unidade!=='TON';
  var denso = labels.length > 14;
  var classeAlt = (impresso?'ger-graf-folha':'ger-graf')+(altura==='alto'?' alto':'');

  if(gerEstado.eixo==='combo' && !forcaPaineis){
    host.innerHTML = gerLegenda(mostraTon,mostraM3,pal)+
      '<div class="'+classeAlt+'"><canvas id="'+id+'"></canvas></div>';
    var ds=[];
    if(mostraTon) ds.push(Object.assign(gerBarraVol('Volume (TON)', serie.ton, pal.ton, pal, denso, impresso), {yAxisID:'y'}));
    if(mostraM3)  ds.push(Object.assign(gerBarraVol('Volume (m³)', serie.m3, pal.m3, pal, denso, impresso), {yAxisID:'y'}));
    ds.push(gerLinhaEnt(serie.ent, pal, 'y1', denso));
    gerNovoGrafico(document.getElementById(id), {
      type:'bar',                       // o combo e um grafico de barras com um dataset type:'line' dentro
      data:{labels:labels, datasets:ds},
      options:{responsive:true, maintainAspectRatio:false, animation:impresso?false:{duration:380},
        layout:{padding:{top:denso?40:16, right:denso?4:30}},
        plugins:{legend:{display:false},
          tooltip:{callbacks:{label:function(c){
            var v=c.parsed.y;
            return c.dataset.label+': '+(c.dataset.type==='line'?gerN(v):gerVolCheio(v));
          }}}},
        scales:{x:gerEixoCategoria(pal,true,null,impresso),
          y:gerEixoVolume(pal, mostraTon&&mostraM3?'Volume':(mostraTon?'TON':'m³')),
          y1:gerEixoEntregas(pal,true)}}
    });
    return;
  }

  // Paineis separados: volume em cima (barras), entregas embaixo (LINHA), um eixo em cada.
  // Sem a linha de entregas dentro do quadro de volume, o topo fica livre e o rotulo de cada
  // barra cabe acima dela — e o que resolve o aperto da evolucao diaria.
  var idA=id+'A', idB=id+'B';
  var hA = impresso ? (altura==='alto'?'152px':'130px') : (altura==='alto'?'250px':'195px');
  var hB = impresso ? (altura==='alto'?'96px':'82px') : '130px';
  host.innerHTML = gerLegenda(mostraTon,mostraM3,pal)+
    '<div class="ger-par">'+
    '<div style="position:relative;height:'+hA+'"><canvas id="'+idA+'"></canvas></div>'+
    '<div style="position:relative;height:'+hB+'"><canvas id="'+idB+'"></canvas></div></div>';
  var dsA=[];
  if(mostraTon) dsA.push(gerBarraVol('Volume (TON)', serie.ton, pal.ton, pal, denso, impresso, true));
  if(mostraM3)  dsA.push(gerBarraVol('Volume (m³)', serie.m3, pal.m3, pal, denso, impresso, true));
  gerNovoGrafico(document.getElementById(idA), {
    type:'bar', data:{labels:labels, datasets:dsA},
    options:{responsive:true, maintainAspectRatio:false, animation:impresso?false:{duration:380},
      layout:{padding:{top:denso?34:16}},
      plugins:{legend:{display:false}, tooltip:{callbacks:{label:function(c){ return c.dataset.label+': '+gerVolCheio(c.parsed.y); }}}},
      scales:{x:gerEixoCategoria(pal,false,null,impresso), y:gerEixoVolume(pal,'Volume')}}
  });
  gerNovoGrafico(document.getElementById(idB), {
    type:'line', data:{labels:labels, datasets:[gerLinhaEnt(serie.ent, pal, 'y', denso)]},
    options:{responsive:true, maintainAspectRatio:false, animation:impresso?false:{duration:380},
      layout:{padding:{top:16, right:denso?6:30}},
      plugins:{legend:{display:false}, tooltip:{callbacks:{label:function(c){ return 'Entregas: '+gerN(c.parsed.y); }}}},
      scales:{x:gerEixoCategoria(pal,true,null,impresso), y:gerEixoEntregas(pal,false)}}
  });
}

// Motoristas: barra horizontal de entregas (a pergunta principal) com o volume escrito na ponta.
// Volume e entregas tem escalas muito diferentes — virar duas barras na mesma regua esconderia o volume.
// TODOS os motoristas do periodo, sem top-N: no papel o quadro ganha folha propria.
function gerGraficoMotoristas(host, id, lista, impresso){
  var pal=gerPaleta(impresso);
  var itens=lista;
  var mostraTon = gerEstado.unidade!=='M³', mostraM3 = gerEstado.unidade!=='TON';
  var n=Math.max(1, itens.length);
  // No papel, ~84% da sobra util da folha (uma A4 retrato depois do cabecalho, do titulo e do
  // rodape da ~885px): preenchendo tudo a barra fica gorda demais para o espaco da linha.
  // Fonte e espessura acompanham a altura da linha, senao com poucos motoristas fica miudo.
  var alturaPx, fonte, barra;
  if(impresso){
    alturaPx = Math.min(740, Math.max(160, n*42));
    var linha = alturaPx/n;
    fonte = Math.max(7, Math.min(11, linha*0.40));
    barra = Math.max(5, Math.min(16, linha*0.45));
  } else {
    alturaPx = Math.max(200, n*23+34);
    fonte = 11; barra = 20;
  }
  var folgaDir = impresso ? Math.min(190, Math.round(25*fonte*0.55)) : 132;
  host.innerHTML='<div style="position:relative;height:'+Math.round(alturaPx)+'px"><canvas id="'+id+'"></canvas></div>';
  function textoVol(i){
    var p=[];
    if(mostraTon && itens[i].ton>0) p.push(gerVol(itens[i].ton)+' t');
    if(mostraM3 && itens[i].m3>0) p.push(gerVol(itens[i].m3)+' m³');
    return p.join(' · ');
  }
  gerNovoGrafico(document.getElementById(id), {
    type:'bar',
    data:{labels:itens.map(function(x){ return x.mot; }),
      datasets:[{label:'Entregas', data:itens.map(function(x){ return x.entregas; }),
        backgroundColor:pal.ent, borderRadius:4, borderSkipped:false, maxBarThickness:Math.round(barra),
        datalabels:gerRotulo(pal,{anchor:'end', align:'right', offset:5, display:true, tam:impresso?fonte:10,
          formatter:function(v,ctx){ var t=textoVol(ctx.dataIndex); return gerN(v)+(t?'  ('+t+')':''); }})}]},
    options:{indexAxis:'y', responsive:true, maintainAspectRatio:false, animation:impresso?false:{duration:380},
      layout:{padding:{right:folgaDir}},
      plugins:{legend:{display:false},
        tooltip:{callbacks:{label:function(c){ var t=textoVol(c.dataIndex); return c.parsed.x+' entregas'+(t?' · '+t:''); }}}},
      scales:{
        x:{beginAtZero:true, ticks:{color:pal.texto2, font:{size:9}, precision:0}, grid:{color:pal.grid, drawTicks:false}, border:{display:false},
           title:{display:true, text:'Nº de entregas', color:pal.texto2, font:{size:9}}},
        y:{ticks:{color:pal.texto, font:{size:impresso?fonte:11, weight:'500'}}, grid:{display:false}, border:{display:false}}}}
  });
}

// ---------- tabelas ----------
function gerTabelaLocais(lista, rotuloCol, total){
  var mostraTon = gerEstado.unidade!=='M³', mostraM3 = gerEstado.unidade!=='TON';
  var h='<div class="ger-rolo"><table class="ger-tab"><thead><tr>'+
    '<th>'+gerEsc(rotuloCol)+'</th><th>Entregas</th><th>% das entregas</th>'+
    (mostraTon?'<th>Volume (TON)</th>':'')+(mostraM3?'<th>Volume (m³)</th>':'')+
    '<th>Média/entrega</th></tr></thead><tbody>';
  lista.forEach(function(x, i){
    var media = x.entregas ? (x.un==='M³'? x.m3/Math.max(1,x.entM3) : x.ton/Math.max(1,x.entTon)) : 0;
    h+='<tr><td><span class="ger-pos">'+(i+1)+'</span>'+gerEsc(x.local)+'</td>'+
      '<td class="num">'+gerN(x.entregas)+'</td>'+
      '<td class="num">'+gerN(total.entregas?x.entregas/total.entregas*100:0,1)+'%</td>'+
      (mostraTon?'<td class="num">'+(x.ton>0?gerVolCheio(x.ton):'—')+'</td>':'')+
      (mostraM3?'<td class="num">'+(x.m3>0?gerVolCheio(x.m3):'—')+'</td>':'')+
      '<td class="num">'+gerN(media,1)+' '+gerEsc(x.un==='M³'?'m³':'t')+'</td></tr>';
  });
  var somaT=0, somaM=0, somaE=0;
  lista.forEach(function(x){ somaT+=x.ton; somaM+=x.m3; somaE+=x.entregas; });
  h+='</tbody><tfoot><tr><td>Total</td><td class="num">'+gerN(somaE)+'</td><td class="num">100,0%</td>'+
    (mostraTon?'<td class="num">'+gerVolCheio(somaT)+'</td>':'')+
    (mostraM3?'<td class="num">'+gerVolCheio(somaM)+'</td>':'')+
    '<td></td></tr></tfoot></table></div>';
  return h;
}

function gerTabelaMotoristas(lista, total){
  var mostraTon = gerEstado.unidade!=='M³', mostraM3 = gerEstado.unidade!=='TON';
  var h='<div class="ger-rolo"><table class="ger-tab"><thead><tr>'+
    '<th>Motorista</th><th>Entregas</th><th>% das entregas</th>'+
    (mostraTon?'<th>Volume (TON)</th>':'')+(mostraM3?'<th>Volume (m³)</th>':'')+
    '<th>Caminhões</th><th>Média km/L</th></tr></thead><tbody>';
  lista.forEach(function(x, i){
    h+='<tr><td><span class="ger-pos">'+(i+1)+'</span>'+gerEsc(x.mot)+'</td>'+
      '<td class="num">'+gerN(x.entregas)+'</td>'+
      '<td class="num">'+gerN(total.entregas?x.entregas/total.entregas*100:0,1)+'%</td>'+
      (mostraTon?'<td class="num">'+(x.ton>0?gerVolCheio(x.ton):'—')+'</td>':'')+
      (mostraM3?'<td class="num">'+(x.m3>0?gerVolCheio(x.m3):'—')+'</td>':'')+
      '<td class="num">'+gerN(x.placas)+'</td>'+
      '<td class="num">'+(x.kmL!=null?gerN(x.kmL,2):'—')+'</td></tr>';
  });
  var sT=0,sM=0,sE=0;
  lista.forEach(function(x){ sT+=x.ton; sM+=x.m3; sE+=x.entregas; });
  h+='</tbody><tfoot><tr><td>Total · '+lista.length+' motoristas</td><td class="num">'+gerN(sE)+'</td><td class="num">100,0%</td>'+
    (mostraTon?'<td class="num">'+gerVolCheio(sT)+'</td>':'')+
    (mostraM3?'<td class="num">'+gerVolCheio(sM)+'</td>':'')+
    '<td></td><td></td></tr></tfoot></table></div>';
  return h;
}

// ---------- periodo ----------
// O periodo vem dos filtros da propria aba (a mesma barra da visao Operacional): intervalo de
// datas tem prioridade, depois dia, semana e mes. Sem nenhum filtro de periodo, vale tudo o que
// existe no recorte — e ai nao ha periodo anterior pra comparar, e os deltas saem como "—".
function gerPeriodoDosFiltros(base){
  var v=function(id){ var el=document.getElementById(id); return el?el.value:''; };
  var dtIni=v('fpDtIni'), dtFim=v('fpDtFim'), dia=v('fpDia'), sem=v('fpSemana'), mes=v('fpMes');
  if(dtIni||dtFim) return {ini:dtIni||base.dataMin, fim:dtFim||base.dataMax};
  if(dia) return {ini:dia, fim:dia};
  if(sem){
    var wp=sem.split('-S'), wy=parseInt(wp[0],10), wn=parseInt(wp[1],10);
    var jan1=new Date(wy,0,1);
    var ini=new Date(jan1.getTime()+((wn-1)*7-jan1.getDay()+1)*86400000);
    var fim=new Date(ini.getTime()+6*86400000);
    var f=function(d){ return [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-'); };
    return {ini:f(ini), fim:f(fim)};
  }
  if(mes){
    var mp=mes.split('-');
    return {ini:mes+'-01', fim:mes+'-'+String(GER.ultimoDiaMes(+mp[0], +mp[1])).padStart(2,'0')};
  }
  return {ini:base.dataMin, fim:base.dataMax};
}

// ---------- tela ----------
function gerCard(titulo, sub, idCorpo){
  return '<section class="ger-card"><div class="ger-card-topo"><h2>'+gerEsc(titulo)+'</h2></div>'+
    '<div class="ger-sub">'+gerEsc(sub)+'</div><div id="'+idCorpo+'"></div></section>';
}

function gerSerieDeLocais(lista){
  return {ton:lista.map(function(x){return x.ton}), m3:lista.map(function(x){return x.m3}),
          ent:lista.map(function(x){return x.entregas}), labels:lista.map(function(x){return x.local})};
}

// Entrada da visao: recebe as linhas ja filtradas pela aba (todos os filtros MENOS periodo —
// o calculo precisa do periodo anterior, que esta fora do intervalo escolhido).
function buildProdGerencial(linhasFiltradas, unidade){
  var host=document.getElementById('prodGerencial');
  if(!host) return;
  gerLimparGraficos();
  gerEstado.unidade = unidade || 'ambos';

  var base=GER.montarDoCadastro(linhasFiltradas, BASE.clientesM3);
  if(!base.linhas.length){
    gerUltimo=null;
    host.innerHTML='<div class="ger-card"><div class="ger-vazio">Nenhum lançamento para os filtros aplicados.</div></div>';
    return;
  }
  var p=gerPeriodoDosFiltros(base);
  var res=GER.calcular(base, p.ini, p.fim);
  gerUltimo=res;

  if(!res.kpis.entregas){
    host.innerHTML='<div class="ger-card"><div class="ger-vazio">Nenhuma entrega no período selecionado.<br>'+
      'Escolha outro período na barra de filtros acima.</div></div>';
    return;
  }

  var topoDesc=GER.topN(res.descarga, 10).itens;
  var topoCarga=GER.topN(res.carga, 10).itens;
  host.innerHTML =
    '<div class="ger-faixa-periodo"><b>'+gerEsc(res.periodo.rotulo)+'</b>'+
      (res.anterior?'<span>comparado com '+gerEsc(res.anterior.rotulo)+'</span>':'<span>sem período anterior para comparar</span>')+
      (lastProdFiltros?'<span>'+gerEsc(lastProdFiltros)+'</span>':'')+'</div>'+
    gerBlocoKpis(res, false)+
    gerCard('Evolução no período', (res.evolucao.granularidade==='dia'
        ? 'Volume por dia e nº de entregas por dia'
        : 'Volume por mês e nº de entregas por mês')+
        ' — em dois quadros, que num só os valores não cabem', 'gerEvol')+
    gerCard('Por local de descarga', topoDesc.length<res.descarga.length
        ? 'Os 10 maiores destinos; o restante está somado em "Outros" e detalhado na tabela'
        : 'Todos os destinos do período', 'gerDesc')+
    '<section class="ger-card"><div class="ger-card-topo"><h2>Destinos em detalhe</h2></div><div class="ger-sub">'+
      res.descarga.length+' locais de descarga no período</div>'+gerTabelaLocais(res.descarga,'Local de descarga',res.kpis)+'</section>'+
    gerCard('Por local de carga', topoCarga.length<res.carga.length
        ? 'As 10 maiores origens; o restante está somado em "Outros"'
        : 'Todas as origens do período', 'gerCarga')+
    '<section class="ger-card"><div class="ger-card-topo"><h2>Origens em detalhe</h2></div><div class="ger-sub">'+
      res.carga.length+' locais de carga no período</div>'+gerTabelaLocais(res.carga,'Local de carga',res.kpis)+'</section>'+
    gerCard('Produção por motorista', res.motoristas.length+' motoristas com entrega no período, do maior para o menor', 'gerMot')+
    '<section class="ger-card"><div class="ger-card-topo"><h2>Motoristas em detalhe</h2></div>'+
      '<div class="ger-sub">km/L pelo método tanque-a-tanque, o mesmo da aba Consumo</div>'+
      gerTabelaMotoristas(res.motoristas, res.kpis)+'</section>'+
    '<div class="ger-notas">'+gerNotasHtml(res)+'</div>';

  var ev=res.evolucao.pontos;
  gerBlocoGrafico(document.getElementById('gerEvol'), 'cGerEvol', ev.map(function(x){return x.rotulo}),
    {ton:ev.map(function(x){return x.ton}), m3:ev.map(function(x){return x.m3}), ent:ev.map(function(x){return x.entregas})},
    false, 'alto', true);
  var sd=gerSerieDeLocais(topoDesc); gerBlocoGrafico(document.getElementById('gerDesc'), 'cGerDesc', sd.labels, sd, false);
  var sc=gerSerieDeLocais(topoCarga); gerBlocoGrafico(document.getElementById('gerCarga'), 'cGerCarga', sc.labels, sc, false);
  gerGraficoMotoristas(document.getElementById('gerMot'), 'cGerMot', res.motoristas, false);
}

function gerNotasHtml(res){
  var n=[
    'Entrega = lançamento com <b>local de descarga preenchido e quantidade maior que zero</b> — a mesma regra da aba Relatório.',
    '<b>TON e m³ nunca são somados.</b> A unidade vem do local de descarga (ADM PF e ADM LEM são sempre m³).',
    'O período anterior é comparável: mês fechado volta um mês, intervalo livre volta o mesmo número de dias ('+
      (res.anterior?gerEsc(res.anterior.rotulo):'—')+').',
    'km/L pelo método tanque-a-tanque por placa, igual à aba Consumo: motorista sem abastecimento fechado no período aparece com —.'
  ];
  return '<b>Como os números são calculados</b><ul><li>'+n.join('</li><li>')+'</li></ul>';
}

// ---------- folhas A4 (PDF) ----------
// CSS das folhas: uma fonte so, usada tanto no palco fora da tela (onde os graficos sao
// desenhados pra virar PNG) quanto na janela de impressao. As medidas em mm sao as mesmas
// nos dois lugares, senao o grafico sairia esticado no papel.
function gerCssFolha(){
  return '*{margin:0;padding:0;box-sizing:border-box}'+
    'body{font-family:"Barlow",sans-serif;background:#fff;color:#111;font-size:11px;line-height:1.45}'+
    'h1,h2,h3{font-family:"Barlow Condensed",sans-serif;margin:0;font-weight:600}'+
    'table{border-collapse:collapse;width:100%}'+
    '.num{font-family:"JetBrains Mono",monospace;font-variant-numeric:tabular-nums}'+
    '.ger-folha{width:100%;background:#fff;color:#111;padding:13mm 12mm 10mm;font-size:11px}'+
    '.ger-folha-topo{display:flex;align-items:center;justify-content:space-between;gap:12px;'+
      'padding-bottom:9px;border-bottom:2px solid #0d692c;margin-bottom:13px}'+
    '.ger-marca{display:flex;align-items:center;gap:10px}'+
    '.ger-marca img{height:38px;width:auto;object-fit:contain}'+
    '.ger-marca-nome{font-family:"Barlow Condensed",sans-serif;font-size:15px;font-weight:700;letter-spacing:.6px;color:#0d692c;line-height:1.1}'+
    '.ger-marca-sub{font-size:9.5px;color:#55606b}'+
    '.ger-folha-tit{text-align:right}'+
    '.ger-folha-tit h3{font-size:13px;color:#111}'+
    '.ger-folha-tit div{font-size:9px;color:#55606b;margin-top:1px}'+
    '.ger-folha h2{font-size:12.5px;color:#111;margin:0 0 2px}'+
    '.ger-folha .ger-sub{font-size:9.5px;color:#55606b;margin-bottom:7px}'+
    '.ger-folha .ger-leg{display:flex;gap:12px;flex-wrap:wrap;color:#55606b;font-size:9.5px;margin-bottom:6px}'+
    '.ger-folha .ger-leg span{display:inline-flex;align-items:center;gap:5px}'+
    '.ger-folha .ger-chave{width:11px;height:11px;border-radius:3px;flex:none}'+
    '.ger-folha .ger-chave.linha{height:3px;border-radius:2px;width:15px}'+
    '.ger-bloco{margin-bottom:15px;break-inside:avoid;page-break-inside:avoid}'+
    '.ger-folha .ger-kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-bottom:14px}'+
    '.ger-folha .ger-kpi{background:#f6f8fa;border:1px solid #d8dde3;border-radius:6px;padding:8px 10px}'+
    '.ger-folha .ger-kpi-rot{font-size:8px;text-transform:uppercase;letter-spacing:.8px;color:#55606b;font-weight:600}'+
    '.ger-folha .ger-kpi-val{font-family:"Barlow Condensed",sans-serif;font-size:21px;font-weight:700;color:#111;line-height:1.05;'+
      'margin-top:2px;font-variant-numeric:tabular-nums;white-space:nowrap}'+
    '.ger-folha .ger-kpi-val .un{font-size:11px;font-weight:600;color:#55606b;margin-left:3px}'+
    '.ger-folha .ger-kpi-pe{display:flex;align-items:center;gap:5px;font-size:9px;color:#55606b;margin-top:2px;min-height:13px}'+
    '.ger-delta{display:inline-flex;align-items:center;gap:3px;font-weight:600;font-family:"JetBrains Mono",monospace;font-size:9px}'+
    '.ger-delta.sobe{color:#1a7f37}.ger-delta.desce{color:#cf222e}.ger-delta.igual{color:#55606b}'+
    '.ger-folha table.ger-tab{font-size:9.5px}'+
    '.ger-folha table.ger-tab th{text-align:right;font-size:8px;text-transform:uppercase;letter-spacing:.6px;color:#55606b;'+
      'font-weight:600;padding:4px 6px;border-bottom:1px solid #d8dde3;white-space:nowrap}'+
    '.ger-folha table.ger-tab th:first-child{text-align:left}'+
    '.ger-folha table.ger-tab td{padding:2.5px 6px;border-bottom:1px solid #eceff2;text-align:right;color:#111;line-height:1.3;white-space:nowrap}'+
    '.ger-folha table.ger-tab td:first-child{text-align:left;font-weight:500}'+
    '.ger-folha table.ger-tab tfoot td{border-top:1.5px solid #c5ccd3;border-bottom:none;font-weight:700;padding-top:5px}'+
    '.ger-pos{display:inline-block;width:17px;color:#8894a0;font-family:"JetBrains Mono",monospace;font-size:8.5px}'+
    '.ger-rodape{margin-top:14px;padding-top:7px;border-top:1px solid #d8dde3;display:flex;justify-content:space-between;'+
      'font-size:8.5px;color:#55606b}'+
    '.ger-graf-folha{position:relative;height:175px}'+
    '.ger-graf-folha.alto{height:235px}'+
    '.ger-par{display:grid;gap:8px}';
}

function gerFolhaTopo(res, filtros){
  return '<div class="ger-folha-topo">'+
    '<div class="ger-marca">'+(typeof PDF_LOGO!=='undefined'?'<img src="'+PDF_LOGO+'" alt="Biomassa Chaparini">':'')+
    '<div><div class="ger-marca-nome">BIOMASSA CHAPARINI</div>'+
    '<div class="ger-marca-sub">Sistema de Gestão de Frota</div></div></div>'+
    '<div class="ger-folha-tit"><h3>Relatório Gerencial de Produção</h3>'+
    '<div><b>Período:</b> '+gerEsc(res.periodo.rotulo)+'</div>'+
    (filtros?'<div><b>Filtros:</b> '+gerEsc(filtros)+'</div>':'')+
    '<div>Gerado em '+new Date().toLocaleDateString('pt-BR')+'</div></div></div>';
}
function gerFolhaRodape(res, secao){
  return '<div class="ger-rodape">'+
    '<span>Biomassa Chaparini · Relatório Gerencial · '+gerEsc(res.periodo.rotulo)+'</span>'+
    '<span>'+gerEsc(secao)+'</span></div>';
}

// As 4 folhas, na ordem: resumo+evolucao+descarga / carga+tabelas / motoristas / motoristas em detalhe.
function gerFolhasHtml(res, filtros){
  var topoDesc=GER.topN(res.descarga, 10).itens;
  var topoCarga=GER.topN(res.carga, 10).itens;
  return '<div class="ger-folha">'+gerFolhaTopo(res, filtros)+
      gerBlocoKpis(res, true)+
      '<div class="ger-bloco"><h2>Evolução no período</h2><div class="ger-sub">'+
        (res.evolucao.granularidade==='dia'?'Volume por dia e nº de entregas por dia':'Volume por mês e nº de entregas por mês')+
        '</div><div id="pGerEvol"></div></div>'+
      '<div class="ger-bloco"><h2>Volume e entregas por local de descarga</h2><div class="ger-sub">'+
        (topoDesc.length<res.descarga.length?'10 maiores destinos; o restante somado em "Outros"':'Todos os destinos do período')+
        '</div><div id="pGerDesc"></div></div>'+
      gerFolhaRodape(res,'Resumo e destinos')+'</div>'+

    '<div class="ger-folha">'+gerFolhaTopo(res, filtros)+
      '<div class="ger-bloco"><h2>Volume e entregas por local de carga</h2><div class="ger-sub">'+
        (topoCarga.length<res.carga.length?'10 maiores origens; o restante somado em "Outros"':'Todas as origens do período')+
        '</div><div id="pGerCarga"></div></div>'+
      '<div class="ger-bloco"><h2>Destinos em detalhe</h2>'+gerTabelaLocais(res.descarga,'Local de descarga',res.kpis)+'</div>'+
      '<div class="ger-bloco"><h2>Origens em detalhe</h2>'+gerTabelaLocais(res.carga,'Local de carga',res.kpis)+'</div>'+
      gerFolhaRodape(res,'Origens e detalhamento')+'</div>'+

    '<div class="ger-folha">'+gerFolhaTopo(res, filtros)+
      '<div class="ger-bloco"><h2>Produção por motorista</h2><div class="ger-sub">'+
        res.motoristas.length+' motoristas com entrega no período, do maior para o menor</div>'+
        '<div id="pGerMot"></div></div>'+
      gerFolhaRodape(res,'Motoristas')+'</div>'+

    '<div class="ger-folha">'+gerFolhaTopo(res, filtros)+
      '<div class="ger-bloco"><h2>Motoristas em detalhe</h2><div class="ger-sub">'+
        'km/L pelo método tanque-a-tanque, o mesmo da aba Consumo</div>'+
        gerTabelaMotoristas(res.motoristas,res.kpis)+'</div>'+
      gerFolhaRodape(res,'Motoristas em detalhe')+'</div>';
}

function gerFolhasGraficos(res, raiz){
  var ev=res.evolucao.pontos;
  gerBlocoGrafico(raiz.querySelector('#pGerEvol'), 'cGerPEvol', ev.map(function(x){return x.rotulo}),
    {ton:ev.map(function(x){return x.ton}), m3:ev.map(function(x){return x.m3}), ent:ev.map(function(x){return x.entregas})},
    true, 'alto', true);
  var sd=gerSerieDeLocais(GER.topN(res.descarga,10).itens);
  gerBlocoGrafico(raiz.querySelector('#pGerDesc'), 'cGerPDesc', sd.labels, sd, true);
  var sc=gerSerieDeLocais(GER.topN(res.carga,10).itens);
  gerBlocoGrafico(raiz.querySelector('#pGerCarga'), 'cGerPCarga', sc.labels, sc, true, 'alto');
  gerGraficoMotoristas(raiz.querySelector('#pGerMot'), 'cGerPMot', res.motoristas, true);
}

// Monta as folhas num palco FORA DA TELA (nao display:none — o Chart.js precisa de largura
// real, senao desenha num canvas de 0px), troca cada canvas pelo PNG dele e manda o HTML
// pronto pra janela de impressao. Mesmo padrao do exportPagePDF do js/utils.js.
function exportProdGerencialPDF(){
  var win=window.open('','_blank');
  if(!win){showToast('Seu navegador bloqueou a janela do PDF. Permita pop-ups para este site.',true);return;}
  var palco=null;
  try{
    var res=gerUltimo;
    if(!res || !res.kpis.entregas){
      win.close();
      showToast('Nada para imprimir: nenhuma entrega no período filtrado.',true);
      return;
    }
    var filtros=lastProdFiltros||'';
    palco=document.createElement('div');
    // 794px = a largura de uma A4 retrato em pixel de CSS (210mm), a mesma do papel
    palco.style.cssText='position:fixed;left:-20000px;top:0;width:794px;background:#fff;z-index:-1';
    palco.innerHTML='<style>'+gerCssFolha()+'</style>'+gerFolhasHtml(res, filtros);
    document.body.appendChild(palco);
    gerFolhasGraficos(res, palco);

    palco.querySelectorAll('canvas').forEach(function(cv){
      var img=document.createElement('img');
      try{ img.src=cv.toDataURL('image/png'); }catch(e){ img.alt='gráfico'; }
      img.style.width='100%'; img.style.height='100%'; img.style.objectFit='contain';
      cv.parentNode.replaceChild(img,cv);
      destroyChart(cv.id);
    });

    var html='<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">'+
      '<title>Relatório Gerencial de Produção - Biomassa Chaparini</title>'+
      '<link href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&family=Barlow+Condensed:wght@500;600;700&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">'+
      '<style>'+gerCssFolha()+
      '@page{size:A4 portrait;margin:0}'+
      '*{-webkit-print-color-adjust:exact;print-color-adjust:exact}'+
      // sem altura fixa: com muitos motoristas a tabela segue pra pagina seguinte em vez de
      // estourar a folha e deixar uma pagina quase vazia no fim
      '.ger-folha{break-after:page;page-break-after:always}'+
      '.ger-folha:last-of-type{break-after:auto;page-break-after:auto}'+
      '.ger-folha tr{break-inside:avoid;page-break-inside:avoid}'+
      '.ger-folha thead{display:table-header-group}'+
      'img{max-width:100%}'+
      '</style></head><body>'+palco.innerHTML+
      '<script>window.onload=function(){setTimeout(function(){window.print()},400)}<'+'/script>'+
      '</body></html>';
    win.document.write(html);
    win.document.close();
  }catch(e){
    try{ win.close(); }catch(e2){}
    showToast('Erro ao gerar o relatório: '+e.message,true);
  }finally{
    if(palco && palco.parentNode) palco.parentNode.removeChild(palco);
  }
}
