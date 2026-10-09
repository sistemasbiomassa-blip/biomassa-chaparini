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
    g.itemPartes=[]; g.qtdChutada=false; g.maqLida=false; g.maqTrecho='';
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
    else if(g.maqsNota.length>1 && g.itens.length===1 && num(g.itens[0].quantidade)>=2){
      // um produto só, mas várias unidades para várias máquinas (10 baldes de óleo para
      // PICADOR 01 e PICADOR 02): divide a QUANTIDADE. A nota não diz quanto é de cada
      // uma, então parte igual e avisa que é palpite.
      g.dividir=true; g.itemMaq=['']; g.itemPartes=[_maqNfePartesIguais(g.itens[0],g.maqsNota)];
      g.qtdChutada=true;
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
  // dividida: cada item precisa de uma máquina (se é para ir tudo na fazenda, não divide);
  // item com a quantidade repartida precisa de máquina em cada parte e a soma das
  // quantidades tem de fechar com a do item, senão sobraria ou faltaria mercadoria
  if(g.dividir) return g.itens.every(function(it,n){
    var partes=(g.itemPartes||[])[n];
    if(!partes || !partes.length) return !!g.itemMaq[n];
    var soma=0, ok=partes.length>1;
    partes.forEach(function(p){ if(!p.maq || !(num(p.qtd)>0)) ok=false; soma+=num(p.qtd); });
    return ok && Math.abs(soma-num(it.quantidade))<0.001;
  });
  return !!(g.maq||g.floresta);
}
// Nota que atende mais de uma máquina (ex.: óleo de motor do PICADOR 02 + hidráulico da
// ESCAVADEIRA 02 na mesma NF-e): cada item vai para a sua máquina e o sistema cria um
// lançamento por máquina, com o valor dos itens dela. A nota fica ligada aos dois.
function _maqNfeDividir(i,ligar){
  var g=_maqNfe.grupos[i]; if(!g) return;
  g.dividir=!!ligar;
  if(!g.dividir){ g.itemPartes=[]; g.qtdChutada=false; }
  else {
    if(!g.itemMaq.length) g.itemMaq=g.itens.map(function(){ return g.maq||''; });
    // nota de um item só: o que dá para dividir é a quantidade
    if(g.itens.length===1 && num(g.itens[0].quantidade)>=2 && !(g.itemPartes||[])[0])
      g.itemPartes=[_maqNfePartesIguais(g.itens[0],g.maqsNota)];
  }
  _maqNfeRender();
}
function _maqNfeItemMaq(i,n,v){
  var g=_maqNfe.grupos[i]; if(!g) return;
  g.itemMaq[n]=v;
  _maqNfeRender();
}
// ---------- quantidade do item repartida entre máquinas ----------
// Caso real (NF-e 426569): 10 baldes de óleo numa linha só, "PICADOR 01- PICADOR 02" nas
// observações. Não dá para dividir por item (é um item só), então divide a quantidade: o
// valor de cada máquina é proporcional, e a última parte fecha a conta no centavo.
function _maqNfePartesIguais(it,maqs){
  var total=num(it&&it.quantidade)||0, lista=(maqs||[]).slice(0,2), partes=[], resto=total;
  if(lista.length<2) lista=[{maq:{id:''}},{maq:{id:''}}];
  lista.forEach(function(x,k){
    var q=(k===lista.length-1)?resto:(total%1===0?Math.floor(total/lista.length):Math.round(total/lista.length*1000)/1000);
    partes.push({maq:String(x.maq.id||''), qtd:Math.round(q*1000)/1000});
    resto=Math.round((resto-q)*1000)/1000;
  });
  return partes;
}
function _maqNfeItemQtd(i,n,ligar){
  var g=_maqNfe.grupos[i]; if(!g) return;
  g.itemPartes=g.itemPartes||[];
  if(ligar){
    var sugeridas=(g.maqsNota&&g.maqsNota.length>1)?g.maqsNota:[{maq:{id:g.itemMaq[n]||''}}];
    g.itemPartes[n]=_maqNfePartesIguais(g.itens[n],sugeridas);
  } else {
    g.itemPartes[n]=null;
    g.qtdChutada=false;
  }
  _maqNfeRender();
}
function _maqNfeParteSet(i,n,k,campo,valor){
  var g=_maqNfe.grupos[i], p=g&&(g.itemPartes||[])[n]&&g.itemPartes[n][k]; if(!p) return;
  p[campo]= campo==='qtd' ? num(valor) : valor;
  g.qtdChutada=false;   // mexeu, não é mais palpite do sistema
  _maqNfeRender();
}
function _maqNfeParteAdd(i,n){
  var g=_maqNfe.grupos[i], partes=g&&(g.itemPartes||[])[n]; if(!partes) return;
  partes.push({maq:'', qtd:0});
  _maqNfeRender();
}
function _maqNfeParteDel(i,n,k){
  var g=_maqNfe.grupos[i], partes=g&&(g.itemPartes||[])[n]; if(!partes||partes.length<=2) return;
  partes.splice(k,1);
  _maqNfeRender();
}
// Como o item n se reparte: [{maq, qtd, valor}] — uma entrada só quando a quantidade não
// foi dividida. A última parte recebe a sobra dos centavos, para a soma fechar com o item.
function _maqNfeRepartir(g,n){
  var it=(g.itens||[])[n]||{}, partes=(g.itemPartes||[])[n];
  if(!partes || !partes.length)
    return [{maq:String((g.itemMaq||[])[n]||''), qtd:num(it.quantidade), valor:num(it.valor)}];
  var qTot=num(it.quantidade)||0, vTot=num(it.valor)||0, usado=0;
  return partes.map(function(p,k){
    var q=num(p.qtd)||0;
    var v=(k===partes.length-1)?_nfR2(vTot-usado):_nfR2(qTot?vTot*q/qTot:0);
    usado=_nfR2(usado+v);
    return {maq:String(p.maq||''), qtd:q, valor:v};
  });
}
// máquinas distintas escolhidas, na ordem em que aparecem (cada uma vira um lançamento)
function _maqNfeDestinos(g){
  var ordem=[];
  (g.itens||[]).forEach(function(it,n){
    _maqNfeRepartir(g,n).forEach(function(p){ if(ordem.indexOf(p.maq)<0) ordem.push(p.maq); });
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
              (g.qtdChutada?'<div class="nf-alerta">a nota não diz quanto é de cada uma — reparti em partes iguais, ajuste abaixo</div>':'')+
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
              (g.itens.length>1
                ? '<a class="nf-link" onclick="_maqNfeDividir('+i+',true)">dividir por item</a>'
                : (num((g.itens[0]||{}).quantidade)>=2
                   ? '<a class="nf-link" onclick="_maqNfeDividir('+i+',true)">dividir a quantidade</a>' : ''))+'</td>'+
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
        nfItensHtml(g, g.dividir?function(it,n){ return _maqNfeCelulaItem(i,n,it,g); }:null)+'</td></tr>';
  });
  cont.innerHTML=h+'</tbody></table></div>';
  _maqNfeResumo();
}

// Célula de destino de UM item, na lista de itens da nota dividida: a máquina dele ou,
// quando a quantidade está repartida, uma linha por máquina com quantidade e valor.
function _maqNfeCelulaItem(i,n,it,g){
  var partes=(g.itemPartes||[])[n], qTot=num(it.quantidade)||0;
  var qtdTxt=function(q){ return fmt(q,(q%1)?2:0)+(it.unidade?' '+it.unidade:''); };
  if(!partes || !partes.length){
    return '<select class="nf-item-maq" onchange="_maqNfeItemMaq('+i+','+n+',this.value)">'+_maqNfeOpcoesMaq(g.itemMaq[n]||'')+'</select>'+
           (qTot>=2?'<a class="nf-link" onclick="_maqNfeItemQtd('+i+','+n+',true)">dividir a quantidade</a>':'');
  }
  var val=_maqNfeRepartir(g,n), soma=0;
  var linhas=partes.map(function(p,k){
    soma+=num(p.qtd);
    return '<div class="nf-parte">'+
      '<select class="nf-item-maq" onchange="_maqNfeParteSet('+i+','+n+','+k+',&quot;maq&quot;,this.value)">'+_maqNfeOpcoesMaq(p.maq)+'</select>'+
      '<input class="nf-parte-qtd" value="'+_nfEsc(fmt(num(p.qtd),(num(p.qtd)%1)?2:0))+'" title="quantidade desta máquina"'+
        ' onchange="_maqNfeParteSet('+i+','+n+','+k+',&quot;qtd&quot;,this.value)">'+
      '<span class="nf-parte-val">'+(it.unidade?_nfEsc(it.unidade)+' · ':'')+fmtR(val[k].valor)+'</span>'+
      (partes.length>2?'<span class="maq-act" title="tirar esta máquina" onclick="_maqNfeParteDel('+i+','+n+','+k+')">✖</span>':'')+
      '</div>';
  }).join('');
  var falta=Math.round((qTot-soma)*1000)/1000;
  return linhas+
    (Math.abs(falta)>0.001
      ? '<span class="nf-alerta">'+(falta>0?'falta repartir ':'passou ')+qtdTxt(Math.abs(falta))+' de '+qtdTxt(qTot)+'</span>'
      : '')+
    '<a class="nf-link" onclick="_maqNfeParteAdd('+i+','+n+')">+ outra máquina</a>'+
    '<a class="nf-link" onclick="_maqNfeItemQtd('+i+','+n+',false)">não dividir a quantidade</a>';
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
  // Item com a quantidade repartida vira uma linha de item por máquina, com a quantidade
  // e o valor da parte — a soma continua igual à da nota.
  var ordem=_maqNfeDestinos(g), porMaq={};
  ordem.forEach(function(m,k){ porMaq[m]={idx:k, itens:[]}; });
  var reparticao=g.itens.map(function(it,n){ return _maqNfeRepartir(g,n); });
  g.itens.forEach(function(it,n){
    reparticao[n].forEach(function(p){
      porMaq[p.maq].itens.push({tipo:it.tipo, descricao:it.descricao, unidade:it.unidade, quantidade:p.qtd, valor:p.valor});
    });
  });
  var k=0;
  docs.forEach(function(d){
    var saida=[];
    (d.itens||[]).forEach(function(it){
      var ps=reparticao[k++], qT=0, restoB=num(it.valor_bruto), restoD=num(it.desconto);
      ps.forEach(function(p){ qT+=num(p.qtd); });
      ps.forEach(function(p,j){
        var copia={};
        for(var campo in it) copia[campo]=it[campo];
        copia.quantidade=p.qtd; copia.valor=p.valor;
        if(ps.length>1){   // bruto e desconto da parte, senão a linha sairia incoerente
          var f=qT?num(p.qtd)/qT:0, ultima=(j===ps.length-1);
          copia.valor_bruto=ultima?restoB:_nfR2(num(it.valor_bruto)*f);
          copia.desconto   =ultima?restoD:_nfR2(num(it.desconto)*f);
          restoB=_nfR2(restoB-copia.valor_bruto); restoD=_nfR2(restoD-copia.desconto);
        }
        copia.destino_idx=porMaq[p.maq].idx;
        saida.push(copia);
      });
    });
    d.itens=saida;
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
