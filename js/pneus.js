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
function _pneuRowHtml(containerId,posId,label,removido,instalado,marcaModelo){
  return '<div class="pneu-row" id="'+containerId+'_row_'+posId+'">'+
    '<div class="pneu-pos-tag">'+label+'</div>'+
    '<div><span class="pneu-field-label">Pneu removido (nº)</span><input id="'+containerId+'_rem_'+posId+'" value="'+(removido?String(removido).replace(/"/g,'&quot;'):'')+'"></div>'+
    '<div><span class="pneu-field-label">Pneu instalado (nº) *</span><input id="'+containerId+'_ins_'+posId+'" value="'+(instalado?String(instalado).replace(/"/g,'&quot;'):'')+'"></div>'+
    '<div><span class="pneu-field-label">Marca/Modelo (instalado)</span><input id="'+containerId+'_mm_'+posId+'" value="'+(marcaModelo?String(marcaModelo).replace(/"/g,'&quot;'):'')+'"></div>'+
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
    rowsEl.insertAdjacentHTML('beforeend',_pneuRowHtml(containerId,posId,label,it.PNEU_REMOVIDO,it.PNEU_INSTALADO,it.MARCA_MODELO));
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
    rowsEl.insertAdjacentHTML('beforeend',_pneuRowHtml(containerId,posId,label,'','',''));
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
    var mmEl=document.getElementById(containerId+'_mm_'+posId);
    var instalado=insEl?insEl.value.trim():'';
    if(!instalado) return;
    itens.push({eixo:Number(parts[0]),lado:parts[1],posicao:parts[2]||null,pneu_removido:(remEl&&remEl.value.trim())||null,pneu_instalado:instalado,marca_modelo:(mmEl&&mmEl.value.trim())||null});
  });
  return itens;
}

// ==================== FOLHA DE CAMPO (IMPRESSÃO) ====================
// Folha em branco pra anotar na garagem (pneu removido/instalado por posição)
// e depois passar pro sistema. Uma página por tipo de veículo, mesmo diagrama
// de eixos do formulário digital (PNEU_CONFIGS), sem interatividade.
var PNEU_TIPOS_FOLHA=[
  {key:'cavalo', nome:'Cavalo Mecânico'},
  {key:'carreta_3_eixos', nome:'Carreta 3 Eixos'},
  {key:'carreta_4_eixos', nome:'Carreta 4 Eixos'}
];

function _folhaWheelHtml(axle,lado){
  var ladoTxt=lado==='E'?'Esq.':'Dir.';
  if(!axle.duplo){
    return '<div class="folha-wpos"><div class="folha-tire">'+ladoTxt+'</div></div>';
  }
  var ext='<div class="folha-tire">'+ladoTxt+' ext</div>';
  var int='<div class="folha-tire">'+ladoTxt+' int</div>';
  // Empilhado verticalmente (não lado a lado) — mesma visão de corte do eixo usada no sistema:
  // externa sempre na ponta de fora, interna sempre encostada no diferencial/eixo de arraste.
  return '<div class="folha-wpos">'+(lado==='E'?ext+int:int+ext)+'</div>';
}
function _folhaAxleColHtml(axle){
  var mid=axle.driven?'<div class="folha-diff" title="Diferencial (tração)"></div>':'<div class="folha-beam" title="Eixo de arraste"></div>';
  // Eixo desenhado como uma barra contínua (stub+centro+stub sem espaço entre si) ligando
  // as duas rodas — mesma leitura do diagrama do sistema, só que em traço sólido pro papel.
  var shaft='<div class="folha-shaft-assy"><div class="folha-stub"></div>'+mid+'<div class="folha-stub"></div></div>';
  return '<div class="folha-eixo-col"><div class="folha-eixo-nome">'+axle.nome+'</div>'+
    _folhaWheelHtml(axle,'E')+shaft+_folhaWheelHtml(axle,'D')+'</div>';
}
function _folhaRowHtml(posLabel){
  return '<tr><td>'+posLabel+'</td><td class="folha-blank"></td><td class="folha-blank"></td><td class="folha-blank"></td></tr>';
}
function _folhaSheetHtml(tipoKey,tipoNome,logoSrc){
  var axles=PNEU_CONFIGS[tipoKey];
  var diag='<div class="folha-diagrama">';
  axles.forEach(function(axle,i){
    diag+=_folhaAxleColHtml(axle);
    if(i<axles.length-1) diag+='<div class="'+(axle.driven?'folha-shaft':'folha-frame')+'"></div>';
  });
  diag+='</div>';
  var rows='';
  axles.forEach(function(axle){
    if(axle.duplo){
      rows+=_folhaRowHtml(axle.nome+' · Esquerdo externo');
      rows+=_folhaRowHtml(axle.nome+' · Esquerdo interno');
      rows+=_folhaRowHtml(axle.nome+' · Direito interno');
      rows+=_folhaRowHtml(axle.nome+' · Direito externo');
    } else {
      rows+=_folhaRowHtml(axle.nome+' · Esquerdo');
      rows+=_folhaRowHtml(axle.nome+' · Direito');
    }
  });
  var h='<div class="folha-sheet">';
  h+='<div class="rep-head">'+(logoSrc?'<img src="'+logoSrc+'">':'')+'<div><h1>BIOMASSA CHAPARINI</h1><div class="sub">Folha de Troca de Pneus — '+tipoNome+'</div><div class="gen">Preencher na garagem e lançar depois no sistema (Manutenção → Pneus)</div></div></div>';
  h+='<div class="folha-campos">';
  h+='<div class="folha-campo folha-campo-lg"><label>Placa</label><div class="folha-linha"></div></div>';
  h+='<div class="folha-campo"><label>Data</label><div class="folha-linha"></div></div>';
  h+='<div class="folha-campo folha-campo-lg"><label>Motorista / Operador</label><div class="folha-linha"></div></div>';
  h+='<div class="folha-campo"><label>KM atual</label><div class="folha-linha"></div></div>';
  h+='</div>';
  h+=diag;
  h+='<div class="folha-legenda"><span><i class="folha-leg-dot folha-leg-diff"></i>Diferencial (tração)</span><span><i class="folha-leg-dot folha-leg-beam"></i>Eixo de arraste</span></div>';
  h+='<table class="folha-table"><thead><tr><th>Posição</th><th>Pneu removido (nº)</th><th>Pneu instalado (nº)</th><th>Marca/Modelo (instalado)</th></tr></thead><tbody>'+rows+'</tbody></table>';
  h+='<div class="folha-campo" style="margin-top:14px;max-width:340px"><label>Observações</label><div class="folha-linha"></div><div class="folha-linha" style="margin-top:16px"></div></div>';
  h+='</div>';
  return h;
}
function imprimirFolhaPneus(){
  var logoEl=document.querySelector('.sidebar-logo img');
  var logoSrc=logoEl?logoEl.src:'';
  var win=window.open('','_blank');
  var html='<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Folhas de Pneus — Biomassa Chaparini</title><style>';
  html+='*{margin:0;padding:0;box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}body{font-family:Arial,sans-serif;padding:14px;color:#222;font-size:11px}';
  html+='.rep-head{display:flex;align-items:center;gap:14px;border-bottom:2px solid #0D692C;padding-bottom:10px;margin-bottom:14px}';
  html+='.rep-head img{width:54px;height:54px;border-radius:8px;object-fit:cover}.rep-head h1{font-size:18px;color:#085425;line-height:1.1}';
  html+='.rep-head .sub{font-size:12px;color:#444;margin-top:2px;font-weight:bold}.rep-head .gen{font-size:9px;color:#888;margin-top:3px}';
  html+='.folha-sheet{page-break-after:always;padding-bottom:10px}.folha-sheet:last-child{page-break-after:auto}';
  html+='.folha-campos{display:flex;flex-wrap:wrap;gap:18px;margin-bottom:18px}';
  html+='.folha-campo{flex:1;min-width:110px}.folha-campo-lg{flex:2;min-width:220px}';
  html+='.folha-campo label{display:block;font-size:9px;text-transform:uppercase;letter-spacing:0.5px;color:#666;margin-bottom:4px}';
  html+='.folha-linha{border-bottom:1.3px solid #333;height:20px}';
  html+='.folha-diagrama{display:flex;align-items:center;justify-content:center;gap:0;margin:10px 0 6px;padding:26px 6px 14px;border:1px solid #ddd;border-radius:8px;background:#fafafa}';
  html+='.folha-eixo-col{position:relative;display:flex;flex-direction:column;align-items:center;gap:4px}';
  html+='.folha-eixo-nome{position:absolute;bottom:100%;left:50%;transform:translateX(-50%);margin-bottom:6px;font-size:8.5px;color:#555;white-space:nowrap}';
  html+='.folha-wpos{display:flex;flex-direction:column;gap:3px}';
  html+='.folha-tire{width:40px;height:22px;border:1.4px solid #333;border-radius:3px;display:flex;align-items:center;justify-content:center;font-size:7.5px;line-height:1.1;color:#333;text-align:center}';
  html+='.folha-shaft-assy{display:flex;flex-direction:column;align-items:center}';
  html+='.folha-stub{width:0;height:12px;border-left:3px solid #333}';
  html+='.folha-diff{width:22px;height:22px;border:2.5px solid #222;border-radius:50%}';
  html+='.folha-beam{width:22px;height:8px;border:2px solid #333;border-radius:2px}';
  html+='.folha-shaft{width:36px;height:0;border-top:4px solid #333;align-self:center}';
  html+='.folha-frame{width:36px;height:0;border-top:2px solid #999;align-self:center}';
  html+='.folha-legenda{display:flex;gap:16px;justify-content:center;font-size:9px;color:#666;margin-bottom:10px}';
  html+='.folha-leg-dot{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:4px;vertical-align:middle}';
  html+='.folha-leg-diff{background:#e8e8e8;border:1.4px solid #333}.folha-leg-beam{background:#999}';
  html+='.folha-table{width:100%;border-collapse:collapse;margin-top:4px}';
  html+='.folha-table th{background:#0D692C;color:#fff;text-transform:uppercase;font-size:8.5px;padding:5px 8px;text-align:left}';
  html+='.folha-table td{border:1px solid #ccc;padding:0;font-size:9px}';
  html+='.folha-table td:first-child{padding:6px 8px}';
  html+='.folha-blank{height:26px}';
  html+='@page{size:portrait;margin:10mm}@media print{body{padding:0}}';
  html+='</style></head><body>';
  PNEU_TIPOS_FOLHA.forEach(function(t){ html+=_folhaSheetHtml(t.key,t.nome,logoSrc); });
  html+='<script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script>';
  html+='</body></html>';
  win.document.write(html);
  win.document.close();
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
