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
  openEditModal(key);
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
  DB.manutRealizada.push({PLACA:p,TIPO_MANUTENCAO:t,DATA_MANUTENCAO:d,KM_NA_MANUTENCAO:num(k),'OBSERVAÇÃO':n(document.getElementById('fmObs').value),'USUARIO':currentUserData?currentUserData.nome:currentUser,'DATA_REGISTRO':new Date().toLocaleString('pt-BR')});
  saveToSheets('addManutRealizada', {'PLACA':p,'TIPO_MANUTENCAO':t,'DATA MANUTENÇÃO':d,'KM':num(k),'OBSERVAÇÃO':n(document.getElementById('fmObs').value),'USUARIO':currentUserData?currentUserData.nome:currentUser,'DATA_REGISTRO':new Date().toLocaleString('pt-BR')}, function(ok) {
    if (ok) showToast('✅ Manutenção salva! '+p+' - '+t);
    else showToast('⚠️ Salvo local, falha na planilha', true);
  })
  limparFormManutReal();
  renderManutRealTable();
}

function limparFormManutReal(){
  ['fmPlaca','fmTipo'].forEach(function(id){document.getElementById(id).value=''});
  document.getElementById('fmKM').value='';
  document.getElementById('fmObs').value='';
  document.getElementById('fmData').value=new Date().toISOString().slice(0,10);
}

// ==================== RENDER TABLES ====================
function renderManutRealTable(){
  var data=DB.manutRealizada;
  var h='<table><thead><tr><th>Placa</th><th>Tipo</th><th>Data</th><th>KM</th><th>Observação</th></tr></thead><tbody>';
  data.forEach(function(r){
    h+='<tr><td>'+(r.PLACA||'-')+'</td><td>'+(r.TIPO_MANUTENCAO||'-')+'</td><td>'+formatDateBR(r.DATA_MANUTENCAO)+'</td><td>'+(r.KM_NA_MANUTENCAO?Number(r.KM_NA_MANUTENCAO).toLocaleString('pt-BR'):'-')+'</td><td>'+(r['OBSERVAÇÃO']||'-')+'</td></tr>';
  });
  h+='</tbody></table>';
  document.getElementById('tblManutRealContainer').innerHTML=h;
}

function renderManutProgTable(){
  var data=DB.manutProgramada;
  var h='<table><thead><tr><th>ID</th><th>Tipo</th><th>Intervalo KM</th><th>Alerta Urgente</th><th>Alerta Atenção</th></tr></thead><tbody>';
  data.forEach(function(r){
    h+='<tr><td>'+(r.ID||'-')+'</td><td>'+(r.TIPO_MANUTENCAO||'-')+'</td><td>'+(r.INTERVALO_KM?Number(r.INTERVALO_KM).toLocaleString('pt-BR'):'-')+'</td><td>'+(r.ALERTA_URGENTE?Number(r.ALERTA_URGENTE).toLocaleString('pt-BR'):'-')+'</td><td>'+(r['ALERTA ATENCAO']?Number(r['ALERTA ATENCAO']).toLocaleString('pt-BR'):'-')+'</td></tr>';
  });
  h+='</tbody></table>';
  document.getElementById('tblManutProgContainer').innerHTML=h;
}

function addManutProg(){
  var tipo=prompt('Nome do novo tipo de manutenção:');
  if(!tipo) return;
  var intervalo=prompt('Intervalo KM:');
  var urgente=prompt('Alerta Urgente (KM antes):');
  var atencao=prompt('Alerta Atenção (KM antes):');
  DB.manutProgramada.push({ID:DB.manutProgramada.length+1,TIPO_MANUTENCAO:tipo,INTERVALO_KM:num(intervalo),ALERTA_URGENTE:num(urgente),'ALERTA ATENCAO':num(atencao)});
  if(!BASE.tipoManut.includes(tipo)) BASE.tipoManut.push(tipo);
  renderManutProgTable();
  showToast('✅ Tipo de manutenção adicionado!');
}


// ==================== LOCAIS ====================
function renderLocaisTable(){
  var data = LOCAIS_DATA;
  var h='<table><thead><tr><th>Nome</th><th>Tipo</th><th>Unidade</th><th>Endereço</th><th>Município</th><th>Estado</th><th>Latitude</th><th>Longitude</th><th>Ações</th></tr></thead><tbody>';
  data.forEach(function(r){
    var tipo = r['TIPO'] || r.tipo || '-';
    var badge = '';
    if(tipo.toLowerCase()==='carga') badge='<span style="color:var(--green)">●</span> ';
    else if(tipo.toLowerCase()==='descarga') badge='<span style="color:var(--accent)">●</span> ';
    else if(tipo.toLowerCase()==='abastecimento') badge='<span style="color:var(--yellow)">●</span> ';
    else badge='<span style="color:var(--purple)">●</span> ';
    var unid=r['UNIDADE']||'-';
    var nomeAttr=String(r['NOME']||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'");
    h+='<tr><td>'+(r['NOME']||'-')+'</td><td>'+badge+(tipo)+'</td><td>'+unid+'</td><td>'+(r['ENDEREÇO']||r['ENDERECO']||'-')+'</td><td>'+(r['MUNICIPIO']||'-')+'</td><td>'+(r['ESTADO']||'-')+'</td><td>'+(r['LATITUDE']||'-')+'</td><td>'+(r['LONGITUDE']||'-')+'</td><td><button class="btn btn-sm btn-secondary" onclick="editLocal(\''+nomeAttr+'\')">✏️ Editar</button></td></tr>';
  });
  h+='</tbody></table>';
  document.getElementById('tblLocaisContainer').innerHTML=h;
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

