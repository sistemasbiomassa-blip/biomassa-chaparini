// ==================== CAMINHOES ====================
var TIPO_VEICULO_LABEL={cavalo:'Cavalo Mecânico',carreta_3_eixos:'Carreta 3 eixos',carreta_4_eixos:'Carreta 4 eixos'};

function findCaminhaoById(id){ id=String(id); for(var i=0;i<CAMINHOES_DATA.length;i++){ if(String(CAMINHOES_DATA[i].ID)===id) return CAMINHOES_DATA[i]; } return null; }

function renderCaminhoesTable(){
  var isAdmin=currentUserData&&currentUserData.perfil==='ADMIN';
  var h='<table><thead><tr><th>Placa</th><th>Marca</th><th>Modelo</th><th>Ano</th><th>Tipo de Veículo</th>'+(isAdmin?'<th style="text-align:center">Ações</th>':'')+'</tr></thead><tbody>';
  var lista=CAMINHOES_DATA.slice().sort(function(a,b){return String(a.PLACA||'').localeCompare(String(b.PLACA||''),'pt-BR',{sensitivity:'base'})});
  lista.forEach(function(r){
    var tipoTxt=r.TIPO_VEICULO?TIPO_VEICULO_LABEL[r.TIPO_VEICULO]||r.TIPO_VEICULO:'<span style="color:var(--text2)">— não cadastrado —</span>';
    var acts=isAdmin?'<td style="text-align:center;white-space:nowrap"><span class="maq-act" title="Editar" onclick="openCaminhaoModal(\''+r.ID+'\')">✏️</span> <span class="maq-act" title="Excluir" onclick="openCaminhaoDelete(\''+r.ID+'\')">🗑️</span></td>':'';
    h+='<tr><td style="color:var(--accent);font-weight:600;font-family:JetBrains Mono,monospace">'+(r.PLACA||'-')+'</td><td>'+(r.MARCA||'-')+'</td><td>'+(r.MODELO||'-')+'</td><td style="font-family:JetBrains Mono,monospace;font-size:11px">'+(r.ANO||'-')+'</td><td>'+tipoTxt+'</td>'+acts+'</tr>';
  });
  h+='</tbody></table>';
  document.getElementById('tblCaminhoesContainer').innerHTML=h;
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
  if(!BASE.placas.includes(placa)){BASE.placas.push(placa);populateSelects();}
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
