// ==================== MOTORISTAS ====================

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
  MOTORISTAS_DATA.forEach(function(r){
    var valCNH=r.VALIDADE_CNH||'';
    var vencida=false;
    if(valCNH){
      var hoje=new Date().toISOString().slice(0,10);
      vencida=valCNH<hoje;
    }
    var valStyle=vencida?'color:var(--red);font-weight:600':'';
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
    h+='<tr><td style="font-weight:500">'+(r.NOME||'-')+'</td><td style="font-family:JetBrains Mono,monospace;font-size:11px">'+(r.CPF||'-')+'</td><td style="font-family:JetBrains Mono,monospace;font-size:11px">'+(r.CNH||'-')+'</td><td style="font-family:JetBrains Mono,monospace;font-size:11px;'+valStyle+'">'+(valCNH?valCNH.split('-').reverse().join('/')+(vencida?' ⚠️ Vencida':''):'-')+'</td><td>'+statusCol+'</td>'+acoesCol+'</tr>';
  });
  h+='</tbody></table>';
  document.getElementById('tblMotoristasContainer').innerHTML=h;
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
