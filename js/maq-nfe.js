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

// Prepara os lançamentos recém-lidos: o que já dá para adivinhar vem preenchido, o resto
// fica em branco esperando a conferência.
function _maqNfePrepararGrupos(L){
  var lista=(DB.maquinas||[]).map(function(m){ return {id:m.ID, nome:m.IDENTIFICACAO}; });
  L.grupos.forEach(function(g){
    // compra sem OS (insumo a granel) já nasce como Insumo; com serviço/OS o usuário escolhe
    g.maq=''; g.floresta=''; g.tipo=(!g.os && !g.servicos)?'Insumo':''; g.dividir=false; g.itemMaq=[];
    g.maqLida=false; g.maqTrecho='';
    // o fornecedor escreve a máquina nas informações complementares da nota
    g.maqsNota=nfAcharMaquinas(g.textoLivre, lista);
    if(g.maqsNota.length===1){
      g.maq=String(g.maqsNota[0].maq.id);
      g.maqLida=true;
      // nome escrito errado na nota ("SKIDY 02"): preenche, mas pede conferência
      if(!g.maqsNota[0].exato) g.maqTrecho=g.maqsNota[0].trecho;
    }
    else if(g.maqsNota.length>1 && g.itens.length>1){
      // mais de uma máquina citada: já abre dividido, mas sem adivinhar qual item é de
      // qual — o usuário aponta item a item (fica incompleto até ele escolher)
      g.dividir=true; g.itemMaq=g.itens.map(function(){ return ''; });
    }
  });
  return L;
}

function maqNfeLerArquivos(){
  nfLerSelecao(document.getElementById('maqNfeFiles'),'maq',function(L){
    _maqNfePrepararGrupos(L);
    _maqNfe=L;
    _maqNfeRender();
    var n=L.grupos.filter(_maqNfeImportavel).length, fora=L.rejeitados.length+L.grupos.filter(function(g){return g.erro;}).length;
    if(fora) showToast('⚠️ '+fora+' nota(s) ficaram de fora — veja o aviso no topo',true);
    else if(n) showToast('✅ '+n+' lançamento(s) montados — escolha o destino e confira');
  });
}

function _maqNfeImportavel(g){ return !g.erro; }
function _maqNfeCompleto(g){
  if(g.anexarA) return true;
  if(!g.tipo) return false;
  // dividida: cada item precisa de uma máquina (se é para ir tudo na fazenda, não divide)
  if(g.dividir) return g.itens.every(function(it,n){ return !!g.itemMaq[n]; });
  return !!(g.maq||g.floresta);
}
// Nota que atende mais de uma máquina (ex.: óleo de motor do PICADOR 02 + hidráulico da
// ESCAVADEIRA 02 na mesma NF-e): cada item vai para a sua máquina e o sistema cria um
// lançamento por máquina, com o valor dos itens dela. A nota fica ligada aos dois.
function _maqNfeDividir(i,ligar){
  var g=_maqNfe.grupos[i]; if(!g) return;
  g.dividir=!!ligar;
  if(g.dividir && !g.itemMaq.length) g.itemMaq=g.itens.map(function(){ return g.maq||''; });
  _maqNfeRender();
}
function _maqNfeItemMaq(i,n,v){
  var g=_maqNfe.grupos[i]; if(!g) return;
  g.itemMaq[n]=v;
  _maqNfeRender();
}
// máquinas distintas escolhidas, na ordem em que aparecem (cada uma vira um lançamento)
function _maqNfeDestinos(g){
  var ordem=[];
  (g.itens||[]).forEach(function(it,n){
    var m=String(g.itemMaq[n]||'');
    if(ordem.indexOf(m)<0) ordem.push(m);
  });
  return ordem;
}

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
  // atalho de lote só aparece com 2+ lançamentos; com um só, os campos da linha bastam
  var bulk=document.getElementById('maqNfeBulk');
  if(bulk) bulk.style.display=(G.filter(_maqNfeImportavel).length>1)?'':'none';
  document.getElementById('maqNfeBulkMaq').innerHTML=_maqNfeOpcoesMaq('');
  document.getElementById('maqNfeBulkTipo').innerHTML=_maqNfeOpcoesTipo('',true);
  document.getElementById('maqNfeBulkFl').innerHTML=_maqNfeOpcoesFl('');
  nfRenderAvisos('maqNfeAvisos',_maqNfe.rejeitados,G);

  var cont=document.getElementById('maqNfeTable');
  var imp=G.filter(_maqNfeImportavel);
  if(!imp.length){ cont.innerHTML=''; _maqNfeResumo(); return; }
  // Os itens vão numa linha própria abaixo (não numa coluna): com eles na linha, a tabela
  // ficava mais larga que o modal e a coluna Fazenda saía da tela — e .table-container
  // tem overflow:hidden, então ela ficava inalcançável.
  var COLS=9;
  var h='<div class="table-scroll"><table class="maq-table"><thead><tr><th>Notas</th><th>Data</th><th>Fornecedor</th><th>Peças</th><th>Serviço</th><th>Máquina</th><th>Tipo</th><th>Fazenda</th><th></th></tr></thead><tbody>';
  G.forEach(function(g,i){
    if(g.erro) return;
    var destino;
    if(g.anexarA){
      destino='<td colspan="3" style="font-size:11.5px"><span class="maq-chip maq-chip-b">Anexar</span> '+
              'soma ao lançamento da '+_nfEsc('NF-e '+g.anexarA.numero)+', já importada (mesma OS '+_nfEsc(g.os)+')</td>';
    } else if(g.dividir){
      var dest=_maqNfeDestinos(g).filter(function(m){ return m; });
      var citadas=(g.maqsNota&&g.maqsNota.length>1)
        ? '<div class="nf-lido">a nota cita: '+_nfEsc(g.maqsNota.map(function(x){return x.maq.nome;}).join(', '))+'</div>'
        : '';
      destino='<td style="font-size:11.5px"><span class="maq-chip maq-chip-b">Dividida</span>'+citadas+
              (dest.length?'<div style="margin-top:3px">'+dest.map(function(m){ return _nfEsc(maqNome(m)); }).join('<br>')+'</div>'
                          :'<div class="nf-alerta">escolha a máquina de cada item abaixo</div>')+
              '<a class="nf-link" onclick="_maqNfeDividir('+i+',false)">voltar a uma máquina só</a></td>'+
              '<td><select onchange="_maqNfeSet('+i+',&quot;tipo&quot;,this.value)">'+_maqNfeOpcoesTipo(g.tipo,true)+'</select></td>'+
              '<td><select onchange="_maqNfeSet('+i+',&quot;floresta&quot;,this.value)">'+_maqNfeOpcoesFl(g.floresta)+'</select></td>';
    } else {
      // o nome da máquina costuma vir nas observações da nota: avisa o que foi lido
      var citou=(g.maqsNota||[]).map(function(x){ return x.maq.nome; });
      var avMaq='';
      if(g.maqLida && citou.length===1 && String(g.maq)===String(g.maqsNota[0].maq.id))
        avMaq=g.maqTrecho
          ? '<span class="nf-alerta">a nota diz "'+_nfEsc(g.maqTrecho)+'" — entendi que é esta, confira</span>'
          : '<span class="nf-lido">✓ lida da nota</span>';
      else if(citou.length>1)
        avMaq='<span class="nf-alerta">a nota cita '+_nfEsc(citou.join(', '))+'</span>';
      destino='<td><select onchange="_maqNfeSet('+i+',&quot;maq&quot;,this.value)">'+_maqNfeOpcoesMaq(g.maq)+'</select>'+avMaq+
              (g.itens.length>1?'<a class="nf-link" onclick="_maqNfeDividir('+i+',true)">dividir por item</a>':'')+'</td>'+
              '<td><select onchange="_maqNfeSet('+i+',&quot;tipo&quot;,this.value)">'+_maqNfeOpcoesTipo(g.tipo,true)+'</select></td>'+
              '<td><select onchange="_maqNfeSet('+i+',&quot;floresta&quot;,this.value)">'+_maqNfeOpcoesFl(g.floresta)+'</select></td>';
    }
    h+='<tr>'+
      '<td class="maq-mono" style="font-size:11.5px">'+_nfEsc(nfRotuloNotas(g))+(g.os?'<div style="color:var(--text2)">OS '+_nfEsc(g.os)+'</div>':'')+'</td>'+
      '<td class="maq-mono">'+_nfEsc(formatDateBR(g.data))+'</td>'+
      '<td class="nf-forn" title="'+_nfEsc(g.emitNome||'')+'">'+_nfEsc(g.emitNome||'-')+'</td>'+
      '<td class="maq-mono">'+(g.pecas?fmtR(g.pecas):'—')+'</td>'+
      '<td class="maq-mono">'+(g.servicos?fmtR(g.servicos):'—')+'</td>'+
      destino+
      '<td style="text-align:center"><span class="maq-act" title="Tirar da lista" onclick="_maqNfeRemover('+i+')">✖</span></td>'+
      '</tr>'+
      '<tr class="nf-itens-linha"><td colspan="'+COLS+'">'+
        nfItensHtml(g, g.dividir?function(it,n){
          return '<select class="nf-item-maq" onchange="_maqNfeItemMaq('+i+','+n+',this.value)">'+_maqNfeOpcoesMaq(g.itemMaq[n]||'')+'</select>';
        }:null)+'</td></tr>';
  });
  cont.innerHTML=h+'</tbody></table></div>';
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
  var nome=currentUserData?currentUserData.nome:'';
  var obs=nfRotuloNotas(g)+(g.os?' · OS '+g.os:'');
  if(!g.dividir){
    return {destino:'maq', documentos:docs, lancamentos:[{
      data:g.data, id_maquina:g.maq||'', tipo:g.tipo, servico:nfResumoItens(g),
      custo_pecas:g.pecas, custo_mao_obra:g.servicos, custo_terceiros:0,
      oficina_fornecedor:g.emitNome||'', floresta_opc:g.floresta||'',
      obs:obs, usuario_nome_legado:nome
    }]};
  }
  // Dividida: um lançamento por máquina, com o valor dos itens dela. Os itens do payload
  // levam destino_idx (posição do lançamento), e o banco guarda de quem é cada item.
  var ordem=_maqNfeDestinos(g), porMaq={};
  ordem.forEach(function(m,k){ porMaq[m]={idx:k, itens:[]}; });
  g.itens.forEach(function(it,n){ porMaq[String(g.itemMaq[n]||'')].itens.push(it); });
  var k=0;
  docs.forEach(function(d){
    d.itens=(d.itens||[]).map(function(it){
      var copia={}, m=String(g.itemMaq[k++]||'');
      for(var campo in it) copia[campo]=it[campo];
      copia.destino_idx=porMaq[m].idx;
      return copia;
    });
  });
  var soma=function(itens,servico){
    return Math.round(itens.filter(function(i){ return servico?(i.tipo==='SERVICO'):(i.tipo!=='SERVICO'); })
      .reduce(function(a,i){ return a+num(i.valor); },0)*100)/100;
  };
  return {destino:'maq', documentos:docs, lancamentos:ordem.map(function(m){
    var itens=porMaq[m].itens;
    return {
      data:g.data, id_maquina:m||'', tipo:g.tipo,
      servico:nfResumoItens({itens:itens, os:g.os}),
      custo_pecas:soma(itens,false), custo_mao_obra:soma(itens,true), custo_terceiros:0,
      oficina_fornecedor:g.emitNome||'', floresta_opc:g.floresta||'',
      obs:obs+' · nota dividida entre '+ordem.length+' máquinas',
      usuario_nome_legado:nome
    };
  })};
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
