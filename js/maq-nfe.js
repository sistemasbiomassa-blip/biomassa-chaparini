// ============================================================
// ===== MAQUINÁRIOS: IMPORTAR NF-e / NFS-e (XML) =============
// Uma linha por manutenção: a NF-e das peças e a NFS-e da mão de obra da mesma OS viram
// UM lançamento (peças → custo_pecas, serviço → custo_mao_obra). O usuário confere e
// aponta o destino (máquina e/ou fazenda) — nada entra sem passar pela conferência.
// Leitura dos XML: js/nf-parse.js · detalhe/avisos/gravação: js/nf-ui.js
// ============================================================
var _maqNfe={grupos:[],rejeitados:[]};

function openMaqNfeModal(){
  if(!maqCanLancar()){ showToast('Sem permissão',true); return; }
  _maqNfe={grupos:[],rejeitados:[]};
  document.getElementById('maqNfeFiles').value='';
  document.getElementById('maqNfeStep2').style.display='none';
  document.getElementById('maqNfeImportBtn').style.display='none';
  document.getElementById('maqNfeResumo').innerHTML='';
  document.getElementById('maqNfeAvisos').style.display='none';
  document.getElementById('maqNfeOverlay').classList.add('show');
}
function closeMaqNfeModal(){ document.getElementById('maqNfeOverlay').classList.remove('show'); _maqNfe={grupos:[],rejeitados:[]}; }

function maqNfeLerArquivos(){
  nfLerSelecao(document.getElementById('maqNfeFiles'),'maq',function(L){
    // compra sem OS (insumo a granel) já nasce como Insumo; com serviço/OS o usuário escolhe
    L.grupos.forEach(function(g){ g.maq=''; g.floresta=''; g.tipo=(!g.os && !g.servicos)?'Insumo':''; });
    _maqNfe=L;
    _maqNfeRender();
    var n=L.grupos.filter(_maqNfeImportavel).length, fora=L.rejeitados.length+L.grupos.filter(function(g){return g.erro;}).length;
    if(fora) showToast('⚠️ '+fora+' nota(s) ficaram de fora — veja o aviso no topo',true);
    else if(n) showToast('✅ '+n+' lançamento(s) montados — escolha o destino e confira');
  });
}

function _maqNfeImportavel(g){ return !g.erro; }
function _maqNfeCompleto(g){ return g.anexarA || ((g.maq||g.floresta) && g.tipo); }

function _maqNfeOpcoesMaq(sel){
  var o='<option value="">— só fazenda —</option>';
  DB.maquinas.slice().sort(function(a,b){return String(a.IDENTIFICACAO||'').localeCompare(String(b.IDENTIFICACAO||''),'pt-BR',{sensitivity:'base'})})
    .forEach(function(m){ o+='<option value="'+m.ID+'"'+(String(sel)===String(m.ID)?' selected':'')+'>'+_nfEsc(m.IDENTIFICACAO||('#'+m.ID))+'</option>'; });
  return o;
}
function _maqNfeOpcoesFl(sel){
  var o='<option value="">—</option>';
  _maqOrdAlfa(locaisFiltrados(BASE.localCarga,'Ativos')).forEach(function(fl){ o+='<option'+(String(sel)===String(fl)?' selected':'')+'>'+_nfEsc(fl)+'</option>'; });
  return o;
}
function _maqNfeOpcoesTipo(sel,vazio){
  var o=vazio?'<option value="">—</option>':'';
  MAQ_MANUT_TIPOS.forEach(function(t){ o+='<option'+(String(sel)===t?' selected':'')+'>'+t+'</option>'; });
  return o;
}

function _maqNfeRender(){
  var G=_maqNfe.grupos;
  document.getElementById('maqNfeStep2').style.display='';
  document.getElementById('maqNfeBulkMaq').innerHTML=_maqNfeOpcoesMaq('');
  document.getElementById('maqNfeBulkTipo').innerHTML=_maqNfeOpcoesTipo('',true);
  document.getElementById('maqNfeBulkFl').innerHTML=_maqNfeOpcoesFl('');
  nfRenderAvisos('maqNfeAvisos',_maqNfe.rejeitados,G);

  var cont=document.getElementById('maqNfeTable');
  var imp=G.filter(_maqNfeImportavel);
  if(!imp.length){ cont.innerHTML=''; _maqNfeResumo(); return; }
  var h='<table class="maq-table"><thead><tr><th>Notas</th><th>Data</th><th>Fornecedor</th><th>Itens</th><th>Peças</th><th>Serviço</th><th>Máquina</th><th>Tipo</th><th>Fazenda</th><th></th></tr></thead><tbody>';
  G.forEach(function(g,i){
    if(g.erro) return;
    var destino;
    if(g.anexarA){
      destino='<td colspan="3" style="font-size:11.5px"><span class="maq-chip maq-chip-b">Anexar</span> '+
              'soma ao lançamento da '+_nfEsc('NF-e '+g.anexarA.numero)+', já importada (mesma OS '+_nfEsc(g.os)+')</td>';
    } else {
      destino='<td><select onchange="_maqNfeSet('+i+',&quot;maq&quot;,this.value)">'+_maqNfeOpcoesMaq(g.maq)+'</select></td>'+
              '<td><select onchange="_maqNfeSet('+i+',&quot;tipo&quot;,this.value)">'+_maqNfeOpcoesTipo(g.tipo,true)+'</select></td>'+
              '<td><select onchange="_maqNfeSet('+i+',&quot;floresta&quot;,this.value)">'+_maqNfeOpcoesFl(g.floresta)+'</select></td>';
    }
    h+='<tr>'+
      '<td class="maq-mono" style="font-size:11.5px">'+_nfEsc(nfRotuloNotas(g))+(g.os?'<div style="color:var(--text2)">OS '+_nfEsc(g.os)+'</div>':'')+'</td>'+
      '<td class="maq-mono">'+_nfEsc(formatDateBR(g.data))+'</td>'+
      '<td style="max-width:150px;font-size:11px">'+_nfEsc(g.emitNome||'-')+'</td>'+
      '<td style="max-width:200px;font-size:11px">'+_nfEsc(nfResumoItens(g))+'</td>'+
      '<td class="maq-mono">'+(g.pecas?fmtR(g.pecas):'—')+'</td>'+
      '<td class="maq-mono">'+(g.servicos?fmtR(g.servicos):'—')+'</td>'+
      destino+
      '<td style="text-align:center"><span class="maq-act" title="Tirar da lista" onclick="_maqNfeRemover('+i+')">✖</span></td>'+
      '</tr>';
  });
  cont.innerHTML=h+'</tbody></table>';
  _maqNfeResumo();
}

function _maqNfeResumo(){
  var imp=_maqNfe.grupos.filter(_maqNfeImportavel);
  var incompletos=imp.filter(function(g){ return !_maqNfeCompleto(g); });
  var total=imp.reduce(function(a,g){ return a+g.total; },0);
  var msg;
  if(!imp.length) msg='<strong>Nada para importar.</strong> <span style="color:var(--text2)">Todas as notas selecionadas ficaram de fora pelo motivo acima.</span>';
  else {
    msg='<strong>'+imp.length+'</strong> lançamento(s), somando <strong>'+fmtR(Math.round(total*100)/100)+'</strong>';
    if(incompletos.length) msg+='<div style="color:var(--yellow);margin-top:4px">⚠️ '+incompletos.length+' sem destino (máquina ou fazenda) ou sem tipo — complete para poder importar.</div>';
  }
  document.getElementById('maqNfeResumo').innerHTML=msg;
  var btn=document.getElementById('maqNfeImportBtn');
  btn.style.display=imp.length?'inline-flex':'none';
  btn.disabled=!imp.length||incompletos.length>0;
  btn.textContent='📥 Importar '+imp.length+' lançamento(s)';
}

function _maqNfeSet(i,campo,valor){ if(_maqNfe.grupos[i]){ _maqNfe.grupos[i][campo]=valor; _maqNfeResumo(); } }
function _maqNfeRemover(i){ _maqNfe.grupos.splice(i,1); _maqNfeRender(); }
function maqNfeAplicarTodos(campo){
  var id={maq:'maqNfeBulkMaq',tipo:'maqNfeBulkTipo',floresta:'maqNfeBulkFl'}[campo];
  var v=(document.getElementById(id)||{}).value||'';
  if(campo==='tipo' && !v){ showToast('Escolha o tipo primeiro',true); return; }
  _maqNfe.grupos.forEach(function(g){ if(!g.erro && !g.anexarA) g[campo]=v; });
  _maqNfeRender();
}

function _maqNfePayload(g){
  var docs=g.docs.map(nfDocPayload);
  if(g.anexarA) return {destino:'maq', anexar_a:g.anexarA.id, documentos:docs};
  return {destino:'maq', documentos:docs, lancamentos:[{
    data:g.data, id_maquina:g.maq||'', tipo:g.tipo, servico:nfResumoItens(g),
    custo_pecas:g.pecas, custo_mao_obra:g.servicos, custo_terceiros:0,
    oficina_fornecedor:g.emitNome||'', floresta_opc:g.floresta||'',
    obs:nfRotuloNotas(g)+(g.os?' · OS '+g.os:''),
    usuario_nome_legado:currentUserData?currentUserData.nome:''
  }]};
}

function maqNfeImportar(){
  var imp=_maqNfe.grupos.filter(_maqNfeImportavel);
  if(!imp.length) return;
  if(imp.some(function(g){ return !_maqNfeCompleto(g); })){ showToast('Complete destino e tipo de todas as linhas',true); return; }
  nfGravarGrupos(imp,_maqNfePayload,document.getElementById('maqNfeImportBtn'),function(ok,falhas){
    // recarrega sempre: mesmo com falhas, o que entrou tem que aparecer na tabela
    loadFromSheets(function(){
      if(document.getElementById('pageMaquinarios').classList.contains('active')) renderMaqManutTable();
      if(!falhas.length){ showToast('✅ '+ok+' lançamento(s) importado(s)!'); closeMaqNfeModal(); return; }
      // modal FICA aberto mostrando só o que o banco recusou e por quê
      console.warn('NF recusadas pelo banco:',falhas);
      _maqNfe.grupos=[];
      _maqNfe.rejeitados=[];
      falhas.forEach(function(f){ f.grupo.docs.forEach(function(d){ _maqNfe.rejeitados.push({doc:d,motivo:'Recusada',det:f.det}); }); });
      _maqNfeRender();
      showToast('⚠️ '+ok+' importado(s), '+falhas.length+' recusado(s) — motivo na tela',true);
    });
  });
}
// ===== FIM IMPORTAR NF (MAQUINÁRIOS) =====
