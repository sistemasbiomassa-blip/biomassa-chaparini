// ============================================================
// ===== MÓDULO MAQUINÁRIOS (Fase 3 - parte 1: Máquinas) ======
// Aditivo. Comunicação via loadFromSheets / saveToSheets.
// Cadastro de máquina = ação de ADMIN (lista visível a todos).
// ============================================================
var MAQ_TIPOS = ['Harvester','Forwarder','Skidder','Trator','Escavadeira','Caminhão Florestal','Carregadeira','Feller Florestal','Picador Florestal','Apoio Florestal','Outro'];
var MAQ_METRICAS = ['HORIMETRO','KM','AMBOS'];
var MAQ_STATUS = ['Ativa','Manutenção','Inativa'];
var MAQ_FIELDS = [
  {key:'IDENTIFICACAO', label:'Identificação *', type:'text', ph:'ex: Harvester 01'},
  {key:'TIPO', label:'Tipo *', type:'select', opts:MAQ_TIPOS},
  {key:'MARCA', label:'Marca', type:'text'},
  {key:'MODELO', label:'Modelo', type:'text'},
  {key:'ANO', label:'Ano', type:'number'},
  {key:'SERIE_PATRIMONIO', label:'Série / Patrimônio', type:'text'},
  {key:'METRICA', label:'Métrica *', type:'select', opts:MAQ_METRICAS},
  {key:'STATUS', label:'Status', type:'select', opts:MAQ_STATUS},
  {key:'OBS', label:'Observação', type:'textarea'}
];
var _maqEditId = null;
var _maqDelId = null;

function maqIsAdmin(){ return !!(currentUserData && currentUserData.perfil==='ADMIN'); }
function findMaqById(id){
  id=String(id);
  for(var i=0;i<DB.maquinas.length;i++){ if(String(DB.maquinas[i].ID)===id) return DB.maquinas[i]; }
  return null;
}
function _maqEsc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'); }
function _maqAuditTxt(row){
  if(!row) return '';
  return 'Lançado por <strong>'+_maqEsc(row.USUARIO||'-')+'</strong> em '+_maqEsc(row.DATA_REGISTRO?formatDateBR(row.DATA_REGISTRO):'-');
}

function buildMaquinarios(){
  var ft=document.getElementById('maqFiltroTipo');
  if(ft && ft.options.length<=1){ MAQ_TIPOS.forEach(function(t){ var o=document.createElement('option'); o.textContent=t; ft.appendChild(o); }); }
  var ff=document.getElementById('maqFiltroFloresta');
  if(ff && ff.options.length<=1){ (BASE.localCarga||[]).forEach(function(fl){ var o=document.createElement('option'); o.textContent=fl; ff.appendChild(o); }); }
  renderMaquinasTable();
}

function renderMaquinasTable(){
  var cont=document.getElementById('maqTableContainer');
  if(!cont) return;
  var admin=maqIsAdmin();
  var addBtn=document.getElementById('maqAddBtn');
  if(addBtn) addBtn.style.display = admin ? 'inline-flex' : 'none';
  var fTipo=(document.getElementById('maqFiltroTipo')||{}).value||'';
  var fStatus=(document.getElementById('maqFiltroStatus')||{}).value||'';
  var fFloresta=(document.getElementById('maqFiltroFloresta')||{}).value||'';
  var lista=DB.maquinas.filter(function(m){
    if(fTipo && (m.TIPO||'')!==fTipo) return false;
    if(fStatus && (m.STATUS||'')!==fStatus) return false;
    if(fFloresta && maqFlorestaAtual(m.ID)!==fFloresta) return false;
    return true;
  });
  document.getElementById('maqCount').textContent=lista.length+(lista.length===1?' máquina':' máquinas');
  if(!lista.length){
    cont.innerHTML='<div style="padding:30px;text-align:center;color:var(--text2)">Nenhuma máquina'+((fTipo||fStatus)?' no filtro.':' cadastrada.'+(admin?' Clique em “Nova máquina”.':''))+'</div>';
    return;
  }
  function chip(s){ var c=s==='Ativa'?'maq-chip-g':(s==='Manutenção'?'maq-chip-y':'maq-chip-gray'); return '<span class="maq-chip '+c+'">'+_maqEsc(s||'-')+'</span>'; }
  var h='<table class="maq-table"><thead><tr><th>Identificação</th><th>Tipo</th><th>Marca / Modelo</th><th>Ano</th><th>Métrica</th><th>Status</th><th>Floresta atual</th>'+(admin?'<th style="text-align:center">Ações</th>':'')+'</tr></thead><tbody>';
  lista.forEach(function(m){
    var mm=[(m.MARCA||''),(m.MODELO||'')].filter(Boolean).join(' ');
    h+='<tr><td>'+_maqEsc(m.IDENTIFICACAO||'-')+'</td><td>'+_maqEsc(m.TIPO||'-')+'</td><td>'+_maqEsc(mm||'-')+'</td><td class="maq-mono">'+_maqEsc(m.ANO||'-')+'</td><td>'+_maqEsc(m.METRICA||'-')+'</td><td>'+chip(m.STATUS)+'</td><td>'+_maqEsc(maqFlorestaAtual(m.ID)||'—')+'</td>';
    if(admin){
      h+='<td style="text-align:center;white-space:nowrap"><span class="maq-act" title="Editar" onclick="openMaqModal(\''+m.ID+'\')">✏️</span> <span class="maq-act" title="Excluir" onclick="openMaqDelete(\''+m.ID+'\')">🗑️</span></td>';
    }
    h+='</tr>';
  });
  h+='</tbody></table>';
  cont.innerHTML=h;
}

function openMaqModal(id){
  if(!maqIsAdmin()){ showToast('Apenas ADMIN pode cadastrar/editar máquinas',true); return; }
  _maqEditId=(id!==undefined&&id!==null&&id!=='')?String(id):null;
  var row=_maqEditId?findMaqById(_maqEditId):{};
  if(_maqEditId&&!row){ showToast('Máquina não encontrada',true); return; }
  document.getElementById('maqModalTitle').textContent=_maqEditId?'✏️ Editar Máquina':'🚜 Nova Máquina';
  var html='';
  MAQ_FIELDS.forEach(function(f){
    var val=(row&&row[f.key]!=null)?row[f.key]:'';
    var fid='maqf_'+f.key;
    html+='<div class="form-group"'+(f.type==='textarea'?' style="grid-column:1/-1"':'')+'><label>'+f.label+'</label>';
    if(f.type==='select'){
      html+='<select id="'+fid+'"><option value="">—</option>';
      f.opts.forEach(function(o){ html+='<option'+(String(val)===o?' selected':'')+'>'+o+'</option>'; });
      html+='</select>';
    } else if(f.type==='textarea'){
      html+='<textarea id="'+fid+'" rows="2">'+_maqEsc(val)+'</textarea>';
    } else {
      html+='<input id="'+fid+'" type="'+f.type+'" value="'+_maqEsc(val)+'"'+(f.ph?' placeholder="'+f.ph+'"':'')+'>';
    }
    html+='</div>';
  });
  document.getElementById('maqModalGrid').innerHTML=html;
  document.getElementById('maqModalOverlay').classList.add('show');
}
function closeMaqModal(){ document.getElementById('maqModalOverlay').classList.remove('show'); _maqEditId=null; }

function salvarMaquina(){
  if(!maqIsAdmin()){ showToast('Sem permissão',true); return; }
  var row={};
  MAQ_FIELDS.forEach(function(f){ var el=document.getElementById('maqf_'+f.key); row[f.key]=el?String(el.value).trim():''; });
  if(!row.IDENTIFICACAO){ showToast('Informe a identificação',true); return; }
  if(!row.TIPO){ showToast('Selecione o tipo',true); return; }
  if(!row.METRICA){ showToast('Selecione a métrica',true); return; }
  var btn=document.getElementById('maqSalvarBtn'); if(btn){ btn.disabled=true; btn.textContent='Salvando...'; }
  function done(ok,res){
    if(btn){ btn.disabled=false; btn.textContent='💾 Salvar'; }
    if(!ok){ showToast('❌ Erro ao salvar: '+((res&&res.error)||'desconhecido'),true); return; }
    showToast('✅ Máquina salva!');
    closeMaqModal();
    loadFromSheets(function(){ if(document.getElementById('pageMaquinarios').classList.contains('active')) renderMaquinasTable(); });
  }
  if(_maqEditId) saveToSheets('updateMaquina',{id:_maqEditId,row:row},done);
  else saveToSheets('addMaquina',row,done);
}

function openMaqDelete(id){
  if(!maqIsAdmin()){ showToast('Apenas ADMIN pode excluir',true); return; }
  var m=findMaqById(id); if(!m){ showToast('Máquina não encontrada',true); return; }
  _maqDelId=String(id);
  document.getElementById('maqDelDetails').innerHTML='<div><strong>Identificação:</strong> '+_maqEsc(m.IDENTIFICACAO||'-')+'</div><div><strong>Tipo:</strong> '+_maqEsc(m.TIPO||'-')+'</div><div style="margin-top:8px;color:var(--text2);font-size:12px">A máquina será removida permanentemente da planilha.</div>';
  document.getElementById('maqDelOverlay').classList.add('show');
}
function closeMaqDelete(){ document.getElementById('maqDelOverlay').classList.remove('show'); _maqDelId=null; }
function confirmMaqDelete(){
  if(!_maqDelId){ return; }
  var btn=document.getElementById('maqDelBtn'); if(btn){ btn.disabled=true; btn.textContent='Excluindo...'; }
  saveToSheets('deleteMaquina',{id:_maqDelId},function(ok,res){
    if(btn){ btn.disabled=false; btn.textContent='🗑️ Excluir'; }
    if(!ok){ showToast('❌ Erro ao excluir: '+((res&&res.error)||'desconhecido'),true); return; }
    showToast('✅ Máquina excluída');
    closeMaqDelete();
    loadFromSheets(function(){ if(document.getElementById('pageMaquinarios').classList.contains('active')) renderMaquinasTable(); });
  });
}
function exportMaquinasPDF(){
  var fTipo=(document.getElementById('maqFiltroTipo')||{}).value||'';
  var fStatus=(document.getElementById('maqFiltroStatus')||{}).value||'';
  var fFloresta=(document.getElementById('maqFiltroFloresta')||{}).value||'';
  var lista=DB.maquinas.filter(function(m){
    if(fTipo && (m.TIPO||'')!==fTipo) return false;
    if(fStatus && (m.STATUS||'')!==fStatus) return false;
    if(fFloresta && maqFlorestaAtual(m.ID)!==fFloresta) return false;
    return true;
  }).sort(function(a,b){ return String(a.IDENTIFICACAO||'').localeCompare(String(b.IDENTIFICACAO||'')); });
  var extra=[]; if(fTipo) extra.push('Tipo: '+fTipo); if(fStatus) extra.push('Status: '+fStatus); if(fFloresta) extra.push('Floresta: '+fFloresta);
  var logoEl=document.querySelector('.sidebar-logo img'); var logoSrc=logoEl?logoEl.src:'';
  var win=window.open('','_blank');
  var html='<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Lista de Maquinários</title><style>';
  html+='*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;padding:14px;color:#222;font-size:10px}';
  html+='.rep-head{display:flex;align-items:center;gap:14px;border-bottom:2px solid #0D692C;padding-bottom:10px;margin-bottom:10px}';
  html+='.rep-head img{width:54px;height:54px;border-radius:8px;object-fit:cover}.rep-head h1{font-size:18px;color:#085425;line-height:1.1}';
  html+='.rep-head .sub{font-size:11px;color:#444;margin-top:2px}.rep-head .gen{font-size:9px;color:#888;margin-top:3px}';
  html+='table{width:100%;border-collapse:collapse;margin-top:4px}th,td{border:1px solid #ccc;padding:4px 6px;font-size:9px;text-align:left}';
  html+='th{background:#0D692C;color:#fff;text-transform:uppercase;font-size:8.5px}tbody tr:nth-child(even){background:#f4f8fb}';
  html+='.foot{margin-top:10px;font-size:9px;color:#666;text-align:center}@page{size:landscape;margin:8mm}</style></head><body>';
  html+='<div class="rep-head">'+(logoSrc?'<img src="'+logoSrc+'">':'')+'<div><h1>BIOMASSA CHAPARINI</h1><div class="sub">Lista de Maquinários</div>'+(extra.length?'<div class="sub"><b>Filtros:</b> '+extra.join(' · ')+'</div>':'')+'<div class="gen">Gerado em '+new Date().toLocaleString('pt-BR')+'</div></div></div>';
  if(!lista.length){ html+='<p style="padding:20px;text-align:center;color:#888">Nenhuma máquina para os filtros aplicados.</p>'; }
  else {
    html+='<table><thead><tr><th>Identificação</th><th>Tipo</th><th>Marca</th><th>Modelo</th><th>Ano</th><th>Série / Patrimônio</th><th>Métrica</th><th>Status</th><th>Floresta atual</th></tr></thead><tbody>';
    lista.forEach(function(m){ html+='<tr><td>'+(m.IDENTIFICACAO||'-')+'</td><td>'+(m.TIPO||'-')+'</td><td>'+(m.MARCA||'-')+'</td><td>'+(m.MODELO||'-')+'</td><td>'+(m.ANO||'-')+'</td><td>'+(m.SERIE_PATRIMONIO||'-')+'</td><td>'+(m.METRICA||'-')+'</td><td>'+(m.STATUS||'-')+'</td><td>'+(maqFlorestaAtual(m.ID)||'—')+'</td></tr>'; });
    html+='</tbody></table><div class="foot">'+lista.length+' máquina(s)</div>';
  }
  html+='<script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script></body></html>';
  win.document.write(html); win.document.close();
}
// ===== FIM MÓDULO MAQUINÁRIOS (parte 1) =====

