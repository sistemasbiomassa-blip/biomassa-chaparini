// ============================================================
// ===== NOTAS FISCAIS: TELA (compartilhado) ==================
// Janela de detalhe (peças e serviços de cada nota ligada a um lançamento) e a caixa de
// avisos dos importadores. Lógica de leitura fica em js/nf-parse.js.
// ============================================================
function _nfEsc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// Caminhão: registros "acompanhantes" de uma revisão não guardam nota — ela fica no principal
function _nfIdPrincipal(destino,id){
  // a nota fica no lançamento principal; os companheiros (outros tipos no caminhão,
  // outras máquinas na nota dividida) apontam para ele
  var r=(destino==='caminhao')
    ? ((typeof findManutRealById==='function')?findManutRealById(id):null)
    : ((typeof findManutById==='function')?findManutById(id):null);
  return (r && r.NF_PRINCIPAL_ID)?r.NF_PRINCIPAL_ID:id;
}
function nfDocsDoLancamento(destino,id){
  var alvo=String(_nfIdPrincipal(destino,id)), campo=destino==='maq'?'MAQ_MANUTENCAO_ID':'MANUT_REALIZADA_ID';
  return (DB.nfDocumentos||[]).filter(function(d){ return String(d[campo])===alvo; })
    .sort(function(a,b){ return a.MODELO===b.MODELO?0:(a.MODELO==='NFE'?-1:1); });
}
// Selo clicável "📄 NF-e 19311 + NFS-e 1118" (vazio quando o lançamento não veio de nota)
function nfSeloNotas(destino,id){
  var docs=nfDocsDoLancamento(destino,id);
  if(!docs.length) return '';
  var txt=docs.map(function(d){ return (d.MODELO==='NFSE'?'NFS-e ':'NF-e ')+d.NUMERO; }).join(' + ');
  return '<span class="nf-selo" title="Ver peças e serviços da nota" onclick="nfAbrirDetalhe(\''+destino+'\',\''+id+'\')">📄 '+_nfEsc(txt)+'</span>';
}

function nfAbrirDetalhe(destino,id){
  var docs=nfDocsDoLancamento(destino,id);
  if(!docs.length){ showToast('Este lançamento não veio de nota fiscal',true); return; }
  var total=0, h='';
  docs.forEach(function(d){
    var itens=(DB.nfItens||[]).filter(function(i){ return String(i.DOCUMENTO_ID)===String(d.ID); })
      .sort(function(a,b){ return (a.N_ITEM||0)-(b.N_ITEM||0); });
    var servico=d.MODELO==='NFSE', temDesc=itens.some(function(i){ return num(i.DESCONTO)>0; });
    total+=num(d.VALOR_TOTAL);
    h+='<div class="nf-det-doc">'+
       '<div class="nf-det-cab"><div><strong>'+(servico?'🧾 NFS-e ':'📄 NF-e ')+_nfEsc(d.NUMERO)+'</strong> '+
       '<span class="maq-chip '+(servico?'maq-chip-b':'maq-chip-g')+'">'+(servico?'Serviços':'Peças')+'</span>'+
       '<div class="nf-det-sub">'+_nfEsc(d.EMITENTE_NOME||'-')+' · '+_nfEsc(formatDateBR(d.DATA_EMISSAO))+(d.OS_NUMERO?(' · OS '+_nfEsc(d.OS_NUMERO)):'')+'</div></div>'+
       '<div class="nf-det-valor">'+fmtR(num(d.VALOR_TOTAL))+'</div></div>'+
       '<div class="table-scroll"><table class="maq-table"><thead><tr><th>Descrição</th>'+(servico?'':'<th>Qtd</th>')+
       (temDesc?'<th>Valor cheio</th><th>Desconto</th>':'')+'<th>Valor</th></tr></thead><tbody>';
    itens.forEach(function(i){
      var q=num(i.QUANTIDADE);
      h+='<tr><td>'+_nfEsc(i.DESCRICAO)+'</td>'+
         (servico?'':'<td class="maq-mono">'+(q?(fmt(q,(q%1)?2:0)+(i.UNIDADE?' '+_nfEsc(i.UNIDADE):'')):'—')+'</td>')+
         (temDesc?'<td class="maq-mono">'+fmtR(num(i.VALOR_BRUTO))+'</td><td class="maq-mono" style="color:var(--green)">'+(num(i.DESCONTO)?'− '+fmtR(num(i.DESCONTO)):'—')+'</td>':'')+
         '<td class="maq-mono"><strong>'+fmtR(num(i.VALOR))+'</strong></td></tr>';
    });
    h+='</tbody></table></div>'+
       '<div class="nf-det-chave">Chave de acesso: <span class="maq-mono">'+_nfEsc(d.CHAVE)+'</span></div></div>';
  });
  if(docs.length>1) h+='<div class="nf-det-total">Total das notas: <strong>'+fmtR(Math.round(total*100)/100)+'</strong></div>';
  document.getElementById('nfDetConteudo').innerHTML=h;
  document.getElementById('nfDetOverlay').classList.add('show');
}
function nfFecharDetalhe(){ document.getElementById('nfDetOverlay').classList.remove('show'); }

// Texto para os modais de exclusão: o que mais some junto com o lançamento
function nfAvisoExclusao(destino,id){
  var docs=nfDocsDoLancamento(destino,id), linhas=[];
  if(destino==='caminhao'){
    var r=findManutRealById(id);
    if(r && r.NF_PRINCIPAL_ID){
      var p=findManutRealById(r.NF_PRINCIPAL_ID);
      return '<div class="nf-aviso-exc">Este registro faz parte da revisão lançada como <strong>'+_nfEsc(p?p.TIPO_MANUTENCAO:'?')+'</strong>. Só ele será apagado; a nota e o valor continuam no registro principal.</div>';
    }
    var acomp=DB.manutRealizada.filter(function(x){ return String(x.NF_PRINCIPAL_ID)===String(id); });
    if(acomp.length) linhas.push(acomp.length+' registro(s) da mesma revisão ('+_nfEsc(acomp.map(function(x){return x.TIPO_MANUTENCAO;}).join(', '))+')');
  }
  if(docs.length) linhas.push('a(s) nota(s) '+_nfEsc(docs.map(function(d){ return (d.MODELO==='NFSE'?'NFS-e ':'NF-e ')+d.NUMERO; }).join(' e '))+' com todos os itens — poderão ser importadas de novo');
  if(!linhas.length) return '';
  return '<div class="nf-aviso-exc">⚠️ Também serão apagados:<br>• '+linhas.join('<br>• ')+'</div>';
}

// Lista de itens na tela de CONFERÊNCIA (antes de importar). É lendo "elemento do filtro
// de ar" ou "tambor de freio" que se decide o tipo da manutenção e o destino — só o
// resumo ("17 peças · 7 serviços") não diz o que a nota tem dentro.
// Aberta por padrão em nota curta; em nota longa vem fechada, mas o título já mostra as
// primeiras descrições para não precisar abrir uma por uma num lote grande.
// celulaExtra(item, n): HTML de uma coluna a mais por item — usado pelo importador de
// maquinário para escolher a máquina de cada item quando a nota é dividida.
function nfItensHtml(g,celulaExtra){
  var its=(g&&g.itens)||[];
  if(!its.length) return '';
  var pc=its.filter(function(i){return i.tipo!=='SERVICO';}).length, sv=its.length-pc;
  var resumo=[];
  if(pc) resumo.push(pc+(pc===1?' peça':' peças'));
  if(sv) resumo.push(sv+(sv===1?' serviço':' serviços'));
  var amostra=its.slice(0,2).map(function(i){ return String(i.descricao||'').slice(0,38); }).join(' · ');
  if(its.length>2) amostra+=' · +'+(its.length-2);
  var linhas=its.map(function(i,n){
    var q=num(i.quantidade), serv=i.tipo==='SERVICO';
    return '<tr><td>'+(serv?'🧾':'📦')+'</td>'+
      '<td>'+_nfEsc(i.descricao)+'</td>'+
      '<td class="maq-mono">'+(q?fmt(q,(q%1)?2:0)+(i.unidade?' '+_nfEsc(i.unidade):''):'—')+'</td>'+
      '<td class="maq-mono">'+fmtR(num(i.valor))+'</td>'+
      (celulaExtra?('<td>'+celulaExtra(i,n)+'</td>'):'')+'</tr>';
  }).join('');
  return '<details class="nf-itens"'+((its.length<=10||celulaExtra)?' open':'')+'>'+
    '<summary><strong>'+resumo.join(' · ')+'</strong> <span>'+_nfEsc(amostra)+'</span></summary>'+
    '<div class="nf-itens-box"><table>'+linhas+'</table></div></details>';
}

// ---------- caixa de avisos dos importadores ----------
var _NF_MOTIVOS={
  'Já lançada':{cor:'var(--yellow)',ic:'⚠️',msg:'já tinha sido importada antes e foi ignorada'},
  'Repetida'  :{cor:'var(--yellow)',ic:'⚠️',msg:'foi selecionada duas vezes — só uma entra'},
  'Erro'      :{cor:'var(--red)',   ic:'❌',msg:'não pôde ser lida'},
  'Recusada'  :{cor:'var(--red)',   ic:'❌',msg:'foi recusada pelo banco'}
};
// Aviso no topo, agrupado por motivo e com o número das notas. Um chip discreto na
// linha passava batido e o botão de importar sumia sem explicar nada.
function nfRenderAvisos(elId,rejeitados,grupos){
  var por={}, extra='';
  (rejeitados||[]).forEach(function(r){
    var d=r.doc||{};
    (por[r.motivo]=por[r.motivo]||[]).push((d.numero?nfRotuloDoc(d):(d.arquivo||'?'))+(r.motivo==='Erro'||r.motivo==='Recusada'?': '+r.det:''));
  });
  var h='';
  Object.keys(por).forEach(function(k){
    var t=_NF_MOTIVOS[k]||{cor:'var(--text2)',ic:'•',msg:k}, l=por[k];
    h+='<div style="color:'+t.cor+';margin-bottom:5px">'+t.ic+' <strong>'+l.length+'</strong> nota(s) '+t.msg+
       ' <span style="color:var(--text2)">('+_nfEsc(l.slice(0,6).join(' · '))+(l.length>6?(' · +'+(l.length-6)):'')+')</span></div>';
  });
  (grupos||[]).forEach(function(g){
    if(g.outroCnpj) extra+='<div style="color:var(--orange);margin-bottom:5px">❗ '+_nfEsc(nfRotuloNotas(g))+': destinatário não é a Biomassa ('+_nfEsc(g.outroCnpj)+') — confira antes de importar</div>';
    if(g.erro) extra+='<div style="color:var(--red);margin-bottom:5px">❌ '+_nfEsc(nfRotuloNotas(g))+': '+_nfEsc(g.erro)+'</div>';
  });
  h+=extra;
  var el=document.getElementById(elId);
  el.innerHTML=h;
  el.style.display=h?'':'none';
}

// Lê os arquivos escolhidos; qualquer falha aqui vira aviso na tela (sem isto, um erro
// virava "promise rejeitada" no console e a tela simplesmente não mudava).
function nfLerSelecao(inputEl,destino,cb){
  var arqs=inputEl.files?Array.prototype.slice.call(inputEl.files):[];
  if(!arqs.length) return;
  Promise.all(arqs.map(nfLerArquivo)).then(function(docs){
    cb(nfMontarLista(docs,destino));
  }).catch(function(e){
    console.error('[NF] falha ao ler os XMLs:',e);
    showToast('❌ Erro ao ler os XMLs: '+((e&&e.message)||e),true);
  });
}

// Grava grupo a grupo, em sequência: em lote grande, disparar tudo de uma vez entope a
// conexão e deixa o erro de uma nota difícil de ligar ao arquivo que o causou.
function nfGravarGrupos(grupos,montarPayload,btn,aoTerminar){
  var ok=0, falhas=[], rotulo=btn.textContent;
  btn.disabled=true;
  (function proximo(k){
    if(k>=grupos.length){ btn.disabled=false; btn.textContent=rotulo; aoTerminar(ok,falhas); return; }
    btn.textContent='Importando '+(k+1)+'/'+grupos.length+'...';
    saveToSheets('importarNf',montarPayload(grupos[k]),function(sucesso,res){
      if(sucesso) ok++;
      else falhas.push({grupo:grupos[k],det:nfErroAmigavel(res&&res.error)});
      proximo(k+1);
    });
  })(0);
}
function nfDocPayload(d){
  return {chave:d.chave, modelo:d.modelo, numero:d.numero, serie:d.serie, data_emissao:d.data,
    emitente_cnpj:d.emitCnpj, emitente_nome:d.emitNome, valor_total:d.valor, os_numero:d.os||'',
    itens:d.itens||[]};
}
// ===== FIM NOTAS FISCAIS: TELA =====
