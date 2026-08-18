// ============================================================
// ===== MÓDULO MAQUINÁRIOS (Fase 3 - parte 2: Localização) ===
// Permissão de lançamento: ANALISTA registra/edita os próprios,
// ADMIN exclui, DIRETOR só vê. Floresta = lista de Local de Carga.
// ============================================================
var _maqLocEditId=null, _maqLocDelId=null;

function maqCanLancar(){ return !!(currentUserData && (currentUserData.perfil==='ADMIN'||currentUserData.perfil==='ANALISTA')); }
function maqEhDono(row){ return !!(currentUserData && (row.USUARIO===currentUserData.nome || row.USUARIO===currentUserData.usuario)); }
function maqNome(idMaquina){ var m=findMaqById(idMaquina); return m?(m.IDENTIFICACAO||('#'+idMaquina)):('#'+idMaquina); }
function findLocById(id){ id=String(id); for(var i=0;i<DB.maqLocalizacao.length;i++){ if(String(DB.maqLocalizacao[i].ID)===id) return DB.maqLocalizacao[i]; } return null; }
function _maqZ(n){ return (n<10?'0':'')+n; }
function _maqDiaAnterior(iso){
  var p=String(iso||'').split('-'); if(p.length!==3) return '';
  var d=new Date(Date.UTC(+p[0],+p[1]-1,+p[2])); d.setUTCDate(d.getUTCDate()-1);
  return d.getUTCFullYear()+'-'+_maqZ(d.getUTCMonth()+1)+'-'+_maqZ(d.getUTCDate());
}
// Floresta atual de uma máquina = floresta da última entrada (por data)
function maqFlorestaAtual(idMaquina){
  var id=String(idMaquina), ents=DB.maqLocalizacao.filter(function(l){ return String(l.ID_MAQUINA)===id && l.DATA_ENTRADA; });
  if(!ents.length) return '';
  ents.sort(function(a,b){ return String(a.DATA_ENTRADA).localeCompare(String(b.DATA_ENTRADA)); });
  return ents[ents.length-1].FLORESTA||'';
}
// Saída (dia anterior à próxima entrada) e situação, por máquina
function maqLocComputed(){
  var byMaq={};
  DB.maqLocalizacao.forEach(function(l){ var k=String(l.ID_MAQUINA); (byMaq[k]=byMaq[k]||[]).push(l); });
  var out=[];
  Object.keys(byMaq).forEach(function(k){
    var arr=byMaq[k].slice().sort(function(a,b){ return String(a.DATA_ENTRADA||'').localeCompare(String(b.DATA_ENTRADA||'')); });
    arr.forEach(function(l,i){ var nxt=arr[i+1]; out.push({row:l, saida:(nxt&&nxt.DATA_ENTRADA)?_maqDiaAnterior(nxt.DATA_ENTRADA):'', atual:!nxt}); });
  });
  return out;
}
function _maqPopLocSelects(){
  var sm=document.getElementById('maqLocFiltroMaq');
  if(sm && sm.options.length<=1){ DB.maquinas.forEach(function(m){ var o=document.createElement('option'); o.value=String(m.ID); o.textContent=m.IDENTIFICACAO||('#'+m.ID); sm.appendChild(o); }); }
  var sf=document.getElementById('maqLocFiltroFloresta');
  if(sf && sf.options.length<=1){ (BASE.localCarga||[]).forEach(function(fl){ var o=document.createElement('option'); o.textContent=fl; sf.appendChild(o); }); }
}

function renderMaqLocalTable(){
  var cont=document.getElementById('maqLocTableContainer'); if(!cont) return;
  _maqPopLocSelects();
  var admin=maqIsAdmin();
  var addBtn=document.getElementById('maqLocAddBtn'); if(addBtn) addBtn.style.display=maqCanLancar()?'inline-flex':'none';
  var fMaq=(document.getElementById('maqLocFiltroMaq')||{}).value||'';
  var fFl=(document.getElementById('maqLocFiltroFloresta')||{}).value||'';
  var rows=maqLocComputed().filter(function(o){
    if(fMaq && String(o.row.ID_MAQUINA)!==fMaq) return false;
    if(fFl && (o.row.FLORESTA||'')!==fFl) return false;
    return true;
  });
  rows.sort(function(a,b){
    var na=maqNome(a.row.ID_MAQUINA), nb=maqNome(b.row.ID_MAQUINA);
    if(na!==nb) return na<nb?-1:1;
    return String(b.row.DATA_ENTRADA||'').localeCompare(String(a.row.DATA_ENTRADA||''));
  });
  document.getElementById('maqLocCount').textContent=rows.length+(rows.length===1?' registro':' registros');
  if(!rows.length){ cont.innerHTML='<div style="padding:30px;text-align:center;color:var(--text2)">Nenhuma transferência registrada'+((fMaq||fFl)?' no filtro.':'.')+'</div>'; return; }
  var h='<table class="maq-table"><thead><tr><th>Máquina</th><th>Floresta</th><th>Entrada</th><th>Saída (auto)</th><th>Situação</th><th style="text-align:center">Ações</th></tr></thead><tbody>';
  rows.forEach(function(o){
    var l=o.row, canEdit=admin||maqEhDono(l), acts='';
    if(canEdit) acts+='<span class="maq-act" title="Editar" onclick="openMaqLocalModal(\''+l.ID+'\')">✏️</span> ';
    if(admin) acts+='<span class="maq-act" title="Excluir" onclick="openMaqLocalDelete(\''+l.ID+'\')">🗑️</span>';
    if(!acts) acts='<span style="color:var(--text2)">—</span>';
    var sit=o.atual?'<span class="maq-chip maq-chip-g">Atual</span>':'<span class="maq-chip maq-chip-gray">Encerrado</span>';
    h+='<tr><td>'+_maqEsc(maqNome(l.ID_MAQUINA))+'</td><td>'+_maqEsc(l.FLORESTA||'-')+'</td><td class="maq-mono">'+_maqEsc(formatDateBR(l.DATA_ENTRADA))+'</td><td class="maq-mono" style="color:var(--text2)">'+(o.saida?_maqEsc(formatDateBR(o.saida)):'—')+'</td><td>'+sit+'</td><td style="text-align:center;white-space:nowrap">'+acts+'</td></tr>';
  });
  h+='</tbody></table>';
  cont.innerHTML=h;
}

function _maqLocBuildForm(row){
  row=row||{};
  var mo='<option value="">—</option>';
  DB.maquinas.forEach(function(m){ mo+='<option value="'+m.ID+'"'+(String(row.ID_MAQUINA)===String(m.ID)?' selected':'')+'>'+_maqEsc(m.IDENTIFICACAO||('#'+m.ID))+'</option>'; });
  var fo='<option value="">—</option>';
  locaisFiltrados(BASE.localCarga,'Ativos').forEach(function(fl){ fo+='<option'+(String(row.FLORESTA)===String(fl)?' selected':'')+'>'+_maqEsc(fl)+'</option>'; });
  if(row.FLORESTA && locaisFiltrados(BASE.localCarga,'Ativos').indexOf(row.FLORESTA)===-1) fo+='<option selected>'+_maqEsc(row.FLORESTA)+' (inativo)</option>';
  return '<div class="form-group"><label>Máquina *</label><select id="mlf_maq">'+mo+'</select></div>'+
    '<div class="form-group"><label>Floresta (local de carga) *</label><select id="mlf_fl">'+fo+'</select></div>'+
    '<div class="form-group"><label>Data de entrada *</label><input id="mlf_data" type="date" value="'+_maqEsc(row.DATA_ENTRADA||'')+'"></div>'+
    '<div class="form-group" style="grid-column:1/-1"><label>Observação</label><input id="mlf_obs" type="text" value="'+_maqEsc(row.OBS||'')+'"></div>';
}
function openMaqLocalModal(id){
  _maqLocEditId=(id!==undefined&&id!==null&&id!=='')?String(id):null;
  var row=_maqLocEditId?findLocById(_maqLocEditId):{};
  if(_maqLocEditId){
    if(!row){ showToast('Registro não encontrado',true); return; }
    if(!maqIsAdmin() && !maqEhDono(row)){ showToast('❌ Você só pode editar os seus próprios registros',true); return; }
  } else if(!maqCanLancar()){ showToast('Sem permissão',true); return; }
  document.getElementById('maqLocModalTitle').textContent=_maqLocEditId?'✏️ Editar Transferência':'🌲 Registrar Transferência';
  var laud=document.getElementById('maqLocAudit');
  if(_maqLocEditId){ laud.innerHTML=_maqAuditTxt(row); laud.style.display=''; } else { laud.style.display='none'; }
  document.getElementById('maqLocModalGrid').innerHTML=_maqLocBuildForm(row);
  document.getElementById('maqLocModalOverlay').classList.add('show');
}
function closeMaqLocalModal(){ document.getElementById('maqLocModalOverlay').classList.remove('show'); _maqLocEditId=null; }
function salvarLocalizacao(){
  var maq=document.getElementById('mlf_maq').value, fl=document.getElementById('mlf_fl').value, data=document.getElementById('mlf_data').value, obs=document.getElementById('mlf_obs').value;
  if(!maq){ showToast('Selecione a máquina',true); return; }
  if(!fl){ showToast('Selecione a floresta',true); return; }
  if(!data){ showToast('Informe a data de entrada',true); return; }
  var btn=document.getElementById('maqLocSalvarBtn'); if(btn){ btn.disabled=true; btn.textContent='Salvando...'; }
  var row={ID_MAQUINA:maq, FLORESTA:fl, DATA_ENTRADA:data, OBS:obs};
  function done(ok,res){
    if(btn){ btn.disabled=false; btn.textContent='💾 Salvar'; }
    if(!ok){ showToast('❌ Erro: '+((res&&res.error)||'desconhecido'),true); return; }
    showToast('✅ Transferência salva!');
    closeMaqLocalModal();
    loadFromSheets(function(){ if(document.getElementById('pageMaquinarios').classList.contains('active')){ renderMaqLocalTable(); renderMaquinasTable(); } });
  }
  if(_maqLocEditId) saveToSheets('updateLocalizacaoMaq',{id:_maqLocEditId,row:row},done);
  else { row.USUARIO=currentUserData?currentUserData.nome:''; saveToSheets('addLocalizacaoMaq',row,done); }
}
function openMaqLocalDelete(id){
  if(!maqIsAdmin()){ showToast('Apenas ADMIN pode excluir',true); return; }
  var l=findLocById(id); if(!l){ showToast('Registro não encontrado',true); return; }
  _maqLocDelId=String(id);
  document.getElementById('maqLocDelDetails').innerHTML='<div><strong>Máquina:</strong> '+_maqEsc(maqNome(l.ID_MAQUINA))+'</div><div><strong>Floresta:</strong> '+_maqEsc(l.FLORESTA||'-')+'</div><div><strong>Entrada:</strong> '+_maqEsc(formatDateBR(l.DATA_ENTRADA))+'</div>';
  document.getElementById('maqLocDelOverlay').classList.add('show');
}
function closeMaqLocalDelete(){ document.getElementById('maqLocDelOverlay').classList.remove('show'); _maqLocDelId=null; }
function confirmMaqLocalDelete(){
  if(!_maqLocDelId) return;
  var btn=document.getElementById('maqLocDelBtn'); if(btn){ btn.disabled=true; btn.textContent='Excluindo...'; }
  saveToSheets('deleteLocalizacaoMaq',{id:_maqLocDelId},function(ok,res){
    if(btn){ btn.disabled=false; btn.textContent='🗑️ Excluir'; }
    if(!ok){ showToast('❌ Erro: '+((res&&res.error)||'desconhecido'),true); return; }
    showToast('✅ Registro excluído');
    closeMaqLocalDelete();
    loadFromSheets(function(){ if(document.getElementById('pageMaquinarios').classList.contains('active')){ renderMaqLocalTable(); renderMaquinasTable(); } });
  });
}
// ===== FIM MÓDULO MAQUINÁRIOS (parte 2) =====

