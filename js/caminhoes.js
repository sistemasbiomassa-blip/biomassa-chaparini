// ==================== CAMINHOES ====================
var TIPO_VEICULO_LABEL={cavalo:'Cavalo Mecânico',carreta_3_eixos:'Carreta 3 eixos',carreta_4_eixos:'Carreta 4 eixos'};

function findCaminhaoById(id){ id=String(id); for(var i=0;i<CAMINHOES_DATA.length;i++){ if(String(CAMINHOES_DATA[i].ID)===id) return CAMINHOES_DATA[i]; } return null; }

// ---------- Filtros do quadro (marca / modelo / tipo / ano) ----------
// O sentinel __vazio__ ("— sem marca —" etc.) serve pra achar justamente o que ainda
// falta preencher na frota, que é o oposto do que um filtro normal entrega.
var CM_VAZIO='__vazio__';

function _cmVal(id){ var el=document.getElementById(id); return el?el.value:''; }
function _cmEsc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function _cmCampo(r,k){ var v=r[k]; return v==null?'':String(v).trim(); }

// Troca as opções mantendo o que estava escolhido — quando o valor antigo sai da lista
// (ex: trocou a marca e o modelo não é dela), o select volta pra "Todos" em vez de
// ficar em branco filtrando nada.
function _cmFillSelect(id,todosLabel,valores,temVazio,labelVazio){
  var el=document.getElementById(id); if(!el) return;
  var atual=el.value;
  var h='<option value="">'+todosLabel+'</option>';
  if(temVazio) h+='<option value="'+CM_VAZIO+'">'+labelVazio+'</option>';
  valores.forEach(function(v){ h+='<option value="'+_cmEsc(v)+'">'+_cmEsc(v)+'</option>'; });
  el.innerHTML=h;
  el.value=atual;
  if(el.value!==atual) el.value='';
}

function cmPopularFiltros(){
  var marcas={},modelos={},anos={},semMarca=false,semModelo=false,semAno=false;
  var fMarca=_cmVal('fcmFiltroMarca');
  CAMINHOES_DATA.forEach(function(r){
    var ma=_cmCampo(r,'MARCA'), mo=_cmCampo(r,'MODELO'), an=_cmCampo(r,'ANO');
    if(ma) marcas[ma]=1; else semMarca=true;
    // Modelo acompanha a marca escolhida: um dropdown único com "FH 540" e "R 450"
    // misturados não ajuda ninguém.
    var daMarca = !fMarca || (fMarca===CM_VAZIO ? !ma : ma===fMarca);
    if(daMarca){ if(mo) modelos[mo]=1; else semModelo=true; }
    if(an) anos[an]=1; else semAno=true;
  });
  var ord=function(o){ return Object.keys(o).sort(function(a,b){ return a.localeCompare(b,'pt-BR',{sensitivity:'base'}); }); };
  _cmFillSelect('fcmFiltroMarca','Todas as marcas',ord(marcas),semMarca,'— sem marca —');
  _cmFillSelect('fcmFiltroModelo','Todos os modelos',ord(modelos),semModelo,'— sem modelo —');
  _cmFillSelect('fcmFiltroAno','Todos os anos',Object.keys(anos).sort(function(a,b){ return num(b)-num(a); }),semAno,'— sem ano —');
}

function _cmFiltrosAtuais(){
  return {marca:_cmVal('fcmFiltroMarca'),modelo:_cmVal('fcmFiltroModelo'),tipo:_cmVal('fcmFiltroTipo'),ano:_cmVal('fcmFiltroAno')};
}
function _cmPassa(r,f){
  function bate(valor,filtro){
    if(!filtro) return true;
    if(filtro===CM_VAZIO) return !valor;
    return valor===filtro;
  }
  return bate(_cmCampo(r,'MARCA'),f.marca) && bate(_cmCampo(r,'MODELO'),f.modelo) &&
         bate(_cmCampo(r,'ANO'),f.ano) && bate(_cmCampo(r,'TIPO_VEICULO'),f.tipo);
}
// Lista que a tabela, o gráfico e o PDF enxergam — sempre a mesma.
function _cmListaFiltrada(){
  var f=_cmFiltrosAtuais();
  return CAMINHOES_DATA.filter(function(r){ return _cmPassa(r,f); })
    .sort(function(a,b){ return String(a.PLACA||'').localeCompare(String(b.PLACA||''),'pt-BR',{sensitivity:'base'}); });
}
function limparFiltrosCaminhoes(){
  ['fcmFiltroMarca','fcmFiltroModelo','fcmFiltroTipo','fcmFiltroAno'].forEach(function(id){
    var el=document.getElementById(id); if(el) el.value='';
  });
  renderCaminhoesTable();
}

function renderCaminhoesTable(){
  var isAdmin=currentUserData&&currentUserData.perfil==='ADMIN';
  // O DIRETOR enxerga esta aba só pra consultar a frota — esconde o formulário
  // de cadastro, que o RLS recusaria de qualquer forma (escrita aqui é só ADMIN).
  var fcCard=document.getElementById('fcmFormCard');
  if(fcCard) fcCard.style.display=isAdmin?'':'none';
  cmPopularFiltros();
  var f=_cmFiltrosAtuais();
  var lista=_cmListaFiltrada();
  var badge=document.getElementById('fcmCount');
  if(badge) badge.textContent=lista.length+(lista.length===1?' veículo':' veículos')+(lista.length!==CAMINHOES_DATA.length?' de '+CAMINHOES_DATA.length:'');
  if(!lista.length){
    var temFiltro=f.marca||f.modelo||f.tipo||f.ano;
    document.getElementById('tblCaminhoesContainer').innerHTML='<div style="padding:30px;text-align:center;color:var(--text2)">Nenhum veículo '+(temFiltro?'neste filtro.':'cadastrado.')+'</div>';
    renderCaminhoesChart(lista);
    return;
  }
  var h='<table><thead><tr><th>Placa</th><th>Marca</th><th>Modelo</th><th>Ano</th><th>Tipo de Veículo</th>'+(isAdmin?'<th style="text-align:center">Ações</th>':'')+'</tr></thead><tbody>';
  lista.forEach(function(r){
    var tipoTxt=r.TIPO_VEICULO?TIPO_VEICULO_LABEL[r.TIPO_VEICULO]||r.TIPO_VEICULO:'<span style="color:var(--text2)">— não cadastrado —</span>';
    var acts=isAdmin?'<td style="text-align:center;white-space:nowrap"><span class="maq-act" title="Editar" onclick="openCaminhaoModal(\''+r.ID+'\')">✏️</span> <span class="maq-act" title="Excluir" onclick="openCaminhaoDelete(\''+r.ID+'\')">🗑️</span></td>':'';
    h+='<tr><td style="color:var(--accent);font-weight:600;font-family:JetBrains Mono,monospace">'+(r.PLACA||'-')+'</td><td>'+(r.MARCA||'-')+'</td><td>'+(r.MODELO||'-')+'</td><td style="font-family:JetBrains Mono,monospace;font-size:11px">'+(r.ANO||'-')+'</td><td>'+tipoTxt+'</td>'+acts+'</tr>';
  });
  h+='</tbody></table>';
  document.getElementById('tblCaminhoesContainer').innerHTML=h;
  renderCaminhoesChart(lista);
}

// ---------- Gráfico: quantos veículos por marca, separados por tipo ----------
// Barra empilhada em vez de uma barra só: "7 Volvo" não diz nada; "5 cavalos + 2
// carretas" diz. Com o filtro de tipo em "Cavalo Mecânico" vira a contagem de cavalos.
var CM_TIPO_COR={cavalo:'#3b82f6',carreta_3_eixos:'#f97316',carreta_4_eixos:'#a855f7'};
var CM_SEM_TIPO='__sem_tipo__';
var CM_SEM_MARCA='— sem marca —';

function _cmTipoLabel(t){ return t===CM_SEM_TIPO?'Tipo não cadastrado':(TIPO_VEICULO_LABEL[t]||t); }

// Agrupa a lista filtrada em marca x tipo. Serve pro gráfico da tela e pro do PDF,
// que é o mesmo gráfico desenhado de novo num canvas fora da tela.
function _cmAgrupaPorMarca(lista){
  var porMarca={}, tiposVistos={};
  lista.forEach(function(r){
    var ma=_cmCampo(r,'MARCA')||CM_SEM_MARCA;
    var tp=_cmCampo(r,'TIPO_VEICULO')||CM_SEM_TIPO;
    if(!porMarca[ma]) porMarca[ma]={total:0};
    porMarca[ma][tp]=(porMarca[ma][tp]||0)+1;
    porMarca[ma].total++;
    tiposVistos[tp]=1;
  });
  // Ordem fixa dos tipos conhecidos; qualquer valor estranho no banco entra depois.
  var tipos=Object.keys(TIPO_VEICULO_LABEL).filter(function(t){ return tiposVistos[t]; });
  Object.keys(tiposVistos).forEach(function(t){ if(t!==CM_SEM_TIPO && tipos.indexOf(t)<0) tipos.push(t); });
  if(tiposVistos[CM_SEM_TIPO]) tipos.push(CM_SEM_TIPO);
  // Marca com mais veículos primeiro — o ranking é a leitura útil aqui. A coluna
  // "sem marca" vai sempre pro fim, senão ela se mistura no meio do ranking.
  var marcas=Object.keys(porMarca).sort(function(a,b){
    if(a===CM_SEM_MARCA) return 1;
    if(b===CM_SEM_MARCA) return -1;
    return porMarca[b].total-porMarca[a].total || a.localeCompare(b,'pt-BR',{sensitivity:'base'});
  });
  var maxTotal=0;
  marcas.forEach(function(m){ if(porMarca[m].total>maxTotal) maxTotal=porMarca[m].total; });
  return {porMarca:porMarca,marcas:marcas,tipos:tipos,maxTotal:maxTotal};
}

// impressao=true: cores de papel (o cinza da tela some no branco) e sem animação,
// senão o PNG do PDF sai no meio da animação, com as barras pela metade.
function _cmChartConfig(agr,impressao){
  var cores;
  if(impressao){
    cores={text:'#333333',grid:'#dddddd',total:'#111111'};
  }else{
    var c=cc();
    // O total vai escrito em cima da barra: no cinza dos eixos ele quase some.
    cores={text:c.text,grid:c.grid,total:document.body.classList.contains('light')?'#1a2235':'#eaf0f6'};
  }
  var datasets=agr.tipos.map(function(t,i){
    return {
      label:_cmTipoLabel(t),
      data:agr.marcas.map(function(m){ return agr.porMarca[m][t]||0; }),
      backgroundColor: t===CM_SEM_TIPO?'#6b7280':(CM_TIPO_COR[t]||modernColors[i%modernColors.length]),
      borderRadius:6,
      maxBarThickness:64
    };
  });
  // Folga no topo do eixo: sem isso a barra mais alta encosta no limite e o total
  // dela é escrito por cima da legenda, ilegível.
  var folga=Math.max(1,Math.ceil(agr.maxTotal*0.18));
  var totaisPlugin={
    id:'cmTotaisPilha',
    afterDatasetsDraw:function(chart){
      var meta=chart.getDatasetMeta(0);
      if(!meta||!meta.data) return;
      var ctx=chart.ctx, escY=chart.scales.y;
      ctx.save();
      ctx.font='700 12px Outfit,Arial,sans-serif';
      ctx.fillStyle=cores.total;
      ctx.textAlign='center';
      ctx.textBaseline='bottom';
      meta.data.forEach(function(el,i){
        // Soma só o que está visível: esconder um tipo na legenda recalcula o número.
        var t=0;
        chart.data.datasets.forEach(function(ds,di){ if(chart.isDatasetVisible(di)) t+=(ds.data[i]||0); });
        if(t) ctx.fillText(String(t), el.x, escY.getPixelForValue(t)-5);
      });
      ctx.restore();
    }
  };
  var opts={
    responsive:!impressao,
    maintainAspectRatio:false,
    plugins:{
      legend:{labels:{color:cores.text,boxHeight:8}},
      tooltip:{enabled:!impressao,callbacks:{
        label:function(c){ return ' '+c.dataset.label+': '+c.parsed.y; },
        footer:function(items){
          if(!items.length) return '';
          var m=items[0].label;
          return 'Total '+m+': '+(agr.porMarca[m]?agr.porMarca[m].total:0);
        }
      }}
    },
    scales:{
      x:{stacked:true,ticks:{color:cores.text},grid:{display:false}},
      y:{stacked:true,beginAtZero:true,suggestedMax:agr.maxTotal+folga,ticks:{color:cores.text,precision:0},grid:{color:cores.grid}}
    }
  };
  if(impressao){ opts.animation=false; opts.devicePixelRatio=2; }
  return {type:'bar',data:{labels:agr.marcas,datasets:datasets},plugins:[totaisPlugin],options:opts};
}

function renderCaminhoesChart(lista){
  var grid=document.getElementById('fcmChartGrid');
  if(!grid) return;
  destroyChart('cCamMarca');
  if(typeof Chart==='undefined' || !lista.length){
    grid.style.display='none';
    return;
  }
  grid.style.display='';
  var agr=_cmAgrupaPorMarca(lista);
  // Hoje a maioria das carretas está sem marca, então essa barra é a maior do gráfico —
  // o badge diz de quantas se trata, pra ninguém ler "sem marca" como uma marca da frota.
  var badge=document.getElementById('fcmChartBadge');
  if(badge){
    var nSemMarca=agr.porMarca[CM_SEM_MARCA]?agr.porMarca[CM_SEM_MARCA].total:0;
    var nMarcas=agr.marcas.length-(nSemMarca?1:0);
    badge.textContent=nMarcas+(nMarcas===1?' marca':' marcas')+(nSemMarca?' · '+nSemMarca+' sem marca':'');
  }
  chartInstances['cCamMarca']=new Chart(document.getElementById('cCamMarca'),_cmChartConfig(agr,false));
}

// ---------- Relatório em PDF (retrato) ----------
// Desenha o gráfico de novo num canvas fora da tela só pra virar PNG. Capturar o da
// tela traria as cores escuras, que no papel ficam ilegíveis.
function _cmChartPNG(agr){
  if(typeof Chart==='undefined') return '';
  var cv=null,ch=null;
  try{
    cv=document.createElement('canvas');
    cv.width=900; cv.height=360;
    cv.style.position='fixed'; cv.style.left='-10000px'; cv.style.top='0';
    document.body.appendChild(cv);
    ch=new Chart(cv,_cmChartConfig(agr,true));
    var img=cv.toDataURL('image/png');
    return img;
  }catch(e){
    return '';
  }finally{
    if(ch) ch.destroy();
    if(cv&&cv.parentNode) cv.parentNode.removeChild(cv);
  }
}

function exportCaminhoesPDF(){
  // Abre a janela já no clique (gesto do usuário), senão o navegador bloqueia em silêncio.
  var win=window.open('','_blank');
  if(!win){ showToast('Seu navegador bloqueou a janela do PDF. Permita pop-ups para este site.',true); return; }
  var f=_cmFiltrosAtuais();
  var lista=_cmListaFiltrada();
  var filtros=[];
  if(f.marca) filtros.push('Marca: '+(f.marca===CM_VAZIO?'(sem marca)':f.marca));
  if(f.modelo) filtros.push('Modelo: '+(f.modelo===CM_VAZIO?'(sem modelo)':f.modelo));
  if(f.tipo) filtros.push('Tipo: '+(f.tipo===CM_VAZIO?'(não cadastrado)':(TIPO_VEICULO_LABEL[f.tipo]||f.tipo)));
  if(f.ano) filtros.push('Ano: '+(f.ano===CM_VAZIO?'(sem ano)':f.ano));
  var agr=lista.length?_cmAgrupaPorMarca(lista):null;
  var graficoImg=agr?_cmChartPNG(agr):'';
  var porTipo={};
  lista.forEach(function(r){ var t=_cmCampo(r,'TIPO_VEICULO')||CM_SEM_TIPO; porTipo[t]=(porTipo[t]||0)+1; });
  var resumo=Object.keys(TIPO_VEICULO_LABEL).concat([CM_SEM_TIPO]).filter(function(t){ return porTipo[t]; });
  var agora=new Date();

  var html='<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Caminhões Cadastrados - Biomassa Chaparini</title><style>';
  html+='*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;padding:16px;color:#222;font-size:10px}';
  html+='.rep-head{display:flex;align-items:center;gap:14px;border-bottom:2px solid #0D692C;padding-bottom:10px;margin-bottom:12px}';
  html+='.rep-head img{height:46px;width:auto;object-fit:contain}.rep-head h1{font-size:17px;color:#085425;line-height:1.1}';
  html+='.rep-head .sub{font-size:11px;color:#444;margin-top:2px}.rep-head .gen{font-size:9px;color:#888;margin-top:3px}';
  html+='.resumo{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px}';
  html+='.resumo div{border:1px solid #ccc;border-radius:8px;padding:6px 10px;background:#f4f8fb}';
  html+='.resumo b{font-size:15px;color:#085425;display:block;line-height:1.2}';
  html+='.resumo span{font-size:8.5px;text-transform:uppercase;color:#555}';
  html+='.graf{margin-bottom:12px;page-break-inside:avoid}.graf h2{font-size:12px;color:#085425;margin-bottom:4px}';
  html+='.graf img{width:100%;height:auto;border:1px solid #e3e3e3;border-radius:8px}';
  html+='table{width:100%;border-collapse:collapse;margin-top:4px}th,td{border:1px solid #ccc;padding:4px 6px;font-size:9px;text-align:left;overflow-wrap:anywhere}';
  html+='th{background:#0D692C;color:#fff;text-transform:uppercase;font-size:8.5px}tbody tr:nth-child(even){background:#f4f8fb}';
  html+='tr{page-break-inside:avoid}thead{display:table-header-group}';
  html+='.foot{margin-top:10px;font-size:9px;color:#666;text-align:center}';
  html+='@page{size:portrait;margin:10mm}</style></head><body>';
  html+='<div class="rep-head"><img src="'+PDF_LOGO+'" alt="Biomassa Chaparini"><div><h1>BIOMASSA CHAPARINI</h1>';
  html+='<div class="sub">Caminhões Cadastrados</div>';
  html+=(filtros.length?'<div class="sub"><b>Filtros:</b> '+_cmEsc(filtros.join(' · '))+'</div>':'');
  html+='<div class="gen">Gerado em '+agora.toLocaleDateString('pt-BR')+' às '+agora.toLocaleTimeString('pt-BR')+'</div></div></div>';
  if(!lista.length){
    html+='<p style="padding:20px;text-align:center;color:#888">Nenhum veículo para os filtros aplicados.</p>';
  }else{
    html+='<div class="resumo"><div><b>'+lista.length+'</b><span>Veículos</span></div>';
    resumo.forEach(function(t){ html+='<div><b>'+porTipo[t]+'</b><span>'+_cmEsc(_cmTipoLabel(t))+'</span></div>'; });
    html+='</div>';
    if(graficoImg) html+='<div class="graf"><h2>Veículos por marca</h2><img src="'+graficoImg+'"></div>';
    html+='<table><thead><tr><th>Placa</th><th>Marca</th><th>Modelo</th><th>Ano</th><th>Tipo de Veículo</th></tr></thead><tbody>';
    lista.forEach(function(r){
      var tipoTxt=r.TIPO_VEICULO?(TIPO_VEICULO_LABEL[r.TIPO_VEICULO]||r.TIPO_VEICULO):'— não cadastrado —';
      html+='<tr><td>'+_cmEsc(r.PLACA||'-')+'</td><td>'+_cmEsc(r.MARCA||'-')+'</td><td>'+_cmEsc(r.MODELO||'-')+'</td><td>'+_cmEsc(r.ANO||'-')+'</td><td>'+_cmEsc(tipoTxt)+'</td></tr>';
    });
    html+='</tbody></table><div class="foot">'+lista.length+' veículo(s)'+(lista.length!==CAMINHOES_DATA.length?' de '+CAMINHOES_DATA.length+' cadastrados':'')+'</div>';
  }
  html+='<script>window.onload=function(){setTimeout(function(){window.print()},300)}<'+'/script></body></html>';
  win.document.write(html);
  win.document.close();
}

function salvarCaminhao(){
  var placa=document.getElementById('fcmPlaca').value.trim().toUpperCase().replace(/\s+/g,'');
  if(!placa){showToast('Placa é obrigatória!',true);return;}
  var rec={
    PLACA:placa,
    MARCA:document.getElementById('fcmMarca').value.trim(),
    MODELO:document.getElementById('fcmModelo').value.trim(),
    ANO:document.getElementById('fcmAno').value,
    TIPO_VEICULO:document.getElementById('fcmTipoVeiculo').value||null
  };
  CAMINHOES_DATA.push(rec);
  if(!BASE.placas.includes(placa)){
    BASE.placas.push(placa);
    BASE.placas.sort(function(a,b){ return String(a).localeCompare(String(b),'pt-BR'); }); // mantém a ordem ao cadastrar
    populateSelects();
  }
  saveToSheets('addCaminhao', rec, function(ok){
    if(ok) showToast('✅ Caminhão cadastrado! '+placa);
    else showToast('⚠️ Salvo local, falha na planilha',true);
    loadFromSheets(function(){ renderCaminhoesTable(); });
  });
  limparFormCaminhao();
}

function limparFormCaminhao(){
  ['fcmPlaca','fcmMarca','fcmModelo','fcmAno'].forEach(function(id){document.getElementById(id).value='';});
  document.getElementById('fcmTipoVeiculo').value='';
}

// ---------- Edição (necessária pra classificar a frota já cadastrada) ----------
var _cmEditId=null;
function _cmBuildForm(row){
  row=row||{};
  var to='<option value="">— não cadastrado —</option>';
  Object.keys(TIPO_VEICULO_LABEL).forEach(function(k){ to+='<option value="'+k+'"'+(row.TIPO_VEICULO===k?' selected':'')+'>'+TIPO_VEICULO_LABEL[k]+'</option>'; });
  return ''+
    '<div class="form-group"><label>Placa</label><input type="text" value="'+(row.PLACA||'')+'" disabled></div>'+
    '<div class="form-group"><label>Tipo de Veículo</label><select id="cm_tipoVeiculo">'+to+'</select></div>'+
    '<div class="form-group"><label>Marca</label><input id="cm_marca" type="text" value="'+(row.MARCA?String(row.MARCA).replace(/"/g,'&quot;'):'')+'"></div>'+
    '<div class="form-group"><label>Modelo</label><input id="cm_modelo" type="text" value="'+(row.MODELO?String(row.MODELO).replace(/"/g,'&quot;'):'')+'"></div>'+
    '<div class="form-group"><label>Ano</label><input id="cm_ano" type="number" min="1990" max="2030" value="'+(row.ANO||'')+'"></div>';
}
function openCaminhaoModal(id){
  if(!currentUserData||currentUserData.perfil!=='ADMIN'){showToast('Apenas ADMIN pode editar caminhões',true);return;}
  var row=findCaminhaoById(id);
  if(!row){showToast('Caminhão não encontrado',true);return;}
  _cmEditId=String(id);
  document.getElementById('cmModalGrid').innerHTML=_cmBuildForm(row);
  document.getElementById('cmModalOverlay').classList.add('show');
}
function closeCaminhaoModal(){ document.getElementById('cmModalOverlay').classList.remove('show'); _cmEditId=null; }
function salvarCaminhaoEdit(){
  if(!_cmEditId) return;
  var row={
    tipo_veiculo:document.getElementById('cm_tipoVeiculo').value||null,
    marca:document.getElementById('cm_marca').value.trim()||null,
    modelo:document.getElementById('cm_modelo').value.trim()||null,
    ano:document.getElementById('cm_ano').value?num(document.getElementById('cm_ano').value):null
  };
  var btn=document.getElementById('cmSalvarBtn'); if(btn){btn.disabled=true;btn.textContent='Salvando...';}
  saveToSheets('updateCaminhao',{id:_cmEditId,row:row},function(ok,res){
    if(btn){btn.disabled=false;btn.textContent='💾 Salvar';}
    if(!ok){showToast('❌ Erro: '+((res&&res.error)||'desconhecido'),true);return;}
    showToast('✅ Caminhão atualizado!');
    closeCaminhaoModal();
    loadFromSheets(function(){ renderCaminhoesTable(); });
  });
}

// ---------- Exclusão ----------
var _cmDelId=null;
function openCaminhaoDelete(id){
  if(!currentUserData||currentUserData.perfil!=='ADMIN'){showToast('Apenas ADMIN pode excluir caminhões',true);return;}
  var row=findCaminhaoById(id);
  if(!row){showToast('Caminhão não encontrado',true);return;}
  _cmDelId=String(id);
  document.getElementById('cmDelDetails').innerHTML='<div><strong>Placa:</strong> '+(row.PLACA||'-')+'</div><div><strong>Marca/Modelo:</strong> '+(row.MARCA||'-')+' '+(row.MODELO||'')+'</div><div style="margin-top:8px;color:var(--text2);font-size:12px">⚠️ Se essa placa já tiver lançamentos (Cadastro, Manutenção, Garantia), a exclusão vai falhar — nesse caso não é possível remover, só deixar de usar a placa.</div>';
  document.getElementById('cmDelOverlay').classList.add('show');
}
function closeCaminhaoDelete(){ document.getElementById('cmDelOverlay').classList.remove('show'); _cmDelId=null; }
function confirmCaminhaoDelete(){
  if(!_cmDelId) return;
  var btn=document.getElementById('cmDelBtn'); if(btn){btn.disabled=true;btn.textContent='Excluindo...';}
  saveToSheets('deleteCaminhao',{id:_cmDelId},function(ok,res){
    if(btn){btn.disabled=false;btn.textContent='🗑️ Excluir';}
    if(!ok){showToast('❌ Não foi possível excluir: '+((res&&res.error)||'essa placa já tem lançamentos vinculados'),true);return;}
    showToast('✅ Caminhão excluído');
    closeCaminhaoDelete();
    loadFromSheets(function(){ renderCaminhoesTable(); });
  });
}
