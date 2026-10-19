// ============================================================
// ===== PEÇAS, PRODUTOS E SERVIÇOS DAS NOTAS (nf_itens) ======
// Consulta os itens das notas fiscais importadas para responder: quanto se gastou em
// estopa, em filtro de ar, quantos litros de óleo uma placa levou, quanto de cada
// revisão foi peça e quanto foi mão de obra, quem gasta mais em freio.
// Só existe item para o que entrou por XML — lançamento digitado à mão tem só o total.
//
// Duas instâncias, porque as notas de caminhão e as de máquina/insumo moram em abas
// diferentes do sistema (decisão do redesenho: item de máquina não aparece em
// Manutenção, e vice-versa):
//   'manut' — embutida em Manutenção › Custos. Herda período e veículo do filtro do
//             topo e mostra resumo de uma linha, para não virar um segundo relatório
//             com totais próprios ao lado do primeiro. Só caminhão.
//   'maq'   — aba própria em Maquinários › Peças e Produtos. Relatório completo, com
//             KPIs e filtros próprios. Só máquina/insumo.
// Cada instância tem estado e containers próprios: id repetido no documento faz
// getElementById devolver sempre o primeiro, e a segunda instância nunca desenharia.
// ============================================================
var NF_REL_CFG={
  manut:{
    filtros:'nfRelFiltros', conteudo:'nfRelConteudo',
    embutido:true, origemFixa:'caminhao',
    // a busca fica fora do <details>, sempre à vista: é a pergunta mais comum
    // ("quanto gastei de estopa") e dentro do bloco fechado ninguém achava
    buscaTopo:'nfRelBuscaTopo', detalhes:'nfRelDetalhes'
  },
  maq:{
    filtros:'nfRelFiltrosMaq', conteudo:'nfRelConteudoMaq',
    embutido:false, origemFixa:'maq',
    // a busca tambem fica fora da barra de filtros aqui, para a aba abrir com a mesma
    // cara de Manutencao > Custos (nao tem <details> nesta: a aba ja e o relatorio)
    buscaTopo:'nfRelBuscaTopoMaq'
  }
};
function _nfRelNovo(origem){ return {busca:'',atalho:'',origem:origem||'',alvo:'',tipo:'',dtIni:'',dtFim:''}; }
var nfRelEst={ manut:_nfRelNovo('caminhao'), maq:_nfRelNovo('maq') };

// Mesmo reconhecimento do importador (js/nf-parse.js NF_REGRAS_TIPO), para "filtro de ar"
// não pegar o filtro de cabine nem "óleo motor" pegar óleo de câmbio. Freio aqui é GASTO
// com freio, então entra diagnóstico também — diferente da sugestão de tipo, que zera alerta.
var NF_REL_ATALHOS=[
  {id:'oleo',  rotulo:'🛢️ Óleo motor',          re:/OLEO\s+(PARA\s+|DE\s+|DO\s+|P\/\s*)?MOTOR|OLEO\s+LUBRIFICANTE|\b(5|10|15|20)W-?\d{2}\b/},
  {id:'foleo', rotulo:'Filtro de óleo',          re:/FILTRO\s+(DE\s+|DO\s+)?OLEO|FILTRO\s+LUBRIF/},
  {id:'far',   rotulo:'Filtro de ar',            re:/FILTRO\s+(DE\s+|DO\s+)?AR\b/},
  {id:'fcomb', rotulo:'Filtro de combustível',   re:/FILTR\w*\s+(DE\s+|DO\s+)?COMBUST|SEPARADOR\s+DE\s+AGUA/},
  {id:'freio', rotulo:'🛑 Freio',                re:/FREIO|PASTILHA|\bLONA\b/},
  {id:'pneu',  rotulo:'🛞 Pneu',                 re:/PNEU|CAMARA\s+DE\s+AR|RECAP/}
];

// Texto indo para dentro de um onclick='...': _nfEsc cuida do HTML mas não do apóstrofo
// nem da barra invertida, que quebrariam a string JS. Descrição de nota também vem com
// quebra de linha de vez em quando.
function _nfRelAttr(s){
  return _nfEsc(String(s==null?'':s).replace(/[\r\n]+/g,' ').replace(/\\/g,'\\\\')).replace(/'/g,"\\'");
}

function _nfRelUn(u){
  var n=_nfNorm(u).trim();
  if(/^(L|LT|LTS|LITRO|LITROS)$/.test(n)) return 'L';
  return n||'UN';
}
// De onde veio cada nota: placa do caminhão, ou máquina (ou "insumo" da fazenda)
function _nfRelOrigem(d){
  if(d.MANUT_REALIZADA_ID){
    var r=findManutRealById(d.MANUT_REALIZADA_ID);
    return {origem:'caminhao', alvo:r?r.PLACA:'?', id:d.MANUT_REALIZADA_ID};
  }
  var m=findManutById(d.MAQ_MANUTENCAO_ID);
  var alvo=m?(m.ID_MAQUINA?maqNome(m.ID_MAQUINA):'Insumo · '+(m.FLORESTA_OPC||'sem fazenda')):'?';
  return {origem:'maq', alvo:alvo, id:d.MAQ_MANUTENCAO_ID};
}
function _nfRelLinhas(){
  var docs={};
  (DB.nfDocumentos||[]).forEach(function(d){ docs[d.ID]=d; });
  var out=[];
  (DB.nfItens||[]).forEach(function(i){
    var d=docs[i.DOCUMENTO_ID]; if(!d) return;
    var o=_nfRelOrigem(d);
    out.push({item:i, doc:d, origem:o.origem, alvo:o.alvo, lancId:o.id,
      data:String(d.DATA_EMISSAO||'').slice(0,10), norm:_nfNorm(i.DESCRICAO), valor:num(i.VALOR)});
  });
  return out;
}
function _nfRelFiltrar(k,linhas){
  var S=nfRelEst[k];
  var at=NF_REL_ATALHOS.filter(function(a){ return a.id===S.atalho; })[0];
  var palavras=_nfNorm(S.busca).split(/\s+/).filter(Boolean);
  return linhas.filter(function(l){
    if(S.origem && l.origem!==S.origem) return false;
    if(S.alvo && l.alvo!==S.alvo) return false;
    if(S.tipo && l.item.TIPO!==S.tipo) return false;
    if(S.dtIni && l.data<S.dtIni) return false;
    if(S.dtFim && l.data>S.dtFim) return false;
    if(at && !at.re.test(l.norm)) return false;
    for(var i=0;i<palavras.length;i++){ if(l.norm.indexOf(palavras[i])<0) return false; }
    return true;
  });
}

// Chamado por Manutenção › Custos: o quadro é o detalhe do que está acima, então herda
// o recorte do filtro do topo em vez de ter seletores próprios brigando com ele.
function nfRelSincronizar(k,f){
  if(typeof f==='undefined'){ f=k; k='manut'; }   // compatibilidade com a chamada antiga
  var S=nfRelEst[k];
  S.origem=NF_REL_CFG[k].origemFixa;   // máquina e insumo pertencem à aba Maquinários
  S.alvo=f.placa||'';
  S.dtIni=f.dtIni||'';
  S.dtFim=f.dtFim||'';
}

function buildNfRelatorio(k,soResultado){
  k=k||'manut';
  var C=NF_REL_CFG[k], S=nfRelEst[k];
  var cont=document.getElementById(C.conteudo); if(!cont) return;
  S.origem=C.origemFixa;               // a instância nunca sai do seu lado da frota
  var todas=_nfRelLinhas();
  if(!soResultado) _nfRelFiltros(k,todas);
  _nfRelEcoBusca(k);
  if(!todas.length){
    cont.innerHTML='<div class="nf-rel-vazio">Nenhuma nota fiscal importada ainda.<br>Importe em Cadastro → Manutenção Realizada (caminhões) ou Maquinários → Manutenção.</div>';
    return;
  }
  var L=_nfRelFiltrar(k,todas);
  if(!L.length){ cont.innerHTML='<div class="nf-rel-vazio">Nada encontrado com esses filtros.</div>'; return; }

  // ---- totais ----
  var tot=0, pc=0, sv=0, un={}, notas={};
  L.forEach(function(l){
    tot+=l.valor;
    if(l.item.TIPO==='SERVICO') sv+=l.valor; else pc+=l.valor;
    notas[l.doc.ID]=1;
    var q=num(l.item.QUANTIDADE);
    if(l.item.TIPO==='PECA' && q){ var u=_nfRelUn(l.item.UNIDADE); un[u]=(un[u]||0)+q; }
  });
  // quantidade somada por unidade, sem converter (balde de 20 L não vira litro sozinho)
  var qtdTxt=Object.keys(un).sort(function(a,b){ return a==='L'?-1:(b==='L'?1:a.localeCompare(b)); })
    .map(function(u){ return fmt(un[u],(un[u]%1)?1:0)+' '+u; }).join(' · ')||'—';
  var h=C.embutido?'':'<div class="kpi-row" id="kpiNfRel_'+k+'">'+
    '<div class="kpi-card"><div class="kpi-icon">💰</div><div class="kpi-value">'+fmtR(Math.round(tot*100)/100)+'</div><div class="kpi-label">Total</div></div>'+
    '<div class="kpi-card"><div class="kpi-icon">🔩</div><div class="kpi-value">'+fmtR(Math.round(pc*100)/100)+'</div><div class="kpi-label">Peças'+(tot?' · '+Math.round(pc/tot*100)+'%':'')+'</div></div>'+
    '<div class="kpi-card"><div class="kpi-icon">🧰</div><div class="kpi-value">'+fmtR(Math.round(sv*100)/100)+'</div><div class="kpi-label">Mão de obra'+(tot?' · '+Math.round(sv/tot*100)+'%':'')+'</div></div>'+
    '<div class="kpi-card"><div class="kpi-icon">📦</div><div class="kpi-value" title="'+_nfEsc(qtdTxt)+'">'+_nfEsc(qtdTxt)+'</div><div class="kpi-label">Quantidade (peças)</div></div>'+
    '<div class="kpi-card"><div class="kpi-icon">📄</div><div class="kpi-value">'+Object.keys(notas).length+'</div><div class="kpi-label">Notas</div></div>'+
    '</div>';
  // no modo embutido o resumo vira uma linha só, sem competir com os indicadores do topo
  if(C.embutido) h='<div class="nf-rel-resumo">'+L.length+' itens em '+Object.keys(notas).length+
    ' nota(s) · <strong>'+fmtR(Math.round(tot*100)/100)+'</strong> — peças '+fmtR(Math.round(pc*100)/100)+
    ' · mão de obra '+fmtR(Math.round(sv*100)/100)+'</div>';

  // ---- por produto ----
  // Responde "quanto gastei de estopa" sem precisar saber o que digitar: a lista mostra
  // cada descrição com quantas vezes entrou e quanto somou. Clicar joga a descrição na
  // busca, e aí dá para encurtar o termo e juntar as variações ("ESTOPA" e "ESTOPA DE
  // MALHA COSTURADA" são itens diferentes na nota, mas o mesmo produto na prática).
  var pr={};
  L.forEach(function(l){
    var d=String(l.item.DESCRICAO||'(sem descrição)').trim();
    if(!pr[d]) pr[d]={v:0, n:0, q:0, un:'', sv:(l.item.TIPO==='SERVICO')};
    var p=pr[d]; p.v+=l.valor; p.n++;
    var q=num(l.item.QUANTIDADE);
    if(q){ var u=_nfRelUn(l.item.UNIDADE); if(!p.un||p.un===u){ p.un=u; p.q+=q; } else p.un='*'; }
  });
  var prL=Object.keys(pr).sort(function(a,b){ return pr[b].v-pr[a].v; });
  h+='<div class="manut-panel nf-rel-bloco"><div class="manut-ph"><div class="manut-ph-title">Por produto — quanto somou cada um</div>'+
     '<div class="manut-ph-badge">'+prL.length+' produto(s)</div></div>'+
     '<div class="table-scroll" style="max-height:340px"><table class="manut-km-tbl"><thead><tr><th>Produto / serviço</th><th></th><th>Vezes</th><th>Qtd</th><th>Total</th></tr></thead><tbody>';
  prL.forEach(function(d){
    var p=pr[d];
    h+='<tr class="nf-rel-clica" onclick="_nfRelBuscarProduto(\''+k+'\',\''+_nfRelAttr(d)+'\')" title="Buscar só este">'+
       '<td style="white-space:normal;min-width:260px">'+_nfEsc(d)+'</td>'+
       '<td><span class="maq-chip '+(p.sv?'maq-chip-b':'maq-chip-g')+'">'+(p.sv?'Serviço':'Peça')+'</span></td>'+
       '<td class="manut-km-num">'+p.n+'</td>'+
       '<td class="manut-km-num">'+(p.q&&p.un!=='*'?fmt(p.q,(p.q%1)?2:0)+' '+_nfEsc(p.un):'—')+'</td>'+
       '<td class="manut-km-num"><strong>'+fmtR(Math.round(p.v*100)/100)+'</strong></td></tr>';
  });
  h+='</tbody></table></div></div>';

  // ---- ranking por placa/máquina ----
  var rk={};
  L.forEach(function(l){ var kk=l.alvo; if(!rk[kk]) rk[kk]={v:0,pc:0,sv:0,origem:l.origem}; rk[kk].v+=l.valor; if(l.item.TIPO==='SERVICO') rk[kk].sv+=l.valor; else rk[kk].pc+=l.valor; });
  var rkL=Object.keys(rk).sort(function(a,b){ return rk[b].v-rk[a].v; }), mx=rkL.length?rk[rkL[0]].v:0;
  h+='<div class="manut-panel nf-rel-bloco"><div class="manut-ph"><div class="manut-ph-title">Quem gastou mais</div><div class="manut-ph-badge">'+rkL.length+(C.origemFixa==='maq'?' máquina(s)/insumo(s)':' placa(s)')+'</div></div><div class="nf-rel-rank">';
  rkL.forEach(function(kk,i){
    var o=rk[kk];
    h+='<div class="nf-rel-rank-lin" onclick="_nfRelSetAlvo(\''+k+'\',\''+_nfRelAttr(kk)+'\')" title="Filtrar só esta">'+
       '<span class="nf-rel-pos">'+(i+1)+'</span>'+
       '<span class="'+(o.origem==='caminhao'?'manut-placa-tag':'nf-rel-maq')+'">'+_nfEsc(kk)+'</span>'+
       '<div class="nf-rel-barra"><div style="width:'+(mx?Math.max(2,Math.round(o.v/mx*100)):0)+'%"></div></div>'+
       '<span class="manut-km-num">'+fmtR(Math.round(o.v*100)/100)+'</span>'+
       '<span class="nf-rel-split">peça '+fmtR(Math.round(o.pc*100)/100)+' · serviço '+fmtR(Math.round(o.sv*100)/100)+'</span></div>';
  });
  h+='</div></div>';

  // ---- por manutenção (revisão): quanto foi peça e quanto foi mão de obra ----
  var mt={};
  L.forEach(function(l){
    var kk=l.origem+'|'+l.lancId;
    if(!mt[kk]) mt[kk]={origem:l.origem, id:l.lancId, alvo:l.alvo, data:l.data, oficina:l.doc.EMITENTE_NOME, os:l.doc.OS_NUMERO, pc:0, sv:0, docs:{}};
    var m=mt[kk];
    if(l.data<m.data) m.data=l.data;
    if(l.item.TIPO==='SERVICO') m.sv+=l.valor; else m.pc+=l.valor;
    m.docs[l.doc.ID]=(l.doc.MODELO==='NFSE'?'NFS-e ':'NF-e ')+l.doc.NUMERO;
  });
  var mtL=Object.keys(mt).sort(function(a,b){ return String(mt[b].data).localeCompare(String(mt[a].data)); });
  h+='<div class="manut-panel nf-rel-bloco"><div class="manut-ph"><div class="manut-ph-title">Por manutenção — peça × mão de obra</div><div class="manut-ph-badge">'+mtL.length+' manutenção(ões)</div></div>'+
     '<div class="table-scroll" style="max-height:320px"><table class="manut-km-tbl"><thead><tr><th>Data</th><th>'+(C.origemFixa==='maq'?'Máquina':'Placa')+'</th><th>Oficina</th><th>Notas</th><th>Peças</th><th>Mão de obra</th><th>Total</th><th>% peças</th></tr></thead><tbody>';
  mtL.forEach(function(kk){
    var m=mt[kk], t=m.pc+m.sv;
    h+='<tr class="nf-rel-clica" onclick="nfAbrirDetalhe(\''+m.origem+'\',\''+m.id+'\')" title="Ver as peças e serviços">'+
       '<td class="manut-km-num">'+_nfEsc(formatDateBR(m.data))+'</td>'+
       '<td>'+(m.origem==='caminhao'?'<span class="manut-placa-tag">'+_nfEsc(m.alvo)+'</span>':_nfEsc(m.alvo))+'</td>'+
       '<td style="white-space:normal;max-width:220px">'+_nfEsc(m.oficina||'-')+(m.os?' <span style="color:var(--text2)">· OS '+_nfEsc(m.os)+'</span>':'')+'</td>'+
       '<td style="font-size:11.5px">📄 '+_nfEsc(Object.keys(m.docs).map(function(d){return m.docs[d];}).join(' + '))+'</td>'+
       '<td class="manut-km-num">'+(m.pc?fmtR(Math.round(m.pc*100)/100):'—')+'</td>'+
       '<td class="manut-km-num">'+(m.sv?fmtR(Math.round(m.sv*100)/100):'—')+'</td>'+
       '<td class="manut-km-num"><strong>'+fmtR(Math.round(t*100)/100)+'</strong></td>'+
       '<td class="manut-km-num">'+(t?Math.round(m.pc/t*100)+'%':'—')+'</td></tr>';
  });
  h+='</tbody></table></div></div>';

  // ---- itens ----
  L.sort(function(a,b){ return String(b.data).localeCompare(String(a.data)) || (b.valor-a.valor); });
  h+='<div class="manut-panel nf-rel-bloco"><div class="manut-ph"><div class="manut-ph-title">Item a item</div><div class="manut-ph-badge">'+L.length+' item(ns)</div></div>'+
     '<div class="table-scroll" style="max-height:420px"><table class="manut-km-tbl"><thead><tr><th>Data</th><th>'+(C.origemFixa==='maq'?'Máquina':'Placa')+'</th><th>Descrição</th><th></th><th>Qtd</th><th>Valor</th><th>Nota</th></tr></thead><tbody>';
  L.forEach(function(l){
    var q=num(l.item.QUANTIDADE), sv=l.item.TIPO==='SERVICO';
    h+='<tr class="nf-rel-clica" onclick="nfAbrirDetalhe(\''+l.origem+'\',\''+l.lancId+'\')">'+
       '<td class="manut-km-num">'+_nfEsc(formatDateBR(l.data))+'</td>'+
       '<td>'+(l.origem==='caminhao'?'<span class="manut-placa-tag">'+_nfEsc(l.alvo)+'</span>':_nfEsc(l.alvo))+'</td>'+
       '<td style="white-space:normal;min-width:260px">'+_nfEsc(l.item.DESCRICAO)+'</td>'+
       '<td><span class="maq-chip '+(sv?'maq-chip-b':'maq-chip-g')+'">'+(sv?'Serviço':'Peça')+'</span></td>'+
       '<td class="manut-km-num">'+(q?fmt(q,(q%1)?2:0)+' '+_nfEsc(_nfRelUn(l.item.UNIDADE)):'—')+'</td>'+
       '<td class="manut-km-num"><strong>'+fmtR(l.valor)+'</strong></td>'+
       '<td style="font-size:11.5px;color:var(--text2)">'+(l.doc.MODELO==='NFSE'?'NFS-e ':'NF-e ')+_nfEsc(l.doc.NUMERO)+'</td></tr>';
  });
  h+='</tbody></table></div></div>';
  cont.innerHTML=h;
}

// ---- barra de filtros ----
function _nfRelFiltros(k,todas){
  var C=NF_REL_CFG[k], S=nfRelEst[k];
  var el=document.getElementById(C.filtros); if(!el) return;
  var alvos={};
  todas.forEach(function(l){ if(!S.origem || l.origem===S.origem) alvos[l.alvo]=l.origem; });
  var alvoL=Object.keys(alvos).sort(function(a,b){ return a.localeCompare(b,'pt-BR'); });
  if(S.alvo && !alvos[S.alvo]) S.alvo='';
  var sel=function(v,o){ return v===o?' selected':''; };
  var h='<div class="nf-rel-atalhos"><span class="filter-label">Atalhos</span>';
  NF_REL_ATALHOS.forEach(function(a){
    h+='<div class="manut-filter-tag'+(S.atalho===a.id?' active':'')+'" onclick="_nfRelSet(\''+k+'\',\'atalho\',\''+(S.atalho===a.id?'':a.id)+'\')">'+a.rotulo+'</div>';
  });
  h+='</div><div class="nf-rel-linha">'+
    // na instância embutida a busca mora fora do <details>, sempre visível
    (C.buscaTopo?'':'<input type="text" class="filter-select nf-rel-busca" id="nfRelBusca_'+k+'" placeholder="🔎 Quanto gastei com... (ex.: estopa, correia, filtro de ar)" value="'+_nfEsc(S.busca)+'" oninput="_nfRelBuscar(\''+k+'\',this.value)">')+
    (C.embutido?'':'<select class="filter-select" onchange="_nfRelSet(\''+k+'\',\'alvo\',this.value)"><option value="">'+(C.origemFixa==='maq'?'Todas as máquinas/insumos':'Todas as placas')+'</option>'+
      alvoL.map(function(a){ return '<option'+sel(S.alvo,a)+'>'+_nfEsc(a)+'</option>'; }).join('')+'</select>')+
    '<select class="filter-select" onchange="_nfRelSet(\''+k+'\',\'tipo\',this.value)"><option value="">Peças e serviços</option><option value="PECA"'+sel(S.tipo,'PECA')+'>Só peças</option><option value="SERVICO"'+sel(S.tipo,'SERVICO')+'>Só mão de obra</option></select>'+
    (C.embutido?'':'<div class="nf-rel-datas">📅 De <input type="date" value="'+_nfEsc(S.dtIni)+'" onchange="_nfRelSet(\''+k+'\',\'dtIni\',this.value)"> até <input type="date" value="'+_nfEsc(S.dtFim)+'" onchange="_nfRelSet(\''+k+'\',\'dtFim\',this.value)"></div>')+
    '<button class="manut-filter-reset" onclick="_nfRelLimpar(\''+k+'\')">↺ Limpar</button></div>'+
    '<div class="nf-rel-nota">ℹ️ Só entra o que foi importado por nota fiscal (XML). Manutenção digitada à mão não tem as peças, só o total. '+
    'Busca por texto pega peça e serviço: "filtro de ar" também acha a mão de obra "substituir filtro de ar" — use "Só peças" para separar.</div>';
  el.innerHTML=h;
}
function _nfRelSet(k,campo,v){ nfRelEst[k][campo]=v; buildNfRelatorio(k); }
function _nfRelSetAlvo(k,a){ var S=nfRelEst[k]; S.alvo=(S.alvo===a)?'':a; buildNfRelatorio(k); }

// Busca: redesenha só o resultado (soResultado=true), senão o campo perderia o foco a
// cada letra digitada.
var _nfRelTimer={};
function _nfRelBuscar(k,v){
  nfRelEst[k].busca=v;
  clearTimeout(_nfRelTimer[k]);
  _nfRelTimer[k]=setTimeout(function(){ buildNfRelatorio(k,true); },250);
}
// Clicar numa linha de "Por produto" joga a descrição na busca
function _nfRelBuscarProduto(k,d){
  var S=nfRelEst[k];
  S.busca=(S.busca===d)?'':d;
  S.atalho='';
  buildNfRelatorio(k);
}
// Mantém o campo de fora do <details> e o resumo ao lado dele em sincronia com o estado,
// e abre o bloco sozinho quando há algo buscado — digitar e nada aparecer seria pior
// do que o problema que a busca resolve.
function _nfRelEcoBusca(k){
  var C=NF_REL_CFG[k], S=nfRelEst[k];
  if(!C.buscaTopo) return;
  var inp=document.getElementById(C.buscaTopo);
  if(inp && inp.value!==S.busca) inp.value=S.busca;
  var det=document.getElementById(C.detalhes);
  if(det && (S.busca||S.atalho)) det.open=true;
  var eco=document.getElementById(C.buscaTopo+'Eco');
  if(eco){
    if(!S.busca && !S.atalho){ eco.innerHTML=''; return; }
    var L=_nfRelFiltrar(k,_nfRelLinhas()), t=0, q={};
    L.forEach(function(l){
      t+=l.valor;
      var n=num(l.item.QUANTIDADE);
      if(n){ var u=_nfRelUn(l.item.UNIDADE); q[u]=(q[u]||0)+n; }
    });
    var qtd=Object.keys(q).map(function(u){ return fmt(q[u],(q[u]%1)?1:0)+' '+u; }).join(' · ');
    eco.innerHTML=L.length
      ? '<strong>'+fmtR(Math.round(t*100)/100)+'</strong> em '+L.length+' item(ns)'+(qtd?' · '+_nfEsc(qtd):'')
      : 'nada encontrado nas notas';
  }
}
function _nfRelLimpar(k){
  nfRelEst[k]=_nfRelNovo(NF_REL_CFG[k].origemFixa);
  // A instância embutida não é dona do período nem do veículo — quem manda é o filtro do
  // topo de Custos. Limpar aqui não pode largar o quadro fora daquele recorte, senão ele
  // passa a mostrar mais do que a tabela logo acima.
  if(NF_REL_CFG[k].embutido && typeof mcFiltro!=='undefined') nfRelSincronizar(k,mcFiltro);
  buildNfRelatorio(k);
}
// ===== FIM PEÇAS, PRODUTOS E SERVIÇOS =====
