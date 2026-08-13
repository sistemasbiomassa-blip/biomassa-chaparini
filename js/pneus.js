// ==================== RASTREIO DE PNEUS POR POSIÇÃO ====================
// Diagrama de eixos (visão de cima) compartilhado entre o formulário de
// Manutenção Realizada (Cadastro) e a edição no Detalhamento (aba Manutenção).
// Convenção de posição: "EIXO-LADO" (eixo simples) ou "EIXO-LADO-POSICAO"
// (eixo duplo), ex: "1-E", "2-D-externa".
var PNEU_CONFIGS={
  cavalo:[
    {eixo:1,duplo:false,driven:false,nome:'Eixo 1 · Direção'},
    {eixo:2,duplo:true,driven:true,nome:'Eixo 2 · Tração'},
    {eixo:3,duplo:true,driven:true,nome:'Eixo 3 · Tração'}
  ],
  carreta_3_eixos:[
    {eixo:1,duplo:true,driven:false,nome:'Eixo 1'},
    {eixo:2,duplo:true,driven:false,nome:'Eixo 2'},
    {eixo:3,duplo:true,driven:false,nome:'Eixo 3'}
  ],
  carreta_4_eixos:[
    {eixo:1,duplo:true,driven:false,nome:'Eixo 1'},
    {eixo:2,duplo:true,driven:false,nome:'Eixo 2'},
    {eixo:3,duplo:true,driven:false,nome:'Eixo 3'},
    {eixo:4,duplo:true,driven:false,nome:'Eixo 4'}
  ]
};

function _pneuTireHtml(containerId,posId,label,pickedMap){
  var picked=pickedMap[posId]?' picked':'';
  return '<div class="pneu-tire'+picked+'" data-posid="'+posId+'" title="'+label.replace(/"/g,'&quot;')+'" onclick="pneuToggleTire(\''+containerId+'\',\''+posId+'\',\''+label.replace(/'/g,"\\'")+'\')"></div>';
}
function _pneuWheelPosHtml(containerId,eixo,lado,duplo,pickedMap,axleNome){
  if(!duplo){
    var posId=eixo+'-'+lado;
    var label=axleNome+' · '+(lado==='E'?'Esquerdo':'Direito');
    return '<div class="pneu-wheel-pos">'+_pneuTireHtml(containerId,posId,label,pickedMap)+'</div>';
  }
  var extId=eixo+'-'+lado+'-externa', intId=eixo+'-'+lado+'-interna';
  var ladoTxt=lado==='E'?'Esq.':'Dir.';
  var extLabel=axleNome+' · '+ladoTxt+' externo', intLabel=axleNome+' · '+ladoTxt+' interno';
  var order=lado==='E'?[[extId,extLabel],[intId,intLabel]]:[[intId,intLabel],[extId,extLabel]];
  return '<div class="pneu-wheel-pos">'+order.map(function(o){return _pneuTireHtml(containerId,o[0],o[1],pickedMap)}).join('')+'</div>';
}
function _pneuAxleColHtml(containerId,axle,pickedMap){
  var top=_pneuWheelPosHtml(containerId,axle.eixo,'E',axle.duplo,pickedMap,axle.nome);
  var bottom=_pneuWheelPosHtml(containerId,axle.eixo,'D',axle.duplo,pickedMap,axle.nome);
  var mid=axle.driven?'<div class="pneu-diff"></div>':'<div class="pneu-beam"></div>';
  return '<div class="pneu-axle-col"><div class="pneu-axle-name">'+axle.nome+'</div>'+top+'<div class="pneu-stub"></div>'+mid+'<div class="pneu-stub"></div>'+bottom+'</div>';
}
function _pneuRowHtml(containerId,posId,label,removido,instalado){
  return '<div class="pneu-row" id="'+containerId+'_row_'+posId+'">'+
    '<div class="pneu-pos-tag">'+label+'</div>'+
    '<div><span class="pneu-field-label">Pneu removido (nº)</span><input id="'+containerId+'_rem_'+posId+'" value="'+(removido?String(removido).replace(/"/g,'&quot;'):'')+'"></div>'+
    '<div><span class="pneu-field-label">Pneu instalado (nº) *</span><input id="'+containerId+'_ins_'+posId+'" value="'+(instalado?String(instalado).replace(/"/g,'&quot;'):'')+'"></div>'+
    '<div class="pneu-row-rm" onclick="pneuToggleTire(\''+containerId+'\',\''+posId+'\',\''+label.replace(/'/g,"\\'")+'\')">✕</div>'+
    '</div>';
}

// Desenha o diagrama pra um tipo de veículo, marcando (e pré-preenchendo) as
// posições passadas em itensExistentes (modo edição) — formato DB.manutPneusItens.
function renderDiagramaEixos(containerId,tipoVeiculo,itensExistentes){
  var cont=document.getElementById(containerId);
  if(!cont) return;
  var axles=PNEU_CONFIGS[tipoVeiculo];
  if(!axles){ cont.innerHTML='<div style="padding:14px;color:var(--text2);font-size:12px">Tipo de veículo não reconhecido.</div>'; return; }
  var pickedMap={};
  (itensExistentes||[]).forEach(function(it){
    var posId=it.EIXO+'-'+it.LADO+(it.POSICAO?'-'+it.POSICAO:'');
    pickedMap[posId]=it;
  });
  var rowH='<div class="pneu-rig-row">';
  axles.forEach(function(axle,i){
    rowH+=_pneuAxleColHtml(containerId,axle,pickedMap);
    if(i<axles.length-1) rowH+='<div class="'+(axle.driven?'pneu-shaft':'pneu-frame-bar')+'"></div>';
  });
  rowH+='</div>';
  var legendH='<div class="pneu-legend"><span><i class="pneu-legend-dot pneu-legend-diff"></i>Diferencial (tração)</span><span><i class="pneu-legend-dot pneu-legend-beam"></i>Eixo de arraste</span></div>';
  cont.innerHTML='<div class="pneu-diagram">'+rowH+legendH+'</div><div id="'+containerId+'_rows" class="pneu-rows"></div>';

  var rowsEl=document.getElementById(containerId+'_rows');
  Object.keys(pickedMap).forEach(function(posId){
    var it=pickedMap[posId];
    var tireEl=cont.querySelector('.pneu-tire[data-posid="'+posId+'"]');
    var label=tireEl?tireEl.getAttribute('title'):posId;
    rowsEl.insertAdjacentHTML('beforeend',_pneuRowHtml(containerId,posId,label,it.PNEU_REMOVIDO,it.PNEU_INSTALADO));
  });
}

// Marca/desmarca uma posição — adiciona/remove a linha de removido/instalado.
function pneuToggleTire(containerId,posId,label){
  var tireEl=document.querySelector('#'+containerId+' .pneu-tire[data-posid="'+posId+'"]');
  if(!tireEl) return;
  var rowsEl=document.getElementById(containerId+'_rows');
  var existingRow=document.getElementById(containerId+'_row_'+posId);
  if(existingRow){
    existingRow.remove();
    tireEl.classList.remove('picked');
  } else {
    tireEl.classList.add('picked');
    rowsEl.insertAdjacentHTML('beforeend',_pneuRowHtml(containerId,posId,label,'',''));
  }
}

// Lê as posições marcadas no diagrama — usado no momento de salvar.
// Exige "instalado" preenchido; ignora posições marcadas sem esse campo.
function coletarItensPneu(containerId){
  var itens=[];
  document.querySelectorAll('#'+containerId+' .pneu-tire.picked').forEach(function(t){
    var posId=t.getAttribute('data-posid');
    var parts=posId.split('-');
    var insEl=document.getElementById(containerId+'_ins_'+posId);
    var remEl=document.getElementById(containerId+'_rem_'+posId);
    var instalado=insEl?insEl.value.trim():'';
    if(!instalado) return;
    itens.push({eixo:Number(parts[0]),lado:parts[1],posicao:parts[2]||null,pneu_removido:(remEl&&remEl.value.trim())||null,pneu_instalado:instalado});
  });
  return itens;
}

// ==================== CONSULTA DE PNEU ====================
function _pneuPosLabel(it){
  var ladoTxt=it.LADO==='E'?'Esquerdo':'Direito';
  var posTxt=it.POSICAO?(' '+(it.POSICAO==='externa'?'externo':'interno')):'';
  return 'Eixo '+it.EIXO+' · '+ladoTxt+posTxt;
}
function buscarPneu(){
  var termo=document.getElementById('pneuBuscaInput').value.trim();
  var cont=document.getElementById('pneuBuscaResultado');
  if(!termo){ cont.innerHTML=''; return; }
  var eventos=[];
  DB.manutPneusItens.forEach(function(it){
    if(it.PNEU_INSTALADO===termo) eventos.push({tipo:'in',item:it});
    if(it.PNEU_REMOVIDO===termo) eventos.push({tipo:'out',item:it});
  });
  if(!eventos.length){ cont.innerHTML='<div style="padding:14px;color:var(--text2);font-size:12px;text-align:center">Nenhum evento encontrado pra esse número.</div>'; return; }
  eventos.forEach(function(e){
    var manut=findManutRealById(e.item.MANUT_REALIZADA_ID);
    e.data=manut?manut.DATA_MANUTENCAO:'';
    e.placa=manut?manut.PLACA:'-';
    e.km=manut?manut.KM_NA_MANUTENCAO:null;
    e.local=manut?manut.LOCAL_SERVICO:'';
  });
  eventos.sort(function(a,b){ return String(b.data||'').localeCompare(String(a.data||'')); });
  var h='<div class="pneu-timeline">';
  eventos.forEach(function(e){
    var posLabel=_pneuPosLabel(e.item);
    var acao=e.tipo==='in'?'Instalado em':'Removido de';
    h+='<div class="pneu-tl-item"><div class="pneu-tl-dot '+e.tipo+'"></div><div class="pneu-tl-body">'+
      '<div class="pneu-tl-top"><span class="pneu-tl-date">'+formatDateBR(e.data)+'</span><span class="pneu-tl-tag '+e.tipo+'">'+(e.tipo==='in'?'Instalado':'Removido')+'</span></div>'+
      '<div class="pneu-tl-desc">'+acao+' <b>'+(e.placa||'-')+'</b> — '+posLabel+(e.km?' ('+Number(e.km).toLocaleString('pt-BR')+' km)':'')+(e.local?' em '+e.local:'')+'</div>'+
      '</div></div>';
  });
  h+='</div>';
  cont.innerHTML=h;
}
