// ==================== INIT ====================
function initApp(){
  populateSelects();
  renderManutRealTable();
  renderManutProgTable();
  renderGarantiaTable();
  renderGarantiaPgTable();
  renderLocaisTable();
  document.getElementById('fData').value=new Date().toISOString().slice(0,10);
  document.getElementById('fmData').value=new Date().toISOString().slice(0,10);
  iniciarMascaras();
}

function populateSelects(){
  function fill(id,arr,ph){
    var sel=document.getElementById(id);
    if(!sel) return;
    var sorted=arr.slice().sort(function(a,b){return String(a).localeCompare(String(b),'pt-BR',{sensitivity:'base'})});
    sel.innerHTML='<option value="">'+(ph||'Selecione')+'</option>';
    sorted.forEach(function(v){sel.innerHTML+='<option value="'+v+'">'+v+'</option>'});
  }
  fill('fMotorista',motoristasFiltrados(BASE.motoristas,'Ativos'));
  fill('fLocalCarga',locaisFiltrados(BASE.localCarga,'Ativos'));
  fill('fLocalDescarga',locaisFiltrados(BASE.localDescarga,'Ativos'));
  fill('fPlaca',BASE.placas);
  fill('fLocalAbast',locaisFiltrados(BASE.localAbast,'Ativos'));
  fill('fClasseDesp',BASE.classeDesp);
  fill('fmPlaca',BASE.placas);
  fill('fmTipo',BASE.tipoManut);
  fill('fmMotorista',motoristasFiltrados(BASE.motoristas,'Ativos'));
}

// Reaplica as opções de um <select> específico sem mexer nos outros campos do
// formulário — usado depois de cadastrar/editar/excluir um tipo de manutenção
// (ou outra lista usada em BASE), pra não perder o que já estava preenchido
// no resto do Cadastro (populateSelects() reseta a tela toda).
function refreshSelectOptions(id,arr,ph){
  var sel=document.getElementById(id);
  if(!sel) return;
  var atual=sel.value;
  var sorted=arr.slice().sort(function(a,b){return String(a).localeCompare(String(b),'pt-BR',{sensitivity:'base'})});
  sel.innerHTML='<option value="">'+(ph||'Selecione')+'</option>';
  sorted.forEach(function(v){sel.innerHTML+='<option value="'+v+'">'+v+'</option>'});
  if(atual && arr.indexOf(atual)>=0) sel.value=atual;
}

