// ============================================================
// ===== ROMANEIO DE DESCARGA (PDF) — LEITURA =================
// O cliente entrega a ficha de descarga em PDF (a Cargill chama de "Ficha de Circulação").
// Esse PDF tem camada de TEXTO — não é imagem escaneada — então dá para ler com o pdf.js
// dentro do próprio navegador: sem OCR, sem servidor, sem custo. É o mesmo princípio do
// importador de nota fiscal (js/nf-parse.js), só que a origem é PDF em vez de XML.
//
// Aqui fica só a LEITURA e o casamento com o cadastro (nada de DOM, para dar para testar
// fora do navegador). A tela de conferência e a gravação estão em js/romaneio-ui.js.
//
// Para ensinar um modelo novo de romaneio (outro cliente): acrescentar uma entrada em
// ROM_MODELOS (como reconhecer + como ler) e, se for o caso, em ROM_UNIDADES (de qual
// local de carga/descarga do sistema aquele papel está falando).
// ============================================================

// pdf.js é baixado só quando o usuário abre o importador — não pesa no carregamento do
// sistema para quem nunca usa. Versão UMD (define window.pdfjsLib), fixada de propósito.
var ROM_PDFJS_URL='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
var ROM_PDFJS_WORKER='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
var _romPdfJsProm=null;

function romCarregarPdfJs(){
  if(_romPdfJsProm) return _romPdfJsProm;
  _romPdfJsProm=new Promise(function(ok,falhou){
    if(typeof window!=='undefined' && window.pdfjsLib){ ok(window.pdfjsLib); return; }
    var s=document.createElement('script');
    s.src=ROM_PDFJS_URL;
    s.onload=function(){
      if(!window.pdfjsLib){ _romPdfJsProm=null; falhou(new Error('o leitor de PDF não carregou')); return; }
      window.pdfjsLib.GlobalWorkerOptions.workerSrc=ROM_PDFJS_WORKER;
      ok(window.pdfjsLib);
    };
    s.onerror=function(){ _romPdfJsProm=null; falhou(new Error('não consegui baixar o leitor de PDF (verifique a internet)')); };
    document.head.appendChild(s);
  });
  return _romPdfJsProm;
}

// ==================== TEXTO DO PDF ====================
function _romNorm(s){ return String(s==null?'':s).normalize('NFD').replace(/[̀-ͯ]/g,'').toUpperCase(); }
function _romDig(s){ return String(s==null?'':s).replace(/\D/g,''); }

// Número do papel em formato brasileiro ("43.940" = 43940, "46,47" = 46,47).
function _romNum(s){
  if(s==null||s==='') return null;
  var t=String(s).replace(/\s|KG/gi,'').replace(/\./g,'').replace(',','.');
  var v=parseFloat(t);
  return isNaN(v)?null:v;
}

// O pdf.js entrega pedaços soltos de texto com a coordenada de cada um. Aqui eles voltam
// a ser LINHAS: agrupa por altura (Y) e ordena da esquerda para a direita (X), que é o
// que deixa "Peso Líquido:  43.940 KG" inteiro numa linha só para o regex achar.
function romLinhasDeItens(itens){
  var grupos=[];
  (itens||[]).forEach(function(it){
    if(!it || !it.str || !it.str.trim()) return;
    var x=it.transform[4], y=Math.round(it.transform[5]), g=null;
    for(var i=0;i<grupos.length;i++){ if(Math.abs(grupos[i].y-y)<=2){ g=grupos[i]; break; } }
    if(!g){ g={y:y,itens:[]}; grupos.push(g); }
    g.itens.push({x:x,s:it.str});
  });
  grupos.sort(function(a,b){ return b.y-a.y; });                       // de cima para baixo
  return grupos.map(function(g){
    g.itens.sort(function(a,b){ return a.x-b.x; });
    return g.itens.map(function(i){ return i.s.trim(); }).filter(Boolean).join('  ');
  });
}

// ArrayBuffer do arquivo -> linhas de texto de todas as páginas.
function romLerPdf(buf){
  return romCarregarPdfJs().then(function(pdfjsLib){
    return pdfjsLib.getDocument({data:new Uint8Array(buf)}).promise;
  }).then(function(doc){
    var paginas=[];
    for(var p=1;p<=doc.numPages;p++) paginas.push(p);
    return paginas.reduce(function(prom,p){
      return prom.then(function(linhas){
        return doc.getPage(p).then(function(pg){ return pg.getTextContent(); })
          .then(function(tc){ return linhas.concat(romLinhasDeItens(tc.items)); });
      });
    }, Promise.resolve([]));
  });
}

// ==================== DE QUE VIAGEM O PAPEL ESTÁ FALANDO ====================
// O romaneio diz onde DESCARREGOU, nunca onde carregou. A fazenda de carga é uma regra
// fixa por unidade de descarga, combinada com o usuário (Cargill Porto Nacional sempre
// vem da Faz. Novo Acordo). Para outro cliente, acrescentar aqui.
var ROM_UNIDADES=[
  { contem:'CARGILL PORTO NACIONAL', descarga:'CARGILL - PORTO NACIONAL', carga:'FAZ. NOVO ACORDO' }
];

// Fazenda de carga combinada para um destino (usado quando o usuário troca o destino na
// tela de conferência)
function romCargaPadraoDoDestino(descarga){
  for(var i=0;i<ROM_UNIDADES.length;i++){
    if(ROM_UNIDADES[i].descarga===descarga) return ROM_UNIDADES[i].carga;
  }
  return '';
}

function romLocaisDaUnidade(unidade){
  var u=_romNorm(unidade).replace(/[^A-Z0-9]+/g,' ').trim();
  for(var i=0;i<ROM_UNIDADES.length;i++){
    if(u.indexOf(ROM_UNIDADES[i].contem)>=0) return ROM_UNIDADES[i];
  }
  return null;
}

// ==================== MODELOS DE ROMANEIO ====================
var ROM_MODELOS=[
  { id:'cargill', nome:'Ficha de Circulação (Cargill)',
    inicio:/FICHA DE CIRCULACAO/,                                     // onde começa cada ficha
    reconhece:function(txtN){ return /FICHA DE CIRCULACAO/.test(txtN); },
    ler:function(linhas,linhasN){ return _romLerCargill(linhas,linhasN); } }
];

// Procura um rótulo e devolve a primeira linha seguinte que casa com o padrão
// (no papel, o valor vem sempre embaixo do rótulo, não ao lado).
function _romDepoisDe(linhas,testeRotulo,re,limite){
  for(var i=0;i<linhas.length;i++){
    if(!testeRotulo(linhas[i])) continue;
    for(var k=i; k<Math.min(i+(limite||3),linhas.length); k++){
      var m=linhas[k].match(re);
      if(m) return m[1].trim();
    }
  }
  return null;
}

function _romLerCargill(linhas,linhasN){
  var txtN=linhasN.join('\n');
  var pega=function(re){ var m=txtN.match(re); return m?m[1].trim():null; };

  // unidade = a linha logo abaixo do título ("CARGILL - PORTO NACIONAL FABRICA")
  var unidade='';
  for(var i=0;i<linhasN.length;i++){
    if(/FICHA DE CIRCULACAO/.test(linhasN[i])){ unidade=(linhas[i+1]||'').trim(); break; }
  }

  // nota fiscal: vem como "16982/1" (número/série), na linha abaixo do rótulo NF/Série
  var nota=_romDepoisDe(linhasN,function(l){ return l.indexOf('NF/SERIE')>=0; }, /\b(\d{3,9})\/\d{1,3}\b/, 3)
        || pega(/\b(\d{3,9})\/\d{1,3}\b/);

  // motorista: linha abaixo do bloco de rótulos "Motorista  CPF  Placa Veículo"
  // (o rótulo "Motorista" aparece de novo lá embaixo, na assinatura — por isso exijo CPF
  // na mesma linha). Nome lido da linha ORIGINAL, para não perder o acento de "JOÃO".
  var motorista=null, cpf=null, iMot=-1;
  for(var j=0;j<linhasN.length;j++){
    if(linhasN[j].indexOf('MOTORISTA')>=0 && linhasN[j].indexOf('CPF')>=0){ iMot=j; break; }
  }
  if(iMot>=0){
    for(var k=iMot+1;k<Math.min(iMot+3,linhas.length);k++){
      var m=linhas[k].match(/^([A-ZÀ-Ÿ][A-ZÀ-Ÿ'´\. ]{4,60}?)\s{2,}(\d{11})\b/);
      if(m){ motorista=m[1].trim(); cpf=m[2]; break; }
    }
  }

  // placa do veículo: Mercosul (RSC4B41) ou antiga (ABC1234). A placa também aparece
  // colada no LotID ("...004029RSC4B41"), mas ali não há fronteira de palavra antes.
  var placa=null;
  if(iMot>=0 && linhasN[iMot+1]){ var mp=linhasN[iMot+1].match(/\b([A-Z]{3}\d[A-Z0-9]\d{2})\b/); if(mp) placa=mp[1]; }
  if(!placa) placa=pega(/\b([A-Z]{3}\d[A-Z0-9]\d{2})\b/);

  return {
    unidade: unidade,
    ticket: _romDepoisDe(linhasN,function(l){ return l.indexOf('TICKET')>=0; }, /\b(\d{4,9})\b/, 2),
    nota: nota,
    produto: pega(/\b\d{4,6}\s*-\s*([A-Z][A-Z0-9 \-\/]{3,40}?)\s{2,}/),
    motorista: motorista,
    cpf: cpf,
    placa: placa,
    pesoLiquidoKg: _romNum(pega(/PESO LIQUIDO:\s*([\d\.,]+)\s*KG/)) ,
    pesoOrigemKg:  _romNum(pega(/PESO ORIGEM:\s*([\d\.,]+)\s*KG/)),
    descontoKg:    _romNum(pega(/DESCONTO:\s*([\d\.,]+)\s*KG/)),
    entrada: pega(/DATA HORA ENTRADA:\s*(\d{2}-\d{2}-\d{4}\s+\d{2}:\d{2})/),
    saida:   pega(/DATA HORA SAIDA:\s*(\d{2}-\d{2}-\d{4}\s+\d{2}:\d{2})/),
    pesagem1: pega(/DATA HORA 1A PESAGEM:\s*(\d{2}-\d{2}-\d{4}\s+\d{2}:\d{2})/),
    pesagem2: pega(/DATA HORA 2A PESAGEM:\s*(\d{2}-\d{2}-\d{4}\s+\d{2}:\d{2})/)
  };
}

// linhas -> campos crus do romaneio (ou {erro} quando não reconheço o papel)
function romParse(linhas,arquivo){
  var L=linhas||[], LN=L.map(_romNorm), txtN=LN.join('\n'), modelo=null;
  // PDF escaneado (ou foto salva como PDF) é uma IMAGEM dentro do arquivo: não tem texto
  // para ler. Vale a pena dizer isso com todas as letras, senão a mensagem genérica de
  // "não reconheci" manda o usuário procurar erro no lugar errado.
  if(txtN.replace(/\s+/g,'').length<60)
    return { arquivo:arquivo, semTexto:true,
             erro:'este PDF não tem texto dentro — é imagem escaneada ou foto. Para ler um destes eu preciso de OCR; peça o PDF original do cliente, ou digitalize com o texto pesquisável ligado' };
  for(var i=0;i<ROM_MODELOS.length;i++){ if(ROM_MODELOS[i].reconhece(txtN)){ modelo=ROM_MODELOS[i]; break; } }
  if(!modelo) return { arquivo:arquivo, erro:'não reconheci este PDF como romaneio (por enquanto leio a Ficha de Circulação da Cargill)' };
  var cru=modelo.ler(L,LN);
  cru.arquivo=arquivo; cru.modelo=modelo.id; cru.modeloNome=modelo.nome;
  return cru;
}

// Um PDF pode trazer várias fichas juntas (quando alguém junta os romaneios do dia num
// arquivo só). Corta o documento onde cada ficha começa e lê uma por uma.
function romFatiarDocumento(linhas){
  var LN=(linhas||[]).map(_romNorm), cortes=[];
  for(var i=0;i<LN.length;i++){
    for(var m=0;m<ROM_MODELOS.length;m++){
      if(ROM_MODELOS[m].inicio && ROM_MODELOS[m].inicio.test(LN[i])){ cortes.push(i); break; }
    }
  }
  if(cortes.length<2) return [linhas||[]];
  return cortes.map(function(ini,k){
    return linhas.slice(ini, k+1<cortes.length?cortes[k+1]:linhas.length);
  });
}

// Arquivo inteiro -> uma lista de romaneios crus (um por ficha encontrada)
function romParseArquivo(linhas,arquivo){
  var fatias=romFatiarDocumento(linhas);
  return fatias.map(function(f,i){
    return romParse(f, arquivo + (fatias.length>1 ? (' — ficha '+(i+1)+'/'+fatias.length) : ''));
  });
}

// ==================== CASAR COM O CADASTRO ====================
function _romBaseMotoristas(){ return (typeof MOTORISTAS_DATA!=='undefined' && MOTORISTAS_DATA) ? MOTORISTAS_DATA : []; }
function _romBasePlacas(){ return (typeof BASE!=='undefined' && BASE && BASE.placas) ? BASE.placas : []; }
function _romBaseCadastro(){ return (typeof DB!=='undefined' && DB && DB.cadastro) ? DB.cadastro : []; }

// Palavras úteis de um nome (sem acento, sem "DE"/"DOS"/"DA", que não identificam ninguém)
function _romPalavras(nome){
  return _romNorm(nome).replace(/[^A-Z ]+/g,' ').split(/\s+/)
    .filter(function(p){ return p.length>2 && ['DOS','DAS','DEL'].indexOf(p)<0; });
}
function _romAtivo(m){ return !String(m.DATA_DESLIGAMENTO||'').trim(); }
// escrito errado: usa a mesma régua do importador de nota fiscal quando ela está por perto
function _romParecido(a,b){
  if(typeof _nfParecido==='function') return _nfParecido(a,b);
  if(!a||!b) return false;
  if(a===b) return true;
  var curto=a.length<b.length?a:b, longo=a.length<b.length?b:a;
  return curto.length>=4 && curto.length/longo.length>=0.6 && longo.indexOf(curto)===0;
}
// quantas letras separam um nome do outro (para "CLAUDEMIRO" ficar com CLAUDEMIR, e não
// com CLAUDECI, que também começa com CLAU)
function _romDistancia(a,b){
  if(typeof _nfDist==='function') return _nfDist(a,b);
  a=String(a||''); b=String(b||'');
  var linha=[], i, j;
  for(j=0;j<=b.length;j++) linha[j]=j;
  for(i=1;i<=a.length;i++){
    var ant=linha[0]; linha[0]=i;
    for(j=1;j<=b.length;j++){
      var tmp=linha[j];
      linha[j]=Math.min(linha[j]+1, linha[j-1]+1, ant+(a.charAt(i-1)===b.charAt(j-1)?0:1));
      ant=tmp;
    }
  }
  return linha[b.length];
}

// O romaneio traz o nome COMPLETO ("VALDESON PEREIRA DOS SANTOS"); no cadastro o mesmo
// motorista pode estar só como "VALDESON". Então:
//   1) CPF igual  -> certeza
//   2) nome igual -> certeza
//   3) todas as palavras do nome cadastrado aparecem no nome do romaneio -> palpite, e
//      ganha o mais específico ("DIOMAR SOUSA MACIEL" vence "DIOMAR"); empate = não chuto
//   4) primeiro nome escrito parecido -> palpite, só se for um só
// Devolve {nome, modo:'cpf'|'exato'|'contido'|'parecido'|'', texto, opcoes:[nomes]}.
function romCasarMotorista(nomePdf,cpfPdf){
  var lista=_romBaseMotoristas(), cpf=_romDig(cpfPdf), vazio={nome:'',modo:'',texto:'',opcoes:[]};
  var preferirAtivos=function(arr){
    var ativos=arr.filter(function(x){ return _romAtivo(x.m||x); });
    return ativos.length?ativos:arr;
  };

  if(cpf.length===11){
    var porCpf=lista.filter(function(m){ return _romDig(m.CPF)===cpf; });
    if(porCpf.length===1) return { nome:porCpf[0].NOME, modo:'cpf', texto:'CPF do romaneio bate com a ficha', opcoes:[] };
  }

  var alvo=_romPalavras(nomePdf);
  if(!alvo.length) return vazio;

  var iguais=lista.filter(function(m){ return _romPalavras(m.NOME).join(' ')===alvo.join(' '); });
  if(iguais.length===1) return { nome:iguais[0].NOME, modo:'exato', texto:'nome igual ao do cadastro', opcoes:[] };

  var contidos=[];
  lista.forEach(function(m){
    var p=_romPalavras(m.NOME);
    if(!p.length) return;
    var todas=p.every(function(w){ return alvo.indexOf(w)>=0; });
    if(todas) contidos.push({ m:m, n:p.length });
  });
  if(contidos.length){
    contidos=preferirAtivos(contidos);
    var melhor=Math.max.apply(null, contidos.map(function(c){ return c.n; }));
    var top=contidos.filter(function(c){ return c.n===melhor; });
    if(top.length===1){
      return { nome:top[0].m.NOME, modo:'contido',
               texto:'o romaneio diz "'+nomePdf+'" — entendi que é este, confira', opcoes:[] };
    }
    return { nome:'', modo:'', texto:'"'+nomePdf+'" serve para mais de um motorista — escolha qual',
             opcoes:top.map(function(c){ return c.m.NOME; }) };
  }

  var prim=alvo[0], quase=[];
  lista.forEach(function(m){
    var p=_romPalavras(m.NOME);
    if(p.length && _romParecido(p[0],prim)) quase.push(m);
  });
  quase=preferirAtivos(quase);
  if(quase.length){
    // o mais perto em letras ganha, e só vira palpite se for um só nessa distância
    var dist=quase.map(function(m){ return _romDistancia(_romPalavras(m.NOME)[0],prim); });
    var menor=Math.min.apply(null,dist);
    var top=quase.filter(function(m,i){ return dist[i]===menor; });
    if(top.length===1){
      return { nome:top[0].NOME, modo:'parecido',
               texto:'o romaneio diz "'+nomePdf+'" — o parecido no cadastro é este, confira', opcoes:[] };
    }
  }
  return { nome:'', modo:'', texto:'não achei "'+nomePdf+'" no cadastro — escolha o motorista',
           opcoes:quase.map(function(m){ return m.NOME; }) };
}

// "18-11-2026 06:52" -> {data:'2026-11-18', hora:'06:52'}
function _romDataHora(s){
  var m=String(s||'').match(/^(\d{2})-(\d{2})-(\d{4})\s+(\d{2}:\d{2})$/);
  return m ? { data:m[3]+'-'+m[2]+'-'+m[1], hora:m[4] } : null;
}

// Onde esta nota fiscal já aparece hoje. A coluna NOTA **não é única** no banco (a trava
// saiu na migration 0003: o mesmo número de nota reaparece em viagens diferentes, e há
// casos reais disso). Então "já lançado" é nota + placa; a mesma nota em OUTRA placa vira
// só um aviso, não um bloqueio.
function romNotaEmUso(nota,placa){
  var vazio={ mesmaPlaca:[], outras:[] };
  if(nota==null||nota==='') return vazio;
  var n=Number(nota);
  if(!n) return vazio;                                     // nota 0 é lixo antigo, ignora
  var p=_romNorm(placa).replace(/\s+/g,'');
  var res={ mesmaPlaca:[], outras:[] };
  _romBaseCadastro().forEach(function(r){
    if(r.NOTA==null||r.NOTA===''||Number(r.NOTA)!==n) return;
    if(p && _romNorm(r.PLACA).replace(/\s+/g,'')===p) res.mesmaPlaca.push(r);
    else res.outras.push(r);
  });
  return res;
}

// Lançamentos da mesma placa na mesma data (ou na véspera, para a viagem que entrou
// 23:40 e saiu 00:20) que ainda não têm nota: são os candidatos a "complementar" em vez
// de virar uma segunda linha da mesma viagem.
function romCandidatosComplementar(placa,data,dataEntrada){
  if(!placa||!data) return [];
  var datas=[data];
  if(dataEntrada && datas.indexOf(dataEntrada)<0) datas.push(dataEntrada);
  var p=_romNorm(placa).replace(/\s+/g,'');
  return _romBaseCadastro().filter(function(r){
    if(_romNorm(r.PLACA).replace(/\s+/g,'')!==p) return false;
    if(datas.indexOf(r.DATA)<0) return false;
    return !(r.NOTA!=null && r.NOTA!=='');
  });
}

// Campos crus -> o que vai para a tela de conferência, já casado com o cadastro.
function romResolver(cru){
  var g={ arquivo:cru.arquivo, cru:cru, erro:cru.erro||'', semTexto:!!cru.semTexto, avisos:[],
          data:'', chegada:'', saida:'', nota:'', quantidade:null, placa:'', placaPdf:'',
          motorista:'', motoristaPdf:'', motModo:'', motTexto:'', motOpcoes:[],
          localCarga:'', localDescarga:'', destino:'novo', jaLancado:null, notaEmOutra:null,
          candidatos:[], gravarCpf:false };
  if(g.erro) return g;

  var loc=romLocaisDaUnidade(cru.unidade);
  if(loc){ g.localDescarga=loc.descarga; g.localCarga=loc.carga; }
  else g.avisos.push('não sei a qual local do sistema corresponde "'+(cru.unidade||'?')+'" — escolha o local de descarga e o de carga');

  g.placaPdf=cru.placa||'';
  g.placa=(cru.placa && _romBasePlacas().indexOf(cru.placa)>=0)?cru.placa:'';
  if(cru.placa && !g.placa) g.avisos.push('a placa '+cru.placa+' não está cadastrada — escolha a placa');
  if(!cru.placa) g.avisos.push('não achei a placa no romaneio — escolha a placa');

  g.motoristaPdf=cru.motorista||'';
  var mt=romCasarMotorista(cru.motorista,cru.cpf);
  g.motorista=mt.nome; g.motModo=mt.modo; g.motTexto=mt.texto; g.motOpcoes=mt.opcoes||[];

  var ent=_romDataHora(cru.entrada), sai=_romDataHora(cru.saida), p2=_romDataHora(cru.pesagem2);
  g.data=(sai&&sai.data)||(p2&&p2.data)||(ent&&ent.data)||'';
  g.dataEntrada=ent?ent.data:'';
  g.chegada=ent?ent.hora:'';
  g.saida=sai?sai.hora:'';
  if(!g.data) g.avisos.push('não achei a data de saída no romaneio — preencha a data');

  g.nota=cru.nota||'';
  if(!g.nota) g.avisos.push('não achei o número da nota no romaneio — preencha para o sistema travar duplicidade');

  // o sistema guarda tonelada; o romaneio traz quilo
  var emM3 = (typeof BASE!=='undefined' && BASE && BASE.clientesM3) ? BASE.clientesM3.indexOf(g.localDescarga)>=0 : false;
  if(cru.pesoLiquidoKg!=null && !emM3) g.quantidade=Math.round(cru.pesoLiquidoKg/10)/100;
  else if(emM3) g.avisos.push('este destino é medido em M³ e o romaneio traz quilo — preencha a quantidade à mão');
  else g.avisos.push('não achei o peso líquido no romaneio — preencha a quantidade');

  romAtualizarCruzamentos(g);
  return g;
}

// Refaz as checagens que dependem do que já está lançado. Roda de novo sempre que o
// usuário mexe em nota, placa ou data na tela de conferência.
function romAtualizarCruzamentos(g){
  var uso=romNotaEmUso(g.nota,g.placa);
  g.jaLancado=uso.mesmaPlaca.length?uso.mesmaPlaca[0]:null;
  g.notaEmOutra=uso.outras.length?uso.outras[0]:null;
  g.candidatos=romCandidatosComplementar(g.placa,g.data,g.dataEntrada);
  if(g.destino!=='novo' && !g.candidatos.some(function(r){ return String(r.ID)===String(g.destino); })) g.destino='novo';
  return g;
}

// Tudo o que falta preencher antes de deixar importar ('' = pronto)
function romFaltando(g){
  if(g.erro) return 'erro';
  if(g.jaLancado) return 'ja';
  if(!g.motorista) return 'motorista';
  if(!g.placa) return 'placa';
  if(!g.data) return 'data';
  if(g.quantidade==null||!(g.quantidade>0)) return 'quantidade';
  if(!g.localDescarga) return 'local de descarga';
  return '';
}

// Linha do cadastro (chaves "estilo planilha", as mesmas que o formulário usa)
function romLinhaCadastro(g){
  return {
    'MOTORISTA':g.motorista, 'DATA':g.data, 'PLACA':g.placa,
    'LOCAL CARGA':g.localCarga||null, 'LOCAL DESCARGA':g.localDescarga||null,
    'NOTA':g.nota?Number(g.nota):null, 'QUANTIDADE':g.quantidade,
    'CHEGADA CLIENTE':g.chegada||null, 'SAIDA CLIENTE':g.saida||null
  };
}

// Ao COMPLEMENTAR um lançamento que já existe: só preenche o que está vazio lá. O que já
// foi digitado por alguém nunca é sobrescrito — o que diverge volta em "conflitos" para
// aparecer na tela.
function romDiffComplemento(g,reg){
  var novo=romLinhaCadastro(g), muda={}, conflitos=[];
  Object.keys(novo).forEach(function(k){
    var v=novo[k];
    if(v===null||v===''||v===undefined) return;
    var atual=reg[k];
    var vazio=(atual===null||atual===''||atual===undefined);
    if(vazio){ muda[k]=v; return; }
    var igual = (k==='NOTA'||k==='QUANTIDADE') ? Number(atual)===Number(v) : String(atual)===String(v);
    if(!igual) conflitos.push({campo:k, atual:atual, romaneio:v});
  });
  return { muda:muda, conflitos:conflitos };
}

if(typeof module!=='undefined' && module.exports){
  module.exports={ romLinhasDeItens:romLinhasDeItens, romParse:romParse, romResolver:romResolver,
                   romParseArquivo:romParseArquivo, romFatiarDocumento:romFatiarDocumento,
                   romCasarMotorista:romCasarMotorista, romLocaisDaUnidade:romLocaisDaUnidade,
                   romFaltando:romFaltando, romLinhaCadastro:romLinhaCadastro,
                   romDiffComplemento:romDiffComplemento, romCandidatosComplementar:romCandidatosComplementar,
                   romNotaEmUso:romNotaEmUso, romAtualizarCruzamentos:romAtualizarCruzamentos,
                   _romNum:_romNum, _romDataHora:_romDataHora };
}
