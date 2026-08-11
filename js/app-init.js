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
  fill('fLocalCarga',BASE.localCarga);
  fill('fLocalDescarga',BASE.localDescarga);
  fill('fPlaca',BASE.placas);
  fill('fLocalAbast',BASE.localAbast);
  fill('fClasseDesp',BASE.classeDesp);
  fill('fmPlaca',BASE.placas);
  fill('fmTipo',BASE.tipoManut);
}

