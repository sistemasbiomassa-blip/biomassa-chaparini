// ==================== MÁSCARAS NUMÉRICAS ====================
function mascaraNumero(el, maxInteiros, maxDecimais){
  var dec = maxDecimais || 2;
  var maxDigitos = (maxInteiros || 9) + dec; // total máximo de dígitos

  el.addEventListener('keydown', function(e){
    // Sempre permitir: backspace, delete, tab, escape, enter, setas
    if([8,9,27,13,46,37,38,39,40].indexOf(e.keyCode) !== -1) return;
    // Bloquear tudo que não for número
    if((e.keyCode < 48 || e.keyCode > 57) && (e.keyCode < 96 || e.keyCode > 105)){
      e.preventDefault();
      return;
    }
    // Bloquear se já atingiu o limite de dígitos
    var raw = el.value.replace(/\D/g,'');
    if(raw.length >= maxDigitos){
      e.preventDefault();
    }
  });

  el.addEventListener('input', function(){
    var raw = el.value.replace(/\D/g,'');
    if(!raw){ el.value=''; return; }
    // Garantir que não ultrapasse o máximo (proteção extra para colar texto)
    if(raw.length > maxDigitos) raw = raw.slice(0, maxDigitos);
    // Preencher zeros à esquerda até ter dígitos suficientes para os decimais
    while(raw.length <= dec) raw = '0' + raw;
    var intPart = raw.slice(0, raw.length - dec);
    var decPart = raw.slice(raw.length - dec);
    // Remover zeros à esquerda da parte inteira (mantém pelo menos 1)
    intPart = intPart.replace(/^0+/,'') || '0';
    // Separador de milhar
    intPart = intPart.replace(/\B(?=(\d{3})+(?!\d))/g,'.');
    el.value = intPart + ',' + decPart;
  });
}

// ── Limites de cada campo — altere aqui se precisar ajustar ──────────────
var LIMITES_CAMPOS = {
  quantidadeTON: 2,  // TON:  99,99
  quantidadeM3:  3,  // M³:  999,99
  km:            6,  // KM:  999.999,99
  litros:        3,  // Litros: 999,99
  valorUnit:     2,  // Valor Unitário: 9,99 (usa 2 inteiros para funcionar corretamente)
  arla:          3,  // Arla: 999,99
  valorDesp:     5   // Valor Despesa: 99.999,99
};

function aplicarMascaraQuantidade(){
  var fQ = document.getElementById('fQuantidade');
  if(!fQ) return;
  var local = document.getElementById('fLocalDescarga') ? document.getElementById('fLocalDescarga').value : '';
  var isM3 = BASE.clientesM3.includes(local);
  var maxInt = isM3 ? LIMITES_CAMPOS.quantidadeM3 : LIMITES_CAMPOS.quantidadeTON;
  // Remover listeners antigos clonando o elemento
  var novo = fQ.cloneNode(true);
  fQ.parentNode.replaceChild(novo, fQ);
  mascaraNumero(novo, maxInt, 2);
}

function clonarEMascarar(id, maxInt, dec){
  var el = document.getElementById(id);
  if(!el) return;
  var novo = el.cloneNode(true);
  el.parentNode.replaceChild(novo, el);
  mascaraNumero(novo, maxInt, dec || 2);
}

function iniciarMascaras(){
  aplicarMascaraQuantidade();
  clonarEMascarar('fKM',        LIMITES_CAMPOS.km,        2);
  clonarEMascarar('fLitros',    LIMITES_CAMPOS.litros,    2);
  clonarEMascarar('fValorUnit', LIMITES_CAMPOS.valorUnit,  2);
  clonarEMascarar('fArla',      LIMITES_CAMPOS.arla,       2);
  clonarEMascarar('fValorDesp', LIMITES_CAMPOS.valorDesp,  2);
}

