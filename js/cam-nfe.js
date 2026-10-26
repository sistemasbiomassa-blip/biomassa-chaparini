// ============================================================
// ===== CAMINHÕES: IMPORTAR NF-e / NFS-e (XML) ===============
// Uma revisão costuma cobrir vários tipos do catálogo (óleo, filtro de ar, filtro de
// combustível...) e manut_realizada guarda um tipo por linha. Então cada tipo marcado
// vira um registro — é o que zera o alerta de KM de cada um — mas o VALOR e as notas
// ficam só no primeiro (principal); os outros apontam para ele (nf_principal_id). Sem
// isso o custo de uma revisão apareceria uma vez por tipo.
// Placa e KM vêm do texto da nota quando a oficina escreve (a TECAR escreve); senão,
// o usuário escolhe/digita. Leitura: js/nf-parse.js · tela comum: js/nf-ui.js
// ============================================================
var _camNfe={grupos:[],rejeitados:[]};

function _camNfePodeLancar(){ return currentUserData && (currentUserData.perfil==='ADMIN'||currentUserData.perfil==='ANALISTA'); }

function openCamNfeModal(){
  if(!_camNfePodeLancar()){ showToast('Sem permissão',true); return; }
  _camNfe={grupos:[],rejeitados:[]};
  document.getElementById('camNfeFiles').value='';
  document.getElementById('camNfeLista').innerHTML='';
  document.getElementById('camNfeResumo').innerHTML='';
  document.getElementById('camNfeAvisos').style.display='none';
  document.getElementById('camNfeImportBtn').style.display='none';
  document.getElementById('camNfeOverlay').classList.add('show');
}
function closeCamNfeModal(){ document.getElementById('camNfeOverlay').classList.remove('show'); _camNfe={grupos:[],rejeitados:[]}; }

function camNfeLerArquivos(){
  nfLerSelecao(document.getElementById('camNfeFiles'),'caminhao',function(L){
    _camNfePrepararGrupos(L);
    _camNfe=L;
    _camNfeRender();
    var fora=L.rejeitados.length+L.grupos.filter(function(g){return g.erro;}).length;
    if(fora) showToast('⚠️ '+fora+' nota(s) ficaram de fora — veja o aviso no topo',true);
    else if(L.grupos.length) showToast('✅ '+L.grupos.length+' manutenção(ões) montadas — confira placa, KM e tipos');
  });
}

// Prepara as revisões recém-lidas: o que dá para adivinhar vem preenchido, o resto fica
// em branco esperando a conferência.
function _camNfePrepararGrupos(L){
  var tipos=nfTiposImportaveis();
  L.grupos.forEach(function(g){
    // placa da nota só vale se estiver cadastrada; senão o usuário escolhe
    g.placaNota=g.placa;
    g.placa=(g.placa && BASE.placas.indexOf(g.placa)>=0)?g.placa:'';
    g.kmNota=g.km;
    g.tipos=nfSugerirTipos(g.itens,tipos);
    g.sugeridos=g.tipos.slice();
    g.dividir=false; g.itemPlaca=[]; g.plKm={}; g.plTipos={}; g.plMot={};
    g.motorista='';   // quem estava com o caminhão: opcional, serve para o histórico
    nfSemearApelidos(g);   // "o que é" de cada item, lembrado do código do fornecedor
    // nota que cita duas placas cadastradas: já abre dividida, sem adivinhar de quem é
    // cada item (o usuário aponta item a item)
    g.placasNota=_camNfePlacasNoTexto(g.textoLivre);
    if(g.placasNota.length>1 && g.itens.length>1){
      g.dividir=true; g.itemPlaca=g.itens.map(function(){ return ''; }); g.placa='';
    }
  });
  return L;
}
// Placas cadastradas citadas no texto da nota, na ordem em que aparecem
function _camNfePlacasNoTexto(texto){
  var t=' '+String(texto||'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim()+' ', achadas=[];
  (BASE.placas||[]).forEach(function(p){
    var pos=t.indexOf(' '+String(p).toUpperCase().replace(/[^A-Z0-9]+/g,'')+' ');
    if(pos>=0) achadas.push({p:p,pos:pos});
  });
  achadas.sort(function(a,b){ return a.pos-b.pos; });
  return achadas.map(function(x){ return x.p; });
}

function _camNfeImportavel(g){ return !g.erro; }
function _camNfeFaltando(g){
  if(g.anexarA) return '';
  if(g.dividir){
    // uma revisão por placa: cada item precisa de placa, e cada placa dos seus tipos/KM
    if(!g.itens.every(function(it,n){ return !!g.itemPlaca[n]; })) return 'placa';
    var placas=_camNfePlacas(g);
    if(!placas.length) return 'placa';
    if(placas.some(function(p){ return !(g.plTipos[p]||[]).length; })) return 'tipo';
    if(placas.some(function(p){ return manutKmObrigatorio(g.plTipos[p]||[]) && !(num(g.plKm[p])>0); })) return 'KM';
    return '';
  }
  if(!g.placa) return 'placa';
  if(!g.tipos.length) return 'tipo';
  // KM só é exigido quando algum tipo marcado gera alerta de KM — é ele que usa o número.
  // Conserto avulso ("Outros") normalmente não traz KM na nota.
  if(manutKmObrigatorio(g.tipos) && !(g.km>0)) return 'KM';
  return '';
}
// ---------- nota dividida entre placas ----------
// Uma nota com peças de dois caminhões (NF-e 128215: um rolamento para cada) vira uma
// revisão por placa, cada uma com o valor dos seus itens, os seus tipos e o seu KM. A
// nota fica ligada às duas.
function _camNfePlacas(g){
  var ordem=[];
  (g.itens||[]).forEach(function(it,n){
    var p=String(g.itemPlaca[n]||'');
    if(p && ordem.indexOf(p)<0) ordem.push(p);
  });
  return ordem;
}
function _camNfeItensDaPlaca(g,placa){
  return (g.itens||[]).filter(function(it,n){ return String(g.itemPlaca[n]||'')===String(placa); });
}
function _camNfeTotalDaPlaca(g,placa){
  return Math.round(_camNfeItensDaPlaca(g,placa).reduce(function(a,i){ return a+num(i.valor); },0)*100)/100;
}
function _camNfeDividir(i,ligar){
  var g=_camNfe.grupos[i]; if(!g) return;
  g.dividir=!!ligar;
  if(g.dividir){
    if(!g.itemPlaca.length) g.itemPlaca=g.itens.map(function(){ return g.placa||''; });
    _camNfeSemearPlacas(g);
  } else {
    // volta ao modo de uma placa; o que foi apontado item a item fica guardado, caso
    // o usuário divida de novo
    g.plKm={}; g.plTipos={}; g.plSug={}; g.plMot={};
  }
  _camNfeRender();
}
function _camNfeItemPlaca(i,n,v){
  var g=_camNfe.grupos[i]; if(!g) return;
  g.itemPlaca[n]=v;
  _camNfeSemearPlacas(g);
  _camNfeRender();
}
// Placa que acabou de entrar na divisão começa com os tipos sugeridos pelos itens DELA
// (um caminhão pode ter levado freio e o outro, filtro) e com o KM que a nota trouxe.
function _camNfeSemearPlacas(g){
  var tipos=nfTiposImportaveis();
  g.plSug=g.plSug||{};
  _camNfePlacas(g).forEach(function(p){
    if(!g.plTipos[p]){
      g.plTipos[p]=nfSugerirTipos(_camNfeItensDaPlaca(g,p),tipos);
      g.plSug[p]=g.plTipos[p].slice();   // o que o sistema sugeriu, para marcar na tela
    }
    if(g.plKm[p]===undefined) g.plKm[p]=(g.placaNota===p && g.kmNota>0)?g.kmNota:0;
  });
}
function _camNfeKmPlaca(i,placa,valor){
  var g=_camNfe.grupos[i]; if(!g) return;
  g.plKm[placa]=num(valor);
  _camNfeRender();
}
function _camNfeMotPlaca(i,placa,valor){
  var g=_camNfe.grupos[i]; if(!g) return;
  g.plMot[placa]=valor;
  _camNfeRender();
}
function _camNfeTipoPlaca(i,placa,el){
  var g=_camNfe.grupos[i], t=el.getAttribute('data-tipo'); if(!g) return;
  var lista=g.plTipos[placa]||[];
  if(el.checked){ if(lista.indexOf(t)<0) lista.push(t); }
  else lista=lista.filter(function(x){ return x!==t; });
  var ordem=nfTiposImportaveis();
  lista.sort(function(a,b){ return ordem.indexOf(a)-ordem.indexOf(b); });
  g.plTipos[placa]=lista;
  _camNfeRender();
}
// Tipo com intervalo de KM cadastrado é o que entra na matriz e gera alerta (ver
// js/manutencao.js: progs filtra por INTERVALO_KM). "Outros" e "Troca de Óleo e Filtro"
// não têm intervalo: servem para registrar o serviço sem mexer em alerta nenhum.
function _camNfeTemAlerta(tipo){ return manutTipoTemAlertaKm(tipo); }
// KM lido da nota é conferido contra a última manutenção da placa: menor que ela quase
// sempre é erro de digitação da oficina ou nota de outro caminhão.
function _camNfeUltimoKm(placa){
  var mx=0;
  DB.manutRealizada.forEach(function(r){ if(r.PLACA===placa && num(r.KM_NA_MANUTENCAO)>mx) mx=num(r.KM_NA_MANUTENCAO); });
  return mx;
}

function _camNfeRotuloKm(g){ return manutKmObrigatorio(g.tipos)?'KM *':'KM (opcional nos tipos marcados)'; }

// ---------- pedaços da tela reaproveitados pelos dois modos (uma placa / dividida) ----------
function _camNfeOpcoesMotorista(sel){
  var o='<option value="">— sem motorista —</option>';
  var lista=(typeof motoristasFiltrados==='function')?motoristasFiltrados(BASE.motoristas||[],'Ativos'):(BASE.motoristas||[]);
  lista.slice().sort().forEach(function(m){ o+='<option'+(String(sel)===String(m)?' selected':'')+'>'+_nfEsc(m)+'</option>'; });
  return o;
}
function _camNfeOpcoesPlaca(sel){
  var o='<option value="">— escolha —</option>';
  (BASE.placas||[]).forEach(function(p){ o+='<option'+(String(sel)===String(p)?' selected':'')+'>'+_nfEsc(p)+'</option>'; });
  return o;
}
// KM lido da nota é conferido contra a última manutenção da placa e contra o KM das
// viagens: menor ou muito fora quase sempre é erro de digitação da oficina.
function _camNfeAvisoKm(placa,km){
  if(!(num(km)>0) || !placa) return '';
  var av='', ult=_camNfeUltimoKm(placa);
  if(ult && num(km)<ult) av+=' <span class="nf-alerta">menor que a última manutenção desta placa ('+fmt(ult,0)+' km)</span>';
  var kmHoje=(typeof kmAtualPorPlaca==='function')?kmAtualPorPlaca(placa):null;
  if(kmHoje && (num(km)>kmHoje*1.5 || num(km)<kmHoje*0.5))
    av+=' <span class="nf-alerta">fora do esperado: esta placa está com ~'+fmt(kmHoje,0)+' km nas viagens</span>';
  return av;
}
// placa vazia = nota inteira numa placa só (modo de sempre); com placa = bloco da placa
function _camNfeChips(i,placa,marcados,sugeridos){
  var chk='';
  nfTiposImportaveis().forEach(function(t){
    var mk=(marcados||[]).indexOf(t)>=0, sug=(sugeridos||[]).indexOf(t)>=0;
    // tipo sem intervalo de KM cadastrado não entra na matriz nem gera alerta — é o caso
    // de "Corretiva" e "Outros", para conserto avulso que não se encaixa em nenhum tipo
    var semAlerta=!_camNfeTemAlerta(t);
    var acao=placa?('_camNfeTipoPlaca('+i+',&quot;'+_nfEsc(placa)+'&quot;,this)'):('_camNfeTipo('+i+',this)');
    chk+='<label class="nf-tipo'+(mk?' on':'')+'" title="'+(semAlerta?'Não gera alerta de KM':'Marcar zera o alerta de KM deste tipo')+'">'+
         '<input type="checkbox"'+(mk?' checked':'')+' onchange="'+acao+'" data-tipo="'+_nfEsc(t)+'"> '+_nfEsc(t)+
         (sug?' <em>sugerido</em>':(semAlerta?' <i class="nf-tipo-na">sem alerta</i>':''))+'</label>';
  });
  return chk;
}
// Um bloco por placa quando a nota é dividida: valor dos itens dela, KM e tipos próprios.
function _camNfeBlocoPlaca(i,g,placa){
  var tipos=g.plTipos[placa]||[], km=num(g.plKm[placa]);
  var itens=_camNfeItensDaPlaca(g,placa);
  var rotKm=manutKmObrigatorio(tipos)?'KM *':'KM (opcional nos tipos marcados)';
  var av=(g.placaNota===placa && g.kmNota>0 && km===g.kmNota?'<span class="nf-lido">✓ lido da nota</span>':'')+_camNfeAvisoKm(placa,km);
  // peça de conserto avulso não casa com nenhum tipo do catálogo: é Corretiva ou Outros
  var semSug=!tipos.length
    ? '<span class="nf-alerta">nenhum tipo sugerido pelos itens — se foi conserto avulso, marque <strong>Corretiva</strong> ou <strong>Outros</strong></span>'
    : '';
  return '<div class="nf-placa-bloco">'+
    '<div class="nf-placa-cab"><span class="manut-placa-tag">'+_nfEsc(placa)+'</span>'+
      '<strong>'+fmtR(_camNfeTotalDaPlaca(g,placa))+'</strong>'+
      '<span style="color:var(--text2)">'+itens.length+(itens.length===1?' item':' itens')+'</span></div>'+
    '<div class="nf-card-campos">'+
      '<div><label>'+rotKm+'</label>'+
      '<input type="text" inputmode="decimal" placeholder="ex: 373.379" value="'+(km?fmt(km,(km%1)?2:0):'')+
      '" onchange="_camNfeKmPlaca('+i+',&quot;'+_nfEsc(placa)+'&quot;,this.value)">'+av+'</div>'+
      '<div><label>Motorista (opcional)</label><select onchange="_camNfeMotPlaca('+i+',&quot;'+_nfEsc(placa)+'&quot;,this.value)">'+
        _camNfeOpcoesMotorista(g.plMot[placa]||'')+'</select></div>'+
    '</div>'+
    '<div class="nf-card-tipos"><label>Tipos de manutenção desta placa *</label><div>'+
      _camNfeChips(i,placa,tipos,(g.plSug||{})[placa])+'</div>'+semSug+'</div>'+
    '</div>';
}

function _camNfeRender(){
  var G=_camNfe.grupos, tipos=nfTiposImportaveis();
  nfRenderAvisos('camNfeAvisos',_camNfe.rejeitados,G);
  var h='';
  G.forEach(function(g,i){
    if(g.erro) return;
    var cab='<div class="nf-card-cab"><div><strong>'+_nfEsc(g.emitNome||'-')+'</strong>'+
      '<div class="nf-det-sub">'+_nfEsc(formatDateBR(g.data))+(g.os?' · OS '+_nfEsc(g.os):'')+' · '+_nfEsc(nfRotuloNotas(g))+'</div></div>'+
      '<span class="maq-act" title="Tirar da lista" onclick="_camNfeRemover('+i+')">✖</span></div>';
    var valores='<div class="nf-card-valores">'+
      (g.pecas?'<span>📄 Peças <strong>'+fmtR(g.pecas)+'</strong></span>':'')+
      (g.servicos?'<span>🧾 Serviço <strong>'+fmtR(g.servicos)+'</strong></span>':'')+
      '<span>Total <strong>'+fmtR(g.total)+'</strong></span>'+
      '</div>'+
      // descrição item a item: é por ela que se escolhe o tipo; quando a nota é dividida,
      // cada item ganha o seletor da placa a que pertence
      nfItensHtml(g, g.dividir?function(it,n){
        return '<select class="nf-item-maq" onchange="_camNfeItemPlaca('+i+','+n+',this.value)">'+
               _camNfeOpcoesPlaca(g.itemPlaca[n]||'')+'</select>';
      }:null, {fn:'_camNfeApelido', i:i, valores:g.itemApelido, lembrados:g.itemApelidoLido})+
      nfObsHtml(g);              // e o texto da nota, de onde saem placa, OS e KM

    if(g.anexarA){
      h+='<div class="nf-card">'+cab+valores+
         '<div class="nf-card-anexo"><span class="maq-chip maq-chip-b">Anexar</span> A NF-e '+_nfEsc(g.anexarA.numero)+
         ' desta mesma OS já foi lançada. Esta nota vai <strong>somar</strong> ao valor daquela revisão, sem criar registros novos.</div></div>';
      return;
    }

    var corpo;
    if(g.dividir){
      var placas=_camNfePlacas(g);
      corpo='<div class="nf-card-anexo"><span class="maq-chip maq-chip-b">Dividida</span> '+
        'uma revisão por placa, cada uma com o valor dos seus itens'+
        ((g.placasNota||[]).length>1?' — a nota cita '+_nfEsc(g.placasNota.join(', ')):'')+
        '. Aponte a placa de cada item na lista acima.'+
        '<a class="nf-link" onclick="_camNfeDividir('+i+',false)">voltar a uma placa só</a></div>'+
        (placas.length
          ? placas.map(function(p){ return _camNfeBlocoPlaca(i,g,p); }).join('')
          : '<div class="nf-alerta" style="margin-top:6px">nenhum item tem placa ainda</div>');
    } else {
      var opPl='<option value="">— escolha —</option>';
      BASE.placas.forEach(function(p){ opPl+='<option'+(p===g.placa?' selected':'')+'>'+_nfEsc(p)+'</option>'; });
      var avPlaca='';
      if(g.placaNota && g.placa===g.placaNota) avPlaca='<span class="nf-lido">✓ lida da nota</span>';
      else if(g.placaNota) avPlaca='<span class="nf-alerta">a nota diz '+_nfEsc(g.placaNota)+', que não está cadastrada</span>';
      var avKm=(g.kmNota && g.km===g.kmNota?'<span class="nf-lido">✓ lido da nota</span>':'')+_camNfeAvisoKm(g.placa,g.km);

      corpo='<div class="nf-card-campos">'+
        '<div><label>Placa *</label><select onchange="_camNfeSet('+i+',&quot;placa&quot;,this.value)">'+opPl+'</select>'+avPlaca+
          (g.itens.length>1?'<a class="nf-link" onclick="_camNfeDividir('+i+',true)">dividir entre placas</a>':'')+'</div>'+
        '<div><label id="camNfeKmLab'+i+'">'+_camNfeRotuloKm(g)+'</label><input type="text" inputmode="decimal" placeholder="ex: 373.379" value="'+(g.km?fmt(g.km,(g.km%1)?2:0):'')+'" onchange="_camNfeSet('+i+',&quot;km&quot;,this.value)">'+avKm+'</div>'+
        '<div><label>Motorista (opcional)</label><select onchange="_camNfeSet('+i+',&quot;motorista&quot;,this.value)">'+_camNfeOpcoesMotorista(g.motorista)+'</select></div>'+
      '</div>'+
      '<div class="nf-card-tipos"><label>Tipos de manutenção * <span style="text-transform:none;letter-spacing:0">— cada um zera o alerta de KM dele; o valor fica só no primeiro. Não se encaixa em nenhum (troca de um tubo, um conserto avulso)? Marque <strong>Outros</strong>.</span></label><div>'+
        _camNfeChips(i,'',g.tipos,g.sugeridos)+'</div></div>';
    }

    h+='<div class="nf-card">'+cab+valores+corpo+'</div>';
  });
  document.getElementById('camNfeLista').innerHTML=h;
  _camNfeResumo();
}

function _camNfeResumo(){
  var imp=_camNfe.grupos.filter(_camNfeImportavel);
  var faltando=imp.filter(function(g){ return _camNfeFaltando(g); });
  var total=imp.reduce(function(a,g){ return a+g.total; },0);
  var msg;
  if(!imp.length) msg='<strong>Nada para importar.</strong> <span style="color:var(--text2)">Todas as notas selecionadas ficaram de fora pelo motivo acima.</span>';
  else {
    msg='<strong>'+imp.length+'</strong> manutenção(ões), somando <strong>'+fmtR(Math.round(total*100)/100)+'</strong>';
    if(faltando.length) msg+='<div style="color:var(--yellow);margin-top:4px">⚠️ '+faltando.length+' com '+
      faltando.map(_camNfeFaltando).filter(function(v,i,a){return a.indexOf(v)===i;}).join(', ')+' em branco — complete para poder importar.</div>';
  }
  document.getElementById('camNfeResumo').innerHTML=msg;
  var btn=document.getElementById('camNfeImportBtn');
  btn.style.display=imp.length?'inline-flex':'none';
  btn.disabled=!imp.length||faltando.length>0;
  btn.textContent='📥 Importar '+imp.length+' manutenção(ões)';
}

function _camNfeApelido(i,n,v){
  var g=_camNfe.grupos[i]; if(!g) return;
  g.itemApelido[n]=String(v||'').trim();
  g.itemApelidoLido[n]=false;   // escrito agora, não é mais o que veio da memória
  _camNfeRender();
}
function _camNfeSet(i,campo,valor){
  var g=_camNfe.grupos[i]; if(!g) return;
  // num() entende o formato brasileiro (373.379,00). Antes o campo era type=number e
  // o navegador tirava vírgula e ponto, gravando 100x o valor (37.337.900 km).
  g[campo]=(campo==='km')?num(valor):valor;
  _camNfeRender();
}
function _camNfeTipo(i,el){
  var g=_camNfe.grupos[i], t=el.getAttribute('data-tipo'); if(!g) return;
  if(el.checked){ if(g.tipos.indexOf(t)<0) g.tipos.push(t); }
  else g.tipos=g.tipos.filter(function(x){ return x!==t; });
  // mantém a ordem do catálogo: é ela que decide qual registro é o principal
  var ordem=nfTiposImportaveis();
  g.tipos.sort(function(a,b){ return ordem.indexOf(a)-ordem.indexOf(b); });
  el.parentNode.classList.toggle('on',el.checked);
  // o KM deixa de ser obrigatório se sobrar só tipo sem alerta — o rótulo acompanha
  var lab=document.getElementById('camNfeKmLab'+i);
  if(lab) lab.textContent=_camNfeRotuloKm(g);
  _camNfeResumo();
}
function _camNfeRemover(i){ _camNfe.grupos.splice(i,1); _camNfeRender(); }

function _camNfePayload(g){
  var docs=nfAplicarApelidos(g, g.docs.map(nfDocPayload)), notas=nfRotuloNotas(g);
  if(g.anexarA) return {destino:'caminhao', anexar_a:g.anexarA.id, nota_fiscal_txt:notas, documentos:docs};
  var nome=currentUserData?currentUserData.nome:'';
  var detalhe=(g.os?'OS '+g.os+' · ':'')+(g.pecas?'peças '+fmtR(g.pecas):'')+(g.pecas&&g.servicos?' + ':'')+(g.servicos?'serviço '+fmtR(g.servicos):'');
  if(g.dividir) return _camNfePayloadDividido(g,docs,notas,nome);
  return {destino:'caminhao', documentos:docs, lancamentos:g.tipos.map(function(t,k){
    return {
      placa:g.placa, tipo_manutencao:t, data_manutencao:g.data, km:(g.km>0?g.km:''),
      valor:k===0?g.total:'', motorista:g.motorista||'',
      local_servico:g.emitNome||'', nota_fiscal:notas,
      observacao:k===0
        ? detalhe+(g.tipos.length>1?' · cobre também: '+g.tipos.slice(1).join(', '):'')
        : 'Mesma revisão de "'+g.tipos[0]+'" — valor e itens da nota estão lá',
      usuario_nome_legado:nome
    };
  })};
}

// Nota dividida: para CADA placa, os registros dos tipos dela. O primeiro registro da
// placa leva o valor dos itens daquela placa; os outros ficam zerados apontando para ele,
// como numa revisão normal. Os itens levam destino_idx apontando para o primeiro registro
// da sua placa, e é por ele que o banco sabe de quem é cada peça.
function _camNfePayloadDividido(g,docs,notas,nome){
  var placas=_camNfePlacas(g), lanc=[], idxPrimeiro={};
  placas.forEach(function(p){
    var tipos=g.plTipos[p]||[], total=_camNfeTotalDaPlaca(g,p), km=num(g.plKm[p]);
    var resumo=(g.os?'OS '+g.os+' · ':'')+nfResumoItens({itens:_camNfeItensDaPlaca(g,p), os:g.os});
    tipos.forEach(function(t,k){
      if(k===0) idxPrimeiro[p]=lanc.length;
      lanc.push({
        placa:p, tipo_manutencao:t, data_manutencao:g.data, km:(km>0?km:''),
        valor:k===0?total:'', motorista:g.plMot[p]||'',
        local_servico:g.emitNome||'', nota_fiscal:notas,
        observacao:k===0
          ? resumo+(tipos.length>1?' · cobre também: '+tipos.slice(1).join(', '):'')+
            ' · nota dividida entre '+placas.length+' placas ('+placas.join(', ')+')'
          : 'Mesma revisão de "'+tipos[0]+'" — valor e itens da nota estão lá',
        usuario_nome_legado:nome
      });
    });
  });
  var k=0;
  docs.forEach(function(d){
    d.itens=(d.itens||[]).map(function(it){
      var copia={}, p=String(g.itemPlaca[k++]||'');
      for(var campo in it) copia[campo]=it[campo];
      copia.destino_idx=idxPrimeiro[p];
      return copia;
    });
  });
  return {destino:'caminhao', documentos:docs, lancamentos:lanc};
}

function camNfeImportar(){
  var imp=_camNfe.grupos.filter(_camNfeImportavel);
  if(!imp.length) return;
  if(imp.some(_camNfeFaltando)){ showToast('Complete placa, KM e tipo de todas as manutenções',true); return; }
  nfGravarGrupos(imp,_camNfePayload,document.getElementById('camNfeImportBtn'),function(ok,falhas){
    loadFromSheets(function(){
      if(typeof renderManutRealTable==='function') renderManutRealTable();
      if(document.getElementById('pageManutencao').classList.contains('active')) buildManutencao();
      if(!falhas.length){ showToast('✅ '+ok+' manutenção(ões) importada(s)!'); closeCamNfeModal(); return; }
      console.warn('NF recusadas pelo banco:',falhas);
      _camNfe.grupos=[];
      _camNfe.rejeitados=[];
      falhas.forEach(function(f){ f.grupo.docs.forEach(function(d){ _camNfe.rejeitados.push({doc:d,motivo:'Recusada',det:f.det}); }); });
      _camNfeRender();
      showToast('⚠️ '+ok+' importada(s), '+falhas.length+' recusada(s) — motivo na tela',true);
    });
  });
}
// ===== FIM IMPORTAR NF (CAMINHÕES) =====
