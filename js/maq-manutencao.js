// ============================================================
// ===== MÓDULO MAQUINÁRIOS (Fase 3 - parte 4: Manutenção) ====
// Total = peças + mão de obra + terceiros (somado ao vivo e no servidor).
// ============================================================
var _maqMtEditId=null, _maqMtDelId=null;
var MAQ_MANUT_TIPOS=['Preventiva','Corretiva'];
function findManutById(id){ id=String(id); for(var i=0;i<DB.maqManutencao.length;i++){ if(String(DB.maqManutencao[i].ID)===id) return DB.maqManutencao[i]; } return null; }

function _maqMtPopSelects(){
  var sm=document.getElementById('maqMtFiltroMaq');
  if(sm && sm.options.length<=1){ DB.maquinas.forEach(function(m){ var o=document.createElement('option'); o.value=String(m.ID); o.textContent=m.IDENTIFICACAO||('#'+m.ID); sm.appendChild(o); }); }
  var sf=document.getElementById('maqMtFiltroFloresta');
  if(sf && sf.options.length<=1){ (BASE.localCarga||[]).forEach(function(fl){ var o=document.createElement('option'); o.textContent=fl; sf.appendChild(o); }); }
}

function renderMaqManutTable(){
  var cont=document.getElementById('maqMtTableContainer'); if(!cont) return;
  _maqMtPopSelects();
  var admin=maqIsAdmin();
  var addBtn=document.getElementById('maqMtAddBtn'); if(addBtn) addBtn.style.display=maqCanLancar()?'inline-flex':'none';
  var di=(document.getElementById('maqMtIni')||{}).value||'';
  var df=(document.getElementById('maqMtFim')||{}).value||'';
  var fMaq=(document.getElementById('maqMtFiltroMaq')||{}).value||'';
  var fFl=(document.getElementById('maqMtFiltroFloresta')||{}).value||'';
  var fTipo=(document.getElementById('maqMtFiltroTipo')||{}).value||'';
  var rows=DB.maqManutencao.filter(function(r){
    if(di && String(r.DATA||'')<di) return false;
    if(df && String(r.DATA||'')>df) return false;
    if(fMaq && String(r.ID_MAQUINA)!==fMaq) return false;
    if(fTipo && (r.TIPO||'')!==fTipo) return false;
    if(fFl && maqFlorestaDoLancamento(r)!==fFl) return false;
    return true;
  });
  rows.sort(function(a,b){ return String(b.DATA||'').localeCompare(String(a.DATA||'')); });
  document.getElementById('maqMtCount').textContent=rows.length+(rows.length===1?' registro':' registros');
  if(!rows.length){ cont.innerHTML='<div style="padding:30px;text-align:center;color:var(--text2)">Nenhuma manutenção'+((di||df||fMaq||fFl||fTipo)?' no filtro.':'.')+'</div>'; return; }
  var h='<table class="maq-table"><thead><tr><th>Data</th><th>Máquina</th><th>Tipo</th><th>Serviço</th><th>Floresta (auto)</th><th>Peças</th><th>M. obra</th><th>Terceiros</th><th>Total</th><th>Oficina</th><th style="text-align:center">Ações</th></tr></thead><tbody>';
  rows.forEach(function(r){
    var canEdit=admin||maqEhDono(r), acts='';
    if(canEdit) acts+='<span class="maq-act" title="Editar" onclick="openMaqManutModal(\''+r.ID+'\')">✏️</span> ';
    if(admin) acts+='<span class="maq-act" title="Excluir" onclick="openMaqManutDelete(\''+r.ID+'\')">🗑️</span>';
    if(!acts) acts='<span style="color:var(--text2)">—</span>';
    var tipoChip=r.TIPO==='Preventiva'?'<span class="maq-chip maq-chip-g">Preventiva</span>':(r.TIPO==='Corretiva'?'<span class="maq-chip maq-chip-y">Corretiva</span>':'<span class="maq-chip maq-chip-gray">'+_maqEsc(r.TIPO||'-')+'</span>');
    var fl=maqFlorestaDoLancamento(r);
    h+='<tr><td class="maq-mono">'+_maqEsc(formatDateBR(r.DATA))+'</td><td>'+_maqEsc(maqNome(r.ID_MAQUINA))+'</td><td>'+tipoChip+'</td><td>'+_maqEsc(r.SERVICO||'-')+'</td><td>'+(fl?_maqEsc(fl):'<span style="color:var(--text2)">— sem localização</span>')+'</td><td class="maq-mono">'+fmtR(num(r.CUSTO_PECAS))+'</td><td class="maq-mono">'+fmtR(num(r.CUSTO_MAO_OBRA))+'</td><td class="maq-mono">'+fmtR(num(r.CUSTO_TERCEIROS))+'</td><td class="maq-mono"><strong>'+fmtR(num(r.CUSTO_TOTAL))+'</strong></td><td>'+_maqEsc(r.OFICINA_FORNECEDOR||'-')+'</td><td style="text-align:center;white-space:nowrap">'+acts+'</td></tr>';
  });
  h+='</tbody></table>';
  cont.innerHTML=h;
}

function _maqMtBuildForm(row){
  row=row||{};
  var mo='<option value="">—</option>';
  DB.maquinas.forEach(function(m){ mo+='<option value="'+m.ID+'"'+(String(row.ID_MAQUINA)===String(m.ID)?' selected':'')+'>'+_maqEsc(m.IDENTIFICACAO||('#'+m.ID))+'</option>'; });
  var to='<option value="">—</option>';
  MAQ_MANUT_TIPOS.forEach(function(t){ to+='<option'+(String(row.TIPO)===t?' selected':'')+'>'+t+'</option>'; });
  var fo='<option value="">— automático (pela localização) —</option>';
  (BASE.localCarga||[]).forEach(function(fl){ fo+='<option'+(String(row.FLORESTA_OPC)===String(fl)?' selected':'')+'>'+_maqEsc(fl)+'</option>'; });
  var dataVal=row.DATA||new Date().toISOString().slice(0,10);
  var pecVal=(row.CUSTO_PECAS!=null&&row.CUSTO_PECAS!=='')?fmt(num(row.CUSTO_PECAS),2):'';
  var maoVal=(row.CUSTO_MAO_OBRA!=null&&row.CUSTO_MAO_OBRA!=='')?fmt(num(row.CUSTO_MAO_OBRA),2):'';
  var terVal=(row.CUSTO_TERCEIROS!=null&&row.CUSTO_TERCEIROS!=='')?fmt(num(row.CUSTO_TERCEIROS),2):'';
  var horVal=(row.HORIMETRO!=null&&row.HORIMETRO!=='')?num(row.HORIMETRO):'';
  var kmVal=(row.KM!=null&&row.KM!=='')?num(row.KM):'';
  return ''+
    '<div class="form-group"><label>Data *</label><input id="mmt_data" type="date" value="'+_maqEsc(dataVal)+'"></div>'+
    '<div class="form-group"><label>Máquina *</label><select id="mmt_maq" onchange="_maqMtToggleLeitura()">'+mo+'</select></div>'+
    '<div class="form-group"><label>Tipo *</label><select id="mmt_tipo">'+to+'</select></div>'+
    '<div class="form-group" style="grid-column:1/-1"><label>Serviço executado *</label><input id="mmt_serv" type="text" value="'+_maqEsc(row.SERVICO||'')+'" placeholder="ex: troca de óleo e filtros"></div>'+
    '<div class="form-group" id="mmt_horGrp"><label>Horímetro (h)</label><input id="mmt_hor" type="number" step="0.1" value="'+_maqEsc(horVal)+'"></div>'+
    '<div class="form-group" id="mmt_kmGrp"><label>KM</label><input id="mmt_km" type="number" step="1" value="'+_maqEsc(kmVal)+'"></div>'+
    '<div class="form-group"><label>Custo peças (R$)</label><input id="mmt_pec" type="text" inputmode="decimal" value="'+_maqEsc(pecVal)+'"></div>'+
    '<div class="form-group"><label>Mão de obra (R$)</label><input id="mmt_mao" type="text" inputmode="decimal" value="'+_maqEsc(maoVal)+'"></div>'+
    '<div class="form-group"><label>Terceiros (R$)</label><input id="mmt_ter" type="text" inputmode="decimal" value="'+_maqEsc(terVal)+'"></div>'+
    '<div class="form-group"><label>Custo total</label><input id="mmt_tot" type="text" value="" readonly style="background:var(--surface2);font-weight:600"></div>'+
    '<div class="form-group"><label>Oficina / Fornecedor</label><input id="mmt_ofic" type="text" value="'+_maqEsc(row.OFICINA_FORNECEDOR||'')+'"></div>'+
    '<div class="form-group"><label>Floresta (opcional)</label><select id="mmt_flopc">'+fo+'</select></div>'+
    '<div class="form-group" style="grid-column:1/-1"><label>Observação</label><input id="mmt_obs" type="text" value="'+_maqEsc(row.OBS||'')+'"></div>';
}
function _maqMtToggleLeitura(){
  var met=maqMetrica(document.getElementById('mmt_maq').value);
  var hor=document.getElementById('mmt_horGrp'), km=document.getElementById('mmt_kmGrp');
  if(!met){ hor.style.display=''; km.style.display=''; return; }
  hor.style.display=(met==='HORIMETRO'||met==='AMBOS')?'':'none';
  km.style.display=(met==='KM'||met==='AMBOS')?'':'none';
}
function _maqMtCalcTotal(){
  var t=num(document.getElementById('mmt_pec').value)+num(document.getElementById('mmt_mao').value)+num(document.getElementById('mmt_ter').value);
  document.getElementById('mmt_tot').value=fmtR(Math.round(t*100)/100);
}
function openMaqManutModal(id){
  _maqMtEditId=(id!==undefined&&id!==null&&id!=='')?String(id):null;
  var row=_maqMtEditId?findManutById(_maqMtEditId):{};
  if(_maqMtEditId){
    if(!row){ showToast('Registro não encontrado',true); return; }
    if(!maqIsAdmin() && !maqEhDono(row)){ showToast('❌ Você só pode editar os seus próprios lançamentos',true); return; }
  } else if(!maqCanLancar()){ showToast('Sem permissão',true); return; }
  document.getElementById('maqMtModalTitle').textContent=_maqMtEditId?'✏️ Editar Manutenção':'🔧 Nova Manutenção';
  var aud=document.getElementById('maqMtAudit');
  if(_maqMtEditId){ aud.innerHTML=_maqAuditTxt(row); aud.style.display=''; } else { aud.style.display='none'; }
  document.getElementById('maqMtModalGrid').innerHTML=_maqMtBuildForm(row);
  mascaraNumero(document.getElementById('mmt_pec'),6,2);
  mascaraNumero(document.getElementById('mmt_mao'),6,2);
  mascaraNumero(document.getElementById('mmt_ter'),6,2);
  document.getElementById('mmt_pec').addEventListener('input',_maqMtCalcTotal);
  document.getElementById('mmt_mao').addEventListener('input',_maqMtCalcTotal);
  document.getElementById('mmt_ter').addEventListener('input',_maqMtCalcTotal);
  _maqMtToggleLeitura();
  _maqMtCalcTotal();
  document.getElementById('maqMtModalOverlay').classList.add('show');
}
function closeMaqManutModal(){ document.getElementById('maqMtModalOverlay').classList.remove('show'); _maqMtEditId=null; }
function salvarManutMaq(){
  var maq=document.getElementById('mmt_maq').value;
  var data=document.getElementById('mmt_data').value;
  var tipo=document.getElementById('mmt_tipo').value;
  var serv=document.getElementById('mmt_serv').value.trim();
  if(!maq){ showToast('Selecione a máquina',true); return; }
  if(!data){ showToast('Informe a data',true); return; }
  if(!tipo){ showToast('Selecione o tipo',true); return; }
  if(!serv){ showToast('Descreva o serviço',true); return; }
  var horVis=document.getElementById('mmt_horGrp').style.display!=='none';
  var kmVis=document.getElementById('mmt_kmGrp').style.display!=='none';
  var horEl=document.getElementById('mmt_hor'), kmEl=document.getElementById('mmt_km');
  var row={
    DATA:data, ID_MAQUINA:maq, TIPO:tipo, SERVICO:serv,
    HORIMETRO:(horVis && horEl.value!=='')?num(horEl.value):'',
    KM:(kmVis && kmEl.value!=='')?num(kmEl.value):'',
    CUSTO_PECAS:num(document.getElementById('mmt_pec').value),
    CUSTO_MAO_OBRA:num(document.getElementById('mmt_mao').value),
    CUSTO_TERCEIROS:num(document.getElementById('mmt_ter').value),
    OFICINA_FORNECEDOR:document.getElementById('mmt_ofic').value.trim(),
    FLORESTA_OPC:document.getElementById('mmt_flopc').value,
    OBS:document.getElementById('mmt_obs').value.trim()
  };
  var btn=document.getElementById('maqMtSalvarBtn'); if(btn){ btn.disabled=true; btn.textContent='Salvando...'; }
  function done(ok,res){
    if(btn){ btn.disabled=false; btn.textContent='💾 Salvar'; }
    if(!ok){ showToast('❌ Erro: '+((res&&res.error)||'desconhecido'),true); return; }
    showToast('✅ Manutenção salva!');
    closeMaqManutModal();
    loadFromSheets(function(){ if(document.getElementById('pageMaquinarios').classList.contains('active')) renderMaqManutTable(); });
  }
  if(_maqMtEditId) saveToSheets('updateManutMaq',{id:_maqMtEditId,row:row},done);
  else { row.USUARIO=currentUserData?currentUserData.nome:''; saveToSheets('addManutMaq',row,done); }
}
function openMaqManutDelete(id){
  if(!maqIsAdmin()){ showToast('Apenas ADMIN pode excluir',true); return; }
  var r=findManutById(id); if(!r){ showToast('Registro não encontrado',true); return; }
  _maqMtDelId=String(id);
  document.getElementById('maqMtDelDetails').innerHTML='<div><strong>Máquina:</strong> '+_maqEsc(maqNome(r.ID_MAQUINA))+'</div><div><strong>Serviço:</strong> '+_maqEsc(r.SERVICO||'-')+'</div><div><strong>Total:</strong> '+fmtR(num(r.CUSTO_TOTAL))+'</div>';
  document.getElementById('maqMtDelOverlay').classList.add('show');
}
function closeMaqManutDelete(){ document.getElementById('maqMtDelOverlay').classList.remove('show'); _maqMtDelId=null; }
function confirmMaqManutDelete(){
  if(!_maqMtDelId) return;
  var btn=document.getElementById('maqMtDelBtn'); if(btn){ btn.disabled=true; btn.textContent='Excluindo...'; }
  saveToSheets('deleteManutMaq',{id:_maqMtDelId},function(ok,res){
    if(btn){ btn.disabled=false; btn.textContent='🗑️ Excluir'; }
    if(!ok){ showToast('❌ Erro: '+((res&&res.error)||'desconhecido'),true); return; }
    showToast('✅ Manutenção excluída');
    closeMaqManutDelete();
    loadFromSheets(function(){ if(document.getElementById('pageMaquinarios').classList.contains('active')) renderMaqManutTable(); });
  });
}
// ===== FIM MÓDULO MAQUINÁRIOS (parte 4) =====

