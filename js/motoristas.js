// ==================== MOTORISTAS ====================

// Quantos dias antes do vencimento a CNH já vira aviso. 60 = os "2 meses antes"
// pedidos: tempo de marcar exame e renovar sem o motorista parar de rodar.
var CNH_AVISO_DIAS=60;
function _motEsc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'); }
// Dias daqui até a validade (negativo = já venceu; null = sem data ou data estranha).
// Comparado em data local, sem hora, para não errar um dia por causa de fuso.
function _cnhDiasPara(validade){
  var s=String(validade||'').slice(0,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  var p=s.split('-');
  var alvo=new Date(Number(p[0]),Number(p[1])-1,Number(p[2]));
  var ag=new Date();
  var hoje=new Date(ag.getFullYear(),ag.getMonth(),ag.getDate());
  return Math.round((alvo-hoje)/86400000);
}
function _cnhDias(n){ return n+(n===1?' dia':' dias'); }
function _cnhDataBR(v){ return String(v||'').slice(0,10).split('-').reverse().join('/'); }

// Quem precisa de aviso, em duas listas já ordenadas por urgência. Uma função só,
// usada pelo bloco dentro da aba e pelo aviso na tela — a regra de quem entra no
// aviso não pode ser diferente nos dois lugares.
// Só motorista ATIVO: cobrar a CNH de quem já foi desligado é ruído.
function _cnhListas(){
  var vencidas=[], proximas=[];
  (MOTORISTAS_DATA||[]).forEach(function(r){
    if(motoristaInativo(r)) return;
    var d=_cnhDiasPara(r.VALIDADE_CNH);
    if(d===null) return; // sem validade cadastrada não dá para avisar nada
    var item={nome:r.NOME, dias:d, val:r.VALIDADE_CNH, cnh:r.CNH};
    if(d<0) vencidas.push(item);
    else if(d<=CNH_AVISO_DIAS) proximas.push(item);
  });
  vencidas.sort(function(a,b){ return a.dias-b.dias; });   // venceu há mais tempo primeiro
  proximas.sort(function(a,b){ return a.dias-b.dias; });   // vence mais cedo primeiro
  return {vencidas:vencidas, proximas:proximas};
}
function _cnhTxtVenc(x){ return 'venceu em '+_cnhDataBR(x.val)+' — há '+_cnhDias(Math.abs(x.dias)); }
function _cnhTxtProx(x){ return x.dias===0?('vence HOJE, '+_cnhDataBR(x.val)):('vence em '+_cnhDataBR(x.val)+' — faltam '+_cnhDias(x.dias)); }

// ---------- Aviso na tela, ao entrar no sistema ----------
// Mesmo comportamento do aviso de diesel baixo do Comboio: aparece no login, o OK
// esconde até o próximo login (não grava nada), e volta a aparecer enquanto houver
// CNH vencida ou a vencer. É o lembrete para cobrar o motorista antes de vencer.
var _cnhAlertDismissed=false;
function checkCnhAlert(){
  var ov=document.getElementById('cnhAlertOverlay');
  if(!ov) return;
  if(_cnhAlertDismissed){ ov.classList.remove('show'); return; }
  // Um aviso por vez: se o de diesel baixo está na tela, este espera o OK dele
  // (dismissComboioAlert chama de volta aqui) em vez de aparecer empilhado em cima.
  var cb=document.getElementById('comboioAlertOverlay');
  if(cb && cb.classList.contains('show')) return;
  var L=_cnhListas();
  if(!L.vencidas.length && !L.proximas.length){ ov.classList.remove('show'); return; }
  var qtd=L.vencidas.length+L.proximas.length;
  var h='<div style="font-size:38px;text-align:center;margin-bottom:6px">🪪</div>';
  h+='<h2 style="text-align:center;color:var(--'+(L.vencidas.length?'red':'yellow')+');margin-bottom:4px">CNH '+(L.vencidas.length?'vencida':'perto de vencer')+'</h2>';
  h+='<p style="text-align:center;color:var(--text2);font-size:13px;margin-bottom:14px">'+qtd+(qtd===1?' motorista precisa':' motoristas precisam')+' renovar a CNH:</p>';
  h+='<div style="display:flex;flex-direction:column;gap:8px;max-height:260px;overflow-y:auto">';
  function cartao(x,venc){
    var cor=venc?'var(--red)':'var(--yellow)';
    return '<div style="border:1px solid '+cor+';border-left:5px solid '+cor+';border-radius:10px;padding:10px 12px">'+
      '<div style="font-weight:700">'+(venc?'🔴':'🟡')+' '+_motEsc(x.nome||'-')+'</div>'+
      '<div style="font-size:12px;color:var(--text2)"><strong style="color:'+cor+'">'+(venc?_cnhTxtVenc(x):_cnhTxtProx(x))+'</strong>'+
      (x.cnh?(' · CNH '+_motEsc(x.cnh)):'')+'</div></div>';
  }
  L.vencidas.forEach(function(x){ h+=cartao(x,true); });
  L.proximas.forEach(function(x){ h+=cartao(x,false); });
  h+='</div>';
  document.getElementById('cnhAlertBody').innerHTML=h;
  ov.classList.add('show');
}
function dismissCnhAlert(){
  _cnhAlertDismissed=true;
  var ov=document.getElementById('cnhAlertOverlay'); if(ov) ov.classList.remove('show');
}

// ---------- Bloco dentro da aba Motoristas ----------
// Fica onde se resolve o problema (a ficha do motorista), e continua na tela depois
// de dar OK no aviso.
function renderCnhAvisos(){
  var el=document.getElementById('motCnhAviso'); if(!el) return;
  var L=_cnhListas(), vencidas=L.vencidas, proximas=L.proximas;
  if(!vencidas.length && !proximas.length){ el.innerHTML=''; el.style.display='none'; return; }
  function linha(x,venc){
    var txt=venc?_cnhTxtVenc(x):_cnhTxtProx(x);
    return '<div style="display:flex;gap:8px;align-items:baseline;padding:3px 0;font-size:13px">'+
      '<span>'+(venc?'🔴':'🟡')+'</span><span><strong>'+_motEsc(x.nome||'-')+'</strong> — '+txt+'</span></div>';
  }
  var cor=vencidas.length?'var(--red)':'var(--yellow)';
  var h='<div style="background:var(--surface);border:1px solid '+cor+';border-left:5px solid '+cor+';border-radius:10px;padding:12px 14px;margin-bottom:14px">';
  h+='<div style="font-weight:700;font-size:13px;margin-bottom:6px">🪪 CNH — atenção ao vencimento</div>';
  if(vencidas.length) h+='<div style="margin-bottom:'+(proximas.length?'8px':'0')+'"><div style="font-size:11px;color:var(--text2);text-transform:uppercase;letter-spacing:.06em">Vencida'+(vencidas.length>1?'s':'')+' ('+vencidas.length+')</div>'+vencidas.map(function(x){return linha(x,true);}).join('')+'</div>';
  if(proximas.length) h+='<div><div style="font-size:11px;color:var(--text2);text-transform:uppercase;letter-spacing:.06em">Vence'+(proximas.length>1?'m':'')+' nos próximos '+CNH_AVISO_DIAS+' dias ('+proximas.length+')</div>'+proximas.map(function(x){return linha(x,false);}).join('')+'</div>';
  h+='</div>';
  el.innerHTML=h;
  el.style.display='block';
}

function motoristaInativo(r){
  return !!(r && String(r.DATA_DESLIGAMENTO||'').trim());
}

// ---------- FILTRO ATIVOS/INATIVOS (central, usado pelas abas) ----------
// Cruza por NOME com a ficha MOTORISTAS. Sem ficha = ATIVO (fallback seguro: na dúvida, mostra).
function motoristaEstaInativo(nome){
  var alvo=String(nome||'').trim().toUpperCase();
  if(!alvo) return false;
  for(var i=0;i<(MOTORISTAS_DATA||[]).length;i++){
    if(String(MOTORISTAS_DATA[i].NOME||'').trim().toUpperCase()===alvo){
      return !!String(MOTORISTAS_DATA[i].DATA_DESLIGAMENTO||'').trim();
    }
  }
  return false; // sem ficha -> tratado como ativo
}
// modo: 'Ativos' (padrão) | 'Inativos' | 'Todos'
function motoristasFiltrados(lista, modo){
  lista=lista||[];
  if(modo==='Todos') return lista.slice();
  if(modo==='Inativos') return lista.filter(function(n){ return motoristaEstaInativo(n); });
  return lista.filter(function(n){ return !motoristaEstaInativo(n); }); // Ativos (default)
}
// monta o seletor de modo (via extraHtml do createFilters). stateVar = nome da variável global de estado.
function motoristaModoSelectHtml(stateVar, modoAtual, rebuildFn){
  function op(v,txt){ return '<option value="'+v+'"'+(modoAtual===v?' selected':'')+'>'+txt+'</option>'; }
  return '<span style="display:inline-flex;align-items:center;gap:4px;margin-left:4px">'+
    '<span style="font-size:11px;color:var(--text2,#6b7280)">👤</span>'+
    '<select class="filter-select" onchange="'+stateVar+'=this.value;'+rebuildFn+'()" title="Quais motoristas mostrar no filtro">'+
    op('Ativos','Ativos')+op('Inativos','Inativos')+op('Todos','Todos')+
    '</select></span>';
}

function renderMotoristasTable(){
  var isAdmin = (currentUserData && currentUserData.perfil === 'ADMIN');
  var syncBox=document.getElementById('motSyncBox'); if(syncBox) syncBox.style.display=isAdmin?'block':'none';
  var h='<table><thead><tr><th>Nome</th><th>CPF</th><th>CNH</th><th>Validade CNH</th><th>Status</th>'+(isAdmin?'<th>Ações</th>':'')+'</tr></thead><tbody>';
  var listaOrdenada=MOTORISTAS_DATA.slice().sort(function(a,b){
    return String(a.NOME||'').localeCompare(String(b.NOME||''),'pt-BR');
  });
  listaOrdenada.forEach(function(r){
    var valCNH=r.VALIDADE_CNH||'';
    var dias=_cnhDiasPara(valCNH);
    var vencida=(dias!==null && dias<0);
    var vencendo=(dias!==null && dias>=0 && dias<=CNH_AVISO_DIAS);
    var valStyle=vencida?'color:var(--red);font-weight:600':(vencendo?'color:var(--yellow);font-weight:600':'');
    // Selo na própria célula da validade, que é onde se olha a CNH.
    var selo=vencida
      ? ' ⚠️ Vencida há '+_cnhDias(Math.abs(dias))
      : (vencendo?(dias===0?' ⏳ Vence hoje':' ⏳ Vence em '+_cnhDias(dias)):'');
    var inativo=motoristaInativo(r);
    var dtDeslig=String(r.DATA_DESLIGAMENTO||'').trim();
    var statusCol=inativo
      ? '<span style="color:var(--red);font-weight:600">🔴 Inativo</span>'+(dtDeslig?'<br><span style="font-size:10px;color:var(--text2)">desde '+dtDeslig.split('-').reverse().join('/')+'</span>':'')
      : '<span style="color:var(--green);font-weight:600">🟢 Ativo</span>';
    var nomeEsc=(r.NOME||'').replace(/'/g,"\\'");
    var acoesCol='';
    if(isAdmin){
      acoesCol = inativo
        ? '<td><button class="btn btn-secondary" style="padding:4px 10px;font-size:11px" onclick="reativarMotorista(\''+nomeEsc+'\')">↩️ Reativar</button></td>'
        : '<td><button class="btn btn-secondary" style="padding:4px 10px;font-size:11px" onclick="desligarMotorista(\''+nomeEsc+'\')">🔴 Desligar</button></td>';
    }
    h+='<tr><td style="font-weight:500">'+(r.NOME||'-')+'</td><td style="font-family:JetBrains Mono,monospace;font-size:11px">'+(r.CPF||'-')+'</td><td style="font-family:JetBrains Mono,monospace;font-size:11px">'+(r.CNH||'-')+'</td><td style="font-family:JetBrains Mono,monospace;font-size:11px;'+valStyle+'">'+(valCNH?_cnhDataBR(valCNH)+selo:'-')+'</td><td>'+statusCol+'</td>'+acoesCol+'</tr>';
  });
  h+='</tbody></table>';
  document.getElementById('tblMotoristasContainer').innerHTML=h;
  renderCnhAvisos(); // junto com a tabela: todo caminho que redesenha uma redesenha o outro
}

function salvarMotorista(){
  var nome=document.getElementById('fmtNome').value.trim().toUpperCase();
  if(!nome){showToast('Nome é obrigatório!',true);return;}
  var rec={
    NOME:nome,
    CPF:document.getElementById('fmtCPF').value.trim(),
    CNH:document.getElementById('fmtCNH').value.trim(),
    VALIDADE_CNH:document.getElementById('fmtValidCNH').value,
    DATA_ADMISSAO:document.getElementById('fmtAdmissao').value,
    DATA_DESLIGAMENTO:''
  };
  MOTORISTAS_DATA.push(rec);
  if(!BASE.motoristas.includes(nome)){BASE.motoristas.push(nome);populateSelects();}
  saveToSheets('addMotorista', rec, function(ok){
    if(ok) showToast('✅ Motorista cadastrado! '+nome);
    else showToast('⚠️ Salvo local, falha na planilha',true);
  });
  renderMotoristasTable();
  limparFormMotorista();
}

function limparFormMotorista(){
  ['fmtNome','fmtCPF','fmtCNH','fmtValidCNH','fmtAdmissao'].forEach(function(id){var el=document.getElementById(id);if(el)el.value='';});
}

// ---------- Desligar / Reativar motorista (só ADMIN) ----------
function _acharMotoristaPorNome(nome){
  var alvo=String(nome||'').trim().toUpperCase();
  for(var i=0;i<MOTORISTAS_DATA.length;i++){
    if(String(MOTORISTAS_DATA[i].NOME||'').trim().toUpperCase()===alvo) return MOTORISTAS_DATA[i];
  }
  return null;
}

function desligarMotorista(nome){
  if(!currentUserData||currentUserData.perfil!=='ADMIN'){showToast('Apenas ADMIN pode desligar motoristas',true);return;}
  var rec=_acharMotoristaPorNome(nome);
  if(!rec){showToast('Motorista não encontrado na ficha. Cadastre-o em Motoristas antes de desligar.',true);return;}
  var hoje=new Date().toISOString().slice(0,10);
  var entrada=prompt('Data de desligamento de '+nome+' (AAAA-MM-DD):', hoje);
  if(entrada===null) return; // cancelou
  entrada=entrada.trim();
  if(!/^\d{4}-\d{2}-\d{2}$/.test(entrada)){showToast('Data inválida. Use o formato AAAA-MM-DD.',true);return;}
  rec.DATA_DESLIGAMENTO=entrada;
  saveToSheets('updateMotorista', {nome:nome, row:{DATA_DESLIGAMENTO:entrada}}, function(ok){
    if(ok) showToast('🔴 '+nome+' desligado em '+entrada.split('-').reverse().join('/'));
    else { rec.DATA_DESLIGAMENTO=''; showToast('⚠️ Falha ao salvar na planilha',true); }
    renderMotoristasTable();
  });
  renderMotoristasTable();
}

function reativarMotorista(nome){
  if(!currentUserData||currentUserData.perfil!=='ADMIN'){showToast('Apenas ADMIN pode reativar motoristas',true);return;}
  var rec=_acharMotoristaPorNome(nome);
  if(!rec){showToast('Motorista não encontrado na ficha.',true);return;}
  if(!confirm('Reativar '+nome+'? Ele voltará a aparecer como ATIVO.')) return;
  var anterior=rec.DATA_DESLIGAMENTO;
  rec.DATA_DESLIGAMENTO='';
  saveToSheets('updateMotorista', {nome:nome, row:{DATA_DESLIGAMENTO:''}}, function(ok){
    if(ok) showToast('↩️ '+nome+' reativado');
    else { rec.DATA_DESLIGAMENTO=anterior; showToast('⚠️ Falha ao salvar na planilha',true); }
    renderMotoristasTable();
  });
  renderMotoristasTable();
}

// ---------- Sincronizar: criar ficha p/ motoristas que estão na BASE DE DADOS mas não na aba MOTORISTAS ----------
// Só ADMIN. Cria só o NOME (CPF/CNH em branco, nasce ATIVO). Seguro de repetir (só cria quem falta).
// Usa o addMotorista existente (que já tem proteção anti-duplicata na BASE) — não mexe no Code.gs.
function sincronizarMotoristasDaBase(){
  if(!currentUserData||currentUserData.perfil!=='ADMIN'){showToast('Apenas ADMIN pode importar',true);return;}
  var info=document.getElementById('motSyncInfo');
  // conjunto de nomes que já têm ficha (normalizado)
  var temFicha={};
  (MOTORISTAS_DATA||[]).forEach(function(r){ var n=String(r.NOME||'').trim().toUpperCase(); if(n) temFicha[n]=1; });
  // nomes na BASE sem ficha
  var faltando=[];
  (BASE.motoristas||[]).forEach(function(nome){
    var n=String(nome||'').trim();
    if(!n) return;
    if(!temFicha[n.toUpperCase()]){ faltando.push(n); temFicha[n.toUpperCase()]=1; } // evita repetir no mesmo lote
  });

  if(!faltando.length){
    if(info) info.textContent='✅ Todos os motoristas da Base de Dados já têm ficha. Nada a importar.';
    showToast('Nada a importar — todos já têm ficha');
    return;
  }

  if(!confirm('Encontrados '+faltando.length+' motorista(s) na Base de Dados sem ficha.\nCriar a ficha deles agora? (só o nome, nascem ATIVOS)')) return;

  var btn=document.getElementById('motSyncBtn');
  if(btn){ btn.disabled=true; btn.textContent='Importando...'; }
  if(info) info.textContent='Importando '+faltando.length+' motorista(s)...';

  // Gravação EM FILA (um de cada vez, esperando confirmar) — evita perder gravações
  // quando o Apps Script recebe muitas chamadas em rajada.
  var total=faltando.length, idx=0, erros=0;
  function finalizar(){
    if(btn){ btn.disabled=false; btn.textContent='🔄 Importar motoristas da Base de Dados'; }
    var msg='✅ '+(total-erros)+' ficha(s) criada(s)'+(erros?(' • '+erros+' com falha — tente importar de novo'):'');
    if(info) info.textContent=msg;
    showToast(msg, erros>0);
    renderMotoristasTable();
  }
  function proximo(){
    if(idx>=total){ finalizar(); return; }
    var nome=faltando[idx];
    if(info) info.textContent='Importando '+(idx+1)+' de '+total+'... ('+nome+')';
    var rec={ NOME:nome.toUpperCase(), CPF:'', CNH:'', VALIDADE_CNH:'', DATA_ADMISSAO:'', DATA_DESLIGAMENTO:'' };
    saveToSheets('addMotorista', rec, function(ok){
      if(ok){ MOTORISTAS_DATA.push(rec); } // só adiciona local se realmente gravou
      else { erros++; }
      idx++;
      // pequena pausa entre gravações para não sobrecarregar o Apps Script
      setTimeout(proximo, 250);
    });
  }
  proximo();
}
