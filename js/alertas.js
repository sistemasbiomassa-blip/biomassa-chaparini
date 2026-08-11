// ============================================================
// ===== MÓDULO ALERTAS / LEMBRETES ==========================
// Lembrete livre disparado por data ou por km atingido numa placa.
// Fica "ativo" (aparece pra todo mundo) enquanto STATUS==='pendente' e a
// condição bate. O botão OK do banner só esconde pela sessão (sem
// persistência) — some de vez só quando o criador ou um ADMIN resolve
// (concluído / não concluído + motivo).
// ============================================================
var _alertasDismissed={};
var _alResolveId=null;
var _alertasBannerVisible=false;

// Beep curto (Web Audio API, sem arquivo de áudio) tocado quando o banner
// passa de escondido pra visível — silencioso se o navegador bloquear.
function _alTocarSom(){
  try{
    var Ctx=window.AudioContext||window.webkitAudioContext;
    var ctx=new Ctx();
    var now=ctx.currentTime;
    // Timbre de sininho: alguns harmônicos afinados como os de um sino real
    // (fundamental + parciais em ~2x/3x/4.2x), cada um com seu próprio decaimento.
    var fundamental=1318.5; // E6
    var parciais=[
      {mult:1,    ganho:0.30, decaimento:0.9},
      {mult:2.01, ganho:0.16, decaimento:0.7},
      {mult:3.0,  ganho:0.09, decaimento:0.5},
      {mult:4.2,  ganho:0.05, decaimento:0.35}
    ];
    parciais.forEach(function(p){
      var o=ctx.createOscillator(), g=ctx.createGain();
      o.type='sine';
      o.frequency.value=fundamental*p.mult;
      g.gain.setValueAtTime(0.0001,now);
      g.gain.exponentialRampToValueAtTime(p.ganho,now+0.006);
      g.gain.exponentialRampToValueAtTime(0.0001,now+p.decaimento);
      o.connect(g); g.connect(ctx.destination);
      o.start(now);
      o.stop(now+p.decaimento);
    });
  }catch(e){ /* autoplay bloqueado ou API indisponível — ignora */ }
}

function alertaIsAdmin(){ return !!(currentUserData && currentUserData.perfil==='ADMIN'); }
function alertaEhDono(r){ return !!(currentUserData && r._usuarioId===currentUser); }
function _alEsc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'); }
function findAlertaById(id){ id=String(id); for(var i=0;i<DB.alertas.length;i++){ if(String(DB.alertas[i].ID)===id) return DB.alertas[i]; } return null; }
function _alHojeISO(){ return new Date().toISOString().slice(0,10); }

function alertaEstaAtivo(a){
  if(!a || a.STATUS!=='pendente') return false;
  if(a.TIPO_GATILHO==='data'){
    if(!a.DATA_ALVO) return false;
    return String(a.DATA_ALVO).slice(0,10)<=_alHojeISO();
  }
  if(a.TIPO_GATILHO==='km'){
    var kmAtual=kmAtualPorPlaca(a.PLACA);
    return kmAtual!=null && kmAtual>=num(a.KM_ALVO);
  }
  return false;
}
function alertasAtivosList(){ return (DB.alertas||[]).filter(alertaEstaAtivo); }

// ---------- Banner global (aparece em qualquer aba) ----------
function renderAlertasBanner(){
  var cont=document.getElementById('alertasBannerContainer');
  if(!cont) return;
  var ativos=alertasAtivosList().filter(function(a){ return !_alertasDismissed[a.ID]; });
  if(!ativos.length){ cont.innerHTML=''; cont.style.display='none'; _alertasBannerVisible=false; return; }
  var h='';
  ativos.forEach(function(a){
    var gat=a.TIPO_GATILHO==='data'
      ? ('📅 alvo: '+formatDateBR(a.DATA_ALVO))
      : ('🚚 '+_alEsc(a.PLACA)+' atingiu '+fmt(num(a.KM_ALVO),0)+' km');
    h+='<div style="background:var(--surface);border:1px solid var(--red);border-left:5px solid var(--red);border-radius:10px;padding:12px 14px;box-shadow:0 4px 14px rgba(0,0,0,.25)">'+
       '<div style="font-weight:700;font-size:13px">🔔 '+_alEsc(a.DESCRICAO)+'</div>'+
       '<div style="font-size:12px;color:var(--text2);margin:4px 0 10px">'+gat+'</div>'+
       '<div style="text-align:right"><button class="btn btn-primary btn-sm" onclick="dismissAlertaBanner(\''+a.ID+'\')">OK</button></div>'+
       '</div>';
  });
  cont.innerHTML=h;
  cont.style.display='flex';
  if(!_alertasBannerVisible) _alTocarSom();
  _alertasBannerVisible=true;
}
function dismissAlertaBanner(id){
  _alertasDismissed[id]=true;
  renderAlertasBanner();
}

// ---------- Página Alertas ----------
function buildAlertas(){ renderAlertasTable(); }

function renderAlertasTable(){
  var contAtivos=document.getElementById('alertasAtivosContainer');
  var contTodos=document.getElementById('alertasTodosContainer');
  if(!contAtivos||!contTodos) return;

  var ativos=alertasAtivosList();
  if(!ativos.length){
    contAtivos.innerHTML='<div style="padding:20px;text-align:center;color:var(--text2)">Nenhum alerta ativo no momento.</div>';
  } else {
    var h='';
    ativos.forEach(function(a){ h+=_alCard(a); });
    contAtivos.innerHTML=h;
  }

  var todos=(DB.alertas||[]).slice().sort(function(a,b){ return String(b.CRIADO_EM||'').localeCompare(String(a.CRIADO_EM||'')); });
  if(!todos.length){ contTodos.innerHTML='<div style="padding:20px;text-align:center;color:var(--text2)">Nenhum alerta cadastrado.</div>'; return; }
  var h2='<table class="maq-table"><thead><tr><th>Descrição</th><th>Gatilho</th><th>Status</th><th>Criado por</th><th style="text-align:center">Ações</th></tr></thead><tbody>';
  todos.forEach(function(a){
    var gat=a.TIPO_GATILHO==='data'
      ? ('📅 '+formatDateBR(a.DATA_ALVO))
      : ('🚚 '+_alEsc(a.PLACA)+' @ '+fmt(num(a.KM_ALVO),0)+' km');
    var canResolve=(a.STATUS==='pendente') && (alertaEhDono(a)||alertaIsAdmin());
    var acts=canResolve
      ? '<span class="maq-act" title="Resolver" onclick="abrirResolverAlertaModal(\''+a.ID+'\')">✅</span>'
      : '<span style="color:var(--text2)">—</span>';
    h2+='<tr><td>'+_alEsc(a.DESCRICAO)+'</td><td>'+gat+'</td><td>'+_alStatusChip(a)+'</td><td>'+_alEsc(a.USUARIO||'-')+'</td><td style="text-align:center">'+acts+'</td></tr>';
  });
  h2+='</tbody></table>';
  contTodos.innerHTML=h2;
}

function _alStatusChip(a){
  if(a.STATUS==='concluido') return '<span class="maq-chip maq-chip-g">Concluído</span>';
  if(a.STATUS==='nao_concluido') return '<span class="maq-chip maq-chip-y" title="'+_alEsc(a.MOTIVO||'')+'">Não concluído</span>';
  return '<span class="maq-chip maq-chip-gray">Pendente</span>';
}

function _alCard(a){
  var gat=a.TIPO_GATILHO==='data'
    ? ('Data alvo: '+formatDateBR(a.DATA_ALVO))
    : ('Placa '+_alEsc(a.PLACA)+' · KM alvo: '+fmt(num(a.KM_ALVO),0));
  var canResolve=alertaEhDono(a)||alertaIsAdmin();
  return '<div style="border:1px solid var(--red);border-left:5px solid var(--red);border-radius:10px;padding:12px 14px;margin-bottom:10px">'+
    '<div style="font-weight:700">🔔 '+_alEsc(a.DESCRICAO)+'</div>'+
    '<div style="font-size:12px;color:var(--text2);margin:4px 0 8px">'+gat+' · criado por '+_alEsc(a.USUARIO||'-')+'</div>'+
    (canResolve?'<button class="btn btn-secondary btn-sm" onclick="abrirResolverAlertaModal(\''+a.ID+'\')">✅ Resolver</button>':'')+
    '</div>';
}

// ---------- Modal: Novo Alerta ----------
function _alBuildNovoForm(){
  var po='<option value="">—</option>';
  (BASE.placas||[]).forEach(function(p){ po+='<option>'+_alEsc(p)+'</option>'; });
  return ''+
    '<div class="form-group" style="grid-column:1/-1"><label>Descrição *</label><textarea id="al_desc" rows="3" placeholder="ex: Trocar pastilha de freio"></textarea></div>'+
    '<div class="form-group" style="grid-column:1/-1"><label>Disparar por *</label>'+
      '<div style="display:flex;gap:16px;margin-top:4px">'+
        '<label style="display:flex;align-items:center;gap:6px;font-weight:400;text-transform:none;letter-spacing:normal"><input type="radio" name="al_tipo" value="data" checked onchange="_alToggleTipo()"> Data</label>'+
        '<label style="display:flex;align-items:center;gap:6px;font-weight:400;text-transform:none;letter-spacing:normal"><input type="radio" name="al_tipo" value="km" onchange="_alToggleTipo()"> KM de uma placa</label>'+
      '</div>'+
    '</div>'+
    '<div class="form-group" id="al_dataGrp"><label>Data alvo *</label><input id="al_data" type="date"></div>'+
    '<div class="form-group" id="al_placaGrp" style="display:none"><label>Placa *</label><select id="al_placa">'+po+'</select></div>'+
    '<div class="form-group" id="al_kmGrp" style="display:none"><label>KM alvo *</label><input id="al_km" type="number" step="1" placeholder="ex: 250000"></div>';
}
function _alToggleTipo(){
  var tipo=document.querySelector('input[name="al_tipo"]:checked').value;
  document.getElementById('al_dataGrp').style.display=tipo==='data'?'':'none';
  document.getElementById('al_placaGrp').style.display=tipo==='km'?'':'none';
  document.getElementById('al_kmGrp').style.display=tipo==='km'?'':'none';
}
function openNovoAlertaModal(){
  document.getElementById('alModalGrid').innerHTML=_alBuildNovoForm();
  document.getElementById('alModalOverlay').classList.add('show');
}
function closeNovoAlertaModal(){ document.getElementById('alModalOverlay').classList.remove('show'); }
function salvarAlerta(){
  var desc=document.getElementById('al_desc').value.trim();
  if(!desc){ showToast('Descreva o alerta',true); return; }
  var tipo=document.querySelector('input[name="al_tipo"]:checked').value;
  var row={DESCRICAO:desc, TIPO_GATILHO:tipo};
  if(tipo==='data'){
    var d=document.getElementById('al_data').value;
    if(!d){ showToast('Informe a data alvo',true); return; }
    row.DATA_ALVO=d;
  } else {
    var placa=document.getElementById('al_placa').value;
    var km=document.getElementById('al_km').value;
    if(!placa){ showToast('Selecione a placa',true); return; }
    if(!km){ showToast('Informe o KM alvo',true); return; }
    row.PLACA=placa;
    row.KM_ALVO=num(km);
  }
  var btn=document.getElementById('alSalvarBtn'); if(btn){ btn.disabled=true; btn.textContent='Salvando...'; }
  saveToSheets('addAlerta', row, function(ok,res){
    if(btn){ btn.disabled=false; btn.textContent='💾 Salvar'; }
    if(!ok){ showToast('❌ Erro: '+((res&&res.error)||'desconhecido'),true); return; }
    showToast('✅ Alerta criado!');
    closeNovoAlertaModal();
    loadFromSheets(function(){
      renderAlertasBanner();
      if(document.getElementById('pageAlertas').classList.contains('active')) renderAlertasTable();
    });
  });
}

// ---------- Modal: Resolver Alerta ----------
function _alBuildResolverForm(){
  return ''+
    '<div class="form-group" style="grid-column:1/-1"><label>Resultado *</label>'+
      '<div style="display:flex;gap:16px;margin-top:4px">'+
        '<label style="display:flex;align-items:center;gap:6px;font-weight:400;text-transform:none;letter-spacing:normal"><input type="radio" name="al_resultado" value="concluido" checked onchange="_alToggleMotivo()"> Concluído</label>'+
        '<label style="display:flex;align-items:center;gap:6px;font-weight:400;text-transform:none;letter-spacing:normal"><input type="radio" name="al_resultado" value="nao_concluido" onchange="_alToggleMotivo()"> Não concluído</label>'+
      '</div>'+
    '</div>'+
    '<div class="form-group" id="al_motivoGrp" style="display:none;grid-column:1/-1"><label>Motivo *</label><textarea id="al_motivo" rows="2" placeholder="Por que não foi concluído?"></textarea></div>';
}
function _alToggleMotivo(){
  var v=document.querySelector('input[name="al_resultado"]:checked').value;
  document.getElementById('al_motivoGrp').style.display=v==='nao_concluido'?'':'none';
}
function abrirResolverAlertaModal(id){
  var r=findAlertaById(id);
  if(!r){ showToast('Alerta não encontrado',true); return; }
  if(!(alertaEhDono(r)||alertaIsAdmin())){ showToast('❌ Só quem criou o alerta ou um ADMIN pode resolvê-lo',true); return; }
  _alResolveId=String(id);
  document.getElementById('alResolverDesc').textContent=r.DESCRICAO;
  document.getElementById('alResolverGrid').innerHTML=_alBuildResolverForm();
  document.getElementById('alResolverOverlay').classList.add('show');
}
function closeResolverAlertaModal(){ document.getElementById('alResolverOverlay').classList.remove('show'); _alResolveId=null; }
function confirmarResolverAlerta(){
  if(!_alResolveId) return;
  var v=document.querySelector('input[name="al_resultado"]:checked').value;
  var row={status:v, resolvido_em:new Date().toISOString()};
  if(v==='nao_concluido'){
    var motivo=document.getElementById('al_motivo').value.trim();
    if(!motivo){ showToast('Descreva o motivo',true); return; }
    row.motivo_nao_concluido=motivo;
  } else {
    row.motivo_nao_concluido=null;
  }
  var btn=document.getElementById('alResolverBtn'); if(btn){ btn.disabled=true; btn.textContent='Salvando...'; }
  saveToSheets('updateAlerta', {id:_alResolveId, row:row}, function(ok,res){
    if(btn){ btn.disabled=false; btn.textContent='💾 Salvar'; }
    if(!ok){ showToast('❌ Erro: '+((res&&res.error)||'desconhecido'),true); return; }
    showToast('✅ Alerta resolvido!');
    closeResolverAlertaModal();
    loadFromSheets(function(){
      renderAlertasBanner();
      if(document.getElementById('pageAlertas').classList.contains('active')) renderAlertasTable();
    });
  });
}
// ===== FIM MÓDULO ALERTAS =====
