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
    var tipos=nfTiposImportaveis();
    L.grupos.forEach(function(g){
      // placa da nota só vale se estiver cadastrada; senão o usuário escolhe
      g.placaNota=g.placa;
      g.placa=(g.placa && BASE.placas.indexOf(g.placa)>=0)?g.placa:'';
      g.kmNota=g.km;
      g.tipos=nfSugerirTipos(g.itens,tipos);
      g.sugeridos=g.tipos.slice();
    });
    _camNfe=L;
    _camNfeRender();
    var fora=L.rejeitados.length+L.grupos.filter(function(g){return g.erro;}).length;
    if(fora) showToast('⚠️ '+fora+' nota(s) ficaram de fora — veja o aviso no topo',true);
    else if(L.grupos.length) showToast('✅ '+L.grupos.length+' manutenção(ões) montadas — confira placa, KM e tipos');
  });
}

function _camNfeImportavel(g){ return !g.erro; }
function _camNfeFaltando(g){
  if(g.anexarA) return '';
  if(!g.placa) return 'placa';
  if(!(g.km>0)) return 'KM';
  if(!g.tipos.length) return 'tipo';
  return '';
}
// KM lido da nota é conferido contra a última manutenção da placa: menor que ela quase
// sempre é erro de digitação da oficina ou nota de outro caminhão.
function _camNfeUltimoKm(placa){
  var mx=0;
  DB.manutRealizada.forEach(function(r){ if(r.PLACA===placa && num(r.KM_NA_MANUTENCAO)>mx) mx=num(r.KM_NA_MANUTENCAO); });
  return mx;
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
      '<span style="color:var(--text2)">'+_nfEsc(nfResumoItens(g))+'</span></div>';

    if(g.anexarA){
      h+='<div class="nf-card">'+cab+valores+
         '<div class="nf-card-anexo"><span class="maq-chip maq-chip-b">Anexar</span> A NF-e '+_nfEsc(g.anexarA.numero)+
         ' desta mesma OS já foi lançada. Esta nota vai <strong>somar</strong> ao valor daquela revisão, sem criar registros novos.</div></div>';
      return;
    }

    var opPl='<option value="">— escolha —</option>';
    BASE.placas.forEach(function(p){ opPl+='<option'+(p===g.placa?' selected':'')+'>'+_nfEsc(p)+'</option>'; });
    var avPlaca='';
    if(g.placaNota && g.placa===g.placaNota) avPlaca='<span class="nf-lido">✓ lida da nota</span>';
    else if(g.placaNota) avPlaca='<span class="nf-alerta">a nota diz '+_nfEsc(g.placaNota)+', que não está cadastrada</span>';
    var avKm='';
    if(g.kmNota && g.km===g.kmNota) avKm='<span class="nf-lido">✓ lido da nota</span>';
    var ult=g.placa?_camNfeUltimoKm(g.placa):0;
    if(g.km>0 && ult && g.km<ult) avKm+=' <span class="nf-alerta">menor que a última manutenção desta placa ('+fmt(ult,0)+' km)</span>';

    var chk='';
    tipos.forEach(function(t){
      var mk=g.tipos.indexOf(t)>=0, sug=g.sugeridos.indexOf(t)>=0;
      chk+='<label class="nf-tipo'+(mk?' on':'')+'"><input type="checkbox"'+(mk?' checked':'')+
           ' onchange="_camNfeTipo('+i+',this)" data-tipo="'+_nfEsc(t)+'"> '+_nfEsc(t)+(sug?' <em>sugerido</em>':'')+'</label>';
    });

    h+='<div class="nf-card">'+cab+valores+
      '<div class="nf-card-campos">'+
        '<div><label>Placa *</label><select onchange="_camNfeSet('+i+',&quot;placa&quot;,this.value)">'+opPl+'</select>'+avPlaca+'</div>'+
        '<div><label>KM *</label><input type="number" min="0" step="1" value="'+(g.km||'')+'" onchange="_camNfeSet('+i+',&quot;km&quot;,this.value)">'+avKm+'</div>'+
      '</div>'+
      '<div class="nf-card-tipos"><label>Tipos de manutenção * <span style="text-transform:none;letter-spacing:0">— cada um zera o alerta de KM dele; o valor fica só no primeiro</span></label><div>'+chk+'</div></div>'+
      '</div>';
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

function _camNfeSet(i,campo,valor){
  var g=_camNfe.grupos[i]; if(!g) return;
  g[campo]=(campo==='km')?(parseInt(valor,10)||0):valor;
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
  _camNfeResumo();
}
function _camNfeRemover(i){ _camNfe.grupos.splice(i,1); _camNfeRender(); }

function _camNfePayload(g){
  var docs=g.docs.map(nfDocPayload), notas=nfRotuloNotas(g);
  if(g.anexarA) return {destino:'caminhao', anexar_a:g.anexarA.id, nota_fiscal_txt:notas, documentos:docs};
  var nome=currentUserData?currentUserData.nome:'';
  var detalhe=(g.os?'OS '+g.os+' · ':'')+(g.pecas?'peças '+fmtR(g.pecas):'')+(g.pecas&&g.servicos?' + ':'')+(g.servicos?'serviço '+fmtR(g.servicos):'');
  return {destino:'caminhao', documentos:docs, lancamentos:g.tipos.map(function(t,k){
    return {
      placa:g.placa, tipo_manutencao:t, data_manutencao:g.data, km:g.km,
      valor:k===0?g.total:'',
      local_servico:g.emitNome||'', nota_fiscal:notas,
      observacao:k===0
        ? detalhe+(g.tipos.length>1?' · cobre também: '+g.tipos.slice(1).join(', '):'')
        : 'Mesma revisão de "'+g.tipos[0]+'" — valor e itens da nota estão lá',
      usuario_nome_legado:nome
    };
  })};
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
