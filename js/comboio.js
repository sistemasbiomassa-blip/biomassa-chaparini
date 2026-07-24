// ============================================================
// ===== MÓDULO COMBOIO (Fase 3 - pedaço 1: esqueleto) ========
// Aditivo. Não altera nenhuma função existente.
// Sub-abas: Saldos · Entradas · Saídas · Tanques.
// Vínculo de tudo = LOCAL_ABASTECIMENTO (lista BASE.localAbast).
// Saldo = SALDO_INICIAL + entradas − saídas (a partir de DATA_INICIO).
// Saídas (só leitura) = litros de MAQ_ABASTECIMENTO + CADASTRO que
//   apontam pro mesmo Posto.
// Permissões: tanque = só ADMIN; entradas = ADMIN+ANALISTA.
// >>> Pedaço 1 só monta a estrutura navegável. Os cálculos e o CRUD
//     entram nos pedaços seguintes.
// ============================================================
var comboioFiltro = { dtIni:'', dtFim:'', localAbast:'', motorista:'', fornecedor:'' };

function comboioIsAdmin(){ return !!(currentUserData && currentUserData.perfil==='ADMIN'); }
function comboioPerfil(){ return (currentUserData && currentUserData.perfil) ? currentUserData.perfil : ''; }

// Helpers compartilhados do módulo Comboio
function _cbEsc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'); }
function _cbNorm(s){ return String(s==null?'':s).trim().toUpperCase(); }
function _cbNum(v){ if(v===''||v===null||v===undefined) return 0; if(typeof v==='number') return v; var s=String(v).trim(); if(s.indexOf(',')>=0) s=s.replace(/\./g,'').replace(',','.'); var n=Number(s); return isNaN(n)?0:n; }
function _cbNumBR(v){ return _cbNum(v).toLocaleString('pt-BR',{minimumFractionDigits:0, maximumFractionDigits:2}); }
// Número -> string mascarada BR com 'dec' casas (ex.: 1000.5 -> "1.000,50"). Vazio -> "".
function _cbToMask(v, dec){
  dec = dec || 2;
  if(v===''||v===null||v===undefined) return '';
  var n=_cbNum(v);
  var fixed=Math.abs(n).toFixed(dec);
  var parts=fixed.split('.');
  var intp=parts[0].replace(/\B(?=(\d{3})+(?!\d))/g,'.');
  return intp+(dec>0?(','+parts[1]):'');
}
function _cbAuditTxt(row){
  if(!row) return '';
  return 'Cadastrado por <strong>'+_cbEsc(row.USUARIO||'-')+'</strong> em '+_cbEsc(row.DATA_REGISTRO?formatDateBR(row.DATA_REGISTRO):'-');
}

function buildComboio(){
  // Pedaço 1: apenas renderiza a sub-aba ativa. Sem cálculo ainda.
  renderComboioSaldos();
}

function _comboioPlaceholder(titulo){
  return '<div class="table-container"><div style="padding:40px;text-align:center;color:var(--text2);font-size:13px">'+
         '🛢️ <strong>'+titulo+'</strong><br><span style="font-size:11px">Em construção — entra no próximo pedaço.</span></div></div>';
}

// ---------- COMBOIO: Saldos ----------
// Saldo = SALDO_INICIAL + entradas − saídas, contando a partir de DATA_INICIO.
// Entradas: TANQUE_ENTRADAS (mesmo Posto). Saídas: MAQ_ABASTECIMENTO (máquinas)
// + CADASTRO (caminhões) que apontam pro mesmo Posto. Helpers reusados na aba Saídas.
function _cbDatePart(v){
  var s=String(v==null?'':v).trim();
  var m=s.match(/^(\d{4})-(\d{2})-(\d{2})/); if(m) return m[0];
  var b=s.match(/^(\d{2})\/(\d{2})\/(\d{4})/); if(b) return b[3]+'-'+b[2]+'-'+b[1];
  return s;
}
function _cbEntradasTanque(posto, dataIni){
  var p=_cbNorm(posto), ini=_cbDatePart(dataIni||''), tot=0;
  (DB.tanqueEntradas||[]).forEach(function(e){
    if(_cbNorm(e.LOCAL_ABASTECIMENTO)!==p) return;
    if(ini && _cbDatePart(e.DATA)<ini) return;
    tot+=_cbNum(e.LITROS);
  });
  return Math.round(tot*100)/100;
}
function _cbSaidasTanque(posto, dataIni){
  var p=_cbNorm(posto), ini=_cbDatePart(dataIni||''), maq=0, cam=0;
  (DB.maqAbastecimento||[]).forEach(function(r){
    if(_cbNorm(r.TANQUE_POSTO)!==p) return;
    if(ini && _cbDatePart(r.DATA)<ini) return;
    maq+=_cbNum(r.LITROS);
  });
  (DB.cadastro||[]).forEach(function(r){
    if(_cbNorm(r['LOCAL ABASTECIMENTO'])!==p) return;
    if(ini && _cbDatePart(r.DATA)<ini) return;
    cam+=_cbNum(r['QTDADE LITROS']);
  });
  maq=Math.round(maq*100)/100; cam=Math.round(cam*100)/100;
  return {total:Math.round((maq+cam)*100)/100, maquinas:maq, caminhoes:cam};
}
function _cbSaldoTanque(t){
  var si=_cbNum(t.SALDO_INICIAL);
  var ent=_cbEntradasTanque(t.LOCAL_ABASTECIMENTO, t.DATA_INICIO);
  var sai=_cbSaidasTanque(t.LOCAL_ABASTECIMENTO, t.DATA_INICIO);
  return {saldo:Math.round((si+ent-sai.total)*100)/100, inicial:si, entradas:ent, saidas:sai.total, saidasDet:sai, min:_cbNum(t.NIVEL_MINIMO)};
}
function _cbStatusTanque(saldo, min){
  if(saldo < min) return 'red';
  if(saldo <= min*1.2) return 'yellow';
  return 'green';
}

// Último preço de compra (R$/L) de um Posto com tanque — pega a entrada mais
// recente por DATA (desempate pelo ID). Retorna null se não houver entradas.
function _cbUltimoPrecoTanque(posto){
  var p=_cbNorm(posto), best=null, bD='', bId=-1;
  (DB.tanqueEntradas||[]).forEach(function(e){
    if(_cbNorm(e.LOCAL_ABASTECIMENTO)!==p) return;
    var d=_cbDatePart(e.DATA), id=Number(e.ID)||0;
    if(best===null || d>bD || (d===bD && id>bId)){ best=_cbNum(e.PRECO_LITRO); bD=d; bId=id; }
  });
  return best;
}
// Handler do campo Tanque/Posto no abastecimento da máquina: ao escolher um
// Posto com tanque, preenche o R$/L com o último preço (editável). Só dispara
// na ação do usuário (não no carregamento do modal), preservando o valor salvo.
function _maqAbPrecoAuto(){
  var sel=document.getElementById('mab_tanq'), pre=document.getElementById('mab_pre');
  if(!sel||!pre) return;
  var preco=_cbUltimoPrecoTanque(sel.value);
  if(preco!=null){ pre.value=fmt(preco,2); if(typeof _maqAbCalcTotal==='function') _maqAbCalcTotal(); }
}

// ---------- COMBOIO: Alerta de saldo baixo ----------
// Mostra uma caixa central no login listando os tanques abaixo do mínimo.
// "OK" some pela sessão; reaparece a cada login até o saldo subir (comprar diesel).
// Sem persistência: recalcula a cada carregamento.
var _comboioAlertDismissed=false;
function _cbTanquesBaixos(){
  var out=[];
  (DB.tanques||[]).forEach(function(t){
    var s=_cbSaldoTanque(t);
    if(_cbStatusTanque(s.saldo, s.min)==='red') out.push({posto:t.LOCAL_ABASTECIMENTO, saldo:s.saldo, min:s.min});
  });
  return out;
}
function checkComboioAlert(){
  var ov=document.getElementById('comboioAlertOverlay');
  if(!ov) return;
  if(_comboioAlertDismissed){ ov.classList.remove('show'); return; }
  var baixos=_cbTanquesBaixos();
  if(!baixos.length){ ov.classList.remove('show'); return; }
  var h='<div style="font-size:38px;text-align:center;margin-bottom:6px">⛽</div>';
  h+='<h2 style="text-align:center;color:var(--red);margin-bottom:4px">Saldo de diesel baixo</h2>';
  h+='<p style="text-align:center;color:var(--text2);font-size:13px;margin-bottom:14px">'+baixos.length+(baixos.length===1?' tanque está':' tanques estão')+' abaixo do nível mínimo:</p>';
  h+='<div style="display:flex;flex-direction:column;gap:8px;max-height:240px;overflow-y:auto">';
  baixos.forEach(function(b){
    h+='<div style="border:1px solid var(--red);border-left:5px solid var(--red);border-radius:10px;padding:10px 12px">'+
       '<div style="font-weight:700">🛢️ '+_cbEsc(b.posto||'-')+'</div>'+
       '<div style="font-size:12px;color:var(--text2)">Saldo: <strong style="color:var(--red)">'+_cbNumBR(b.saldo)+' L</strong> · Mínimo: '+_cbNumBR(b.min)+' L</div>'+
       '</div>';
  });
  h+='</div>';
  document.getElementById('comboioAlertBody').innerHTML=h;
  ov.classList.add('show');
}
function dismissComboioAlert(){
  _comboioAlertDismissed=true;
  var ov=document.getElementById('comboioAlertOverlay'); if(ov) ov.classList.remove('show');
}

function renderComboioSaldos(){
  var cont=document.getElementById('comboioSaldosContainer');
  if(!cont) return;
  var tanques=(DB.tanques||[]).slice().sort(function(a,b){ return _cbNorm(a.LOCAL_ABASTECIMENTO).localeCompare(_cbNorm(b.LOCAL_ABASTECIMENTO)); });
  if(!tanques.length){
    cont.innerHTML='<div class="table-container"><div style="padding:40px;text-align:center;color:var(--text2)">Nenhum tanque cadastrado. Cadastre um na aba <strong>Tanques</strong>.</div></div>';
    return;
  }
  var h='<div class="cb-grid">';
  tanques.forEach(function(t){
    var s=_cbSaldoTanque(t);
    var cls=_cbStatusTanque(s.saldo, s.min);
    var statusTxt = cls==='red'?'⚠️ Abaixo do mínimo':(cls==='yellow'?'Atenção — perto do mínimo':'OK');
    h+='<div class="cb-card '+cls+'">'+
       '<div class="cb-posto">🛢️ '+_cbEsc(t.LOCAL_ABASTECIMENTO||'-')+'</div>'+
       '<div class="cb-saldo">'+_cbNumBR(s.saldo)+' <span class="cb-unit">L</span></div>'+
       '<div class="cb-status">'+statusTxt+'</div>'+
       '<div style="margin-top:10px;border-top:1px solid var(--border);padding-top:8px">'+
       '<div class="cb-line"><span>Saldo inicial</span><span>'+_cbNumBR(s.inicial)+' L</span></div>'+
       '<div class="cb-line"><span>+ Entradas</span><span style="color:var(--green)">+'+_cbNumBR(s.entradas)+' L</span></div>'+
       '<div class="cb-line"><span>− Saídas</span><span style="color:var(--red)">−'+_cbNumBR(s.saidas)+' L</span></div>'+
       '<div class="cb-line"><span>Nível mínimo</span><span>'+_cbNumBR(s.min)+' L</span></div>'+
       '<div class="cb-line" style="font-size:10px;opacity:.7"><span>Desde</span><span>'+_cbEsc(t.DATA_INICIO?formatDateBR(t.DATA_INICIO):'-')+'</span></div>'+
       '</div></div>';
  });
  h+='</div>';
  cont.innerHTML=h;
}
function renderComboioEntradas(){
  var cont=document.getElementById('cbEnTableContainer');
  if(!cont) return;
  var addBtn=document.getElementById('cbEnAddBtn');
  if(addBtn) addBtn.style.display = comboioCanLancar() ? 'inline-flex' : 'none';
  // Filtros: Posto = só os que têm tanque; Fornecedor = distintos das entradas
  _cbFillSelect(document.getElementById('cbEnPosto'), _cbPostosComTanque());
  var forns={}, fornList=[];
  (DB.tanqueEntradas||[]).forEach(function(e){ var f=(e.FORNECEDOR||'').trim(); if(f && !forns[_cbNorm(f)]){ forns[_cbNorm(f)]=1; fornList.push(f); } });
  fornList.sort(function(a,b){ return _cbNorm(a).localeCompare(_cbNorm(b)); });
  _cbFillSelect(document.getElementById('cbEnForn'), fornList);

  var di=(document.getElementById('cbEnIni')||{}).value||'';
  var df=(document.getElementById('cbEnFim')||{}).value||'';
  var fP=(document.getElementById('cbEnPosto')||{}).value||'';
  var fF=(document.getElementById('cbEnForn')||{}).value||'';
  var admin=comboioIsAdmin();
  var rows=(DB.tanqueEntradas||[]).filter(function(r){
    if(di && String(r.DATA||'')<di) return false;
    if(df && String(r.DATA||'')>df) return false;
    if(fP && _cbNorm(r.LOCAL_ABASTECIMENTO)!==_cbNorm(fP)) return false;
    if(fF && _cbNorm(r.FORNECEDOR)!==_cbNorm(fF)) return false;
    return true;
  });
  rows.sort(function(a,b){ return String(b.DATA||'').localeCompare(String(a.DATA||'')); });
  document.getElementById('cbEnCount').textContent=rows.length+(rows.length===1?' registro':' registros');
  if(!rows.length){ cont.innerHTML='<div style="padding:30px;text-align:center;color:var(--text2)">Nenhuma entrada'+((di||df||fP||fF)?' no filtro.':'.'+(comboioCanLancar()?' Clique em “Nova entrada”.':''))+'</div>'; return; }
  var totLit=0, totVal=0;
  var h='<table class="maq-table"><thead><tr><th>Data</th><th>Posto</th><th>Litros</th><th>R$/L</th><th>Total</th><th>Fornecedor</th><th>Nota fiscal</th><th>Cadastro</th><th style="text-align:center">Ações</th></tr></thead><tbody>';
  rows.forEach(function(r){
    totLit+=num(r.LITROS); totVal+=num(r.VALOR_TOTAL);
    var canEdit=admin||_cbEhDono(r), acts='';
    if(canEdit) acts+='<span class="maq-act" title="Editar" onclick="openEntradaModal(\''+r.ID+'\')">✏️</span> ';
    if(admin) acts+='<span class="maq-act" title="Excluir" onclick="openEntradaDelete(\''+r.ID+'\')">🗑️</span>';
    if(!acts) acts='<span style="color:var(--text2)">—</span>';
    h+='<tr><td class="maq-mono">'+_cbEsc(r.DATA?formatDateBR(r.DATA):'-')+'</td><td>'+_cbEsc(r.LOCAL_ABASTECIMENTO||'-')+'</td><td class="maq-mono">'+fmt(num(r.LITROS),2)+'</td><td class="maq-mono">'+fmtR(num(r.PRECO_LITRO))+'</td><td class="maq-mono">'+fmtR(num(r.VALOR_TOTAL))+'</td><td>'+_cbEsc(r.FORNECEDOR||'-')+'</td><td>'+_cbEsc(r.NOTA_FISCAL||'-')+'</td><td style="font-size:11px;color:var(--text2)">'+_cbAuditTxt(r)+'</td><td style="text-align:center;white-space:nowrap">'+acts+'</td></tr>';
  });
  h+='</tbody><tfoot><tr style="font-weight:700;background:var(--surface2)"><td colspan="2" style="text-align:right">TOTAIS:</td><td class="maq-mono">'+fmt(totLit,2)+'</td><td></td><td class="maq-mono">'+fmtR(Math.round(totVal*100)/100)+'</td><td colspan="4"></td></tr></tfoot>';
  h+='</table>';
  cont.innerHTML=h;
}

function clearComboioEntradasFiltro(){
  ['cbEnIni','cbEnFim','cbEnPosto','cbEnForn'].forEach(function(id){ var el=document.getElementById(id); if(el) el.value=''; });
  renderComboioEntradas();
}

// ---------- COMBOIO: Entradas (CRUD) ----------
// Criar = ADMIN+ANALISTA; editar = admin ou dono; excluir = só ADMIN.
var _entEditId=null, _entDelId=null;

function comboioCanLancar(){ return !!(currentUserData && (currentUserData.perfil==='ADMIN'||currentUserData.perfil==='ANALISTA')); }
function _cbEhDono(row){ return !!(currentUserData && row && (row.USUARIO===currentUserData.nome || row.USUARIO===currentUserData.usuario)); }
function findEntradaById(id){ id=String(id); for(var i=0;i<(DB.tanqueEntradas||[]).length;i++){ if(String(DB.tanqueEntradas[i].ID)===id) return DB.tanqueEntradas[i]; } return null; }

function _cbPostosComTanque(){
  var seen={}, out=[];
  (DB.tanques||[]).forEach(function(t){ var p=t.LOCAL_ABASTECIMENTO; if(!p) return; var k=_cbNorm(p); if(seen[k]) return; seen[k]=1; out.push(p); });
  out.sort(function(a,b){ return _cbNorm(a).localeCompare(_cbNorm(b)); });
  return out;
}
function _cbFillSelect(sel, valores){
  if(!sel) return;
  var cur=sel.value;
  var first=sel.options.length?sel.options[0].outerHTML:'<option value="">—</option>';
  var h=first;
  valores.forEach(function(v){ h+='<option'+(String(cur)===String(v)?' selected':'')+'>'+_cbEsc(v)+'</option>'; });
  sel.innerHTML=h;
}

function _entBuildForm(row){
  row=row||{};
  var po='<option value="">—</option>';
  _cbPostosComTanque().forEach(function(p){ po+='<option'+(_cbNorm(row.LOCAL_ABASTECIMENTO)===_cbNorm(p)?' selected':'')+'>'+_cbEsc(p)+'</option>'; });
  var dataVal=row.DATA||new Date().toISOString().slice(0,10);
  var litVal=(row.LITROS!=null&&row.LITROS!=='')?_cbToMask(row.LITROS,2):'';
  var preVal=(row.PRECO_LITRO!=null&&row.PRECO_LITRO!=='')?_cbToMask(row.PRECO_LITRO,2):'';
  return ''+
    '<div class="form-group"><label>Data *</label><input id="ent_data" type="date" value="'+_cbEsc(dataVal)+'"></div>'+
    '<div class="form-group"><label>Posto (tanque) *</label><select id="ent_posto">'+po+'</select></div>'+
    '<div class="form-group"><label>Litros *</label><input id="ent_lit" type="text" inputmode="numeric" value="'+_cbEsc(litVal)+'"></div>'+
    '<div class="form-group"><label>Preço (R$/L) *</label><input id="ent_pre" type="text" inputmode="numeric" value="'+_cbEsc(preVal)+'"></div>'+
    '<div class="form-group"><label>Valor total</label><input id="ent_tot" type="text" value="" readonly style="background:var(--surface2);font-weight:600"></div>'+
    '<div class="form-group"><label>Fornecedor</label><input id="ent_forn" type="text" value="'+_cbEsc(row.FORNECEDOR||'')+'"></div>'+
    '<div class="form-group"><label>Nota fiscal</label><input id="ent_nf" type="text" value="'+_cbEsc(row.NOTA_FISCAL||'')+'"></div>'+
    '<div class="form-group" style="grid-column:1/-1"><label>Observação</label><input id="ent_obs" type="text" value="'+_cbEsc(row.OBS||'')+'"></div>';
}
function _entCalcTotal(){
  var l=num(document.getElementById('ent_lit').value), p=num(document.getElementById('ent_pre').value);
  document.getElementById('ent_tot').value=fmtR(Math.round(l*p*100)/100);
}
function openEntradaModal(id){
  _entEditId=(id!==undefined&&id!==null&&id!=='')?String(id):null;
  var row=_entEditId?findEntradaById(_entEditId):{};
  if(_entEditId){
    if(!row){ showToast('Entrada não encontrada',true); return; }
    if(!comboioIsAdmin() && !_cbEhDono(row)){ showToast('❌ Você só pode editar as suas próprias entradas',true); return; }
  } else if(!comboioCanLancar()){ showToast('Sem permissão',true); return; }
  if(!_cbPostosComTanque().length){ showToast('Cadastre um tanque antes de lançar entradas',true); return; }
  document.getElementById('entradaModalTitle').textContent=_entEditId?'✏️ Editar Entrada':'🛒 Nova Entrada';
  var aud=document.getElementById('entradaAudit');
  if(_entEditId){ aud.innerHTML=_cbAuditTxt(row); aud.style.display=''; } else { aud.style.display='none'; }
  document.getElementById('entradaModalGrid').innerHTML=_entBuildForm(row);
  mascaraNumero(document.getElementById('ent_lit'),6,2);
  mascaraNumero(document.getElementById('ent_pre'),3,2);
  document.getElementById('ent_lit').addEventListener('input',_entCalcTotal);
  document.getElementById('ent_pre').addEventListener('input',_entCalcTotal);
  _entCalcTotal();
  document.getElementById('entradaModalOverlay').classList.add('show');
}
function closeEntradaModal(){ document.getElementById('entradaModalOverlay').classList.remove('show'); _entEditId=null; }
function salvarEntrada(){
  var data=document.getElementById('ent_data').value;
  var posto=document.getElementById('ent_posto').value;
  var litStr=document.getElementById('ent_lit').value;
  var preStr=document.getElementById('ent_pre').value;
  if(!data){ showToast('Informe a data',true); return; }
  if(!posto){ showToast('Selecione o Posto (tanque)',true); return; }
  if(!num(litStr)){ showToast('Informe os litros',true); return; }
  if(!num(preStr)){ showToast('Informe o preço (R$/L)',true); return; }
  var row={
    DATA:data,
    LOCAL_ABASTECIMENTO:posto,
    LITROS:litStr,           // string BR; o servidor converte e calcula VALOR_TOTAL
    PRECO_LITRO:preStr,
    FORNECEDOR:document.getElementById('ent_forn').value.trim(),
    NOTA_FISCAL:document.getElementById('ent_nf').value.trim(),
    OBS:document.getElementById('ent_obs').value.trim()
  };
  var btn=document.getElementById('entradaSalvarBtn'); if(btn){ btn.disabled=true; btn.textContent='Salvando...'; }
  function done(ok,res){
    if(btn){ btn.disabled=false; btn.textContent='💾 Salvar'; }
    if(!ok){ showToast('❌ Erro ao salvar: '+((res&&res.error)||'desconhecido'),true); return; }
    showToast('✅ Entrada salva!');
    closeEntradaModal();
    loadFromSheets(function(){ if(document.getElementById('pageComboio').classList.contains('active')) renderComboioEntradas(); });
  }
  if(_entEditId) saveToSheets('updateTanqueEntrada',{id:_entEditId,row:row},done);
  else { row.USUARIO=currentUserData?currentUserData.nome:''; saveToSheets('addTanqueEntrada',row,done); }
}
function openEntradaDelete(id){
  if(!comboioIsAdmin()){ showToast('Apenas ADMIN pode excluir',true); return; }
  var r=findEntradaById(id); if(!r){ showToast('Entrada não encontrada',true); return; }
  _entDelId=String(id);
  document.getElementById('entradaDelDetails').innerHTML='<div><strong>Data:</strong> '+_cbEsc(r.DATA?formatDateBR(r.DATA):'-')+'</div><div><strong>Posto:</strong> '+_cbEsc(r.LOCAL_ABASTECIMENTO||'-')+'</div><div><strong>Litros:</strong> '+fmt(num(r.LITROS),2)+' L</div><div><strong>Valor:</strong> '+fmtR(num(r.VALOR_TOTAL))+'</div><div style="margin-top:8px;color:var(--text2);font-size:12px">A entrada será removida permanentemente e o saldo do tanque será recalculado.</div>';
  document.getElementById('entradaDelOverlay').classList.add('show');
}
function closeEntradaDelete(){ document.getElementById('entradaDelOverlay').classList.remove('show'); _entDelId=null; }
function confirmEntradaDelete(){
  if(!_entDelId){ return; }
  var btn=document.getElementById('entradaDelBtn'); if(btn){ btn.disabled=true; btn.textContent='Excluindo...'; }
  saveToSheets('deleteTanqueEntrada',{id:_entDelId},function(ok,res){
    if(btn){ btn.disabled=false; btn.textContent='🗑️ Excluir'; }
    if(!ok){ showToast('❌ Erro ao excluir: '+((res&&res.error)||'desconhecido'),true); return; }
    showToast('✅ Entrada excluída');
    closeEntradaDelete();
    loadFromSheets(function(){ if(document.getElementById('pageComboio').classList.contains('active')) renderComboioEntradas(); });
  });
}
function exportEntradasPDF(){
  var di=(document.getElementById('cbEnIni')||{}).value||'';
  var df=(document.getElementById('cbEnFim')||{}).value||'';
  var fP=(document.getElementById('cbEnPosto')||{}).value||'';
  var fF=(document.getElementById('cbEnForn')||{}).value||'';
  var rows=(DB.tanqueEntradas||[]).filter(function(r){
    if(di && String(r.DATA||'')<di) return false;
    if(df && String(r.DATA||'')>df) return false;
    if(fP && _cbNorm(r.LOCAL_ABASTECIMENTO)!==_cbNorm(fP)) return false;
    if(fF && _cbNorm(r.FORNECEDOR)!==_cbNorm(fF)) return false;
    return true;
  }).sort(function(a,b){ return String(a.DATA||'').localeCompare(String(b.DATA||'')); });
  var extra=[];
  if(di) extra.push('De: '+formatDateBR(di));
  if(df) extra.push('Até: '+formatDateBR(df));
  if(fP) extra.push('Posto: '+fP);
  if(fF) extra.push('Fornecedor: '+fF);
  var logoEl=document.querySelector('.sidebar-logo img'); var logoSrc=logoEl?logoEl.src:'';
  var totLit=0, totVal=0;
  var win=window.open('','_blank');
  var html='<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Entradas — Comboio</title><style>';
  html+='*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;padding:14px;color:#222;font-size:10px}';
  html+='.rep-head{display:flex;align-items:center;gap:14px;border-bottom:2px solid #0D692C;padding-bottom:10px;margin-bottom:10px}';
  html+='.rep-head img{width:54px;height:54px;border-radius:8px;object-fit:cover}.rep-head h1{font-size:18px;color:#085425;line-height:1.1}';
  html+='.rep-head .sub{font-size:11px;color:#444;margin-top:2px}.rep-head .gen{font-size:9px;color:#888;margin-top:3px}';
  html+='table{width:100%;border-collapse:collapse;margin-top:4px}th,td{border:1px solid #ccc;padding:4px 6px;font-size:9px;text-align:left}';
  html+='th{background:#0D692C;color:#fff;text-transform:uppercase;font-size:8.5px}tbody tr:nth-child(even){background:#f4f8fb}';
  html+='tfoot td{font-weight:bold;background:#eef5ef}.num{text-align:right}';
  html+='.foot{margin-top:10px;font-size:9px;color:#666;text-align:center}@page{size:landscape;margin:8mm}</style></head><body>';
  html+='<div class="rep-head">'+(logoSrc?'<img src="'+logoSrc+'">':'')+'<div><h1>BIOMASSA CHAPARINI</h1><div class="sub">Entradas de Combustível — Comboio</div>'+(extra.length?'<div class="sub"><b>Filtros:</b> '+extra.join(' · ')+'</div>':'')+'<div class="gen">Gerado em '+new Date().toLocaleString('pt-BR')+'</div></div></div>';
  if(!rows.length){ html+='<p style="padding:20px;text-align:center;color:#888">Nenhuma entrada para os filtros aplicados.</p>'; }
  else {
    html+='<table><thead><tr><th>Data</th><th>Posto</th><th class="num">Litros</th><th class="num">R$/L</th><th class="num">Total</th><th>Fornecedor</th><th>Nota fiscal</th></tr></thead><tbody>';
    rows.forEach(function(r){
      totLit+=num(r.LITROS); totVal+=num(r.VALOR_TOTAL);
      html+='<tr><td>'+(r.DATA?formatDateBR(r.DATA):'-')+'</td><td>'+(r.LOCAL_ABASTECIMENTO||'-')+'</td><td class="num">'+fmt(num(r.LITROS),2)+'</td><td class="num">'+fmtR(num(r.PRECO_LITRO))+'</td><td class="num">'+fmtR(num(r.VALOR_TOTAL))+'</td><td>'+(r.FORNECEDOR||'-')+'</td><td>'+(r.NOTA_FISCAL||'-')+'</td></tr>';
    });
    html+='</tbody><tfoot><tr><td colspan="2" class="num">TOTAIS:</td><td class="num">'+fmt(totLit,2)+'</td><td></td><td class="num">'+fmtR(Math.round(totVal*100)/100)+'</td><td colspan="2"></td></tr></tfoot>';
    html+='</table><div class="foot">'+rows.length+' entrada(s)</div>';
  }
  html+='<script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script></body></html>';
  win.document.write(html); win.document.close();
}
// ---------- COMBOIO: Saídas (somente leitura) ----------
// Lista os abastecimentos que saíram dos tanques: MAQUINAS (MAQ_ABASTECIMENTO)
// + CAMINHÕES (CADASTRO). Só Postos com tanque, cada saída a partir da
// DATA_INICIO do tanque daquele Posto (igual ao cálculo do saldo).
function _cbSaidasLista(){
  var tanquePorPosto={};
  (DB.tanques||[]).forEach(function(t){ tanquePorPosto[_cbNorm(t.LOCAL_ABASTECIMENTO)]=t; });
  var out=[];
  (DB.maqAbastecimento||[]).forEach(function(r){
    var t=tanquePorPosto[_cbNorm(r.TANQUE_POSTO)]; if(!t) return;
    if(_cbDatePart(r.DATA)<_cbDatePart(t.DATA_INICIO||'')) return;
    var lit=_cbNum(r.LITROS); if(!lit) return;
    out.push({data:_cbDatePart(r.DATA), posto:r.TANQUE_POSTO, origem:'Máquina', ident:maqNome(r.ID_MAQUINA), litros:lit});
  });
  (DB.cadastro||[]).forEach(function(r){
    var t=tanquePorPosto[_cbNorm(r['LOCAL ABASTECIMENTO'])]; if(!t) return;
    if(_cbDatePart(r.DATA)<_cbDatePart(t.DATA_INICIO||'')) return;
    var lit=_cbNum(r['QTDADE LITROS']); if(!lit) return;
    var ident=[r.PLACA,r.MOTORISTA].filter(Boolean).join(' · ')||'-';
    out.push({data:_cbDatePart(r.DATA), posto:r['LOCAL ABASTECIMENTO'], origem:'Caminhão', ident:ident, litros:lit});
  });
  return out;
}

function renderComboioSaidas(){
  var cont=document.getElementById('cbSaTableContainer');
  if(!cont) return;
  _cbFillSelect(document.getElementById('cbSaPosto'), _cbPostosComTanque());
  var di=(document.getElementById('cbSaIni')||{}).value||'';
  var df=(document.getElementById('cbSaFim')||{}).value||'';
  var fP=(document.getElementById('cbSaPosto')||{}).value||'';
  var fO=(document.getElementById('cbSaOrigem')||{}).value||'';
  var rows=_cbSaidasLista().filter(function(r){
    if(di && r.data<di) return false;
    if(df && r.data>df) return false;
    if(fP && _cbNorm(r.posto)!==_cbNorm(fP)) return false;
    if(fO && r.origem!==fO) return false;
    return true;
  });
  rows.sort(function(a,b){ return String(b.data).localeCompare(String(a.data)); });
  document.getElementById('cbSaCount').textContent=rows.length+(rows.length===1?' registro':' registros');
  if(!rows.length){
    cont.innerHTML='<div style="padding:30px;text-align:center;color:var(--text2)">Nenhuma saída'+((di||df||fP||fO)?' no filtro.':'.')+'<br><span style="font-size:11px">As saídas de máquina passam a contar após o ajuste do campo Tanque/Posto no abastecimento.</span></div>';
    return;
  }
  var tot=0;
  var h='<table class="maq-table"><thead><tr><th>Data</th><th>Posto</th><th>Origem</th><th>Identificação</th><th>Litros</th></tr></thead><tbody>';
  rows.forEach(function(r){
    tot+=r.litros;
    var badge=r.origem==='Máquina'?'🌲':'🚚';
    h+='<tr><td class="maq-mono">'+_cbEsc(r.data?formatDateBR(r.data):'-')+'</td><td>'+_cbEsc(r.posto||'-')+'</td><td>'+badge+' '+_cbEsc(r.origem)+'</td><td>'+_cbEsc(r.ident||'-')+'</td><td class="maq-mono">'+fmt(r.litros,2)+'</td></tr>';
  });
  h+='</tbody><tfoot><tr style="font-weight:700;background:var(--surface2)"><td colspan="4" style="text-align:right">TOTAL DE SAÍDAS:</td><td class="maq-mono">'+fmt(Math.round(tot*100)/100,2)+' L</td></tr></tfoot>';
  h+='</table>';
  cont.innerHTML=h;
}

function clearComboioSaidasFiltro(){
  ['cbSaIni','cbSaFim','cbSaPosto','cbSaOrigem'].forEach(function(id){ var el=document.getElementById(id); if(el) el.value=''; });
  renderComboioSaidas();
}

function exportSaidasPDF(){
  var di=(document.getElementById('cbSaIni')||{}).value||'';
  var df=(document.getElementById('cbSaFim')||{}).value||'';
  var fP=(document.getElementById('cbSaPosto')||{}).value||'';
  var fO=(document.getElementById('cbSaOrigem')||{}).value||'';
  var rows=_cbSaidasLista().filter(function(r){
    if(di && r.data<di) return false;
    if(df && r.data>df) return false;
    if(fP && _cbNorm(r.posto)!==_cbNorm(fP)) return false;
    if(fO && r.origem!==fO) return false;
    return true;
  }).sort(function(a,b){ return String(a.data).localeCompare(String(b.data)); });
  var extra=[];
  if(di) extra.push('De: '+formatDateBR(di));
  if(df) extra.push('Até: '+formatDateBR(df));
  if(fP) extra.push('Posto: '+fP);
  if(fO) extra.push('Origem: '+fO);
  var logoEl=document.querySelector('.sidebar-logo img'); var logoSrc=logoEl?logoEl.src:'';
  var tot=0;
  var win=window.open('','_blank');
  var html='<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Saídas — Comboio</title><style>';
  html+='*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;padding:14px;color:#222;font-size:10px}';
  html+='.rep-head{display:flex;align-items:center;gap:14px;border-bottom:2px solid #0D692C;padding-bottom:10px;margin-bottom:10px}';
  html+='.rep-head img{width:54px;height:54px;border-radius:8px;object-fit:cover}.rep-head h1{font-size:18px;color:#085425;line-height:1.1}';
  html+='.rep-head .sub{font-size:11px;color:#444;margin-top:2px}.rep-head .gen{font-size:9px;color:#888;margin-top:3px}';
  html+='table{width:100%;border-collapse:collapse;margin-top:4px}th,td{border:1px solid #ccc;padding:4px 6px;font-size:9px;text-align:left}';
  html+='th{background:#0D692C;color:#fff;text-transform:uppercase;font-size:8.5px}tbody tr:nth-child(even){background:#f4f8fb}';
  html+='tfoot td{font-weight:bold;background:#eef5ef}.num{text-align:right}';
  html+='.foot{margin-top:10px;font-size:9px;color:#666;text-align:center}@page{size:landscape;margin:8mm}</style></head><body>';
  html+='<div class="rep-head">'+(logoSrc?'<img src="'+logoSrc+'">':'')+'<div><h1>BIOMASSA CHAPARINI</h1><div class="sub">Saídas de Combustível — Comboio</div>'+(extra.length?'<div class="sub"><b>Filtros:</b> '+extra.join(' · ')+'</div>':'')+'<div class="gen">Gerado em '+new Date().toLocaleString('pt-BR')+'</div></div></div>';
  if(!rows.length){ html+='<p style="padding:20px;text-align:center;color:#888">Nenhuma saída para os filtros aplicados.</p>'; }
  else {
    html+='<table><thead><tr><th>Data</th><th>Posto</th><th>Origem</th><th>Identificação</th><th class="num">Litros</th></tr></thead><tbody>';
    rows.forEach(function(r){
      tot+=r.litros;
      html+='<tr><td>'+(r.data?formatDateBR(r.data):'-')+'</td><td>'+(r.posto||'-')+'</td><td>'+r.origem+'</td><td>'+(r.ident||'-')+'</td><td class="num">'+fmt(r.litros,2)+'</td></tr>';
    });
    html+='</tbody><tfoot><tr><td colspan="4" class="num">TOTAL DE SAÍDAS:</td><td class="num">'+fmt(Math.round(tot*100)/100,2)+' L</td></tr></tfoot>';
    html+='</table><div class="foot">'+rows.length+' saída(s)</div>';
  }
  html+='<script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script></body></html>';
  win.document.write(html); win.document.close();
}
function renderComboioTanques(){
  var cont=document.getElementById('comboioTanquesContainer');
  if(!cont) return;
  var admin=comboioIsAdmin();
  var lista=(DB.tanques||[]).slice().sort(function(a,b){ return _cbNorm(a.LOCAL_ABASTECIMENTO).localeCompare(_cbNorm(b.LOCAL_ABASTECIMENTO)); });
  var h='<div class="filters" style="margin-bottom:14px">';
  if(admin) h+='<button class="btn btn-primary btn-sm" onclick="openTanqueModal()">➕ Novo tanque</button>';
  else h+='<span style="font-size:12px;color:var(--text2)">Somente ADMIN pode cadastrar tanques.</span>';
  h+='</div>';
  h+='<div class="table-container"><div class="table-header"><h3>🛢️ Tanques cadastrados</h3><span class="chart-badge">'+lista.length+(lista.length===1?' tanque':' tanques')+'</span></div>';
  if(!lista.length){
    h+='<div style="padding:30px;text-align:center;color:var(--text2)">Nenhum tanque cadastrado.'+(admin?' Clique em “Novo tanque”.':'')+'</div></div>';
    cont.innerHTML=h; return;
  }
  h+='<div class="table-scroll"><table class="maq-table"><thead><tr><th>Posto / Local</th><th>Saldo inicial (L)</th><th>Nível mínimo (L)</th><th>Data início</th><th>Cadastro</th>'+(admin?'<th style="text-align:center">Ações</th>':'')+'</tr></thead><tbody>';
  lista.forEach(function(t){
    h+='<tr><td>'+_cbEsc(t.LOCAL_ABASTECIMENTO||'-')+'</td>'+
       '<td class="maq-mono">'+_cbNumBR(t.SALDO_INICIAL)+'</td>'+
       '<td class="maq-mono">'+_cbNumBR(t.NIVEL_MINIMO)+'</td>'+
       '<td class="maq-mono">'+_cbEsc(t.DATA_INICIO?formatDateBR(t.DATA_INICIO):'-')+'</td>'+
       '<td style="font-size:11px;color:var(--text2)">'+_cbAuditTxt(t)+'</td>';
    if(admin){
      h+='<td style="text-align:center;white-space:nowrap"><span class="maq-act" title="Editar" onclick="openTanqueModal(\''+t.ID+'\')">✏️</span> <span class="maq-act" title="Excluir" onclick="openTanqueDelete(\''+t.ID+'\')">🗑️</span></td>';
    }
    h+='</tr>';
  });
  h+='</tbody></table></div></div>';
  cont.innerHTML=h;
}

// ---------- TANQUES: cadastro (só ADMIN) ----------
var TANQUE_FIELDS = [
  {key:'LOCAL_ABASTECIMENTO', label:'Posto / Local de Abastecimento *', type:'selectPosto'},
  {key:'SALDO_INICIAL', label:'Saldo inicial (litros) *', type:'mask', maxInt:6, dec:2, ph:'0,00'},
  {key:'NIVEL_MINIMO', label:'Nível mínimo (litros) *', type:'mask', maxInt:6, dec:2, ph:'0,00'},
  {key:'DATA_INICIO', label:'Data início *', type:'date'},
  {key:'OBS', label:'Observação', type:'textarea'}
];
var _tanqueEditId=null, _tanqueDelId=null;

function findTanqueById(id){
  id=String(id);
  for(var i=0;i<(DB.tanques||[]).length;i++){ if(String(DB.tanques[i].ID)===id) return DB.tanques[i]; }
  return null;
}

function openTanqueModal(id){
  if(!comboioIsAdmin()){ showToast('Apenas ADMIN pode cadastrar/editar tanques',true); return; }
  _tanqueEditId=(id!==undefined&&id!==null&&id!=='')?String(id):null;
  var row=_tanqueEditId?findTanqueById(_tanqueEditId):{};
  if(_tanqueEditId&&!row){ showToast('Tanque não encontrado',true); return; }
  document.getElementById('tanqueModalTitle').textContent=_tanqueEditId?'✏️ Editar Tanque':'🛢️ Novo Tanque';
  var postos=(BASE.localAbast||[]);
  var html='';
  TANQUE_FIELDS.forEach(function(f){
    var val=(row&&row[f.key]!=null)?row[f.key]:'';
    var fid='tqf_'+f.key;
    html+='<div class="form-group"'+(f.type==='textarea'?' style="grid-column:1/-1"':'')+'><label>'+f.label+'</label>';
    if(f.type==='selectPosto'){
      html+='<select id="'+fid+'"><option value="">—</option>';
      postos.forEach(function(o){ html+='<option'+(_cbNorm(val)===_cbNorm(o)?' selected':'')+'>'+_cbEsc(o)+'</option>'; });
      html+='</select>';
    } else if(f.type==='textarea'){
      html+='<textarea id="'+fid+'" rows="2">'+_cbEsc(val)+'</textarea>';
    } else if(f.type==='mask'){
      html+='<input id="'+fid+'" type="text" inputmode="numeric" value="'+_cbToMask(val,f.dec)+'"'+(f.ph?' placeholder="'+f.ph+'"':'')+'>';
    } else {
      html+='<input id="'+fid+'" type="'+f.type+'" value="'+_cbEsc(val)+'"'+(f.step?' step="'+f.step+'"':'')+(f.ph?' placeholder="'+f.ph+'"':'')+'>';
    }
    html+='</div>';
  });
  document.getElementById('tanqueModalGrid').innerHTML=html;
  // Aplica máscara BR (1.000,50) nos campos numéricos, igual ao resto do sistema
  TANQUE_FIELDS.forEach(function(f){
    if(f.type==='mask'){ var el=document.getElementById('tqf_'+f.key); if(el) mascaraNumero(el, f.maxInt||6, f.dec||2); }
  });
  document.getElementById('tanqueModalOverlay').classList.add('show');
}
function closeTanqueModal(){ document.getElementById('tanqueModalOverlay').classList.remove('show'); _tanqueEditId=null; }

function salvarTanque(){
  if(!comboioIsAdmin()){ showToast('Sem permissão',true); return; }
  var row={};
  TANQUE_FIELDS.forEach(function(f){ var el=document.getElementById('tqf_'+f.key); row[f.key]=el?String(el.value).trim():''; });
  if(!row.LOCAL_ABASTECIMENTO){ showToast('Selecione o Posto / Local',true); return; }
  if(row.DATA_INICIO===''){ showToast('Informe a data de início',true); return; }
  if(row.SALDO_INICIAL==='') row.SALDO_INICIAL='0';
  if(row.NIVEL_MINIMO==='') row.NIVEL_MINIMO='0';
  // Um Posto = um tanque (o saldo é calculado por Posto)
  var dup=(DB.tanques||[]).some(function(t){ return _cbNorm(t.LOCAL_ABASTECIMENTO)===_cbNorm(row.LOCAL_ABASTECIMENTO) && String(t.ID)!==String(_tanqueEditId||''); });
  if(dup){ showToast('Já existe um tanque para esse Posto',true); return; }
  var btn=document.getElementById('tanqueSalvarBtn'); if(btn){ btn.disabled=true; btn.textContent='Salvando...'; }
  function done(ok,res){
    if(btn){ btn.disabled=false; btn.textContent='💾 Salvar'; }
    if(!ok){ showToast('❌ Erro ao salvar: '+((res&&res.error)||'desconhecido'),true); return; }
    showToast('✅ Tanque salvo!');
    closeTanqueModal();
    loadFromSheets(function(){ if(document.getElementById('pageComboio').classList.contains('active')) renderComboioTanques(); });
  }
  if(_tanqueEditId) saveToSheets('updateTanque',{id:_tanqueEditId,row:row},done);
  else { row.USUARIO=currentUserData?currentUserData.nome:''; saveToSheets('addTanque',row,done); }
}

function openTanqueDelete(id){
  if(!comboioIsAdmin()){ showToast('Apenas ADMIN pode excluir',true); return; }
  var t=findTanqueById(id); if(!t){ showToast('Tanque não encontrado',true); return; }
  _tanqueDelId=String(id);
  document.getElementById('tanqueDelDetails').innerHTML='<div><strong>Posto / Local:</strong> '+_cbEsc(t.LOCAL_ABASTECIMENTO||'-')+'</div><div><strong>Saldo inicial:</strong> '+_cbNumBR(t.SALDO_INICIAL)+' L</div><div style="margin-top:8px;color:var(--text2);font-size:12px">O tanque será removido permanentemente. As entradas e abastecimentos já lançados não são apagados.</div>';
  document.getElementById('tanqueDelOverlay').classList.add('show');
}
function closeTanqueDelete(){ document.getElementById('tanqueDelOverlay').classList.remove('show'); _tanqueDelId=null; }
function confirmTanqueDelete(){
  if(!_tanqueDelId){ return; }
  var btn=document.getElementById('tanqueDelBtn'); if(btn){ btn.disabled=true; btn.textContent='Excluindo...'; }
  saveToSheets('deleteTanque',{id:_tanqueDelId},function(ok,res){
    if(btn){ btn.disabled=false; btn.textContent='🗑️ Excluir'; }
    if(!ok){ showToast('❌ Erro ao excluir: '+((res&&res.error)||'desconhecido'),true); return; }
    showToast('✅ Tanque excluído');
    closeTanqueDelete();
    loadFromSheets(function(){ if(document.getElementById('pageComboio').classList.contains('active')) renderComboioTanques(); });
  });
}

