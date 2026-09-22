// ============================================================
// ===== MANUTENÇÃO > PEÇAS E SERVIÇOS (itens das notas) ======
// Consulta as peças e serviços das notas fiscais importadas (nf_itens) para responder:
// quanto se gastou em filtro de ar, quantos litros de óleo uma placa levou, quanto de cada
// revisão foi peça e quanto foi mão de obra, quem gasta mais em freio.
// Só existe item para o que entrou por XML — lançamento digitado à mão tem só o total.
// ============================================================
var nfRel={busca:'',atalho:'',origem:'',alvo:'',tipo:'',dtIni:'',dtFim:''};

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
function _nfRelFiltrar(linhas){
  var at=NF_REL_ATALHOS.filter(function(a){ return a.id===nfRel.atalho; })[0];
  var palavras=_nfNorm(nfRel.busca).split(/\s+/).filter(Boolean);
  return linhas.filter(function(l){
    if(nfRel.origem && l.origem!==nfRel.origem) return false;
    if(nfRel.alvo && l.alvo!==nfRel.alvo) return false;
    if(nfRel.tipo && l.item.TIPO!==nfRel.tipo) return false;
    if(nfRel.dtIni && l.data<nfRel.dtIni) return false;
    if(nfRel.dtFim && l.data>nfRel.dtFim) return false;
    if(at && !at.re.test(l.norm)) return false;
    for(var k=0;k<palavras.length;k++){ if(l.norm.indexOf(palavras[k])<0) return false; }
    return true;
  });
}

// soResultado: redesenha só o resultado, sem refazer a barra de filtros (usado pela busca,
// para o campo de texto não perder o foco a cada letra digitada)
function buildNfRelatorio(soResultado){
  var cont=document.getElementById('nfRelConteudo'); if(!cont) return;
  var todas=_nfRelLinhas();
  if(!soResultado) _nfRelFiltros(todas);
  if(!todas.length){
    cont.innerHTML='<div class="nf-rel-vazio">Nenhuma nota fiscal importada ainda.<br>Importe em Cadastro → Manutenção Realizada (caminhões) ou Maquinários → Manutenção.</div>';
    return;
  }
  var L=_nfRelFiltrar(todas);
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
  var h='<div class="kpi-row" id="kpiNfRel">'+
    '<div class="kpi-card"><div class="kpi-icon">💰</div><div class="kpi-value">'+fmtR(Math.round(tot*100)/100)+'</div><div class="kpi-label">Total</div></div>'+
    '<div class="kpi-card"><div class="kpi-icon">🔩</div><div class="kpi-value">'+fmtR(Math.round(pc*100)/100)+'</div><div class="kpi-label">Peças'+(tot?' · '+Math.round(pc/tot*100)+'%':'')+'</div></div>'+
    '<div class="kpi-card"><div class="kpi-icon">🧰</div><div class="kpi-value">'+fmtR(Math.round(sv*100)/100)+'</div><div class="kpi-label">Mão de obra'+(tot?' · '+Math.round(sv/tot*100)+'%':'')+'</div></div>'+
    '<div class="kpi-card"><div class="kpi-icon">📦</div><div class="kpi-value" title="'+_nfEsc(qtdTxt)+'">'+_nfEsc(qtdTxt)+'</div><div class="kpi-label">Quantidade (peças)</div></div>'+
    '<div class="kpi-card"><div class="kpi-icon">📄</div><div class="kpi-value">'+Object.keys(notas).length+'</div><div class="kpi-label">Notas</div></div>'+
    '</div>';

  // ---- ranking por placa/máquina ----
  var rk={};
  L.forEach(function(l){ var k=l.alvo; if(!rk[k]) rk[k]={v:0,pc:0,sv:0,origem:l.origem}; rk[k].v+=l.valor; if(l.item.TIPO==='SERVICO') rk[k].sv+=l.valor; else rk[k].pc+=l.valor; });
  var rkL=Object.keys(rk).sort(function(a,b){ return rk[b].v-rk[a].v; }), mx=rkL.length?rk[rkL[0]].v:0;
  h+='<div class="manut-panel nf-rel-bloco"><div class="manut-ph"><div class="manut-ph-title">Quem gastou mais</div><div class="manut-ph-badge">'+rkL.length+' placa(s)/máquina(s)</div></div><div class="nf-rel-rank">';
  rkL.forEach(function(k,i){
    var o=rk[k];
    h+='<div class="nf-rel-rank-lin" onclick="_nfRelSetAlvo(\''+_nfEsc(k).replace(/'/g,"\\'")+'\')" title="Filtrar só esta">'+
       '<span class="nf-rel-pos">'+(i+1)+'</span>'+
       '<span class="'+(o.origem==='caminhao'?'manut-placa-tag':'nf-rel-maq')+'">'+_nfEsc(k)+'</span>'+
       '<div class="nf-rel-barra"><div style="width:'+(mx?Math.max(2,Math.round(o.v/mx*100)):0)+'%"></div></div>'+
       '<span class="manut-km-num">'+fmtR(Math.round(o.v*100)/100)+'</span>'+
       '<span class="nf-rel-split">peça '+fmtR(Math.round(o.pc*100)/100)+' · serviço '+fmtR(Math.round(o.sv*100)/100)+'</span></div>';
  });
  h+='</div></div>';

  // ---- por manutenção (revisão): quanto foi peça e quanto foi mão de obra ----
  var mt={};
  L.forEach(function(l){
    var k=l.origem+'|'+l.lancId;
    if(!mt[k]) mt[k]={origem:l.origem, id:l.lancId, alvo:l.alvo, data:l.data, oficina:l.doc.EMITENTE_NOME, os:l.doc.OS_NUMERO, pc:0, sv:0, docs:{}};
    var m=mt[k];
    if(l.data<m.data) m.data=l.data;
    if(l.item.TIPO==='SERVICO') m.sv+=l.valor; else m.pc+=l.valor;
    m.docs[l.doc.ID]=(l.doc.MODELO==='NFSE'?'NFS-e ':'NF-e ')+l.doc.NUMERO;
  });
  var mtL=Object.keys(mt).sort(function(a,b){ return String(mt[b].data).localeCompare(String(mt[a].data)); });
  h+='<div class="manut-panel nf-rel-bloco"><div class="manut-ph"><div class="manut-ph-title">Por manutenção — peça × mão de obra</div><div class="manut-ph-badge">'+mtL.length+' manutenção(ões)</div></div>'+
     '<div class="table-scroll" style="max-height:320px"><table class="manut-km-tbl"><thead><tr><th>Data</th><th>Placa / Máquina</th><th>Oficina</th><th>Notas</th><th>Peças</th><th>Mão de obra</th><th>Total</th><th>% peças</th></tr></thead><tbody>';
  mtL.forEach(function(k){
    var m=mt[k], t=m.pc+m.sv;
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
  h+='<div class="manut-panel nf-rel-bloco"><div class="manut-ph"><div class="manut-ph-title">Peças e serviços</div><div class="manut-ph-badge">'+L.length+' item(ns)</div></div>'+
     '<div class="table-scroll" style="max-height:420px"><table class="manut-km-tbl"><thead><tr><th>Data</th><th>Placa / Máquina</th><th>Descrição</th><th></th><th>Qtd</th><th>Valor</th><th>Nota</th></tr></thead><tbody>';
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
function _nfRelFiltros(todas){
  var el=document.getElementById('nfRelFiltros'); if(!el) return;
  var alvos={};
  todas.forEach(function(l){ if(!nfRel.origem || l.origem===nfRel.origem) alvos[l.alvo]=l.origem; });
  var alvoL=Object.keys(alvos).sort(function(a,b){ return a.localeCompare(b,'pt-BR'); });
  if(nfRel.alvo && !alvos[nfRel.alvo]) nfRel.alvo='';
  var sel=function(v,o){ return v===o?' selected':''; };
  var h='<div class="nf-rel-atalhos"><span class="filter-label">Atalhos</span>';
  NF_REL_ATALHOS.forEach(function(a){
    h+='<div class="manut-filter-tag'+(nfRel.atalho===a.id?' active':'')+'" onclick="_nfRelSet(\'atalho\',\''+(nfRel.atalho===a.id?'':a.id)+'\')">'+a.rotulo+'</div>';
  });
  h+='</div><div class="nf-rel-linha">'+
    '<input type="text" class="filter-select" id="nfRelBusca" placeholder="🔎 Buscar na descrição (ex.: correia, graxa)" value="'+_nfEsc(nfRel.busca)+'" oninput="_nfRelBuscar(this.value)">'+
    '<select class="filter-select" onchange="_nfRelSet(\'origem\',this.value)"><option value="">🚛🚜 Caminhões e máquinas</option><option value="caminhao"'+sel(nfRel.origem,'caminhao')+'>🚛 Só caminhões</option><option value="maq"'+sel(nfRel.origem,'maq')+'>🚜 Só maquinário</option></select>'+
    '<select class="filter-select" onchange="_nfRelSet(\'alvo\',this.value)"><option value="">Todas as placas/máquinas</option>'+
      alvoL.map(function(a){ return '<option'+sel(nfRel.alvo,a)+'>'+_nfEsc(a)+'</option>'; }).join('')+'</select>'+
    '<select class="filter-select" onchange="_nfRelSet(\'tipo\',this.value)"><option value="">Peças e serviços</option><option value="PECA"'+sel(nfRel.tipo,'PECA')+'>Só peças</option><option value="SERVICO"'+sel(nfRel.tipo,'SERVICO')+'>Só mão de obra</option></select>'+
    '<div class="nf-rel-datas">📅 De <input type="date" value="'+_nfEsc(nfRel.dtIni)+'" onchange="_nfRelSet(\'dtIni\',this.value)"> até <input type="date" value="'+_nfEsc(nfRel.dtFim)+'" onchange="_nfRelSet(\'dtFim\',this.value)"></div>'+
    '<button class="manut-filter-reset" onclick="_nfRelLimpar()">↺ Limpar</button></div>'+
    '<div class="nf-rel-nota">ℹ️ Só entra o que foi importado por nota fiscal (XML). Manutenção digitada à mão não tem as peças, só o total. '+
    'Busca por texto pega peça e serviço: "filtro de ar" também acha a mão de obra "substituir filtro de ar" — use "Só peças" para separar.</div>';
  el.innerHTML=h;
}
function _nfRelSet(campo,v){ nfRel[campo]=v; buildNfRelatorio(); }
function _nfRelSetAlvo(a){ nfRel.alvo=(nfRel.alvo===a)?'':a; buildNfRelatorio(); }
var _nfRelTimer=null;
function _nfRelBuscar(v){
  nfRel.busca=v;
  clearTimeout(_nfRelTimer);
  _nfRelTimer=setTimeout(function(){ buildNfRelatorio(true); },250);
}
function _nfRelLimpar(){ nfRel={busca:'',atalho:'',origem:'',alvo:'',tipo:'',dtIni:'',dtFim:''}; buildNfRelatorio(); }
// ===== FIM PEÇAS E SERVIÇOS =====
