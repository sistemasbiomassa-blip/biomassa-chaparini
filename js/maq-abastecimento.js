// ============================================================
// ===== MÓDULO MAQUINÁRIOS (Fase 3 - parte 3: Abastecimento) =
// Máscaras BR (reusa mascaraNumero/num/fmt). Total = litros x preço.
// Floresta automática pela DATA do abastecimento (via localização).
// ============================================================
var _maqAbEditId=null, _maqAbDelId=null;
var MAQ_COMBUSTIVEIS=['Arla 32','Diesel comum','Diesel S10','Gasolina','Outro'];
var MAQ_TANQUES=['Interno','Externo'];

function _maqOrdAlfa(arr){ return (arr||[]).slice().sort(function(a,b){return String(a).localeCompare(String(b),'pt-BR',{sensitivity:'base'})}); }

// Floresta onde a máquina estava NA DATA informada (período que contém a data)
function maqFlorestaNaData(idMaquina, dataISO){
  if(!dataISO) return '';
  var id=String(idMaquina);
  var ents=DB.maqLocalizacao.filter(function(l){ return String(l.ID_MAQUINA)===id && l.DATA_ENTRADA; })
    .sort(function(a,b){ return String(a.DATA_ENTRADA).localeCompare(String(b.DATA_ENTRADA)); });
  var res='';
  for(var i=0;i<ents.length;i++){ if(String(ents[i].DATA_ENTRADA)<=String(dataISO)) res=ents[i].FLORESTA||''; else break; }
  return res;
}
// Floresta efetiva de um lançamento: override manual, senão automática pela data
function maqFlorestaDoLancamento(row){
  if(row.FLORESTA_OPC) return row.FLORESTA_OPC;
  return maqFlorestaNaData(row.ID_MAQUINA, row.DATA);
}
function findAbastById(id){ id=String(id); for(var i=0;i<DB.maqAbastecimento.length;i++){ if(String(DB.maqAbastecimento[i].ID)===id) return DB.maqAbastecimento[i]; } return null; }
function maqMetrica(idMaquina){ var m=findMaqById(idMaquina); return m?(m.METRICA||''):''; }

function _maqPopAbastSelects(){
  var sm=document.getElementById('maqAbFiltroMaq');
  if(sm && sm.options.length<=1){
    var maqsOrd=DB.maquinas.slice().sort(function(a,b){return String(a.IDENTIFICACAO||'').localeCompare(String(b.IDENTIFICACAO||''),'pt-BR',{sensitivity:'base'})});
    maqsOrd.forEach(function(m){ var o=document.createElement('option'); o.value=String(m.ID); o.textContent=m.IDENTIFICACAO||('#'+m.ID); sm.appendChild(o); });
  }
  var sf=document.getElementById('maqAbFiltroFloresta');
  if(sf && sf.options.length<=1){ _maqOrdAlfa(BASE.localCarga).forEach(function(fl){ var o=document.createElement('option'); o.textContent=fl; sf.appendChild(o); }); }
}

function renderMaqAbastTable(){
  var cont=document.getElementById('maqAbTableContainer'); if(!cont) return;
  _maqPopAbastSelects();
  var admin=maqIsAdmin();
  var addBtn=document.getElementById('maqAbAddBtn'); if(addBtn) addBtn.style.display=maqCanLancar()?'inline-flex':'none';
  var di=(document.getElementById('maqAbIni')||{}).value||'';
  var df=(document.getElementById('maqAbFim')||{}).value||'';
  var fMaq=(document.getElementById('maqAbFiltroMaq')||{}).value||'';
  var fFl=(document.getElementById('maqAbFiltroFloresta')||{}).value||'';
  var rows=DB.maqAbastecimento.filter(function(r){
    if(di && String(r.DATA||'')<di) return false;
    if(df && String(r.DATA||'')>df) return false;
    if(fMaq && String(r.ID_MAQUINA)!==fMaq) return false;
    if(fFl && maqFlorestaDoLancamento(r)!==fFl) return false;
    return true;
  });
  rows.sort(function(a,b){ return String(b.DATA||'').localeCompare(String(a.DATA||'')); });
  document.getElementById('maqAbCount').textContent=rows.length+(rows.length===1?' registro':' registros');
  if(!rows.length){ cont.innerHTML='<div style="padding:30px;text-align:center;color:var(--text2)">Nenhum abastecimento'+((di||df||fMaq||fFl)?' no filtro.':'.')+'</div>'; return; }
  var h='<table class="maq-table"><thead><tr><th>Data</th><th>Máquina</th><th>Floresta (auto)</th><th>Leitura</th><th>Litros</th><th>Vlr Unit.</th><th>Total</th><th>Operador</th><th style="text-align:center">Ações</th></tr></thead><tbody>';
  var totLit=0, totVal=0;
  rows.forEach(function(r){
    totLit+=num(r.LITROS); totVal+=num(r.VALOR_TOTAL);
    var canEdit=admin||maqEhDono(r), acts='';
    if(canEdit) acts+='<span class="maq-act" title="Editar" onclick="openMaqAbastModal(\''+r.ID+'\')">✏️</span> ';
    if(admin) acts+='<span class="maq-act" title="Excluir" onclick="openMaqAbastDelete(\''+r.ID+'\')">🗑️</span>';
    if(!acts) acts='<span style="color:var(--text2)">—</span>';
    var leitura=(r.HORIMETRO!==''&&r.HORIMETRO!=null)?(fmt(num(r.HORIMETRO),0)+' h'):((r.KM!==''&&r.KM!=null)?(fmt(num(r.KM),0)+' km'):'—');
    var fl=maqFlorestaDoLancamento(r);
    h+='<tr><td class="maq-mono">'+_maqEsc(formatDateBR(r.DATA))+'</td><td>'+_maqEsc(maqNome(r.ID_MAQUINA))+'</td><td>'+(fl?_maqEsc(fl):'<span style="color:var(--text2)">— sem localização</span>')+'</td><td class="maq-mono">'+leitura+'</td><td class="maq-mono">'+fmt(num(r.LITROS),2)+'</td><td class="maq-mono">'+fmtR(num(r.PRECO_LITRO))+'</td><td class="maq-mono">'+fmtR(num(r.VALOR_TOTAL))+'</td><td>'+_maqEsc(r.OPERADOR||'-')+'</td><td style="text-align:center;white-space:nowrap">'+acts+'</td></tr>';
  });
  h+='</tbody><tfoot><tr style="font-weight:700;background:var(--surface2)"><td colspan="4" style="text-align:right">TOTAIS:</td><td class="maq-mono">'+fmt(totLit,2)+'</td><td></td><td class="maq-mono">'+fmtR(Math.round(totVal*100)/100)+'</td><td colspan="2"></td></tr></tfoot>';
  h+='</table>';
  cont.innerHTML=h;
}

function _maqAbBuildForm(row){
  row=row||{};
  var mo='<option value="">—</option>';
  var maqsOrdForm=DB.maquinas.slice().sort(function(a,b){return String(a.IDENTIFICACAO||'').localeCompare(String(b.IDENTIFICACAO||''),'pt-BR',{sensitivity:'base'})});
  maqsOrdForm.forEach(function(m){ mo+='<option value="'+m.ID+'"'+(String(row.ID_MAQUINA)===String(m.ID)?' selected':'')+'>'+_maqEsc(m.IDENTIFICACAO||('#'+m.ID))+'</option>'; });
  var co=''; MAQ_COMBUSTIVEIS.forEach(function(c){ co+='<option'+(String(row.TIPO_COMBUSTIVEL||'Diesel S10')===c?' selected':'')+'>'+c+'</option>'; });
  var curPosto=row.TANQUE_POSTO||''; var achouPosto=false;
  var to='<option value="">—</option>';
  _maqOrdAlfa(locaisFiltrados(BASE.localAbast,'Ativos')).forEach(function(p){ var sel=String(curPosto).trim().toUpperCase()===String(p).trim().toUpperCase(); if(sel)achouPosto=true; to+='<option'+(sel?' selected':'')+'>'+_maqEsc(p)+'</option>'; });
  if(curPosto && !achouPosto) to+='<option selected>'+_maqEsc(curPosto)+'</option>'; // preserva valor antigo (ex.: Interno/Externo, ou posto inativado depois)
  var fo='<option value="">— automático (pela localização) —</option>';
  _maqOrdAlfa(locaisFiltrados(BASE.localCarga,'Ativos')).forEach(function(fl){ fo+='<option'+(String(row.FLORESTA_OPC)===String(fl)?' selected':'')+'>'+_maqEsc(fl)+'</option>'; });
  if(row.FLORESTA_OPC && locaisFiltrados(BASE.localCarga,'Ativos').indexOf(row.FLORESTA_OPC)===-1) fo+='<option selected>'+_maqEsc(row.FLORESTA_OPC)+' (inativo)</option>';
  var dataVal=row.DATA||new Date().toISOString().slice(0,10);
  var litVal=(row.LITROS!=null&&row.LITROS!=='')?fmt(num(row.LITROS),2):'';
  var preVal=(row.PRECO_LITRO!=null&&row.PRECO_LITRO!=='')?fmt(num(row.PRECO_LITRO),2):'';
  var horVal=(row.HORIMETRO!=null&&row.HORIMETRO!=='')?fmt(num(row.HORIMETRO),2):'';
  var kmVal=(row.KM!=null&&row.KM!=='')?fmt(num(row.KM),2):'';
  return ''+
    '<div class="form-group"><label>Data *</label><input id="mab_data" type="date" value="'+_maqEsc(dataVal)+'"></div>'+
    '<div class="form-group"><label>Máquina *</label><select id="mab_maq" onchange="_maqAbToggleLeitura()">'+mo+'</select></div>'+
    '<div class="form-group" id="mab_horGrp"><label>Horímetro (h)</label><input id="mab_hor" type="text" inputmode="decimal" value="'+_maqEsc(horVal)+'"></div>'+
    '<div class="form-group" id="mab_kmGrp"><label>KM</label><input id="mab_km" type="text" inputmode="decimal" value="'+_maqEsc(kmVal)+'"></div>'+
    '<div class="form-group"><label>Litros *</label><input id="mab_lit" type="text" inputmode="decimal" value="'+_maqEsc(litVal)+'"></div>'+
    '<div class="form-group"><label>Valor unitário (R$/L) *</label><input id="mab_pre" type="text" inputmode="decimal" value="'+_maqEsc(preVal)+'"></div>'+
    '<div class="form-group"><label>Valor total</label><input id="mab_tot" type="text" value="" readonly style="background:var(--surface2);font-weight:600"></div>'+
    '<div class="form-group"><label>Combustível</label><select id="mab_comb" onchange="_maqAbPrecoAuto()">'+co+'</select></div>'+
    '<div class="form-group"><label>Tanque / Posto</label><select id="mab_tanq" onchange="_maqAbPrecoAuto()">'+to+'</select></div>'+
    '<div class="form-group"><label>Operador</label><input id="mab_oper" type="text" value="'+_maqEsc(row.OPERADOR||'')+'"></div>'+
    '<div class="form-group"><label>Floresta (opcional)</label><select id="mab_flopc">'+fo+'</select></div>'+
    '<div class="form-group" style="grid-column:1/-1"><label>Observação</label><input id="mab_obs" type="text" value="'+_maqEsc(row.OBS||'')+'"></div>';
}
function _maqAbToggleLeitura(){
  var met=maqMetrica(document.getElementById('mab_maq').value);
  var hor=document.getElementById('mab_horGrp'), km=document.getElementById('mab_kmGrp');
  if(!met){ hor.style.display=''; km.style.display=''; return; }
  hor.style.display=(met==='HORIMETRO'||met==='AMBOS')?'':'none';
  km.style.display=(met==='KM'||met==='AMBOS')?'':'none';
}
function _maqAbCalcTotal(){
  var l=num(document.getElementById('mab_lit').value), p=num(document.getElementById('mab_pre').value);
  document.getElementById('mab_tot').value=fmtR(Math.round(l*p*100)/100);
}
function openMaqAbastModal(id){
  _maqAbEditId=(id!==undefined&&id!==null&&id!=='')?String(id):null;
  var row=_maqAbEditId?findAbastById(_maqAbEditId):{};
  if(_maqAbEditId){
    if(!row){ showToast('Registro não encontrado',true); return; }
    if(!maqIsAdmin() && !maqEhDono(row)){ showToast('❌ Você só pode editar os seus próprios lançamentos',true); return; }
  } else if(!maqCanLancar()){ showToast('Sem permissão',true); return; }
  document.getElementById('maqAbModalTitle').textContent=_maqAbEditId?'✏️ Editar Abastecimento':'⛽ Novo Abastecimento';
  var aaud=document.getElementById('maqAbAudit');
  if(_maqAbEditId){ aaud.innerHTML=_maqAuditTxt(row); aaud.style.display=''; } else { aaud.style.display='none'; }
  document.getElementById('maqAbModalGrid').innerHTML=_maqAbBuildForm(row);
  mascaraNumero(document.getElementById('mab_lit'),LIMITES_CAMPOS.litros,2);
  mascaraNumero(document.getElementById('mab_pre'),LIMITES_CAMPOS.valorUnit,2);
  mascaraNumero(document.getElementById('mab_km'),LIMITES_CAMPOS.km,2);
  mascaraNumero(document.getElementById('mab_hor'),LIMITES_CAMPOS.horimetro,2);
  document.getElementById('mab_lit').addEventListener('input',_maqAbCalcTotal);
  document.getElementById('mab_pre').addEventListener('input',_maqAbCalcTotal);
  _maqAbToggleLeitura();
  _maqAbCalcTotal();
  document.getElementById('maqAbastModalOverlay').classList.add('show');
}
function closeMaqAbastModal(){ document.getElementById('maqAbastModalOverlay').classList.remove('show'); _maqAbEditId=null; }
function salvarAbastecimento(){
  var maq=document.getElementById('mab_maq').value;
  var data=document.getElementById('mab_data').value;
  var lit=num(document.getElementById('mab_lit').value);
  var pre=num(document.getElementById('mab_pre').value);
  if(!maq){ showToast('Selecione a máquina',true); return; }
  if(!data){ showToast('Informe a data',true); return; }
  if(!lit){ showToast('Informe os litros',true); return; }
  if(!pre){ showToast('Informe o valor unitário (R$/L)',true); return; }
  var horVis=document.getElementById('mab_horGrp').style.display!=='none';
  var kmVis=document.getElementById('mab_kmGrp').style.display!=='none';
  var horEl=document.getElementById('mab_hor'), kmEl=document.getElementById('mab_km');
  var row={
    DATA:data, ID_MAQUINA:maq,
    HORIMETRO:(horVis && horEl.value!=='')?num(horEl.value):'',
    KM:(kmVis && kmEl.value!=='')?num(kmEl.value):'',
    LITROS:lit, PRECO_LITRO:pre,
    TIPO_COMBUSTIVEL:document.getElementById('mab_comb').value,
    TANQUE_POSTO:document.getElementById('mab_tanq').value,
    OPERADOR:document.getElementById('mab_oper').value.trim(),
    FLORESTA_OPC:document.getElementById('mab_flopc').value,
    OBS:document.getElementById('mab_obs').value.trim()
  };
  var btn=document.getElementById('maqAbSalvarBtn'); if(btn){ btn.disabled=true; btn.textContent='Salvando...'; }
  function done(ok,res){
    if(btn){ btn.disabled=false; btn.textContent='💾 Salvar'; }
    if(!ok){ showToast('❌ Erro: '+((res&&res.error)||'desconhecido'),true); return; }
    showToast('✅ Abastecimento salvo!');
    closeMaqAbastModal();
    loadFromSheets(function(){ if(document.getElementById('pageMaquinarios').classList.contains('active')) renderMaqAbastTable(); });
  }
  if(_maqAbEditId) saveToSheets('updateAbastecimentoMaq',{id:_maqAbEditId,row:row},done);
  else { row.USUARIO=currentUserData?currentUserData.nome:''; saveToSheets('addAbastecimentoMaq',row,done); }
}
function openMaqAbastDelete(id){
  if(!maqIsAdmin()){ showToast('Apenas ADMIN pode excluir',true); return; }
  var r=findAbastById(id); if(!r){ showToast('Registro não encontrado',true); return; }
  _maqAbDelId=String(id);
  document.getElementById('maqAbDelDetails').innerHTML='<div><strong>Máquina:</strong> '+_maqEsc(maqNome(r.ID_MAQUINA))+'</div><div><strong>Data:</strong> '+_maqEsc(formatDateBR(r.DATA))+'</div><div><strong>Total:</strong> '+fmtR(num(r.VALOR_TOTAL))+'</div>';
  document.getElementById('maqAbDelOverlay').classList.add('show');
}
function closeMaqAbastDelete(){ document.getElementById('maqAbDelOverlay').classList.remove('show'); _maqAbDelId=null; }
function confirmMaqAbastDelete(){
  if(!_maqAbDelId) return;
  var btn=document.getElementById('maqAbDelBtn'); if(btn){ btn.disabled=true; btn.textContent='Excluindo...'; }
  saveToSheets('deleteAbastecimentoMaq',{id:_maqAbDelId},function(ok,res){
    if(btn){ btn.disabled=false; btn.textContent='🗑️ Excluir'; }
    if(!ok){ showToast('❌ Erro: '+((res&&res.error)||'desconhecido'),true); return; }
    showToast('✅ Abastecimento excluído');
    closeMaqAbastDelete();
    loadFromSheets(function(){ if(document.getElementById('pageMaquinarios').classList.contains('active')) renderMaqAbastTable(); });
  });
}
// ===== FIM MÓDULO MAQUINÁRIOS (parte 3) =====

