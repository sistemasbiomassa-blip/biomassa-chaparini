// ==================== GARANTIA (Cadastro) ====================
// Duas tabelas: garantia_caminhoes (placa -> data fim / km limite) e
// manut_programada_garantia (placa+tipo -> intervalo/alerta próprio, independente
// do intervalo padrão do mesmo tipo fora de garantia). Só ADMIN gerencia (RLS garante,
// isso aqui só evita abrir o modal à toa).
function findGarantiaById(id){ id=String(id); for(var i=0;i<DB.garantiaCaminhoes.length;i++){ if(String(DB.garantiaCaminhoes[i].ID)===id) return DB.garantiaCaminhoes[i]; } return null; }
function findGarantiaByPlaca(placa){ for(var i=0;i<DB.garantiaCaminhoes.length;i++){ if(DB.garantiaCaminhoes[i].PLACA===placa) return DB.garantiaCaminhoes[i]; } return null; }
function findGarantiaPgById(id){ id=String(id); for(var i=0;i<DB.manutProgramadaGarantia.length;i++){ if(String(DB.manutProgramadaGarantia[i].ID)===id) return DB.manutProgramadaGarantia[i]; } return null; }

function garantiaEstaAtiva(g){
  if(!g) return false;
  var hojeISO=new Date().toISOString().slice(0,10);
  if(g.DATA_FIM && String(g.DATA_FIM).slice(0,10)<hojeISO) return false;
  var kmAtual=kmAtualPorPlaca(g.PLACA);
  if(g.KM_LIMITE && kmAtual!=null && kmAtual>=num(g.KM_LIMITE)) return false;
  return true;
}
function placaEmGarantiaAtiva(placa){
  var g=findGarantiaByPlaca(placa);
  return !!(g && garantiaEstaAtiva(g));
}

// ---------- Tabela: Caminhões em Garantia ----------
function renderGarantiaTable(){
  var cont=document.getElementById('tblGarantiaContainer'); if(!cont) return;
  var data=DB.garantiaCaminhoes.slice().sort(function(a,b){ return String(a.PLACA||'').localeCompare(String(b.PLACA||'')); });
  if(!data.length){ cont.innerHTML='<div style="padding:20px;text-align:center;color:var(--text2)">Nenhuma placa em garantia cadastrada.</div>'; return; }
  var h='<table><thead><tr><th>Placa</th><th>Data Fim</th><th>Km Limite</th><th>Status</th><th>Obs.</th><th style="text-align:center">Ações</th></tr></thead><tbody>';
  data.forEach(function(r){
    var ativa=garantiaEstaAtiva(r);
    var status=ativa?'<span class="maq-chip maq-chip-g">🛡️ Ativa</span>':'<span class="maq-chip maq-chip-gray">Vencida</span>';
    h+='<tr><td>'+(r.PLACA||'-')+'</td><td>'+formatDateBR(r.DATA_FIM)+'</td><td>'+(r.KM_LIMITE?Number(r.KM_LIMITE).toLocaleString('pt-BR'):'-')+' km</td><td>'+status+'</td><td>'+(r.OBS||'-')+'</td>'+
      '<td style="text-align:center;white-space:nowrap"><span class="maq-act" title="Editar" onclick="openGarantiaModal(\''+r.ID+'\')">✏️</span> <span class="maq-act" title="Excluir" onclick="openGarantiaDelete(\''+r.ID+'\')">🗑️</span></td></tr>';
  });
  h+='</tbody></table>';
  cont.innerHTML=h;
}

var _garEditId=null, _garDelId=null;
function _garBuildForm(row){
  row=row||{};
  var po='<option value="">Selecione...</option>';
  (BASE.placas||[]).slice().sort().forEach(function(p){ po+='<option value="'+p+'"'+(row.PLACA===p?' selected':'')+'>'+p+'</option>'; });
  return ''+
    '<div class="form-group"><label>Placa *</label><select id="gar_placa">'+po+'</select></div>'+
    '<div class="form-group"><label>Data Fim *</label><input id="gar_datafim" type="date" value="'+(row.DATA_FIM?String(row.DATA_FIM).slice(0,10):'')+'"></div>'+
    '<div class="form-group"><label>Km Limite *</label><input id="gar_kmlimite" type="number" step="1" value="'+(row.KM_LIMITE!=null?num(row.KM_LIMITE):'')+'"></div>'+
    '<div class="form-group" style="grid-column:1/-1"><label>Observação</label><input id="gar_obs" type="text" value="'+(row.OBS?String(row.OBS).replace(/"/g,'&quot;'):'')+'"></div>';
}
function openGarantiaModal(id){
  if(!currentUserData||currentUserData.perfil!=='ADMIN'){showToast('Apenas ADMIN pode gerenciar garantia',true);return;}
  _garEditId=(id!==undefined&&id!==null&&id!=='')?String(id):null;
  var row=_garEditId?findGarantiaById(_garEditId):{};
  if(_garEditId&&!row){showToast('Garantia não encontrada',true);return;}
  document.getElementById('garModalTitle').textContent=_garEditId?'✏️ Editar Garantia':'🛡️ Nova Garantia';
  document.getElementById('garModalGrid').innerHTML=_garBuildForm(row);
  document.getElementById('garModalOverlay').classList.add('show');
}
function closeGarantiaModal(){ document.getElementById('garModalOverlay').classList.remove('show'); _garEditId=null; }
function salvarGarantia(){
  var placa=document.getElementById('gar_placa').value;
  var datafim=document.getElementById('gar_datafim').value;
  var kmlimite=document.getElementById('gar_kmlimite').value;
  if(!placa){showToast('Selecione a placa',true);return;}
  if(!datafim){showToast('Informe a data fim',true);return;}
  if(!kmlimite){showToast('Informe o km limite',true);return;}
  var obs=document.getElementById('gar_obs').value.trim();
  var btn=document.getElementById('garSalvarBtn'); if(btn){btn.disabled=true;btn.textContent='Salvando...';}
  function done(ok,res){
    if(btn){btn.disabled=false;btn.textContent='💾 Salvar';}
    if(!ok){showToast('❌ Erro: '+((res&&res.error)||'desconhecido'),true);return;}
    showToast('✅ Garantia salva!');
    closeGarantiaModal();
    loadFromSheets(function(){ renderGarantiaTable(); if(typeof buildManutencao==='function'&&document.getElementById('pageManutencao').classList.contains('active')) buildManutencao(); });
  }
  if(_garEditId){
    saveToSheets('updateGarantia',{id:_garEditId,row:{PLACA:placa,DATA_FIM:datafim,KM_LIMITE:num(kmlimite),OBS:obs||null}},done);
  } else {
    saveToSheets('addGarantia',{PLACA:placa,DATA_FIM:datafim,KM_LIMITE:num(kmlimite),OBS:obs||null},done);
  }
}
function openGarantiaDelete(id){
  if(!currentUserData||currentUserData.perfil!=='ADMIN'){showToast('Apenas ADMIN pode excluir',true);return;}
  var r=findGarantiaById(id); if(!r){showToast('Garantia não encontrada',true);return;}
  _garDelId=String(id);
  document.getElementById('garDelDetails').innerHTML='<div><strong>Placa:</strong> '+(r.PLACA||'-')+'</div><div><strong>Data Fim:</strong> '+formatDateBR(r.DATA_FIM)+'</div>';
  document.getElementById('garDelOverlay').classList.add('show');
}
function closeGarantiaDelete(){ document.getElementById('garDelOverlay').classList.remove('show'); _garDelId=null; }
function confirmGarantiaDelete(){
  if(!_garDelId) return;
  var btn=document.getElementById('garDelBtn'); if(btn){btn.disabled=true;btn.textContent='Excluindo...';}
  saveToSheets('deleteGarantia',{id:_garDelId},function(ok,res){
    if(btn){btn.disabled=false;btn.textContent='🗑️ Excluir';}
    if(!ok){showToast('❌ Erro: '+((res&&res.error)||'desconhecido'),true);return;}
    showToast('✅ Garantia excluída');
    closeGarantiaDelete();
    loadFromSheets(function(){ renderGarantiaTable(); renderGarantiaPgTable(); if(typeof buildManutencao==='function'&&document.getElementById('pageManutencao').classList.contains('active')) buildManutencao(); });
  });
}

// ---------- Tabela: Intervalos por Placa (Garantia) ----------
function renderGarantiaPgTable(){
  var cont=document.getElementById('tblGarantiaPgContainer'); if(!cont) return;
  var data=DB.manutProgramadaGarantia.slice().sort(function(a,b){ return String(a.PLACA||'').localeCompare(String(b.PLACA||'')); });
  if(!data.length){ cont.innerHTML='<div style="padding:20px;text-align:center;color:var(--text2)">Nenhum intervalo de garantia cadastrado.</div>'; return; }
  var h='<table><thead><tr><th>Placa</th><th>Tipo</th><th>Intervalo KM</th><th>Alerta Urgente</th><th>Alerta Atenção</th><th style="text-align:center">Ações</th></tr></thead><tbody>';
  data.forEach(function(r){
    h+='<tr><td>'+(r.PLACA||'-')+'</td><td>'+(r.TIPO_MANUTENCAO||'-')+'</td><td>'+Number(r.INTERVALO_KM).toLocaleString('pt-BR')+'</td><td>'+Number(r.ALERTA_URGENTE).toLocaleString('pt-BR')+'</td><td>'+Number(r['ALERTA ATENCAO']).toLocaleString('pt-BR')+'</td>'+
      '<td style="text-align:center;white-space:nowrap"><span class="maq-act" title="Editar" onclick="openGarantiaPgModal(\''+r.ID+'\')">✏️</span> <span class="maq-act" title="Excluir" onclick="openGarantiaPgDelete(\''+r.ID+'\')">🗑️</span></td></tr>';
  });
  h+='</tbody></table>';
  cont.innerHTML=h;
}

var _garPgEditId=null, _garPgDelId=null;
function _garPgBuildForm(row){
  row=row||{};
  var po='<option value="">Selecione...</option>';
  DB.garantiaCaminhoes.slice().sort(function(a,b){return String(a.PLACA).localeCompare(String(b.PLACA))}).forEach(function(g){
    po+='<option value="'+g.PLACA+'"'+(row.PLACA===g.PLACA?' selected':'')+'>'+g.PLACA+'</option>';
  });
  var to='<option value="">Selecione...</option>';
  (BASE.tipoManut||[]).slice().sort().forEach(function(t){ to+='<option value="'+t+'"'+(row.TIPO_MANUTENCAO===t?' selected':'')+'>'+t+'</option>'; });
  to+='<option value="__novo__">+ novo tipo...</option>';
  return ''+
    '<div class="form-group"><label>Placa *</label><select id="gpg_placa">'+po+'</select></div>'+
    '<div class="form-group"><label>Tipo *</label><select id="gpg_tipo" onchange="_gpgToggleNovoTipo()">'+to+'</select></div>'+
    '<div class="form-group" id="gpg_novoTipoGrp" style="display:none;grid-column:1/-1"><label>Nome do novo tipo *</label><input id="gpg_novoTipo" type="text" placeholder="ex: Troca de Amortecedor"></div>'+
    '<div class="form-group"><label>Intervalo KM *</label><input id="gpg_intervalo" type="number" step="1" value="'+(row.INTERVALO_KM!=null?num(row.INTERVALO_KM):'')+'"></div>'+
    '<div class="form-group"><label>Alerta Urgente *</label><input id="gpg_urgente" type="number" step="1" value="'+(row.ALERTA_URGENTE!=null?num(row.ALERTA_URGENTE):'')+'"></div>'+
    '<div class="form-group"><label>Alerta Atenção *</label><input id="gpg_atencao" type="number" step="1" value="'+(row['ALERTA ATENCAO']!=null?num(row['ALERTA ATENCAO']):'')+'"></div>';
}
function _gpgToggleNovoTipo(){
  var v=document.getElementById('gpg_tipo').value;
  document.getElementById('gpg_novoTipoGrp').style.display=(v==='__novo__')?'':'none';
}
function openGarantiaPgModal(id){
  if(!currentUserData||currentUserData.perfil!=='ADMIN'){showToast('Apenas ADMIN pode gerenciar garantia',true);return;}
  if(!DB.garantiaCaminhoes.length){showToast('Cadastre uma placa em garantia primeiro',true);return;}
  _garPgEditId=(id!==undefined&&id!==null&&id!=='')?String(id):null;
  var row=_garPgEditId?findGarantiaPgById(_garPgEditId):{};
  if(_garPgEditId&&!row){showToast('Intervalo não encontrado',true);return;}
  document.getElementById('garPgModalTitle').textContent=_garPgEditId?'✏️ Editar Intervalo':'📏 Novo Intervalo (Garantia)';
  document.getElementById('garPgModalGrid').innerHTML=_garPgBuildForm(row);
  document.getElementById('garPgModalOverlay').classList.add('show');
}
function closeGarantiaPgModal(){ document.getElementById('garPgModalOverlay').classList.remove('show'); _garPgEditId=null; }
function salvarGarantiaPg(){
  var placa=document.getElementById('gpg_placa').value;
  var tipoSel=document.getElementById('gpg_tipo').value;
  var intervalo=document.getElementById('gpg_intervalo').value;
  var urgente=document.getElementById('gpg_urgente').value;
  var atencao=document.getElementById('gpg_atencao').value;
  if(!placa){showToast('Selecione a placa',true);return;}
  if(!tipoSel){showToast('Selecione o tipo',true);return;}
  if(!intervalo||!urgente||!atencao){showToast('Intervalo e alertas são obrigatórios aqui',true);return;}
  if(num(urgente)>num(atencao)){showToast('Alerta Urgente não pode ser maior que Alerta Atenção',true);return;}
  var btn=document.getElementById('garPgSalvarBtn'); if(btn){btn.disabled=true;btn.textContent='Salvando...';}
  function salvarIntervalo(tipoFinal){
    var row={PLACA:placa,TIPO_MANUTENCAO:tipoFinal,INTERVALO_KM:num(intervalo),ALERTA_URGENTE:num(urgente),ALERTA_ATENCAO:num(atencao)};
    function done(ok,res){
      if(btn){btn.disabled=false;btn.textContent='💾 Salvar';}
      if(!ok){showToast('❌ Erro: '+((res&&res.error)||'desconhecido'),true);return;}
      showToast('✅ Intervalo salvo!');
      closeGarantiaPgModal();
      loadFromSheets(function(){ renderGarantiaPgTable(); if(typeof buildManutencao==='function'&&document.getElementById('pageManutencao').classList.contains('active')) buildManutencao(); });
    }
    if(_garPgEditId) saveToSheets('updateManutProgGarantia',{id:_garPgEditId,row:row},done);
    else saveToSheets('addManutProgGarantia',row,done);
  }
  if(tipoSel==='__novo__'){
    var novoTipo=document.getElementById('gpg_novoTipo').value.trim();
    if(!novoTipo){ if(btn){btn.disabled=false;btn.textContent='💾 Salvar';} showToast('Informe o nome do novo tipo',true); return; }
    saveToSheets('addManutProgramada',{'TIPO MANUTENÇÃO':novoTipo},function(ok,res){
      if(!ok){ if(btn){btn.disabled=false;btn.textContent='💾 Salvar';} showToast('❌ Erro ao criar tipo: '+((res&&res.error)||'desconhecido'),true); return; }
      if(!BASE.tipoManut.includes(novoTipo)) BASE.tipoManut.push(novoTipo);
      salvarIntervalo(novoTipo);
    });
  } else {
    salvarIntervalo(tipoSel);
  }
}
function openGarantiaPgDelete(id){
  if(!currentUserData||currentUserData.perfil!=='ADMIN'){showToast('Apenas ADMIN pode excluir',true);return;}
  var r=findGarantiaPgById(id); if(!r){showToast('Intervalo não encontrado',true);return;}
  _garPgDelId=String(id);
  document.getElementById('garPgDelDetails').innerHTML='<div><strong>Placa:</strong> '+(r.PLACA||'-')+'</div><div><strong>Tipo:</strong> '+(r.TIPO_MANUTENCAO||'-')+'</div>';
  document.getElementById('garPgDelOverlay').classList.add('show');
}
function closeGarantiaPgDelete(){ document.getElementById('garPgDelOverlay').classList.remove('show'); _garPgDelId=null; }
function confirmGarantiaPgDelete(){
  if(!_garPgDelId) return;
  var btn=document.getElementById('garPgDelBtn'); if(btn){btn.disabled=true;btn.textContent='Excluindo...';}
  saveToSheets('deleteManutProgGarantia',{id:_garPgDelId},function(ok,res){
    if(btn){btn.disabled=false;btn.textContent='🗑️ Excluir';}
    if(!ok){showToast('❌ Erro: '+((res&&res.error)||'desconhecido'),true);return;}
    showToast('✅ Intervalo excluído');
    closeGarantiaPgDelete();
    loadFromSheets(function(){ renderGarantiaPgTable(); if(typeof buildManutencao==='function'&&document.getElementById('pageManutencao').classList.contains('active')) buildManutencao(); });
  });
}
// ===== FIM MÓDULO GARANTIA =====
