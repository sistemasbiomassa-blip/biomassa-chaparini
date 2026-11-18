// ============================================================
// ===== IMPORTAR ROMANEIO DE DESCARGA (PDF) — TELA ===========
// Lê os PDFs (js/romaneio-parse.js), mostra um cartão por romaneio para conferência e
// grava em cadastro. Nada entra sem o usuário ver antes: o que o sistema deduziu aparece
// em verde (certeza) ou amarelo (palpite), e o que falta trava a importação.
//
// Dois cuidados que o romaneio exige e o XML da nota não tinha:
//  - a mesma nota pode existir em outra viagem (a trava única saiu na migration 0003),
//    então "já lançado" é nota + placa;
//  - a viagem pode já ter sido lançada à mão (muitas vezes só com o diesel), e aí o certo
//    é COMPLEMENTAR aquela linha em vez de criar uma segunda linha da mesma viagem.
// ============================================================
var _rom={ grupos:[], lendo:false };

function _romPodeLancar(){
  if(typeof podeEditarCadastro==='function') return podeEditarCadastro();
  return !!(currentUserData && ['ADMIN','ANALISTA'].indexOf(currentUserData.perfil)>=0);
}

function openRomModal(){
  if(!_romPodeLancar()){ showToast('Sem permissão',true); return; }
  _rom={ grupos:[], lendo:false };
  document.getElementById('romFiles').value='';
  document.getElementById('romLista').innerHTML='';
  document.getElementById('romResumo').innerHTML='';
  document.getElementById('romImportBtn').style.display='none';
  document.getElementById('romOverlay').classList.add('show');
}
function closeRomModal(){
  document.getElementById('romOverlay').classList.remove('show');
  _rom={ grupos:[], lendo:false };
}

// ==================== LEITURA DOS ARQUIVOS ====================
function _romBytes(file){
  return new Promise(function(ok,erro){
    var fr=new FileReader();
    fr.onload=function(e){ ok(e.target.result); };
    fr.onerror=function(){ erro(new Error('não consegui abrir '+file.name)); };
    fr.readAsArrayBuffer(file);
  });
}

function _romLerArquivo(file){
  return _romBytes(file)
    .then(romLerPdf)
    .then(function(linhas){ return romParseArquivo(linhas,file.name).map(romResolver); })
    .catch(function(err){
      return [{ arquivo:file.name, erro:(err&&err.message)||String(err), avisos:[],
                candidatos:[], motOpcoes:[], destino:'novo' }];
    });
}

function romLerArquivos(){
  var arquivos=Array.prototype.slice.call(document.getElementById('romFiles').files||[]);
  if(!arquivos.length) return;
  _rom.lendo=true;
  document.getElementById('romLista').innerHTML='<div class="nf-intro">⏳ Lendo '+arquivos.length+' arquivo(s)…</div>';
  arquivos.reduce(function(prom,f){
    return prom.then(function(acc){ return _romLerArquivo(f).then(function(gs){ return acc.concat(gs); }); });
  }, Promise.resolve([])).then(function(gs){
    _rom.lendo=false;
    _rom.grupos=gs;
    _romRender();
    var fora=gs.filter(function(g){ return g.erro; }).length;
    var ok=gs.length-fora;
    if(fora && !ok) showToast('⚠️ Não consegui ler nenhum dos arquivos — veja o motivo na tela',true);
    else if(fora) showToast('⚠️ '+ok+' romaneio(s) lido(s), '+fora+' com problema — veja na tela',true);
    else showToast('✅ '+ok+' romaneio(s) lido(s) — confira antes de importar');
  });
}

// ==================== TELA ====================
function _romEsc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function _romOpcoes(lista,sel,vazio){
  var h='<option value="">'+(vazio||'— escolher —')+'</option>';
  (lista||[]).forEach(function(v){
    h+='<option value="'+_romEsc(v)+'"'+(String(v)===String(sel)?' selected':'')+'>'+_romEsc(v)+'</option>';
  });
  return h;
}
function _romResumoLinha(r){
  var p=[];
  if(r['CHEGADA CLIENTE']) p.push('cheg. '+r['CHEGADA CLIENTE']);
  if(r['SAIDA CLIENTE']) p.push('saída '+r['SAIDA CLIENTE']);
  if(r.QUANTIDADE) p.push('qtd '+(typeof fmt==='function'?fmt(r.QUANTIDADE):r.QUANTIDADE));
  if(r['QTDADE LITROS']) p.push('diesel '+(typeof fmt==='function'?fmt(r['QTDADE LITROS']):r['QTDADE LITROS'])+' L');
  if(r.NOTA) p.push('nota '+r.NOTA);
  return (r.MOTORISTA||'sem motorista')+(p.length?(' · '+p.join(' · ')):' · linha sem dados');
}

function _romRender(){
  var box=document.getElementById('romLista'), h='';
  if(!_rom.grupos.length){ box.innerHTML=''; document.getElementById('romResumo').innerHTML=''; document.getElementById('romImportBtn').style.display='none'; return; }

  _rom.grupos.forEach(function(g,i){
    h+='<div class="nf-card">';
    h+='<div class="nf-card-cab"><div><strong>'+_romEsc(g.arquivo||'arquivo')+'</strong>';
    if(g.cru&&g.cru.modeloNome) h+='<div style="font-size:11px;color:var(--text2);margin-top:2px">'+_romEsc(g.cru.modeloNome)+(g.cru.ticket?(' · ticket '+_romEsc(g.cru.ticket)):'')+(g.cru.produto?(' · '+_romEsc(g.cru.produto)):'')+'</div>';
    h+='</div></div>';

    if(g.erro){
      h+='<div class="nf-card-anexo" style="background:rgba(239,68,68,.08);border-color:rgba(239,68,68,.3)">❌ '+_romEsc(g.erro)+'</div></div>';
      return;
    }

    if(g.jaLancado){
      h+='<div class="nf-card-anexo" style="background:rgba(239,68,68,.08);border-color:rgba(239,68,68,.3)">'+
         '⛔ <strong>Já lançado.</strong> A nota '+_romEsc(g.nota)+' da placa '+_romEsc(g.placa)+' já está no sistema: '+
         _romEsc(_romResumoLinha(g.jaLancado))+' ('+_romEsc(typeof formatDateBR==='function'?formatDateBR(g.jaLancado.DATA):g.jaLancado.DATA)+'). Este romaneio não será importado.</div>';
    } else if(g.notaEmOutra){
      h+='<div class="nf-card-anexo">⚠️ A nota '+_romEsc(g.nota)+' já aparece em outra viagem ('+_romEsc(g.notaEmOutra.PLACA)+', '+
         _romEsc(typeof formatDateBR==='function'?formatDateBR(g.notaEmOutra.DATA):g.notaEmOutra.DATA)+'). Acontece, mas confira.</div>';
    }

    (g.avisos||[]).forEach(function(a){ h+='<div class="nf-alerta" style="margin:6px 0">⚠️ '+_romEsc(a)+'</div>'; });

    // ---- campos conferíveis ----
    var motLista=(typeof BASE!=='undefined'&&BASE.motoristas)?BASE.motoristas:[];
    var plLista=(typeof BASE!=='undefined'&&BASE.placas)?BASE.placas:[];
    var cgLista=(typeof BASE!=='undefined'&&BASE.localCarga)?BASE.localCarga:[];
    var ddLista=(typeof BASE!=='undefined'&&BASE.localDescarga)?BASE.localDescarga:[];
    var unidade=(typeof getUnit==='function')?getUnit(g.localDescarga):'TON';

    h+='<div class="nf-card-campos">';
    h+='<div><label>Motorista</label><select onchange="romSet('+i+',\'motorista\',this.value)">'+_romOpcoes(motLista,g.motorista)+'</select>';
    if(g.motorista && (g.motModo==='cpf'||g.motModo==='exato')) h+='<span class="nf-lido">✓ '+_romEsc(g.motTexto)+'</span>';
    else if(g.motTexto) h+='<span class="nf-alerta">⚠️ '+_romEsc(g.motTexto)+'</span>';
    if(g.motorista && g.cru && g.cru.cpf && _romFichaSemCpf(g.motorista)){
      h+='<label style="text-transform:none;letter-spacing:0;font-weight:400;margin-top:6px;display:flex;gap:6px;align-items:center;color:var(--text2)">'+
         '<input type="checkbox" '+(g.gravarCpf?'checked':'')+' onchange="romSet('+i+',\'gravarCpf\',this.checked)"> '+
         'gravar o CPF '+_romEsc(_romCpfBonito(g.cru.cpf))+' na ficha dele</label>';
    }
    h+='</div>';
    h+='<div><label>Data</label><input type="date" value="'+_romEsc(g.data)+'" onchange="romSet('+i+',\'data\',this.value)"></div>';
    h+='<div><label>Placa</label><select onchange="romSet('+i+',\'placa\',this.value)">'+_romOpcoes(plLista,g.placa)+'</select>'+
       (g.placa&&g.placaPdf===g.placa?'<span class="nf-lido">✓ lida do romaneio</span>':'')+'</div>';
    h+='<div><label>Nota fiscal</label><input type="number" value="'+_romEsc(g.nota)+'" onchange="romSet('+i+',\'nota\',this.value)"></div>';
    h+='<div><label>Quantidade ('+_romEsc(unidade)+')</label><input type="text" inputmode="decimal" value="'+
       _romEsc(g.quantidade==null?'':(typeof fmt==='function'?fmt(g.quantidade):g.quantidade))+'" onchange="romSet('+i+',\'quantidade\',this.value)">'+
       (g.cru&&g.cru.pesoLiquidoKg!=null?'<span class="nf-lido">✓ '+_romEsc(typeof fmt==='function'?fmt(g.cru.pesoLiquidoKg,0):g.cru.pesoLiquidoKg)+' kg no romaneio</span>':'')+'</div>';
    h+='<div><label>Local de carga</label><select onchange="romSet('+i+',\'localCarga\',this.value)">'+_romOpcoes(cgLista,g.localCarga)+'</select>'+
       (g.localCarga?'<span class="nf-lido">✓ regra: descarga na '+_romEsc(g.localDescarga)+' carrega aqui</span>':'')+'</div>';
    h+='<div><label>Local de descarga</label><select onchange="romSet('+i+',\'localDescarga\',this.value)">'+_romOpcoes(ddLista,g.localDescarga)+'</select></div>';
    h+='<div><label>Chegada no cliente</label><input type="time" value="'+_romEsc(g.chegada)+'" onchange="romSet('+i+',\'chegada\',this.value)"></div>';
    h+='<div><label>Saída do cliente</label><input type="time" value="'+_romEsc(g.saida)+'" onchange="romSet('+i+',\'saida\',this.value)"></div>';
    h+='</div>';

    // ---- nova viagem x complementar lançamento existente ----
    if(!g.jaLancado && g.candidatos && g.candidatos.length){
      h+='<div class="nf-card-anexo"><div style="margin-bottom:6px">Esta placa já tem lançamento sem nota nesta data. É a mesma viagem?</div>';
      h+='<select onchange="romSet('+i+',\'destino\',this.value)" style="width:100%">';
      h+='<option value="novo"'+(g.destino==='novo'?' selected':'')+'>🆕 Lançar como viagem nova</option>';
      g.candidatos.forEach(function(r){
        // o RLS só deixa o ANALISTA/DIRETOR mexer no próprio lançamento: melhor a opção
        // vir travada aqui do que a gravação ser recusada lá no banco
        var meu=(typeof ehDonoLancamento==='function')?ehDonoLancamento(r.USUARIO):true;
        h+='<option value="'+_romEsc(r.ID)+'"'+(String(g.destino)===String(r.ID)?' selected':'')+(meu?'':' disabled')+'>'+
           (meu?'➕ Complementar: ':'🔒 ')+_romEsc(_romResumoLinha(r))+(meu?'':' — lançado por '+_romEsc(r.USUARIO||'outro usuário'))+'</option>';
      });
      h+='</select>';
      if(g.destino!=='novo'){
        var reg=_romRegistro(g.destino);
        if(reg){
          var d=romDiffComplemento(g,reg);
          var campos=Object.keys(d.muda);
          h+='<div style="font-size:11.5px;margin-top:8px;line-height:1.6">'+
             (campos.length?('preenche o que está em branco lá: <strong>'+_romEsc(campos.join(', '))+'</strong>'):'não há nada em branco para preencher nessa linha');
          d.conflitos.forEach(function(c){
            h+='<br><span class="nf-alerta">⚠️ '+_romEsc(c.campo)+': a linha tem "'+_romEsc(c.atual)+'" e o romaneio diz "'+_romEsc(c.romaneio)+'" — mantenho o que já está lá</span>';
          });
          h+='</div>';
        }
      }
      h+='</div>';
    }

    var falta=romFaltando(g);
    if(falta && falta!=='ja' && falta!=='erro') h+='<div class="nf-alerta" style="margin-top:8px">⚠️ falta preencher: '+_romEsc(falta)+'</div>';
    h+='</div>';
  });

  box.innerHTML=h;
  _romResumo();
}

function _romResumo(){
  var prontos=0, jaLancados=0, faltando=0, erros=0, complementos=0;
  _rom.grupos.forEach(function(g){
    var f=romFaltando(g);
    if(f==='erro') erros++;
    else if(f==='ja') jaLancados++;
    else if(f) faltando++;
    else { prontos++; if(g.destino!=='novo') complementos++; }
  });
  var p=[];
  if(prontos) p.push('<strong>'+prontos+'</strong> pronto(s) para importar'+(complementos?(' — '+complementos+' complementando lançamento existente'):''));
  if(faltando) p.push(faltando+' esperando conferência');
  if(jaLancados) p.push(jaLancados+' já lançado(s)');
  if(erros) p.push(erros+' não lido(s)');
  document.getElementById('romResumo').innerHTML=p.join(' · ');
  document.getElementById('romImportBtn').style.display=prontos?'':'none';
  document.getElementById('romImportBtn').textContent='Importar '+prontos+' romaneio(s)';
}

function _romRegistro(id){
  var lista=(typeof DB!=='undefined'&&DB.cadastro)?DB.cadastro:[];
  for(var i=0;i<lista.length;i++){ if(String(lista[i].ID)===String(id)) return lista[i]; }
  return null;
}
function _romFichaSemCpf(nome){
  var lista=(typeof MOTORISTAS_DATA!=='undefined'&&MOTORISTAS_DATA)?MOTORISTAS_DATA:[];
  for(var i=0;i<lista.length;i++){
    if(String(lista[i].NOME)===String(nome)) return !String(lista[i].CPF||'').trim();
  }
  return false;
}
function _romCpfBonito(cpf){
  var d=String(cpf||'').replace(/\D/g,'');
  return d.length===11 ? d.slice(0,3)+'.'+d.slice(3,6)+'.'+d.slice(6,9)+'-'+d.slice(9) : cpf;
}

// Um ponto só de alteração: muda o campo, refaz os cruzamentos e redesenha.
function romSet(i,campo,valor){
  var g=_rom.grupos[i];
  if(!g) return;
  if(campo==='quantidade'){
    g.quantidade=(valor==='')?null:(typeof num==='function'?num(valor):parseFloat(valor));
  } else if(campo==='gravarCpf'){
    g.gravarCpf=!!valor;
  } else if(campo==='localDescarga'){
    g.localDescarga=valor;
    var padrao=romCargaPadraoDoDestino(valor);                 // destino conhecido traz a fazenda junto
    if(padrao && !g.localCarga) g.localCarga=padrao;
  } else if(campo==='motorista'){
    g.motorista=valor;
    g.motModo=valor?'manual':'';
    g.motTexto=valor?'escolhido por você':('o romaneio diz "'+(g.motoristaPdf||'?')+'"');
    g.gravarCpf=false;                                         // outro motorista, outro CPF
  } else {
    g[campo]=valor;
  }
  romAtualizarCruzamentos(g);
  _romRender();
}

// ==================== GRAVAÇÃO ====================
function _romGravar(action,dados){
  return new Promise(function(ok,erro){
    saveToSheets(action,dados,function(bom,res){
      if(bom) ok(res); else erro(new Error((res&&res.error)||'erro desconhecido'));
    });
  });
}

function romImportar(){
  if(!_romPodeLancar()){ showToast('Sem permissão',true); return; }
  var prontos=_rom.grupos.filter(function(g){ return !romFaltando(g); });
  if(!prontos.length){ showToast('Nada pronto para importar',true); return; }
  var btn=document.getElementById('romImportBtn');
  btn.disabled=true; btn.textContent='Importando…';

  var ok=0, falhas=[];
  prontos.reduce(function(prom,g){
    return prom.then(function(){
      var passo = (g.destino==='novo') ? _romGravarNovo(g) : _romGravarComplemento(g);
      return passo.then(function(){ ok++; return _romGravarCpf(g); })
        .catch(function(err){ falhas.push({ arquivo:g.arquivo, motivo:err.message||String(err) }); });
    });
  }, Promise.resolve()).then(function(){
    btn.disabled=false;
    loadFromSheets(function(){
      _romDepoisDeImportar();
      if(!falhas.length){ showToast('✅ '+ok+' romaneio(s) importado(s)!'); closeRomModal(); return; }
      console.warn('Romaneios recusados:',falhas);
      showToast('⚠️ '+ok+' importado(s), '+falhas.length+' com erro: '+falhas[0].motivo,true);
      _rom.grupos=_rom.grupos.filter(function(g){
        return falhas.some(function(f){ return f.arquivo===g.arquivo; });
      });
      _rom.grupos.forEach(function(g){
        var f=falhas.filter(function(x){ return x.arquivo===g.arquivo; })[0];
        g.erro='não gravou: '+f.motivo;
      });
      _romRender();
    });
  });
}

function _romGravarNovo(g){
  var rec=romLinhaCadastro(g);
  rec['USUARIO']=currentUserData?currentUserData.nome:currentUser;
  rec['DATA_REGISTRO']=new Date().toLocaleString('pt-BR');
  return _romGravar('addCadastro',rec).then(function(res){
    var salvo=res&&res[0];
    if(salvo) rec.ID=salvo.id;
    if(typeof DB!=='undefined'&&DB.cadastro) DB.cadastro.push(rec);
  });
}

function _romGravarComplemento(g){
  var reg=_romRegistro(g.destino);
  if(!reg) return Promise.reject(new Error('o lançamento a complementar sumiu da lista — recarregue a página'));
  if(typeof ehDonoLancamento==='function' && !ehDonoLancamento(reg.USUARIO))
    return Promise.reject(new Error('este lançamento é de '+(reg.USUARIO||'outro usuário')+' — só o ADMIN pode complementar'));
  var d=romDiffComplemento(g,reg);
  if(!Object.keys(d.muda).length) return Promise.resolve();            // nada a fazer
  return _romGravar('updateCadastro',{ id:reg.ID, row:d.muda }).then(function(){
    Object.keys(d.muda).forEach(function(k){ reg[k]=d.muda[k]; });
  });
}

// CPF do romaneio vai para a ficha do motorista quando ela está sem — o cadastro vai se
// completando sozinho, e o próximo romaneio dele casa por CPF, sem palpite de nome.
function _romGravarCpf(g){
  if(!g.gravarCpf || !g.motorista || !(g.cru&&g.cru.cpf)) return Promise.resolve();
  var cpf=_romCpfBonito(g.cru.cpf);
  return _romGravar('updateMotorista',{ nome:g.motorista, row:{ CPF:cpf } }).then(function(){
    (MOTORISTAS_DATA||[]).forEach(function(m){ if(m.NOME===g.motorista) m.CPF=cpf; });
  }).catch(function(err){ console.warn('não gravei o CPF de',g.motorista,err); });
}

function _romDepoisDeImportar(){
  var ativo=document.querySelector('.nav-item.active');
  var pg=ativo?ativo.getAttribute('data-page'):'';
  if(pg==='producao'&&typeof buildProducao==='function') buildProducao();
  else if(pg==='financeiro'&&typeof buildFinanceiro==='function') buildFinanceiro();
  else if(pg==='historico'&&typeof buildHistorico==='function') buildHistorico();
  else if(pg==='tempoespera'&&typeof buildTempoEspera==='function') buildTempoEspera();
}
