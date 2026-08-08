// ==================== SUPABASE: helpers genéricos ====================
// Busca todas as linhas de uma tabela, paginando (a API do Supabase limita
// ~1000 linhas por resposta por padrão — CADASTRO e FREQUENCIA passam disso).
function sbFetchAll(table, selectStr){
  var PAGE=1000, from=0, all=[];
  function passo(){
    return sb.from(table).select(selectStr||'*').range(from, from+PAGE-1).then(function(res){
      if(res.error) return Promise.reject(res.error);
      all=all.concat(res.data||[]);
      if((res.data||[]).length<PAGE) return all;
      from+=PAGE;
      return passo();
    });
  }
  return passo();
}
// remove chaves com valor '' (vira null) e nunca envia colunas calculadas pelo banco
var _CAMPOS_CALCULADOS={valor_total:1, custo_total:1};
function _limparPayload(o){
  var out={};
  Object.keys(o||{}).forEach(function(k){
    if(_CAMPOS_CALCULADOS[k]) return;
    var v=o[k];
    out[k]=(v===''||v===undefined)?null:v;
  });
  return out;
}
// converte um objeto com chaves tipo "ID_MAQUINA","OBS","LITROS" pra snake_case (já bate 1:1 com as colunas)
function _lowerKeys(row){
  var out={};
  Object.keys(row||{}).forEach(function(k){ out[k.toLowerCase()]=row[k]; });
  return _limparPayload(out);
}
// CADASTRO tem headers com acento/espaço que não viram snake_case só com toLowerCase()
var _CADASTRO_KEYMAP={
  'MOTORISTA':'motorista','DATA':'data','SITUAÇÃO':'situacao','ENTREGA':'entrega','PLACA':'placa',
  'LOCAL CARGA':'local_carga','LOCAL DESCARGA':'local_descarga','NOTA':'nota','QUANTIDADE':'quantidade',
  'CHEGADA FLORESTA':'chegada_floresta','SAIDA FLORESTA':'saida_floresta','CHEGADA CLIENTE':'chegada_cliente',
  'SAIDA CLIENTE':'saida_cliente','LOCAL ABASTECIMENTO':'local_abastecimento','KM':'km',
  'QTDADE LITROS':'qtdade_litros','VALOR UNITARIO':'valor_unitario','ARLA VALOR':'arla_valor',
  'CLASSE DESPESA':'classe_despesa','DESCR. DESPESA':'descr_despesa','LOCAL DESPESA':'local_despesa',
  'VALOR DESPESA':'valor_despesa','OBSERVAÇÃO':'observacao','USUARIO':'usuario_nome_legado'
  // 'VALOR TOTAL' e 'DATA_REGISTRO' tratados à parte (calculado / automático)
};
function _cadastroToDb(row){
  var out={};
  Object.keys(row||{}).forEach(function(k){
    var col=_CADASTRO_KEYMAP[k];
    if(!col) return; // ignora VALOR TOTAL (calculado) e chaves desconhecidas
    var v=row[k];
    out[col]=(v===''||v===undefined)?null:v;
  });
  return out;
}
function _comUsuarioAtual(payload){
  payload.usuario_id=currentUser||null;
  if(currentUserData && currentUserData.nome) payload.usuario_nome_legado=currentUserData.nome;
  return payload;
}

// ==================== CARREGAMENTO ====================
function loadFromSheets(callback) {
  showToast('⏳ Carregando dados...');
  Promise.all([
    sbFetchAll('cadastro'), sbFetchAll('manut_realizada'), sbFetchAll('manut_programada'),
    sbFetchAll('locais'), sbFetchAll('motoristas'), sbFetchAll('caminhoes'),
    sbFetchAll('classes_despesa'), sbFetchAll('profiles'), sbFetchAll('maquinas'),
    sbFetchAll('maq_localizacao'), sbFetchAll('maq_abastecimento'), sbFetchAll('maq_manutencao'),
    sbFetchAll('tanques'), sbFetchAll('tanque_entradas'), sbFetchAll('frequencia'),
  ]).then(function(r){
    var cadastroR=r[0], manutRR=r[1], manutPR=r[2], locaisR=r[3], motoristasR=r[4], caminhoesR=r[5],
        classesR=r[6], profilesR=r[7], maquinasR=r[8], maqLocR=r[9], maqAbR=r[10], maqManR=r[11],
        tanquesR=r[12], tanqueEntR=r[13], freqR=r[14];

    DB.cadastro = cadastroR.map(function(x){ return {
      ID:x.id, MOTORISTA:x.motorista, DATA:x.data, 'SITUAÇÃO':x.situacao, ENTREGA:x.entrega, PLACA:x.placa,
      'LOCAL CARGA':x.local_carga, 'LOCAL DESCARGA':x.local_descarga, NOTA:x.nota, QUANTIDADE:x.quantidade,
      'CHEGADA FLORESTA':x.chegada_floresta, 'SAIDA FLORESTA':x.saida_floresta,
      'CHEGADA CLIENTE':x.chegada_cliente, 'SAIDA CLIENTE':x.saida_cliente,
      'LOCAL ABASTECIMENTO':x.local_abastecimento, KM:x.km, 'QTDADE LITROS':x.qtdade_litros,
      'VALOR UNITARIO':x.valor_unitario, 'VALOR TOTAL':x.valor_total, 'ARLA VALOR':x.arla_valor,
      'CLASSE DESPESA':x.classe_despesa, 'DESCR. DESPESA':x.descr_despesa, 'LOCAL DESPESA':x.local_despesa,
      'VALOR DESPESA':x.valor_despesa, 'OBSERVAÇÃO':x.observacao,
      USUARIO:x.usuario_nome_legado, DATA_REGISTRO:x.data_registro?String(x.data_registro).slice(0,10):'',
      _usuarioId:x.usuario_id
    };});

    DB.manutRealizada = manutRR.map(function(x){ return {
      ID:x.id, PLACA:x.placa, TIPO_MANUTENCAO:x.tipo_manutencao, DATA_MANUTENCAO:x.data_manutencao,
      KM_NA_MANUTENCAO:x.km, 'OBSERVAÇÃO':x.observacao, USUARIO:x.usuario_nome_legado, _usuarioId:x.usuario_id
    };});

    DB.manutProgramada = manutPR.map(function(x){ return {
      ID:x.id, TIPO_MANUTENCAO:x.tipo_manutencao, INTERVALO_KM:x.intervalo_km,
      ALERTA_URGENTE:x.alerta_urgente, 'ALERTA ATENCAO':x.alerta_atencao
    };});

    LOCAIS_DATA = locaisR.map(function(x){ return {
      NOME:x.nome, TIPO:x.tipo, 'ENDEREÇO':x.endereco, MUNICIPIO:x.municipio, ESTADO:x.estado,
      LATITUDE:x.latitude, LONGITUDE:x.longitude, UNIDADE:x.unidade
    };});

    MOTORISTAS_DATA = motoristasR.map(function(x){ return {
      NOME:x.nome, CPF:x.cpf, CNH:x.cnh, VALIDADE_CNH:x.validade_cnh,
      DATA_ADMISSAO:x.data_admissao, DATA_DESLIGAMENTO:x.data_desligamento
    };});

    CAMINHOES_DATA = caminhoesR.map(function(x){ return { PLACA:x.placa, MARCA:x.marca, MODELO:x.modelo, ANO:x.ano }; });

    USUARIOS = profilesR.map(function(x){ return {
      _id:x.id, USUARIO:x.usuario||x.nome, NOME:x.nome, PERFIL:x.perfil, EMAIL:x.email,
      PRIMEIRO_ACESSO:x.primeiro_acesso?'TRUE':'FALSE', ATIVO:x.ativo?'TRUE':'FALSE'
    };});

    DB.maquinas = maquinasR.map(function(x){ return {
      ID:x.id, IDENTIFICACAO:x.identificacao, TIPO:x.tipo, MARCA:x.marca, MODELO:x.modelo, ANO:x.ano,
      SERIE_PATRIMONIO:x.serie_patrimonio, METRICA:x.metrica, STATUS:x.status, OBS:x.obs
    };});

    DB.maqLocalizacao = maqLocR.map(function(x){ return {
      ID:x.id, ID_MAQUINA:x.id_maquina, FLORESTA:x.floresta, DATA_ENTRADA:x.data_entrada, OBS:x.obs,
      USUARIO:x.usuario_nome_legado, _usuarioId:x.usuario_id
    };});

    DB.maqAbastecimento = maqAbR.map(function(x){ return {
      ID:x.id, DATA:x.data, ID_MAQUINA:x.id_maquina, HORIMETRO:x.horimetro, KM:x.km, LITROS:x.litros,
      PRECO_LITRO:x.preco_litro, VALOR_TOTAL:x.valor_total, TIPO_COMBUSTIVEL:x.tipo_combustivel,
      TANQUE_POSTO:x.tanque_posto, OPERADOR:x.operador, FLORESTA_OPC:x.floresta_opc, OBS:x.obs,
      USUARIO:x.usuario_nome_legado, _usuarioId:x.usuario_id
    };});

    DB.maqManutencao = maqManR.map(function(x){ return {
      ID:x.id, DATA:x.data, ID_MAQUINA:x.id_maquina, TIPO:x.tipo, SERVICO:x.servico, HORIMETRO:x.horimetro,
      KM:x.km, CUSTO_PECAS:x.custo_pecas, CUSTO_MAO_OBRA:x.custo_mao_obra, CUSTO_TERCEIROS:x.custo_terceiros,
      CUSTO_TOTAL:x.custo_total, OFICINA_FORNECEDOR:x.oficina_fornecedor, FLORESTA_OPC:x.floresta_opc, OBS:x.obs,
      USUARIO:x.usuario_nome_legado, _usuarioId:x.usuario_id
    };});

    DB.tanques = tanquesR.map(function(x){ return {
      ID:x.id, LOCAL_ABASTECIMENTO:x.local_abastecimento, SALDO_INICIAL:x.saldo_inicial,
      NIVEL_MINIMO:x.nivel_minimo, DATA_INICIO:x.data_inicio, OBS:x.obs,
      USUARIO:x.usuario_nome_legado, _usuarioId:x.usuario_id
    };});

    DB.tanqueEntradas = tanqueEntR.map(function(x){ return {
      ID:x.id, DATA:x.data, LOCAL_ABASTECIMENTO:x.local_abastecimento, LITROS:x.litros,
      PRECO_LITRO:x.preco_litro, VALOR_TOTAL:x.valor_total, FORNECEDOR:x.fornecedor, NOTA_FISCAL:x.nota_fiscal,
      OBS:x.obs, USUARIO:x.usuario_nome_legado, _usuarioId:x.usuario_id
    };});

    DB.frequencia = freqR.map(function(x){ return {
      ID:x.id, DATA:x.data, MOTORISTA:x.motorista, CODIGO:x.codigo,
      USUARIO:x.usuario_nome_legado, _usuarioId:x.usuario_id
    };});

    BASE.motoristas = MOTORISTAS_DATA.map(function(m){ return m.NOME; });
    BASE.localCarga = LOCAIS_DATA.filter(function(l){ return l.TIPO==='carga'; }).map(function(l){ return l.NOME; });
    BASE.localDescarga = LOCAIS_DATA.filter(function(l){ return l.TIPO==='descarga'; }).map(function(l){ return l.NOME; });
    BASE.placas = CAMINHOES_DATA.map(function(c){ return c.PLACA; });
    BASE.localAbast = LOCAIS_DATA.filter(function(l){ return l.TIPO==='abastecimento'; }).map(function(l){ return l.NOME; });
    BASE.classeDesp = classesR.map(function(c){ return c.nome; });
    BASE.tipoManut = DB.manutProgramada.map(function(m){ return m.TIPO_MANUTENCAO; });
    BASE.clientesM3 = ['ADM PF', 'ADM LEM'];
    LOCAIS_DATA.forEach(function(loc) {
      var nomeLoc = loc.NOME;
      if (!nomeLoc) return;
      if (String(loc.UNIDADE || '').toUpperCase() === 'M3') {
        if (!BASE.clientesM3.includes(nomeLoc)) BASE.clientesM3.push(nomeLoc);
      } else {
        var pos = BASE.clientesM3.indexOf(nomeLoc);
        if (pos >= 0 && !['ADM PF', 'ADM LEM'].includes(nomeLoc)) BASE.clientesM3.splice(pos, 1);
      }
    });

    LOCAIS_COORDS = {};
    LOCAIS_DATA.forEach(function(loc) {
      if (loc.NOME && loc.LATITUDE && loc.LONGITUDE) {
        LOCAIS_COORDS[loc.NOME] = { lat: Number(loc.LATITUDE), lng: Number(loc.LONGITUDE), tipo: (loc.TIPO || '').toLowerCase() };
      }
    });

    dataLoaded = true;
    showToast('✅ ' + DB.cadastro.length + ' registros carregados!');
    if (callback) callback();
  }).catch(function(err) { showToast('❌ Conexão falhou: ' + (err.message||err), true); });
}

// ==================== GRAVAÇÃO (roteador por action) ====================
function saveToSheets(action, data, callback) {
  _rotearAction(action, data).then(function(res){
    if (callback) callback(true, res);
  }).catch(function(err){
    console.error('[saveToSheets]', action, err);
    if (callback) callback(false, { error: err && (err.message||err) });
  });
}

function _rotearAction(action, data) {
  switch (action) {
    // ---------- CADASTRO ----------
    case 'addCadastro': {
      var payload=_comUsuarioAtual(_cadastroToDb(data));
      return sb.from('cadastro').insert(payload).select().then(_unwrap);
    }
    case 'updateCadastro': {
      var id = data.id;
      var row = data.row || data.updates || {};
      var payload = _cadastroToDb(row);
      if (!id) return Promise.reject(new Error('updateCadastro sem id'));
      return sb.from('cadastro').update(payload).eq('id', id).select().then(_unwrap);
    }
    case 'deleteCadastro': {
      if (!data.id) return Promise.reject(new Error('deleteCadastro sem id'));
      return sb.from('cadastro').delete().eq('id', data.id).then(_unwrap);
    }

    // ---------- LOCAIS ----------
    case 'addLocal': {
      var l=_lowerKeys(data); l.tipo=String(l.tipo||'').toLowerCase();
      return sb.from('locais').insert(l).select().then(_unwrap);
    }
    case 'updateLocal': {
      var lu=_lowerKeys(data.row||{}); if(lu.tipo) lu.tipo=String(lu.tipo).toLowerCase();
      var nomeOriginal = data.nomeOriginal || data.NOME_ORIGINAL;
      if(!nomeOriginal) return Promise.reject(new Error('updateLocal sem nomeOriginal'));
      return sb.from('locais').update(lu).eq('nome', nomeOriginal).select().then(_unwrap);
    }

    // ---------- MOTORISTAS ----------
    case 'addMotorista': {
      return sb.from('motoristas').insert(_lowerKeys(data)).select().then(_unwrap);
    }
    case 'updateMotorista': {
      var nome = data.nome || data.NOME || (data.row && data.row.NOME);
      if(!nome) return Promise.reject(new Error('updateMotorista sem nome'));
      return sb.from('motoristas').update(_lowerKeys(data.row||{})).eq('nome', nome).select().then(_unwrap);
    }

    // ---------- CAMINHOES ----------
    case 'addCaminhao': {
      return sb.from('caminhoes').insert(_lowerKeys(data)).select().then(_unwrap);
    }

    // ---------- MANUTENÇÃO ----------
    case 'addManutRealizada': {
      var mr={
        placa: data.PLACA, tipo_manutencao: data.TIPO_MANUTENCAO, data_manutencao: data['DATA MANUTENÇÃO'],
        km: data.KM, observacao: data['OBSERVAÇÃO']
      };
      return sb.from('manut_realizada').insert(_comUsuarioAtual(_limparPayload(mr))).select().then(_unwrap);
    }
    case 'updateManutR': {
      var rr=_lowerKeys(data.row||{});
      return sb.from('manut_realizada').update(rr).eq('id', data.id).select().then(_unwrap);
    }
    case 'deleteManutR': {
      return sb.from('manut_realizada').delete().eq('id', data.id).then(_unwrap);
    }
    case 'addManutProgramada': {
      var mp={ tipo_manutencao:data['TIPO MANUTENÇÃO']||data.TIPO_MANUTENCAO, intervalo_km:data['INTERVALO KM'],
        alerta_urgente:data['ALERTA URGENTE'], alerta_atencao:data['ALERTA ATENCAO'] };
      return sb.from('manut_programada').insert(_limparPayload(mp)).select().then(_unwrap);
    }
    case 'updateManutP': {
      var mpu=_lowerKeys(data.row||{});
      return sb.from('manut_programada').update(mpu).eq('id', data.id).select().then(_unwrap);
    }
    case 'deleteManutP': {
      return sb.from('manut_programada').delete().eq('id', data.id).then(_unwrap);
    }

    // ---------- MAQUINÁRIOS ----------
    case 'addMaquina': return sb.from('maquinas').insert(_lowerKeys(data)).select().then(_unwrap);
    case 'updateMaquina': return sb.from('maquinas').update(_lowerKeys(data.row||{})).eq('id', data.id).select().then(_unwrap);
    case 'deleteMaquina': return sb.from('maquinas').delete().eq('id', data.id).then(_unwrap);

    case 'addLocalizacaoMaq': return sb.from('maq_localizacao').insert(_comUsuarioAtual(_lowerKeys(data))).select().then(_unwrap);
    case 'updateLocalizacaoMaq': return sb.from('maq_localizacao').update(_lowerKeys(data.row||{})).eq('id', data.id).select().then(_unwrap);
    case 'deleteLocalizacaoMaq': return sb.from('maq_localizacao').delete().eq('id', data.id).then(_unwrap);

    case 'addAbastecimentoMaq': return sb.from('maq_abastecimento').insert(_comUsuarioAtual(_lowerKeys(data))).select().then(_unwrap);
    case 'updateAbastecimentoMaq': return sb.from('maq_abastecimento').update(_lowerKeys(data.row||{})).eq('id', data.id).select().then(_unwrap);
    case 'deleteAbastecimentoMaq': return sb.from('maq_abastecimento').delete().eq('id', data.id).then(_unwrap);

    case 'addManutMaq': return sb.from('maq_manutencao').insert(_comUsuarioAtual(_lowerKeys(data))).select().then(_unwrap);
    case 'updateManutMaq': return sb.from('maq_manutencao').update(_lowerKeys(data.row||{})).eq('id', data.id).select().then(_unwrap);
    case 'deleteManutMaq': return sb.from('maq_manutencao').delete().eq('id', data.id).then(_unwrap);

    // ---------- COMBOIO ----------
    case 'addTanque': return sb.from('tanques').insert(_comUsuarioAtual(_lowerKeys(data))).select().then(_unwrap);
    case 'updateTanque': return sb.from('tanques').update(_lowerKeys(data.row||{})).eq('id', data.id).select().then(_unwrap);
    case 'deleteTanque': return sb.from('tanques').delete().eq('id', data.id).then(_unwrap);

    case 'addTanqueEntrada': return sb.from('tanque_entradas').insert(_comUsuarioAtual(_lowerKeys(data))).select().then(_unwrap);
    case 'updateTanqueEntrada': return sb.from('tanque_entradas').update(_lowerKeys(data.row||{})).eq('id', data.id).select().then(_unwrap);
    case 'deleteTanqueEntrada': return sb.from('tanque_entradas').delete().eq('id', data.id).then(_unwrap);

    // ---------- FREQUÊNCIA (upsert em lote por MOTORISTA+DATA) ----------
    case 'saveFrequenciaMes': {
      var marcacoes = data.marcacoes || [];
      var usuario = data.usuario || '';
      var comCodigo = marcacoes.filter(function(m){ return m.CODIGO; });
      var semCodigo = marcacoes.filter(function(m){ return !m.CODIGO; });
      var proms = [];
      if (comCodigo.length) {
        var rows = comCodigo.map(function(m){ return _comUsuarioAtualObj({ data:m.DATA, motorista:m.MOTORISTA, codigo:m.CODIGO }, usuario); });
        proms.push(sb.from('frequencia').upsert(rows, { onConflict: 'motorista,data' }).select());
      }
      semCodigo.forEach(function(m){
        proms.push(sb.from('frequencia').delete().eq('motorista', m.MOTORISTA).eq('data', m.DATA));
      });
      return Promise.all(proms).then(function(results){
        var err = results.find(function(r){ return r.error; });
        if (err) return Promise.reject(err.error);
        return { gravadas: comCodigo.length, removidas: semCodigo.length };
      });
    }

    // ---------- USUÁRIOS (gestão de contas via Edge Function, única peça com acesso à service_role) ----------
    case 'addUsuario':
    case 'updateUsuario':
    case 'updatePassword':
    case 'deleteUsuario': {
      return sb.functions.invoke('gerenciar-usuarios', { body: { action: action, data: data } }).then(function(res){
        if (res.error) return Promise.reject(res.error);
        if (res.data && res.data.ok === false) return Promise.reject(new Error(res.data.error || 'erro desconhecido'));
        return res.data;
      });
    }

    default:
      return Promise.reject(new Error('Ação desconhecida: ' + action));
  }
}
function _unwrap(res){ if(res.error) return Promise.reject(res.error); return res.data; }
function _comUsuarioAtualObj(payload, usuarioNome){
  payload.usuario_id=currentUser||null;
  payload.usuario_nome_legado=usuarioNome||(currentUserData&&currentUserData.nome)||null;
  return payload;
}

// ==================== EDIT / DELETE ====================
// Identificador único de uma linha do CADASTRO: sempre o id real do Supabase.
function rowKey(r){ return String(r.ID); }
function rowKeyAttr(r){
  return String(rowKey(r)).replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/"/g,'&quot;');
}
function findRowByKey(key){
  for(var i=0;i<DB.cadastro.length;i++){
    if(rowKey(DB.cadastro[i])===String(key)) return {row:DB.cadastro[i], idx:i};
  }
  return null;
}

var _editingKey=null;
var _deletingKey=null;

// Campos editáveis no modal — agrupados por seção
var EDIT_FIELDS=[
  {key:'DATA', label:'Data', type:'date'},
  {key:'MOTORISTA', label:'Motorista', type:'select', src:'motoristas'},
  {key:'SITUAÇÃO', label:'Situação', type:'text'},
  {key:'ENTREGA', label:'Entrega', type:'number'},
  {key:'PLACA', label:'Placa', type:'select', src:'placas'},
  {key:'LOCAL CARGA', label:'Local Carga', type:'select', src:'localCarga'},
  {key:'LOCAL DESCARGA', label:'Local Descarga', type:'select', src:'localDescarga'},
  {key:'NOTA', label:'Nota', type:'number'},
  {key:'QUANTIDADE', label:'Quantidade', type:'moneynum', mask:'quantidade'},
  {key:'CHEGADA FLORESTA', label:'Chegada Floresta', type:'time'},
  {key:'SAIDA FLORESTA', label:'Saída Floresta', type:'time'},
  {key:'CHEGADA CLIENTE', label:'Chegada Cliente', type:'time'},
  {key:'SAIDA CLIENTE', label:'Saída Cliente', type:'time'},
  {key:'LOCAL ABASTECIMENTO', label:'Posto', type:'select', src:'localAbast'},
  {key:'KM', label:'KM', type:'moneynum', mask:'km'},
  {key:'QTDADE LITROS', label:'Litros', type:'moneynum', mask:'litros'},
  {key:'VALOR UNITARIO', label:'Vlr Unit. Combust.', type:'moneynum', mask:'valorUnit'},
  {key:'ARLA VALOR', label:'Vlr ARLA', type:'moneynum', mask:'arla'},
  {key:'CLASSE DESPESA', label:'Classe Despesa', type:'select', src:'classeDesp'},
  {key:'DESCR. DESPESA', label:'Descr. Despesa', type:'text'},
  {key:'LOCAL DESPESA', label:'Local Despesa', type:'text'},
  {key:'VALOR DESPESA', label:'Vlr Despesa', type:'moneynum', mask:'valorDesp'},
  {key:'OBSERVAÇÃO', label:'Observação', type:'textarea'}
];

function openEditModal(key){
  var found=findRowByKey(key);
  if(!found){ showToast('Registro não encontrado',true); return; }
  // Permissão (a garantia de verdade é o RLS no banco; isso aqui só evita abrir o modal à toa)
  if(!currentUserData) return;
  if(currentUserData.perfil!=='ADMIN'){
    if(currentUserData.perfil!=='ANALISTA' && currentUserData.perfil!=='DIRETOR'){ showToast('Sem permissão para editar',true); return; }
    var owner=found.row.USUARIO;
    if(owner!==currentUserData.nome && owner!==currentUserData.usuario){
      showToast('❌ Você só pode editar os seus próprios lançamentos',true);
      return;
    }
  }
  _editingKey=key;
  var r=found.row;
  document.getElementById('editSub').textContent='Motorista: '+(r.MOTORISTA||'-')+'  •  Data: '+formatDateBR(r.DATA)+'  •  Registrado em: '+(r.DATA_REGISTRO||'-');
  var grid=document.getElementById('editGrid');
  var html='';
  EDIT_FIELDS.forEach(function(f){
    var val=r[f.key];
    if(val==null) val='';
    var id='ed_'+f.key.replace(/[^a-zA-Z0-9]/g,'_');
    html+='<div class="form-group"'+(f.type==='textarea'?' style="grid-column:1/-1"':'')+'>';
    html+='<label>'+f.label+'</label>';
    if(f.type==='select'){
      var opts=BASE[f.src]||[];
      html+='<select id="'+id+'"><option value="">—</option>';
      opts.forEach(function(o){
        var sel=String(o)===String(val)?' selected':'';
        html+='<option value="'+String(o).replace(/"/g,'&quot;')+'"'+sel+'>'+o+'</option>';
      });
      // garantir que valor atual aparece mesmo se não estiver em BASE
      if(val && opts.indexOf(val)===-1){
        html+='<option value="'+String(val).replace(/"/g,'&quot;')+'" selected>'+val+' (atual)</option>';
      }
      html+='</select>';
    } else if(f.type==='textarea'){
      html+='<textarea id="'+id+'" rows="2" style="width:100%;resize:vertical">'+String(val).replace(/</g,'&lt;')+'</textarea>';
    } else if(f.type==='date'){
      // val pode estar em YYYY-MM-DD ou ISO
      var dval=String(val).slice(0,10);
      html+='<input type="date" id="'+id+'" value="'+dval+'">';
    } else if(f.type==='time'){
      // val pode ter formatos variados — normalizar pra HH:MM
      var tval='';
      if(val){
        var nd=normalizeTimeDisplay(val);
        if(nd && nd!=='-' && /^\d{2}:\d{2}$/.test(nd)) tval=nd;
      }
      html+='<input type="time" id="'+id+'" value="'+tval+'">';
    } else if(f.type==='number'){
      html+='<input type="number" id="'+id+'" '+(f.step?'step="'+f.step+'"':'')+' value="'+(val===''?'':val)+'">';
    } else if(f.type==='moneynum'){
      var mval=(val===''||val==null)?'':fmt(val,2);
      html+='<input type="text" inputmode="decimal" id="'+id+'" value="'+mval+'">';
    } else {
      html+='<input type="text" id="'+id+'" value="'+String(val).replace(/"/g,'&quot;')+'">';
    }
    html+='</div>';
  });
  grid.innerHTML=html;
  _aplicarMascarasEdit();
  document.getElementById('editOverlay').classList.add('show');
}

// Aplica as mesmas máscaras numéricas do Cadastro (js/mascaras.js) aos campos do modal de Editar
function _aplicarMascarasEdit(){
  clonarEMascarar('ed_KM',             LIMITES_CAMPOS.km,        2);
  clonarEMascarar('ed_QTDADE_LITROS',  LIMITES_CAMPOS.litros,    2);
  clonarEMascarar('ed_VALOR_UNITARIO', LIMITES_CAMPOS.valorUnit, 2);
  clonarEMascarar('ed_ARLA_VALOR',     LIMITES_CAMPOS.arla,      2);
  clonarEMascarar('ed_VALOR_DESPESA',  LIMITES_CAMPOS.valorDesp, 2);
  _aplicarMascaraQuantidadeEdit(false);
  var locSel=document.getElementById('ed_LOCAL_DESCARGA');
  if(locSel) locSel.addEventListener('change', function(){ _aplicarMascaraQuantidadeEdit(true); });
}

// limpar=true quando o Local de Descarga muda depois do modal já aberto (mesmo comportamento do Cadastro:
// como o limite de dígitos muda entre TON e M³, o valor antigo é descartado em vez de reformatado)
function _aplicarMascaraQuantidadeEdit(limpar){
  var fQ=document.getElementById('ed_QUANTIDADE');
  if(!fQ) return;
  if(limpar) fQ.value='';
  var locSel=document.getElementById('ed_LOCAL_DESCARGA');
  var local=locSel?locSel.value:'';
  var isM3=BASE.clientesM3.includes(local);
  var maxInt=isM3?LIMITES_CAMPOS.quantidadeM3:LIMITES_CAMPOS.quantidadeTON;
  clonarEMascarar('ed_QUANTIDADE', maxInt, 2);
}

function closeEditModal(){
  document.getElementById('editOverlay').classList.remove('show');
  _editingKey=null;
}

function saveEdit(){
  if(!_editingKey){ closeEditModal(); return; }
  var found=findRowByKey(_editingKey);
  if(!found){ showToast('Registro não encontrado',true); closeEditModal(); return; }
  var r=found.row;
  var updates={};
  EDIT_FIELDS.forEach(function(f){
    var id='ed_'+f.key.replace(/[^a-zA-Z0-9]/g,'_');
    var el=document.getElementById(id);
    if(!el) return;
    var v=el.value;
    if(f.type==='number'||f.type==='moneynum'){
      updates[f.key]=v===''?null:num(v);
    } else {
      updates[f.key]=v===''?null:v;
    }
  });
  // recalcular VALOR TOTAL combustível (exibição local só — o banco recalcula sozinho)
  if(updates['QTDADE LITROS']!=null && updates['VALOR UNITARIO']!=null){
    updates['VALOR TOTAL']=updates['QTDADE LITROS']*updates['VALOR UNITARIO'];
  } else {
    updates['VALOR TOTAL']=null;
  }
  // Validação mínima
  if(!updates['MOTORISTA'] || !updates['DATA']){
    showToast('Motorista e Data são obrigatórios',true);
    return;
  }
  // KM e Litros obrigatórios juntos (mesma regra do Cadastro, sem a validação sequencial por mês)
  if(updates['KM'] && !updates['QTDADE LITROS']){ showToast('⚠️ Se informar KM, informe também Qtde Litros!', true); return; }
  if(updates['QTDADE LITROS'] && !updates['KM']){ showToast('⚠️ Se informar Litros, informe também o KM!', true); return; }
  // KM contra histórico da placa por DATA (mesma regra "inteligente" do Cadastro, ignorando o próprio registro)
  // Validação final de verdade acontece no banco (trigger); isso aqui só dá feedback rápido antes de enviar.
  if(updates['KM'] && updates['PLACA'] && updates['DATA']){
    var kmValEdit = updates['KM'];
    var dtEdit = updates['DATA'];
    var mesAtualEdit = dtEdit.substring(0,7);
    var registrosMesEdit = DB.cadastro.filter(function(other){
      return other!==r &&
             _normPlacaCad(other.PLACA) === _normPlacaCad(updates['PLACA']) &&
             other.KM && num(other.KM) > 0 &&
             other.DATA && other.DATA.substring(0,7) === mesAtualEdit;
    });
    var anterioresEdit = registrosMesEdit.filter(function(o){ return o.DATA <= dtEdit; }).map(function(o){ return num(o.KM); });
    var posterioresEdit = registrosMesEdit.filter(function(o){ return o.DATA > dtEdit; });
    if(anterioresEdit.length > 0){
      var ultimoKMEdit = Math.max.apply(null, anterioresEdit);
      if(kmValEdit <= ultimoKMEdit){
        showToast('⚠️ KM inválido! O último KM desta placa até esta data é ' + numBR(ultimoKMEdit,2) + '. Informe um valor maior.', true);
        return;
      }
      if(kmValEdit > ultimoKMEdit + 2500){
        showToast('⚠️ KM inválido! O valor ' + numBR(kmValEdit,2) + ' ultrapassa o limite de 2.500 km acima do último registrado até esta data (' + numBR(ultimoKMEdit,2) + ').', true);
        return;
      }
    }
    if(posterioresEdit.length > 0){
      var proximoKMEdit = Math.min.apply(null, posterioresEdit.map(function(o){ return num(o.KM); }));
      if(kmValEdit >= proximoKMEdit){
        var proximoRegEdit = posterioresEdit.filter(function(o){ return num(o.KM) === proximoKMEdit; })[0];
        showToast('⚠️ KM inválido! Já existe um lançamento posterior (' + formatDateBR(proximoRegEdit.DATA) + ') com KM ' + numBR(proximoKMEdit,2) + '. Informe um valor menor.', true);
        return;
      }
    }
  }
  // Nota Fiscal duplicada: removido (o próprio negócio usa a mesma nota em viagens diferentes — ver decisão da migração)
  showToast('⏳ Salvando alterações...');
  saveToSheets('updateCadastro', {id:r.ID, row:updates}, function(ok, res){
    if(ok){
      Object.keys(updates).forEach(function(k){ r[k]=updates[k]; });
      showToast('✅ Lançamento atualizado!');
      closeEditModal();
      var active=document.querySelector('.nav-item.active');
      if(active){
        var pg=active.getAttribute('data-page');
        if(pg==='producao') buildProducao();
        else if(pg==='financeiro') buildFinanceiro();
        else if(pg==='tempoespera') buildTempoEspera();
        else if(pg==='historico') buildHistorico();
        else if(pg==='manutencao') buildManutencao();
      }
    } else {
      showToast('❌ Falha ao salvar: '+((res&&res.error)||'erro desconhecido'),true);
    }
  });
}

function openDeleteModal(key){
  if(!currentUserData || currentUserData.perfil!=='ADMIN'){
    showToast('Apenas ADMIN pode excluir',true); return;
  }
  var found=findRowByKey(key);
  if(!found){ showToast('Registro não encontrado',true); return; }
  _deletingKey=key;
  var r=found.row;
  var det='';
  det+='<div><strong>Motorista:</strong> '+(r.MOTORISTA||'-')+'</div>';
  det+='<div><strong>Data:</strong> '+formatDateBR(r.DATA)+'</div>';
  det+='<div><strong>Placa:</strong> '+(r.PLACA||'-')+'</div>';
  det+='<div><strong>Local Carga:</strong> '+(r['LOCAL CARGA']||'-')+'</div>';
  det+='<div><strong>Local Descarga:</strong> '+(r['LOCAL DESCARGA']||'-')+'</div>';
  if(r.QUANTIDADE) det+='<div><strong>Quantidade:</strong> '+fmt(r.QUANTIDADE)+'</div>';
  if(r['VALOR TOTAL']) det+='<div><strong>Vlr Total Combust.:</strong> R$ '+fmt(r['VALOR TOTAL'])+'</div>';
  if(r['VALOR DESPESA']) det+='<div><strong>Vlr Despesa:</strong> R$ '+fmt(r['VALOR DESPESA'])+'</div>';
  det+='<div style="margin-top:8px;color:#888;font-size:11px"><strong>Registrado em:</strong> '+(r.DATA_REGISTRO||'-')+' por '+(r.USUARIO||'-')+'</div>';
  document.getElementById('confirmDetails').innerHTML=det;
  document.getElementById('confirmOverlay').classList.add('show');
}

function closeDeleteModal(){
  document.getElementById('confirmOverlay').classList.remove('show');
  _deletingKey=null;
}

function confirmDelete(){
  if(!_deletingKey){ closeDeleteModal(); return; }
  var key=_deletingKey;
  var found=findRowByKey(key);
  if(!found){ showToast('Registro não encontrado',true); closeDeleteModal(); return; }
  var r=found.row;
  showToast('⏳ Excluindo...');
  saveToSheets('deleteCadastro', {id:r.ID}, function(ok, res){
    if(ok){
      DB.cadastro.splice(found.idx, 1);
      showToast('✅ Lançamento excluído!');
      closeDeleteModal();
      buildHistorico();
    } else {
      showToast('❌ Falha ao excluir: '+((res&&res.error)||'erro desconhecido'),true);
    }
  });
}
