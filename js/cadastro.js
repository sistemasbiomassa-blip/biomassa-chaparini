// ==================== FORM CALCS ====================
function updateUnidade(){
  var c=document.getElementById('fLocalDescarga').value;
  document.getElementById('unidadeLabel').textContent='('+getUnit(c)+')';
  // Limpar quantidade e reaplicar máscara conforme TON ou M³
  var fQ=document.getElementById('fQuantidade');
  if(fQ) fQ.value='';
  aplicarMascaraQuantidade();
}

function calcTempoFloresta(){
  var c=document.getElementById('fChegFloresta').value;
  var s=document.getElementById('fSaidaFloresta').value;
  var d=timeDiff(c,s);
  document.getElementById('fTempoFloresta').value=d!=null?minToHHMM(d):'';
}

function calcTempoCliente(){
  var c=document.getElementById('fChegCliente').value;
  var s=document.getElementById('fSaidaCliente').value;
  var d=timeDiff(c,s);
  document.getElementById('fTempoCliente').value=d!=null?minToHHMM(d):'';
}

function calcValorTotal(){
  var l=num(document.getElementById('fLitros').value);
  var v=num(document.getElementById('fValorUnit').value);
  document.getElementById('fValorTotal').value=l&&v?fmtR(l*v):'';
}

// Ao escolher o Local Abastecimento no CADASTRO, preenche o Valor Unitário
// com o último preço de compra registrado no tanque daquele posto (Comboio).
// Igual ao comportamento da aba Maquinários (_maqAbPrecoAuto). Editável.
function _cadAbPrecoAuto(){
  var sel=document.getElementById('fLocalAbast'), pre=document.getElementById('fValorUnit');
  if(!sel||!pre||typeof _cbUltimoPrecoTanque!=='function') return;
  var preco=_cbUltimoPrecoTanque(sel.value);
  if(preco!=null){ pre.value=fmt(preco,2); calcValorTotal(); }
}

// ==================== DUPLICIDADE PLACA + DATA ====================
var _dupCadastroDismissKey=null;
var _dupCadastroPendingKey=null;

function _normPlacaCad(p){ return String(p||'').toUpperCase().replace(/\s+/g,''); }

function checkDuplicadoCadastro(){
  var placa=document.getElementById('fPlaca').value;
  var dt=document.getElementById('fData').value;
  if(!placa||!dt) return;
  var key=_normPlacaCad(placa)+'|'+dt;
  if(_dupCadastroDismissKey===key) return;
  var matches=DB.cadastro.filter(function(r){
    return _normPlacaCad(r.PLACA)===_normPlacaCad(placa) && r.DATA===dt;
  });
  if(!matches.length) return;
  _dupCadastroPendingKey=key;
  var html='';
  matches.forEach(function(r){
    var resumo=[];
    if(r['CHEGADA FLORESTA']) resumo.push('Cheg. Floresta '+r['CHEGADA FLORESTA']);
    if(r['SAIDA FLORESTA']) resumo.push('Saída Floresta '+r['SAIDA FLORESTA']);
    if(r['CHEGADA CLIENTE']) resumo.push('Cheg. Cliente '+r['CHEGADA CLIENTE']);
    if(r['SAIDA CLIENTE']) resumo.push('Saída Cliente '+r['SAIDA CLIENTE']);
    if(r['QUANTIDADE']) resumo.push('Qtd '+fmt(r['QUANTIDADE']));
    html+='<div style="border:1px solid var(--border);border-radius:8px;padding:10px;display:flex;justify-content:space-between;align-items:center;gap:10px">';
    html+='<div style="font-size:12px;line-height:1.5"><strong>'+(r.MOTORISTA||'-')+'</strong><br>'+(resumo.length?resumo.join(' • '):'sem horários preenchidos')+'</div>';
    html+='<button class="btn btn-primary btn-sm" onclick="dupCadastroComplementar(\''+rowKeyAttr(r)+'\')">Complementar</button>';
    html+='</div>';
  });
  document.getElementById('dupCadastroList').innerHTML=html;
  document.getElementById('dupCadastroOverlay').classList.add('show');
}

function closeDupCadastroModal(){
  document.getElementById('dupCadastroOverlay').classList.remove('show');
}

function dupCadastroNovaViagem(){
  _dupCadastroDismissKey=_dupCadastroPendingKey;
  closeDupCadastroModal();
}

function dupCadastroComplementar(key){
  closeDupCadastroModal();
  limparFormCadastro();
  openEditModal(key, true);
}

// ==================== SAVE ====================
function salvarCadastro(){
  var mot=document.getElementById('fMotorista').value;
  var dt=document.getElementById('fData').value;
  var placa=document.getElementById('fPlaca').value;
  if(!mot||!dt){showToast('Motorista e Data são obrigatórios!',true);return;}
  if(!placa){showToast('Placa é obrigatória!',true);return;}
  var rec={
    'MOTORISTA':mot,'DATA':dt,
    'SITUAÇÃO':n(document.getElementById('fSituacao').value),
    'ENTREGA':n(document.getElementById('fEntrega').value)?num(document.getElementById('fEntrega').value):null,
    'LOCAL CARGA':n(document.getElementById('fLocalCarga').value),
    'LOCAL DESCARGA':n(document.getElementById('fLocalDescarga').value),
    'NOTA':n(document.getElementById('fNota').value)?num(document.getElementById('fNota').value):null,
    'QUANTIDADE':n(document.getElementById('fQuantidade').value)?num(document.getElementById('fQuantidade').value):null,
    'PLACA':n(document.getElementById('fPlaca').value),
    'CHEGADA FLORESTA':n(document.getElementById('fChegFloresta').value),
    'SAIDA FLORESTA':n(document.getElementById('fSaidaFloresta').value),
    'CHEGADA CLIENTE':n(document.getElementById('fChegCliente').value),
    'SAIDA CLIENTE':n(document.getElementById('fSaidaCliente').value),
    'LOCAL ABASTECIMENTO':n(document.getElementById('fLocalAbast').value),
    'KM':n(document.getElementById('fKM').value)?num(document.getElementById('fKM').value):null,
    'QTDADE LITROS':n(document.getElementById('fLitros').value)?num(document.getElementById('fLitros').value):null,
    'VALOR UNITARIO':n(document.getElementById('fValorUnit').value)?num(document.getElementById('fValorUnit').value):null,
    'VALOR TOTAL':null,
    'ARLA VALOR':n(document.getElementById('fArla').value)?num(document.getElementById('fArla').value):null,
    'CLASSE DESPESA':n(document.getElementById('fClasseDesp').value),
    'DESCR. DESPESA':n(document.getElementById('fDescrDesp').value),
    'LOCAL DESPESA':n(document.getElementById('fLocalDesp').value),
    'VALOR DESPESA':n(document.getElementById('fValorDesp').value)?num(document.getElementById('fValorDesp').value):null,
    'OBSERVAÇÃO':n(document.getElementById('fObs').value),
    'USUARIO':currentUserData?currentUserData.nome:currentUser,
    'DATA_REGISTRO':new Date().toLocaleString('pt-BR')
  };
  if(rec['QTDADE LITROS']&&rec['VALOR UNITARIO']) rec['VALOR TOTAL']=rec['QTDADE LITROS']*rec['VALOR UNITARIO'];

  // ── Validação KM + Litros ──────────────────────────────────────────────
  var kmVal = rec['KM'];
  var litVal = rec['QTDADE LITROS'];
  // Regra 3: KM e Litros obrigatórios juntos
  if(kmVal && !litVal){ showToast('⚠️ Se informar KM, informe também Qtde Litros!', true); return; }
  if(litVal && !kmVal){ showToast('⚠️ Se informar Litros, informe também o KM!', true); return; }
  // Regras 1 e 2: validar KM contra histórico do mês atual, respeitando a ORDEM DAS DATAS
  // (permite lançar abastecimento retroativo com KM menor que lançamentos futuros já existentes)
  if(kmVal && rec['PLACA']){
    var mesAtual = dt.substring(0,7); // YYYY-MM
    var registrosMes = DB.cadastro.filter(function(r){
      return _normPlacaCad(r.PLACA) === _normPlacaCad(rec['PLACA']) &&
             r.KM && num(r.KM) > 0 &&
             r.DATA && r.DATA.substring(0,7) === mesAtual;
    });
    var anteriores = registrosMes.filter(function(r){ return r.DATA <= dt; }).map(function(r){ return num(r.KM); });
    var posteriores = registrosMes.filter(function(r){ return r.DATA > dt; });
    if(anteriores.length > 0){
      var ultimoKM = Math.max.apply(null, anteriores);
      if(kmVal <= ultimoKM){
        showToast('⚠️ KM inválido! O último KM desta placa até esta data é ' + numBR(ultimoKM,2) + '. Informe um valor maior.', true);
        return;
      }
      if(kmVal > ultimoKM + 2500){
        showToast('⚠️ KM inválido! O valor ' + numBR(kmVal,2) + ' ultrapassa o limite de 2.500 km acima do último registrado até esta data (' + numBR(ultimoKM,2) + ').', true);
        return;
      }
    }
    if(posteriores.length > 0){
      var proximoKM = Math.min.apply(null, posteriores.map(function(r){ return num(r.KM); }));
      if(kmVal >= proximoKM){
        var proximoReg = posteriores.filter(function(r){ return num(r.KM) === proximoKM; })[0];
        showToast('⚠️ KM inválido! Já existe um lançamento posterior (' + formatDateBR(proximoReg.DATA) + ') com KM ' + numBR(proximoKM,2) + '. Informe um valor menor.', true);
        return;
      }
    }
  }
  // ────────────────────────────────────────────────────────────────────────

  // ── Validação: Nota Fiscal duplicada (global, só quando preenchida) ────
  if(rec['NOTA']){
    var notaDuplicada = DB.cadastro.some(function(r){ return r['NOTA'] && num(r['NOTA'])===rec['NOTA']; });
    if(notaDuplicada){
      showToast('⚠️ Nota Fiscal ' + rec['NOTA'] + ' já cadastrada! Verifique o número informado.', true);
      return;
    }
  }
  // ────────────────────────────────────────────────────────────────────────

  DB.cadastro.push(rec);
  saveToSheets('addCadastro', rec, function(ok, res) {
    if (ok) {
      // Sincroniza o ID real gerado pelo banco (sem isso, editar o lançamento
      // antes de recarregar a página falha por falta de ID)
      var salvo = res && res[0];
      if (salvo) { rec.ID = salvo.id; rec.DATA_REGISTRO = salvo.data_registro ? String(salvo.data_registro).slice(0,10) : rec.DATA_REGISTRO; }
      showToast('✅ Salvo na planilha! '+mot+' - '+dt);
    } else {
      // Insert falhou de verdade (não é só a planilha antiga) — remove da lista local pra não ficar um registro fantasma
      var idx = DB.cadastro.indexOf(rec);
      if (idx >= 0) DB.cadastro.splice(idx, 1);
      showToast('❌ Falha ao salvar: '+((res&&res.error)||'erro desconhecido'), true);
    }
  })
  limparFormCadastro();
}

function limparFormCadastro(){
  ['fMotorista','fSituacao','fLocalCarga','fLocalDescarga','fPlaca','fLocalAbast','fClasseDesp'].forEach(function(id){document.getElementById(id).value=''});
  ['fEntrega','fNota','fQuantidade','fKM','fLitros','fValorUnit','fArla','fValorDesp'].forEach(function(id){document.getElementById(id).value=''});
  ['fChegFloresta','fSaidaFloresta','fChegCliente','fSaidaCliente'].forEach(function(id){document.getElementById(id).value=''});
  ['fTempoFloresta','fTempoCliente','fValorTotal'].forEach(function(id){document.getElementById(id).value=''});
  ['fDescrDesp','fLocalDesp','fObs'].forEach(function(id){document.getElementById(id).value=''});
  document.getElementById('fData').value=new Date().toISOString().slice(0,10);
  document.getElementById('unidadeLabel').textContent='(TON)';
}

function salvarManutRealizada(){
  var p=document.getElementById('fmPlaca').value;
  var t=document.getElementById('fmTipo').value;
  var d=document.getElementById('fmData').value;
  var k=document.getElementById('fmKM').value;
  if(!p||!t||!d||!k){showToast('Todos os campos com * são obrigatórios!',true);return;}
  var valor=num(document.getElementById('fmValor').value);
  var localServico=n(document.getElementById('fmLocalServico').value);
  var notaFiscal=n(document.getElementById('fmNotaFiscal').value);
  var obs=n(document.getElementById('fmObs').value);
  var mostraDiagrama=document.getElementById('fmPneuWrap').style.display!=='none';
  var itensPneu=mostraDiagrama?coletarItensPneu('fmPneuDiagram'):[];
  saveToSheets('addManutRealizada', {'PLACA':p,'TIPO_MANUTENCAO':t,'DATA MANUTENÇÃO':d,'KM':num(k),'OBSERVAÇÃO':obs,VALOR:valor||null,LOCAL_SERVICO:localServico||null,NOTA_FISCAL:notaFiscal||null,'USUARIO':currentUserData?currentUserData.nome:currentUser,'DATA_REGISTRO':new Date().toLocaleString('pt-BR')}, function(ok,res) {
    if(!ok){ showToast('❌ Erro ao salvar: '+((res&&res.error)||'desconhecido'),true); return; }
    var novoId=res&&res[0]&&res[0].id;
    function finalizar(){
      showToast('✅ Manutenção salva! '+p+' - '+t);
      limparFormManutReal();
      loadFromSheets(function(){ renderManutRealTable(); if(document.getElementById('pageManutencao').classList.contains('active')) buildManutencao(); });
    }
    if(itensPneu.length && novoId){
      itensPneu.forEach(function(it){ it.manut_realizada_id=novoId; });
      saveToSheets('addManutPneuItens',{itens:itensPneu},function(ok2,res2){
        if(!ok2) showToast('⚠️ Manutenção salva, mas falha ao salvar as posições de pneu: '+((res2&&res2.error)||'desconhecido'),true);
        finalizar();
      });
    } else {
      finalizar();
    }
  })
}

function limparFormManutReal(){
  ['fmPlaca','fmTipo'].forEach(function(id){document.getElementById(id).value=''});
  ['fmKM','fmValor','fmLocalServico','fmNotaFiscal'].forEach(function(id){document.getElementById(id).value=''});
  document.getElementById('fmObs').value='';
  document.getElementById('fmData').value=new Date().toISOString().slice(0,10);
  _atualizarDiagramaPneuForm();
}

// Mostra/esconde o diagrama de eixos conforme o tipo de manutenção selecionado
// (CONTROLA_PNEUS) e o Tipo de Veículo cadastrado na placa escolhida.
function _atualizarDiagramaPneuForm(){
  var placaEl=document.getElementById('fmPlaca'), tipoEl=document.getElementById('fmTipo');
  var wrap=document.getElementById('fmPneuWrap'), aviso=document.getElementById('fmPneuAviso');
  if(!placaEl||!tipoEl||!wrap||!aviso) return;
  var placa=placaEl.value, tipoNome=tipoEl.value;
  var tipoProg=DB.manutProgramada.filter(function(p){return p.TIPO_MANUTENCAO===tipoNome})[0];
  if(!tipoProg||!tipoProg.CONTROLA_PNEUS||!placa){ wrap.style.display='none'; aviso.style.display='none'; return; }
  var cam=CAMINHOES_DATA.filter(function(c){return c.PLACA===placa})[0];
  var tipoVeiculo=cam?cam.TIPO_VEICULO:null;
  if(!tipoVeiculo){ wrap.style.display='none'; aviso.style.display=''; return; }
  aviso.style.display='none';
  wrap.style.display='';
  renderDiagramaEixos('fmPneuDiagram',tipoVeiculo,[]);
}

// ==================== RENDER TABLES ====================
function renderManutRealTable(){
  var data=DB.manutRealizada;
  var h='<table><thead><tr><th>Placa</th><th>Tipo</th><th>Data</th><th>KM</th><th>Valor</th><th>Local do Serviço</th><th>Nota Fiscal</th><th>Observação</th></tr></thead><tbody>';
  data.forEach(function(r){
    h+='<tr><td>'+(r.PLACA||'-')+'</td><td>'+(r.TIPO_MANUTENCAO||'-')+'</td><td>'+formatDateBR(r.DATA_MANUTENCAO)+'</td><td>'+(r.KM_NA_MANUTENCAO?Number(r.KM_NA_MANUTENCAO).toLocaleString('pt-BR'):'-')+'</td><td>'+(r.VALOR?'R$'+numBR(r.VALOR,2):'-')+'</td><td>'+(r.LOCAL_SERVICO||'-')+'</td><td>'+(r.NOTA_FISCAL||'-')+'</td><td>'+(r['OBSERVAÇÃO']||'-')+'</td></tr>';
  });
  h+='</tbody></table>';
  document.getElementById('tblManutRealContainer').innerHTML=h;
}

function findManutProgById(id){
  id=String(id);
  for(var i=0;i<DB.manutProgramada.length;i++){ if(String(DB.manutProgramada[i].ID)===id) return DB.manutProgramada[i]; }
  return null;
}

function renderManutProgTable(){
  var data=DB.manutProgramada;
  var isAdmin=currentUserData&&currentUserData.perfil==='ADMIN';
  var h='<table><thead><tr><th>Tipo</th><th>Intervalo KM</th><th>Alerta Urgente</th><th>Alerta Atenção</th><th>Pneus</th>'+(isAdmin?'<th style="text-align:center">Ações</th>':'')+'</tr></thead><tbody>';
  data.forEach(function(r){
    var acts=isAdmin?'<td style="text-align:center;white-space:nowrap"><span class="maq-act" title="Editar" onclick="openManutProgModal(\''+r.ID+'\')">✏️</span> <span class="maq-act" title="Excluir" onclick="openManutProgDelete(\''+r.ID+'\')">🗑️</span></td>':'';
    h+='<tr><td>'+(r.TIPO_MANUTENCAO||'-')+'</td><td>'+(r.INTERVALO_KM?Number(r.INTERVALO_KM).toLocaleString('pt-BR'):'<span style="color:var(--text2)">— sem controle —</span>')+'</td><td>'+(r.ALERTA_URGENTE?Number(r.ALERTA_URGENTE).toLocaleString('pt-BR'):'-')+'</td><td>'+(r['ALERTA ATENCAO']?Number(r['ALERTA ATENCAO']).toLocaleString('pt-BR'):'-')+'</td><td>'+(r.CONTROLA_PNEUS?'🛞 sim':'<span style="color:var(--text2)">não</span>')+'</td>'+acts+'</tr>';
  });
  h+='</tbody></table>';
  document.getElementById('tblManutProgContainer').innerHTML=h;
}

var _manutProgEditId=null, _manutProgDelId=null;
function _manutProgBuildForm(row){
  row=row||{};
  return ''+
    '<div class="form-group" style="grid-column:1/-1"><label>Nome do Tipo *</label><input id="mp_nome" type="text" value="'+(row.TIPO_MANUTENCAO?String(row.TIPO_MANUTENCAO).replace(/"/g,'&quot;'):'')+'" placeholder="ex: Troca de Óleo Motor"></div>'+
    '<div class="form-group"><label>Intervalo KM</label><input id="mp_intervalo" type="number" step="1" value="'+(row.INTERVALO_KM!=null&&row.INTERVALO_KM!==''?num(row.INTERVALO_KM):'')+'"></div>'+
    '<div class="form-group"><label>Alerta Urgente (KM antes)</label><input id="mp_urgente" type="number" step="1" value="'+(row.ALERTA_URGENTE!=null&&row.ALERTA_URGENTE!==''?num(row.ALERTA_URGENTE):'')+'"></div>'+
    '<div class="form-group"><label>Alerta Atenção (KM antes)</label><input id="mp_atencao" type="number" step="1" value="'+(row['ALERTA ATENCAO']!=null&&row['ALERTA ATENCAO']!==''?num(row['ALERTA ATENCAO']):'')+'"></div>'+
    '<div class="form-group" style="grid-column:1/-1"><label style="display:flex;align-items:center;gap:7px;text-transform:none;font-weight:400;letter-spacing:normal"><input type="checkbox" id="mp_controlaPneus" style="width:auto"'+(row.CONTROLA_PNEUS?' checked':'')+'> 🛞 Controla pneus por posição (mostra o diagrama de eixos ao lançar este tipo)</label></div>';
}
function openManutProgModal(id){
  if(!currentUserData||currentUserData.perfil!=='ADMIN'){showToast('Apenas ADMIN pode gerenciar tipos de manutenção',true);return;}
  _manutProgEditId=(id!==undefined&&id!==null&&id!=='')?String(id):null;
  var row=_manutProgEditId?findManutProgById(_manutProgEditId):{};
  if(_manutProgEditId&&!row){showToast('Tipo não encontrado',true);return;}
  document.getElementById('manutProgModalTitle').textContent=_manutProgEditId?'✏️ Editar Tipo de Manutenção':'🔧 Novo Tipo de Manutenção';
  document.getElementById('manutProgModalGrid').innerHTML=_manutProgBuildForm(row);
  document.getElementById('manutProgModalOverlay').classList.add('show');
}
function closeManutProgModal(){ document.getElementById('manutProgModalOverlay').classList.remove('show'); _manutProgEditId=null; }
function salvarManutProg(){
  var nome=document.getElementById('mp_nome').value.trim();
  if(!nome){showToast('Informe o nome do tipo',true);return;}
  var intervalo=document.getElementById('mp_intervalo').value;
  var urgente=document.getElementById('mp_urgente').value;
  var atencao=document.getElementById('mp_atencao').value;
  var controlaPneus=document.getElementById('mp_controlaPneus').checked;
  var row={'TIPO MANUTENÇÃO':nome,'INTERVALO KM':intervalo?num(intervalo):'','ALERTA URGENTE':urgente?num(urgente):'','ALERTA ATENCAO':atencao?num(atencao):'',CONTROLA_PNEUS:controlaPneus};
  var btn=document.getElementById('manutProgSalvarBtn'); if(btn){btn.disabled=true;btn.textContent='Salvando...';}
  function done(ok,res){
    if(btn){btn.disabled=false;btn.textContent='💾 Salvar';}
    if(!ok){showToast('❌ Erro: '+((res&&res.error)||'desconhecido'),true);return;}
    showToast('✅ Tipo de manutenção salvo!');
    closeManutProgModal();
    loadFromSheets(function(){ renderManutProgTable(); refreshSelectOptions('fmTipo',BASE.tipoManut); if(typeof buildManutencao==='function'&&document.getElementById('pageManutencao').classList.contains('active')) buildManutencao(); });
  }
  if(_manutProgEditId){
    var rowU={TIPO_MANUTENCAO:nome,INTERVALO_KM:intervalo?num(intervalo):null,ALERTA_URGENTE:urgente?num(urgente):null,ALERTA_ATENCAO:atencao?num(atencao):null,CONTROLA_PNEUS:controlaPneus};
    saveToSheets('updateManutP',{id:_manutProgEditId,row:rowU},done);
  } else {
    saveToSheets('addManutProgramada',row,done);
  }
}
function openManutProgDelete(id){
  if(!currentUserData||currentUserData.perfil!=='ADMIN'){showToast('Apenas ADMIN pode excluir',true);return;}
  var r=findManutProgById(id); if(!r){showToast('Tipo não encontrado',true);return;}
  _manutProgDelId=String(id);
  document.getElementById('manutProgDelDetails').innerHTML='<div><strong>Tipo:</strong> '+(r.TIPO_MANUTENCAO||'-')+'</div>';
  document.getElementById('manutProgDelOverlay').classList.add('show');
}
function closeManutProgDelete(){ document.getElementById('manutProgDelOverlay').classList.remove('show'); _manutProgDelId=null; }
function confirmManutProgDelete(){
  if(!_manutProgDelId) return;
  var btn=document.getElementById('manutProgDelBtn'); if(btn){btn.disabled=true;btn.textContent='Excluindo...';}
  saveToSheets('deleteManutP',{id:_manutProgDelId},function(ok,res){
    if(btn){btn.disabled=false;btn.textContent='🗑️ Excluir';}
    if(!ok){showToast('❌ Erro: '+((res&&res.error)||'desconhecido — verifique se o tipo não está em uso'),true);return;}
    showToast('✅ Tipo excluído');
    closeManutProgDelete();
    loadFromSheets(function(){ renderManutProgTable(); refreshSelectOptions('fmTipo',BASE.tipoManut); });
  });
}


// ==================== LOCAIS ====================
// ---------- FILTRO ATIVOS/INATIVOS (mesmo padrão de motoristasFiltrados) ----------
// Local "sai de uso" (ex: cliente cuja unidade mudou de TON pra M³) sem apagar o
// histórico: fica inativo, some das listas de seleção pra lançamento novo, mas
// segue existindo normalmente pra tudo que já foi lançado com ele.
function localEstaInativo(nome){
  var alvo=String(nome||'').trim().toUpperCase();
  if(!alvo) return false;
  for(var i=0;i<(LOCAIS_DATA||[]).length;i++){
    if(String(LOCAIS_DATA[i].NOME||'').trim().toUpperCase()===alvo){
      return LOCAIS_DATA[i].ATIVO===false;
    }
  }
  return false; // sem ficha -> tratado como ativo
}
// modo: 'Ativos' (padrão) | 'Inativos' | 'Todos'
function locaisFiltrados(lista,modo){
  lista=lista||[];
  if(modo==='Todos') return lista.slice();
  if(modo==='Inativos') return lista.filter(function(n){ return localEstaInativo(n); });
  return lista.filter(function(n){ return !localEstaInativo(n); }); // Ativos (default)
}

function renderLocaisTable(){
  var isAdmin=(currentUserData && currentUserData.perfil==='ADMIN');
  var data = LOCAIS_DATA;
  var h='<table><thead><tr><th>Nome</th><th>Tipo</th><th>Unidade</th><th>Endereço</th><th>Município</th><th>Estado</th><th>Latitude</th><th>Longitude</th><th>Status</th><th>Ações</th></tr></thead><tbody>';
  data.forEach(function(r){
    var tipo = r['TIPO'] || r.tipo || '-';
    var badge = '';
    if(tipo.toLowerCase()==='carga') badge='<span style="color:var(--green)">●</span> ';
    else if(tipo.toLowerCase()==='descarga') badge='<span style="color:var(--accent)">●</span> ';
    else if(tipo.toLowerCase()==='abastecimento') badge='<span style="color:var(--yellow)">●</span> ';
    else badge='<span style="color:var(--purple)">●</span> ';
    var unid=r['UNIDADE']||'-';
    var nomeAttr=String(r['NOME']||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'");
    var inativo=r.ATIVO===false;
    var statusCol=inativo?'<span style="color:var(--red);font-weight:600">🔴 Inativo</span>':'<span style="color:var(--green);font-weight:600">🟢 Ativo</span>';
    var acoesCol='<button class="btn btn-sm btn-secondary" onclick="editLocal(\''+nomeAttr+'\')">✏️ Editar</button>';
    if(isAdmin){
      acoesCol+=inativo
        ? ' <button class="btn btn-sm btn-secondary" onclick="reativarLocal(\''+nomeAttr+'\')">↩️ Reativar</button>'
        : ' <button class="btn btn-sm btn-secondary" onclick="inativarLocal(\''+nomeAttr+'\')">🔴 Inativar</button>';
    }
    h+='<tr><td>'+(r['NOME']||'-')+'</td><td>'+badge+(tipo)+'</td><td>'+unid+'</td><td>'+(r['ENDEREÇO']||r['ENDERECO']||'-')+'</td><td>'+(r['MUNICIPIO']||'-')+'</td><td>'+(r['ESTADO']||'-')+'</td><td>'+(r['LATITUDE']||'-')+'</td><td>'+(r['LONGITUDE']||'-')+'</td><td>'+statusCol+'</td><td style="white-space:nowrap">'+acoesCol+'</td></tr>';
  });
  h+='</tbody></table>';
  document.getElementById('tblLocaisContainer').innerHTML=h;
}

function _acharLocalPorNome(nome){
  var alvo=String(nome||'').trim().toUpperCase();
  for(var i=0;i<LOCAIS_DATA.length;i++){
    if(String(LOCAIS_DATA[i].NOME||'').trim().toUpperCase()===alvo) return LOCAIS_DATA[i];
  }
  return null;
}
function inativarLocal(nome){
  if(!currentUserData||currentUserData.perfil!=='ADMIN'){showToast('Apenas ADMIN pode inativar locais',true);return;}
  var rec=_acharLocalPorNome(nome);
  if(!rec){showToast('Local não encontrado',true);return;}
  if(!confirm('Inativar "'+nome+'"? Ele some das listas de seleção pra lançamento novo, mas o histórico continua intacto.')) return;
  rec.ATIVO=false;
  saveToSheets('updateLocal',{nomeOriginal:nome,row:{ATIVO:false}},function(ok){
    if(ok) showToast('🔴 '+nome+' inativado');
    else { rec.ATIVO=true; showToast('⚠️ Falha ao salvar na planilha',true); }
    renderLocaisTable();
  });
  renderLocaisTable();
}
function reativarLocal(nome){
  if(!currentUserData||currentUserData.perfil!=='ADMIN'){showToast('Apenas ADMIN pode reativar locais',true);return;}
  var rec=_acharLocalPorNome(nome);
  if(!rec){showToast('Local não encontrado',true);return;}
  rec.ATIVO=true;
  saveToSheets('updateLocal',{nomeOriginal:nome,row:{ATIVO:true}},function(ok){
    if(ok) showToast('↩️ '+nome+' reativado');
    else { rec.ATIVO=false; showToast('⚠️ Falha ao salvar na planilha',true); }
    renderLocaisTable();
  });
  renderLocaisTable();
}

var _editandoLocalNome=null;

function editLocal(nome){
  var rec=LOCAIS_DATA.filter(function(r){ return r['NOME']===nome; })[0];
  if(!rec){showToast('Local não encontrado',true);return;}
  _editandoLocalNome=nome;
  document.getElementById('flNome').value=rec['NOME']||'';
  document.getElementById('flTipo').value=(rec['TIPO']||'').toLowerCase();
  document.getElementById('flUnidade').value=rec['UNIDADE']||'';
  document.getElementById('flEndereco').value=rec['ENDEREÇO']||rec['ENDERECO']||'';
  document.getElementById('flMunicipio').value=rec['MUNICIPIO']||'';
  document.getElementById('flEstado').value=rec['ESTADO']||'';
  document.getElementById('flLat').value=rec['LATITUDE']||'';
  document.getElementById('flLng').value=rec['LONGITUDE']||'';
  document.getElementById('btnSalvarLocal').textContent='💾 ATUALIZAR LOCAL';
  document.getElementById('flNome').scrollIntoView({behavior:'smooth',block:'center'});
}

function salvarLocal(){
  var nome = document.getElementById('flNome').value.trim().toUpperCase();
  var tipo = document.getElementById('flTipo').value;
  if(!nome||!tipo){showToast('Nome e Tipo são obrigatórios!',true);return;}
  var rec = {
    'NOME': nome,
    'TIPO': tipo,
    'UNIDADE': document.getElementById('flUnidade').value||'',
    'ENDEREÇO': n(document.getElementById('flEndereco').value),
    'MUNICIPIO': n(document.getElementById('flMunicipio').value),
    'ESTADO': n(document.getElementById('flEstado').value),
    'LATITUDE': n(document.getElementById('flLat').value) ? num(document.getElementById('flLat').value) : null,
    'LONGITUDE': n(document.getElementById('flLng').value) ? num(document.getElementById('flLng').value) : null
  };

  if(_editandoLocalNome){
    var nomeOriginal=_editandoLocalNome;
    var idx=LOCAIS_DATA.findIndex(function(r){ return r['NOME']===nomeOriginal; });
    if(idx<0){showToast('Local não encontrado',true);return;}
    LOCAIS_DATA[idx]=rec;
    if(rec['LATITUDE'] && rec['LONGITUDE']){
      LOCAIS_COORDS[nome]={lat:rec['LATITUDE'],lng:rec['LONGITUDE'],tipo:tipo};
    }
    if(nomeOriginal!==nome) delete LOCAIS_COORDS[nomeOriginal];
    var posM3=BASE.clientesM3.indexOf(nomeOriginal);
    if(posM3>=0) BASE.clientesM3.splice(posM3,1);
    if(rec['UNIDADE']==='M3' && !BASE.clientesM3.includes(nome)){BASE.clientesM3.push(nome);}
    saveToSheets('updateLocal', {nomeOriginal:nomeOriginal, row:rec}, function(ok){
      if(ok) showToast('✅ Local atualizado na planilha! '+nome);
      else showToast('⚠️ Atualizado local, falha na planilha',true);
    });
    renderLocaisTable();
    limparFormLocal();
    return;
  }

  LOCAIS_DATA.push(rec);
  if(rec['LATITUDE'] && rec['LONGITUDE']){
    LOCAIS_COORDS[nome]={lat:rec['LATITUDE'],lng:rec['LONGITUDE'],tipo:tipo};
  }
  if(tipo==='carga' && !BASE.localCarga.includes(nome)){BASE.localCarga.push(nome);populateSelects();}
  if(tipo==='descarga' && !BASE.localDescarga.includes(nome)){BASE.localDescarga.push(nome);populateSelects();}
  if(tipo==='abastecimento' && !BASE.localAbast.includes(nome)){BASE.localAbast.push(nome);populateSelects();}
  if(rec['UNIDADE']==='M3' && !BASE.clientesM3.includes(nome)){BASE.clientesM3.push(nome);}
  saveToSheets('addLocal', rec, function(ok){
    if(ok) showToast('✅ Local salvo na planilha! '+nome);
    else showToast('⚠️ Salvo local, falha na planilha',true);
  });
  renderLocaisTable();
  limparFormLocal();
}

function limparFormLocal(){
  ['flNome','flEndereco','flMunicipio','flEstado','flLat','flLng'].forEach(function(id){document.getElementById(id).value='';});
  document.getElementById('flTipo').value='';
  document.getElementById('flUnidade').value='';
  _editandoLocalNome=null;
  document.getElementById('btnSalvarLocal').textContent='💾 SALVAR LOCAL';
}

