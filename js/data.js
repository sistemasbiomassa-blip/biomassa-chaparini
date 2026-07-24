function loadFromSheets(callback) {
  showToast('⏳ Carregando dados...');
  fetch(API_URL + '?action=all')
    .then(function(r) { return r.json(); })
    .then(function(res) {
      // Compatibilidade: aceita ok ou success
      var okFlag = (res.ok!==undefined) ? res.ok : res.success;
      if (!okFlag) { showToast('❌ Erro: ' + (res.error||'desconhecido'), true); return; }
      var d = res.data;
      DB.cadastro = (d.cadastro && d.cadastro.rows) ? d.cadastro.rows : (d.cadastro || []);
      var manutR = (d.manutRealizada && d.manutRealizada.rows) ? d.manutRealizada.rows : (d.manutRealizada || []);
      DB.manutRealizada = manutR.map(function(r) {
        return { PLACA: r['PLACA'], TIPO_MANUTENCAO: r['TIPO_MANUTENCAO'],
          DATA_MANUTENCAO: r['DATA MANUTENÇÃO'], KM_NA_MANUTENCAO: r['KM'] ? Number(r['KM']) : 0,
          'OBSERVAÇÃO': r['OBSERVAÇÃO'] };
      });
      var manutP = (d.manutProgramada && d.manutProgramada.rows) ? d.manutProgramada.rows : (d.manutProgramada || []);
      DB.manutProgramada = manutP.map(function(r) {
        return { TIPO_MANUTENCAO: r['TIPO MANUTENÇÃO'],
          INTERVALO_KM: r['INTERVALO KM'] ? Number(r['INTERVALO KM']) : 0,
          ALERTA_URGENTE: r['ALERTA URGENTE'] ? Number(r['ALERTA URGENTE']) : 0,
          'ALERTA ATENCAO': r['ALERTA ATENCAO'] ? Number(r['ALERTA ATENCAO']) : 0 };
      });
      // BASE DE DADOS chega como {headers:[...], rows:[{COL:val,...}]} no formato novo,
      // mas o front antigo espera {COL: [val1,val2,...]}. Vamos converter se preciso.
      var b = d.base || {};
      if (b.headers && b.rows) {
        // Novo formato -> converter pra map de arrays
        var bMap = {};
        b.headers.forEach(function(h){ bMap[h]=[]; });
        b.rows.forEach(function(row){
          b.headers.forEach(function(h){
            var v=row[h];
            if(v!=='' && v!==null && v!==undefined) bMap[h].push(v);
          });
        });
        b = bMap;
      }
      BASE.motoristas = b['MOTORISTA'] || [];
      BASE.localCarga = b['LOCAL CARGA'] || [];
      BASE.localDescarga = b['LOCAL DESCARGA'] || [];
      BASE.placas = b['PLACA'] || [];
      BASE.localAbast = b['LOCAL ABASTECIMENTO'] || [];
      BASE.classeDesp = b['CLASSE DESPESA'] || [];
      BASE.tipoManut = b['TIPO_MANUTENCAO'] || [];
      BASE.clientesM3 = ['ADM PF', 'ADM LEM'];
      LOCAIS_DATA = (d.locais && d.locais.rows) ? d.locais.rows : (d.locais || []);
      MOTORISTAS_DATA = (d.motoristas && d.motoristas.rows) ? d.motoristas.rows : (d.motoristas || []);
      CAMINHOES_DATA = (d.caminhoes && d.caminhoes.rows) ? d.caminhoes.rows : (d.caminhoes || []);
      USUARIOS = (d.usuarios && d.usuarios.rows) ? d.usuarios.rows : (d.usuarios || []);
      // ===== MÓDULO MAQUINÁRIOS =====
      DB.maquinas        = (d.maquinas && d.maquinas.rows) ? d.maquinas.rows : (d.maquinas || []);
      DB.maqLocalizacao  = (d.maqLocalizacao && d.maqLocalizacao.rows) ? d.maqLocalizacao.rows : (d.maqLocalizacao || []);
      DB.maqAbastecimento= (d.maqAbastecimento && d.maqAbastecimento.rows) ? d.maqAbastecimento.rows : (d.maqAbastecimento || []);
      DB.maqManutencao   = (d.maqManutencao && d.maqManutencao.rows) ? d.maqManutencao.rows : (d.maqManutencao || []);
      // ===== MÓDULO COMBOIO =====
      DB.tanques        = (d.tanques && d.tanques.rows) ? d.tanques.rows : (d.tanques || []);
      DB.tanqueEntradas = (d.tanqueEntradas && d.tanqueEntradas.rows) ? d.tanqueEntradas.rows : (d.tanqueEntradas || []);
      // ===== MÓDULO FREQUÊNCIA =====
      DB.frequencia     = (d.frequencia && d.frequencia.rows) ? d.frequencia.rows : (d.frequencia || []);
      LOCAIS_DATA.forEach(function(loc) {
        if (loc['NOME'] && loc['LATITUDE'] && loc['LONGITUDE']) {
          LOCAIS_COORDS[loc['NOME']] = { lat: Number(loc['LATITUDE']),
            lng: Number(loc['LONGITUDE']), tipo: (loc['TIPO'] || '').toLowerCase() };
        }
      });
      dataLoaded = true;
      showToast('✅ ' + DB.cadastro.length + ' registros carregados!');
      if (callback) callback();
    })
    .catch(function(err) { showToast('❌ Conexão falhou: ' + err.message, true); });
}

function saveToSheets(action, data, callback) {
  fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action: action, data: data })
  }).then(function(r) { return r.json(); })
  .then(function(res) {
    // Compatibilidade ok/success
    var okFlag = (res.ok!==undefined) ? res.ok : res.success;
    if (callback) callback(okFlag, res);
  })
  .catch(function(err) { showToast('❌ ' + err.message, true); if (callback) callback(false); });
}

// ==================== EDIT / DELETE ====================
// Identificador único de uma linha do CADASTRO.
// PREFERÊNCIA: usa o ID da planilha (coluna ID). Se ainda não tiver, cai pro velho MOTORISTA||DATA||DATA_REGISTRO.
function rowKey(r){
  if(r && r.ID!==undefined && r.ID!==null && r.ID!=='') return 'ID:'+String(r.ID);
  return (r.MOTORISTA||'')+'||'+(r.DATA||'')+'||'+(r.DATA_REGISTRO||'');
}
// Versão escapada pra usar em onclick="..."
function rowKeyAttr(r){
  return String(rowKey(r)).replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/"/g,'&quot;');
}
function findRowByKey(key){
  // Caminho rápido por ID
  if(typeof key==='string' && key.indexOf('ID:')===0){
    var idAlvo=key.substring(3);
    for(var i=0;i<DB.cadastro.length;i++){
      if(String(DB.cadastro[i].ID||'')===idAlvo) return {row:DB.cadastro[i], idx:i};
    }
    return null;
  }
  // Fallback antigo
  for(var j=0;j<DB.cadastro.length;j++){
    if(rowKey(DB.cadastro[j])===key) return {row:DB.cadastro[j], idx:j};
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
  {key:'QUANTIDADE', label:'Quantidade', type:'number', step:'0.01'},
  {key:'CHEGADA FLORESTA', label:'Chegada Floresta', type:'time'},
  {key:'SAIDA FLORESTA', label:'Saída Floresta', type:'time'},
  {key:'CHEGADA CLIENTE', label:'Chegada Cliente', type:'time'},
  {key:'SAIDA CLIENTE', label:'Saída Cliente', type:'time'},
  {key:'LOCAL ABASTECIMENTO', label:'Posto', type:'select', src:'localAbast'},
  {key:'KM', label:'KM', type:'number'},
  {key:'QTDADE LITROS', label:'Litros', type:'number', step:'0.01'},
  {key:'VALOR UNITARIO', label:'Vlr Unit. Combust.', type:'number', step:'0.01'},
  {key:'ARLA VALOR', label:'Vlr ARLA', type:'number', step:'0.01'},
  {key:'CLASSE DESPESA', label:'Classe Despesa', type:'select', src:'classeDesp'},
  {key:'DESCR. DESPESA', label:'Descr. Despesa', type:'text'},
  {key:'LOCAL DESPESA', label:'Local Despesa', type:'text'},
  {key:'VALOR DESPESA', label:'Vlr Despesa', type:'number', step:'0.01'},
  {key:'OBSERVAÇÃO', label:'Observação', type:'textarea'}
];

function openEditModal(key){
  var found=findRowByKey(key);
  if(!found){ showToast('Registro não encontrado',true); return; }
  // Permissão
  if(!currentUserData) return;
  if(currentUserData.perfil!=='ADMIN'){
    if(currentUserData.perfil!=='ANALISTA'){ showToast('Sem permissão para editar',true); return; }
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
    } else {
      html+='<input type="text" id="'+id+'" value="'+String(val).replace(/"/g,'&quot;')+'">';
    }
    html+='</div>';
  });
  grid.innerHTML=html;
  document.getElementById('editOverlay').classList.add('show');
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
    if(f.type==='number'){
      updates[f.key]=v===''?null:num(v);
    } else {
      updates[f.key]=v===''?null:v;
    }
  });
  // recalcular VALOR TOTAL combustível
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
  // Nota Fiscal duplicada (global, só quando preenchida, ignorando o próprio registro)
  if(updates['NOTA']){
    var notaDuplicada = DB.cadastro.some(function(other){ return other!==r && other['NOTA'] && num(other['NOTA'])===num(updates['NOTA']); });
    if(notaDuplicada){
      showToast('⚠️ Nota Fiscal ' + updates['NOTA'] + ' já cadastrada! Verifique o número informado.', true);
      return;
    }
  }
  // Atualizar DB local
  Object.keys(updates).forEach(function(k){ r[k]=updates[k]; });
  // Enviar pro Apps Script com a CHAVE (valores ORIGINAIS) + os novos valores
  // Se a linha tem ID, usa ID (caminho seguro). Senão, manda chave composta.
  var payload;
  if(r.ID!==undefined && r.ID!==null && r.ID!==''){
    payload={
      id: r.ID,
      // Mantém chave composta também (fallback dentro do Apps Script)
      keyMotorista: r.MOTORISTA||'',
      keyData: r.DATA||'',
      keyDataRegistro: r.DATA_REGISTRO||'',
      updates: updates,
      row: updates  // novo formato (Code.gs novo lê "row")
    };
  } else {
    var parts=_editingKey.split('||');
    payload={
      keyMotorista: parts[0]||'',
      keyData: parts[1]||'',
      keyDataRegistro: parts[2]||'',
      updates: updates,
      row: updates
    };
  }
  showToast('⏳ Salvando alterações...');
  saveToSheets('updateCadastro', payload, function(ok){
    if(ok){
      showToast('✅ Lançamento atualizado!');
      // Atualizar a chave local (pode ter mudado MOTORISTA ou DATA)
      // Vamos manter DATA_REGISTRO original, então a chave nova é: novoMotorista || novaData || dataRegistroOriginal
      // O r já está atualizado, mas DATA_REGISTRO não muda
      closeEditModal();
      // Re-renderizar a tela atual
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
      showToast('❌ Falha ao salvar na planilha',true);
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
  var payload;
  if(r.ID!==undefined && r.ID!==null && r.ID!==''){
    payload={
      id: r.ID,
      keyMotorista: r.MOTORISTA||'',
      keyData: r.DATA||'',
      keyDataRegistro: r.DATA_REGISTRO||''
    };
  } else {
    var parts=key.split('||');
    payload={
      keyMotorista: parts[0]||'',
      keyData: parts[1]||'',
      keyDataRegistro: parts[2]||''
    };
  }
  showToast('⏳ Excluindo...');
  saveToSheets('deleteCadastro', payload, function(ok){
    if(ok){
      // Remove do DB local
      DB.cadastro.splice(found.idx, 1);
      showToast('✅ Lançamento excluído!');
      closeDeleteModal();
      buildHistorico();
    } else {
      showToast('❌ Falha ao excluir na planilha',true);
    }
  });
}

