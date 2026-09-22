// ============================================================
// ===== NOTAS FISCAIS: LEITURA DE XML (compartilhado) ========
// Lê NF-e (peças, modelo 55) e NFS-e do Padrão Nacional (serviço) e devolve um formato
// único; junta as notas de uma mesma OS e sugere os tipos de manutenção.
// Usado pelos importadores de Maquinários (maq-nfe.js) e Caminhões (cam-nfe.js).
// Só lógica — nada de tela aqui, para poder ser testado fora do navegador.
// ============================================================
var NF_CNPJ_EMPRESA='24378345000141'; // BIOMASSA CHAPARINI — confere o destinatário

function _nfDig(s){ return String(s==null?'':s).replace(/[^0-9]/g,''); }
function _nfEl(root,tag){ if(!root) return null; var e=root.getElementsByTagNameNS('*',tag); return e.length?e[0]:null; }
function _nfTxt(root,tag){ var e=_nfEl(root,tag); return e?String(e.textContent||'').trim():''; }
// Número vindo do XML: NF-e e NFS-e usam SEMPRE ponto decimal e nunca separador de
// milhar ("2506.00", "7.0000", "130.200"). O num() do app é para o formato brasileiro e
// leria "130.200" como cento e trinta mil — por isso parseFloat direto.
function _nfNum(root,tag){ var t=_nfTxt(root,tag); if(!t) return 0; var n=parseFloat(t); return isNaN(n)?0:n; }
function _nfR2(v){ return Math.round((v||0)*100)/100; }
function _nfNorm(s){ return String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toUpperCase(); }

// ---------- leitura do arquivo ----------
// Boa parte das NF-e vem em ISO-8859-1 (a declaração no topo do XML diz qual é). Ler
// tudo como UTF-8 embaralharia os acentos ("JOSÉ" virando "JOS�"), então lemos os bytes,
// olhamos a declaração e decodificamos com ela.
function nfLerArquivo(f){
  return new Promise(function(res){
    var fr=new FileReader();
    fr.onload=function(){
      var buf=fr.result, bytes=new Uint8Array(buf), cabeca='';
      for(var i=0;i<Math.min(bytes.length,200);i++) cabeca+=String.fromCharCode(bytes[i]);
      var m=/encoding=["']([^"']+)["']/i.exec(cabeca);
      var texto;
      try{ texto=new TextDecoder((m?m[1]:'utf-8').toLowerCase()).decode(buf); }
      catch(e){ texto=new TextDecoder('utf-8').decode(buf); }
      res(nfParse(texto,f.name));
    };
    fr.onerror=function(){ res({arquivo:f.name,erro:'falha ao ler o arquivo'}); };
    fr.readAsArrayBuffer(f);
  });
}

// ---------- parse ----------
function nfParse(texto,arquivo){
  var b={arquivo:arquivo};
  // BOM ou espaço antes da declaração <?xml ...?> faz o DOMParser recusar o arquivo
  texto=String(texto||'').replace(/^﻿/,'').replace(/^\s+/,'');
  var doc;
  try{ doc=new DOMParser().parseFromString(texto,'text/xml'); }
  catch(e){ b.erro='não foi possível ler o arquivo'; return b; }
  if(!doc || !doc.documentElement || doc.getElementsByTagName('parsererror').length){ b.erro='XML inválido ou corrompido'; return b; }

  var infNFe=_nfEl(doc,'infNFe');   if(infNFe)  return _nfParseNFe(doc,infNFe,b);
  var infNFSe=_nfEl(doc,'infNFSe'); if(infNFSe) return _nfParseNFSe(doc,infNFSe,b);
  // layout antigo de prefeitura (ABRASF): cada cidade tem o seu, não dá para ler com segurança
  if(_nfEl(doc,'InfNfse')||_nfEl(doc,'CompNfse')||_nfEl(doc,'Rps')){ b.erro='NFS-e no formato antigo da prefeitura — ainda não suportada, lance à mão'; return b; }
  b.erro='não é uma NF-e nem uma NFS-e'; return b;
}

function _nfParseNFe(doc,inf,b){
  b.modelo='NFE';
  // chave: atributo Id ("NFe" + 44 dígitos); o protocolo repete em chNFe
  var chave=_nfDig(inf.getAttribute('Id')||'');
  if(chave.length!==44) chave=_nfDig(_nfTxt(doc,'chNFe'));
  if(chave.length!==44){ b.erro='NF-e sem chave de acesso válida (44 dígitos)'; return b; }

  var ide=_nfEl(inf,'ide'), emit=_nfEl(inf,'emit'), dest=_nfEl(inf,'dest');
  // o total sai de dentro de ICMSTot: "vProd" solto pegaria o primeiro item
  var tot=_nfEl(_nfEl(inf,'total'),'ICMSTot');
  b.chave=chave;
  b.numero=_nfTxt(ide,'nNF');
  b.serie=_nfTxt(ide,'serie');
  b.data=String(_nfTxt(ide,'dhEmi')||_nfTxt(ide,'dEmi')).slice(0,10);
  b.emitNome=_nfTxt(emit,'xNome');
  b.emitCnpj=_nfDig(_nfTxt(emit,'CNPJ')||_nfTxt(emit,'CPF'));
  b.destNome=_nfTxt(dest,'xNome');
  b.destCnpj=_nfDig(_nfTxt(dest,'CNPJ')||_nfTxt(dest,'CPF'));
  b.valor=_nfR2(_nfNum(tot,'vNF'));

  b.itens=[];
  var dets=inf.getElementsByTagNameNS('*','det'), soma=0;
  for(var i=0;i<dets.length;i++){
    var det=dets[i], prod=_nfEl(det,'prod'), imp=_nfEl(det,'imposto');
    if(!prod) continue;
    var bruto=_nfNum(prod,'vProd'), desc=_nfNum(prod,'vDesc');
    // valor do item que efetivamente compõe o total da nota: com o desconto aplicado e
    // somando frete/seguro/outros/ST/IPI do item. Com o valor cheio, a revisão da TECAR
    // somaria R$ 5.700,62 em itens para uma nota de R$ 4.723,72.
    var liq=_nfR2(bruto-desc+_nfNum(prod,'vFrete')+_nfNum(prod,'vSeg')+_nfNum(prod,'vOutro')
                  +_nfNum(imp,'vICMSST')+_nfNum(imp,'vFCPST')+_nfNum(_nfEl(imp,'IPI'),'vIPI'));
    soma+=liq;
    b.itens.push({n_item:parseInt(det.getAttribute('nItem'),10)||(i+1), tipo:'PECA',
      codigo:_nfTxt(prod,'cProd'), descricao:_nfTxt(prod,'xProd'),
      quantidade:_nfNum(prod,'qCom'), unidade:_nfTxt(prod,'uCom'),
      valor_bruto:bruto, desconto:desc, valor:liq});
  }
  if(b.itens.length && Math.abs(_nfR2(soma)-b.valor)>0.05)
    b.avisoItens='a soma dos itens ('+_nfR2(soma).toFixed(2)+') não bate com o total da nota ('+b.valor.toFixed(2)+')';

  b.textoLivre=_nfTxt(_nfEl(inf,'infAdic'),'infCpl');
  _nfAplicarOS(b);
  return _nfValidar(b);
}

function _nfParseNFSe(doc,inf,b){
  b.modelo='NFSE';
  var chave=_nfDig(inf.getAttribute('Id')||'');
  if(chave.length!==50){ b.erro='NFS-e sem chave de acesso válida (50 dígitos)'; return b; }

  var dps=_nfEl(inf,'infDPS')||_nfEl(doc,'infDPS');
  var emit=_nfEl(inf,'emit'), toma=_nfEl(dps,'toma'), serv=_nfEl(dps,'serv');
  b.chave=chave;
  b.numero=_nfTxt(inf,'nNFSe');
  b.serie=_nfTxt(dps,'serie');
  b.data=String(_nfTxt(dps,'dhEmi')||_nfTxt(dps,'dCompet')||_nfTxt(inf,'dhProc')).slice(0,10);
  b.emitNome=_nfTxt(emit,'xNome');
  b.emitCnpj=_nfDig(_nfTxt(emit,'CNPJ')||_nfTxt(emit,'CPF'));
  b.destNome=_nfTxt(toma,'xNome');
  b.destCnpj=_nfDig(_nfTxt(toma,'CNPJ')||_nfTxt(toma,'CPF'));
  // custo = valor do serviço menos desconto incondicionado. NÃO usar vLiq: retenções
  // (ISS retido, IR, PIS...) reduzem o que se paga à oficina mas continuam sendo custo
  // da empresa — só que recolhido ao governo.
  var vServ=_nfNum(_nfEl(dps,'vServPrest'),'vServ')||_nfNum(dps,'vServ');
  b.valor=_nfR2(vServ-_nfNum(dps,'vDescIncond'));

  b.textoLivre=_nfTxt(serv,'xDescServ');
  b.itens=_nfItensServico(b.textoLivre,b.valor);
  _nfAplicarOS(b);
  return _nfValidar(b);
}

// A NFS-e não tem lista de itens: o serviço é um texto livre (xDescServ). Sistema de
// concessionária (ex.: TECAR) escreve "CÓDIGO - descrição = valor" em sequência; quando
// dá para separar E a soma bate com o total, vira um item por serviço. Senão, um item só
// com o texto inteiro — nunca inventar valor por item.
function _nfItensServico(desc,total){
  var re=/(\d{6,}) - (.+?) = (\d{1,3}(?:\.\d{3})+,\d{2}|\d+,\d{2})/g, m, itens=[], soma=0;
  while((m=re.exec(desc||''))){
    var v=parseFloat(m[3].replace(/\./g,'').replace(',','.'));
    soma+=v;
    itens.push({n_item:itens.length+1, tipo:'SERVICO', codigo:m[1], descricao:m[2].trim(),
      quantidade:null, unidade:null, valor_bruto:v, desconto:0, valor:v});
  }
  if(itens.length && Math.abs(_nfR2(soma)-total)<0.02) return itens;
  return [{n_item:1, tipo:'SERVICO', codigo:'', descricao:String(desc||'Serviço').slice(0,500),
    quantidade:null, unidade:null, valor_bruto:total, desconto:0, valor:total}];
}

// OS, placa e KM que oficinas escrevem no texto livre da nota. Na TECAR:
//   NF-e : "Numero OS: 12252 Placa: RSA3C28  Chassi: ... KM: 361176"
//   NFS-e: "Numero O.S:12252 ,Chassi:... ,Placa:RSA3C28  ,KM:361176"
// Sempre pelo rótulo ("Placa:", "KM:"): procurar formato de placa solto no texto pega
// coisa errada — na nota da TECAR, "DIN7603" (norma de uma arruela) parece placa.
function nfExtrairOS(texto){
  var t=String(texto||''), r={os:'',placa:'',km:0}, m;
  m=/N[uú]mero\s*(?:da\s*)?O\.?\s*S\.?\s*:?\s*(\d{3,})/i.exec(t) || /\bO\.?\s?S\.?\s*(?:n[º°o]\.?\s*)?:\s*(\d{3,})\b/i.exec(t);
  if(m) r.os=m[1];
  m=/Placa\s*:?\s*([A-Z]{3})[\s-]?(\d[A-Z0-9]\d{2})\b/i.exec(t);
  if(m) r.placa=(m[1]+m[2]).toUpperCase();
  m=/\bKM\s*:?\s*(\d{1,3}(?:\.\d{3})+|\d+)/i.exec(t);
  if(m) r.km=parseInt(m[1].replace(/\./g,''),10)||0;
  return r;
}
function _nfAplicarOS(b){ var x=nfExtrairOS(b.textoLivre); b.os=x.os; b.placa=x.placa; b.km=x.km; }

function _nfValidar(b){
  if(!b.data) b.erro='sem data de emissão';
  else if(!(b.valor>0)) b.erro='valor total da nota é zero';
  return b;
}

// ---------- o que já está no sistema ----------
function nfDocPorChave(chave){
  if(!chave || !DB.nfDocumentos) return null;
  for(var i=0;i<DB.nfDocumentos.length;i++){ if(_nfDig(DB.nfDocumentos[i].CHAVE)===chave) return DB.nfDocumentos[i]; }
  return null;
}
// Outra nota da MESMA OS da mesma oficina, já lançada antes (ex.: peças ontem, serviço hoje)
function nfDocMesmaOS(emitCnpj,os){
  if(!emitCnpj || !os || !DB.nfDocumentos) return null;
  for(var i=0;i<DB.nfDocumentos.length;i++){
    var d=DB.nfDocumentos[i];
    if(_nfDig(d.EMITENTE_CNPJ)===emitCnpj && String(d.OS_NUMERO||'')===String(os)) return d;
  }
  return null;
}
function _nfDestinoDoc(d){ return d.MAQ_MANUTENCAO_ID?'maq':(d.MANUT_REALIZADA_ID?'caminhao':''); }

// ---------- montar a lista de conferência ----------
// Separa o que não entra (erro, repetido na seleção, já lançado) e junta o resto em
// grupos: notas da mesma oficina com a mesma OS são UMA manutenção (peças + serviço).
// Sem OS, junta pela mesma oficina + placa + data. Cada grupo vira um lançamento.
function nfMontarLista(docs,destino){
  var rejeitados=[], vistas={}, validos=[];
  docs.forEach(function(d){
    if(d.erro){ rejeitados.push({doc:d,motivo:'Erro',det:d.erro}); return; }
    if(vistas[d.chave]){ rejeitados.push({doc:d,motivo:'Repetida',det:'selecionada duas vezes'}); return; }
    vistas[d.chave]=1;
    if(nfDocPorChave(d.chave)){ rejeitados.push({doc:d,motivo:'Já lançada',det:'já estava no sistema'}); return; }
    validos.push(d);
  });

  var grupos=[], porChave={};
  validos.forEach(function(d){
    var k = d.os&&d.emitCnpj ? 'OS|'+d.emitCnpj+'|'+d.os
          : (d.placa&&d.emitCnpj ? 'PD|'+d.emitCnpj+'|'+d.placa+'|'+d.data : 'DOC|'+d.chave);
    var g=porChave[k];
    if(!g){ g=porChave[k]={docs:[]}; grupos.push(g); }
    g.docs.push(d);
  });

  grupos.forEach(function(g){
    // NF-e (peças) primeiro, depois NFS-e (serviço)
    g.docs.sort(function(a,b){ return a.modelo===b.modelo?0:(a.modelo==='NFE'?-1:1); });
    var d0=g.docs[0];
    g.emitNome=d0.emitNome; g.emitCnpj=d0.emitCnpj; g.os=d0.os;
    g.data=g.docs.map(function(d){return d.data;}).sort()[0];
    g.placa=''; g.km=0;
    g.docs.forEach(function(d){ if(!g.placa&&d.placa) g.placa=d.placa; if(!g.km&&d.km) g.km=d.km; });
    g.pecas=_nfR2(g.docs.filter(function(d){return d.modelo==='NFE';}).reduce(function(a,d){return a+d.valor;},0));
    g.servicos=_nfR2(g.docs.filter(function(d){return d.modelo==='NFSE';}).reduce(function(a,d){return a+d.valor;},0));
    g.total=_nfR2(g.pecas+g.servicos);
    g.itens=[]; g.docs.forEach(function(d){ g.itens=g.itens.concat(d.itens||[]); });
    g.outroCnpj=g.docs.filter(function(d){ return d.destCnpj && d.destCnpj!==NF_CNPJ_EMPRESA; }).map(function(d){return d.destNome||d.destCnpj;})[0]||'';

    // a outra nota desta OS já foi lançada? então esta se ANEXA ao lançamento existente
    var irma=nfDocMesmaOS(g.emitCnpj,g.os);
    if(irma){
      var dest=_nfDestinoDoc(irma);
      if(dest!==destino) g.erro='a outra nota desta OS (nº '+irma.NUMERO+') foi lançada em '+(dest==='maq'?'Maquinários':'Caminhões');
      else g.anexarA={id:dest==='maq'?irma.MAQ_MANUTENCAO_ID:irma.MANUT_REALIZADA_ID, numero:irma.NUMERO};
    }
  });
  return {grupos:grupos, rejeitados:rejeitados};
}

// ---------- sugestão de tipo (caminhões) ----------
// Pelo texto de cada peça/serviço. "item" reconhece o que foi feito; "tipo" acha o nome
// correspondente no catálogo (que tem "Filro de Óleo", com erro de digitação — por isso
// FILT?RO). Freio só com troca de peça de verdade: "tambor de freio para determinar o
// diagnóstico" foi só verificação (confirmado pelo usuário) e não pode zerar o alerta.
var NF_REGRAS_TIPO=[
  {item:/OLEO\s+(PARA\s+|DE\s+|DO\s+|P\/\s*)?MOTOR|OLEO\s+LUBRIFICANTE\s+(PARA\s+)?MOTOR|\b(5|10|15|20)W-?\d{2}\b/, tipo:/OLEO\s+(DO\s+|DE\s+)?MOTOR/},
  {item:/FILTRO\s+(DE\s+|DO\s+)?OLEO|FILTRO\s+LUBRIF/, tipo:/FILT?RO\s+DE\s+OLEO/},
  {item:/FILTRO\s+(DE\s+|DO\s+)?AR\b/, tipo:/FILTRO\s+DE\s+AR\b/},
  {item:/FILTR\w*\s+(DE\s+|DO\s+)?COMBUST|SEPARADOR\s+DE\s+AGUA/, tipo:/FILTRO\s+DE\s+COMBUST/},
  {item:/PASTILHA|LONA\s+(DE\s+)?FREIO|SAPATA\s+(DE\s+)?FREIO|REVIS\w*\s+(DE\s+|DO\s+|DOS\s+)?FREIO/, nao:/DIAGNOST/, tipo:/FREIO/},
  {item:/CORREIA\s+DENTADA/, tipo:/CORREIA\s+DENTADA/},
  {item:/ALINHAMENTO|BALANCEAMENTO/, tipo:/ALINHAMENTO/}
];
// Tipos que o importador oferece: os de pneu ficam de fora porque exigem marcar posição
// e número de cada pneu no diagrama, o que a nota não traz.
function nfTiposImportaveis(){
  return (DB.manutProgramada||[]).filter(function(p){ return p.TIPO_MANUTENCAO && !p.CONTROLA_PNEUS; })
    .map(function(p){ return p.TIPO_MANUTENCAO; });
}
function nfSugerirTipos(itens,tipos){
  var sugeridos=[];
  NF_REGRAS_TIPO.forEach(function(r){
    var bateu=(itens||[]).some(function(it){ var t=_nfNorm(it.descricao); return r.item.test(t) && !(r.nao && r.nao.test(t)); });
    if(!bateu) return;
    for(var i=0;i<tipos.length;i++){
      if(r.tipo.test(_nfNorm(tipos[i]))){ if(sugeridos.indexOf(tipos[i])<0) sugeridos.push(tipos[i]); break; }
    }
  });
  // na ordem do catálogo, que é a ordem em que viram lançamentos (o 1º é o principal)
  return tipos.filter(function(t){ return sugeridos.indexOf(t)>=0; });
}

// ---------- textos ----------
function nfRotuloDoc(d){ return (d.modelo==='NFSE'?'NFS-e ':'NF-e ')+(d.numero||'?'); }
function nfRotuloNotas(g){ return g.docs.map(nfRotuloDoc).join(' + '); }
// Resumo curto para o campo de serviço/observação — o detalhe completo fica nos itens
function nfResumoItens(g){
  var pc=g.itens.filter(function(i){return i.tipo==='PECA';}), sv=g.itens.filter(function(i){return i.tipo==='SERVICO';});
  if(g.itens.length===1){
    var it=g.itens[0];
    return it.descricao+(it.quantidade?(' ('+fmt(it.quantidade,(it.quantidade%1)?2:0)+(it.unidade?' '+it.unidade:'')+')'):'');
  }
  var partes=[];
  if(g.os) partes.push('OS '+g.os);
  if(pc.length) partes.push(pc.length+(pc.length===1?' peça':' peças'));
  if(sv.length) partes.push(sv.length+(sv.length===1?' serviço':' serviços'));
  return partes.join(' · ');
}

// O banco é a autoridade sobre duplicata: mesmo que a conferência local não perceba
// (página com JS em cache, outra aba, outro usuário importando junto), a gravação é
// recusada. Sem tradução, isso chegava como "duplicate key value violates unique
// constraint" resumido em "1 com erro" — e parecia que nada tinha acontecido.
function nfErroAmigavel(msg){
  var m=String((msg&&msg.message)||msg||'');
  if(/nf_documentos_chave_key|duplicate key|23505/i.test(m)) return 'esta nota já foi lançada no sistema';
  if(/chave_formato/i.test(m)) return 'chave da nota em formato inválido';
  if(/destino_check/i.test(m)) return 'faltou escolher máquina ou fazenda';
  if(/tipo_check/i.test(m)) return 'tipo inválido';
  if(/placa_fkey/i.test(m)) return 'placa não cadastrada em Cadastro → Caminhões';
  if(/importar_nf:\s*/i.test(m)) return m.replace(/^.*importar_nf:\s*/i,'');
  if(/row-level security|permission denied|42501/i.test(m)) return 'sem permissão para lançar';
  return m||'erro desconhecido';
}
// ===== FIM NOTAS FISCAIS: LEITURA =====
