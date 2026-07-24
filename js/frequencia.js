// Aditivo. Prefixo "freq". Lê DB.frequencia, grava via saveFrequenciaMes.
// ============================================================
var FREQ_CODIGOS = [
  {cod:'T',  label:'Trabalhado', trabalho:true,  bg:'#1f5c10', fg:'#d6f5c0'},
  {cod:'FG', label:'Folga',      trabalho:false, bg:'#5a5a52', fg:'#e8e8e2'},
  {cod:'AT', label:'Atestado',   trabalho:false, bg:'#14507f', fg:'#cfe7fb'},
  {cod:'F',  label:'Falta',      trabalho:false, bg:'#7a1d1d', fg:'#f6cccc'},
  {cod:'FR', label:'Férias',     trabalho:false, bg:'#8a5a06', fg:'#fbe2b0'}
];
// ordem de clique: vazio -> T -> FG -> AT -> F -> FR -> vazio
var FREQ_CICLO = ['', 'T', 'FG', 'AT', 'F', 'FR'];
var freqEstado = {};        // chave "MOTORISTA||AAAA-MM-DD" -> codigo (estado atual editável)
var freqOriginal = {};      // snapshot do que veio salvo (para diff no salvar)
var freqMotoristasMes = []; // nomes na grade do mês atual

function freqCodigoInfo(cod){
  for(var i=0;i<FREQ_CODIGOS.length;i++){ if(FREQ_CODIGOS[i].cod===cod) return FREQ_CODIGOS[i]; }
  return null;
}
function freqPad2(n){ n=String(n); return n.length<2?('0'+n):n; }
function freqDatePart(v){
  var s=String(v==null?'':v).trim();
  var m=s.match(/^(\d{4})-(\d{2})-(\d{2})/); if(m) return m[1]+'-'+m[2]+'-'+m[3];
  m=s.match(/^(\d{2})\/(\d{2})\/(\d{4})/); if(m) return m[3]+'-'+m[2]+'-'+m[1];
  return s;
}
function freqDiasNoMes(ano,mes){ return new Date(Number(ano), Number(mes), 0).getDate(); } // mes 1-12
function freqDiaSemana(ano,mes,dia){ return new Date(Number(ano),Number(mes)-1,Number(dia)).getDay(); } // 0=dom

// motorista ativo no mês: sem desligamento, OU desligamento no mês selecionado ou depois
function freqMotoristaAtivoNoMes(rec, ano, mes){
  var d=String(rec.DATA_DESLIGAMENTO||'').trim();
  if(!d) return true;
  var dp=freqDatePart(d); // AAAA-MM-DD
  var fimMes=ano+'-'+freqPad2(mes)+'-31';
  // aparece se foi desligado no mês selecionado ou depois (dp >= primeiro dia do mês)
  var iniMes=ano+'-'+freqPad2(mes)+'-01';
  return dp>=iniMes;
}

function freqInitControls(){
  var selAno=document.getElementById('freqAno');
  if(selAno && !selAno.options.length){
    var atual=new Date().getFullYear();
    for(var y=atual+1; y>=atual-3; y--){
      var o=document.createElement('option'); o.value=String(y); o.textContent=String(y); selAno.appendChild(o);
    }
  }
}

function buildFrequencia(){
  freqInitControls();
  var hoje=new Date();
  var selMes=document.getElementById('freqMes'), selAno=document.getElementById('freqAno');
  // só define o padrão na 1ª vez (preserva escolha do usuário ao voltar)
  if(selMes && !selMes.dataset.init){ selMes.value=freqPad2(hoje.getMonth()+1); selMes.dataset.init='1'; selMes.onchange=freqOnPeriodoChange; }
  if(selAno && !selAno.dataset.init){ selAno.value=String(hoje.getFullYear()); selAno.dataset.init='1'; selAno.onchange=freqOnPeriodoChange; }
  freqRenderLegenda();
  freqCarregarMes();
}

function freqRenderLegenda(){
  var el=document.getElementById('freqLegenda'); if(!el) return;
  var h='';
  FREQ_CODIGOS.forEach(function(c){
    h+='<span style="display:inline-flex;align-items:center;gap:5px"><span style="display:inline-block;min-width:24px;text-align:center;padding:2px 6px;border-radius:4px;font-weight:700;background:'+c.bg+';color:'+c.fg+'">'+c.cod+'</span>'+c.label+'</span>';
  });
  h+='<span style="color:var(--text2)">(clique na célula para alternar • em branco = não marcado)</span>';
  el.innerHTML=h;
}

function freqOnPeriodoChange(){ freqCarregarMes(); }

function freqCarregarMes(){
  var ano=document.getElementById('freqAno').value;
  var mes=document.getElementById('freqMes').value;
  freqEstado={}; freqOriginal={};
  // carrega o que já está salvo deste mês
  (DB.frequencia||[]).forEach(function(r){
    var dp=freqDatePart(r.DATA);
    if(dp.slice(0,7)!== (ano+'-'+mes)) return;
    var nome=String(r.MOTORISTA||'').trim();
    var cod=String(r.CODIGO||'').trim().toUpperCase();
    if(!nome||!dp) return;
    var k=nome.toUpperCase()+'||'+dp;
    freqEstado[k]=cod;
    freqOriginal[k]=cod;
  });
  // monta lista de motoristas ativos no mês (da ficha MOTORISTAS)
  freqMotoristasMes = (MOTORISTAS_DATA||[])
    .filter(function(rec){ return rec.NOME && freqMotoristaAtivoNoMes(rec, ano, mes); })
    .map(function(rec){ return String(rec.NOME).trim(); })
    .sort(function(a,b){ return a.localeCompare(b); });
  freqRenderGrid();
}

function freqRenderGrid(){
  var cont=document.getElementById('freqGridContainer'); if(!cont) return;
  var ano=document.getElementById('freqAno').value;
  var mes=document.getElementById('freqMes').value;
  var dias=freqDiasNoMes(ano,mes);
  var diasSemana=['D','S','T','Q','Q','S','S'];

  if(!freqMotoristasMes.length){
    cont.innerHTML='<div style="padding:20px;color:var(--text2)">Nenhum motorista ativo neste mês. Cadastre motoristas (aba Cadastro › Motoristas) ou ajuste o período.</div>';
    document.getElementById('freqInfoBadge').textContent='0 motoristas';
    return;
  }

  var h='<table style="border-collapse:collapse;font-size:12px"><thead><tr>';
  h+='<th style="position:sticky;left:0;background:var(--surface);z-index:2;text-align:left;padding:6px 10px;min-width:160px;border-bottom:1px solid var(--border)">Motorista</th>';
  for(var d=1; d<=dias; d++){
    var dw=freqDiaSemana(ano,mes,d);
    var fimDeSemana=(dw===0||dw===6);
    h+='<th style="padding:4px 0;min-width:26px;text-align:center;border-bottom:1px solid var(--border);'+(fimDeSemana?'color:var(--text2);background:var(--surface2)':'')+'">'+d+'<br><span style="font-weight:400;font-size:9px">'+diasSemana[dw]+'</span></th>';
  }
  h+='</tr></thead><tbody>';

  freqMotoristasMes.forEach(function(nome){
    h+='<tr>';
    h+='<td style="position:sticky;left:0;background:var(--surface);z-index:1;font-weight:500;padding:5px 10px;white-space:nowrap;border-bottom:1px solid var(--border2,#2a2f3a)">'+nome+'</td>';
    for(var d=1; d<=dias; d++){
      var ds=ano+'-'+mes+'-'+freqPad2(d);
      var k=nome.toUpperCase()+'||'+ds;
      var cod=freqEstado[k]||'';
      var info=freqCodigoInfo(cod);
      var st=info?('background:'+info.bg+';color:'+info.fg+';font-weight:700'):'';
      var dw=freqDiaSemana(ano,mes,d);
      var fds=(dw===0||dw===6);
      var nomeAttr=nome.replace(/'/g,"\\'");
      h+='<td onclick="freqToggle(\''+nomeAttr+'\','+d+')" title="'+nome+' • dia '+d+'" style="cursor:pointer;text-align:center;padding:3px 2px;border-bottom:1px solid var(--border2,#2a2f3a);'+(fds&&!info?'background:var(--surface2)':'')+'"><span style="display:inline-block;min-width:22px;border-radius:4px;padding:2px 0;'+st+'">'+(cod||'')+'</span></td>';
    }
    h+='</tr>';
  });
  h+='</tbody></table>';
  cont.innerHTML=h;
  document.getElementById('freqInfoBadge').textContent=freqMotoristasMes.length+' motoristas • '+dias+' dias';
}

function freqToggle(nome, dia){
  var ano=document.getElementById('freqAno').value;
  var mes=document.getElementById('freqMes').value;
  var ds=ano+'-'+mes+'-'+freqPad2(dia);
  var k=nome.toUpperCase()+'||'+ds;
  var atual=freqEstado[k]||'';
  var idx=FREQ_CICLO.indexOf(atual); if(idx<0) idx=0;
  var prox=FREQ_CICLO[(idx+1)%FREQ_CICLO.length];
  if(prox==='') delete freqEstado[k]; else freqEstado[k]=prox;
  freqRenderGrid();
}

function freqPreencherMesT(){
  var ano=document.getElementById('freqAno').value;
  var mes=document.getElementById('freqMes').value;
  var dias=freqDiasNoMes(ano,mes);
  freqMotoristasMes.forEach(function(nome){
    for(var d=1; d<=dias; d++){
      var k=nome.toUpperCase()+'||'+ano+'-'+mes+'-'+freqPad2(d);
      if(!freqEstado[k]) freqEstado[k]='T'; // só preenche os vazios, não sobrescreve folgas já marcadas
    }
  });
  freqRenderGrid();
  showToast('Dias vazios preenchidos com T (revise as folgas e salve)');
}

function freqLimparMes(){
  if(!confirm('Limpar todas as marcações exibidas deste mês? (só salva ao clicar em Salvar mês)')) return;
  freqEstado={};
  freqRenderGrid();
}

function freqSalvarMes(){
  if(!(currentUserData && (currentUserData.perfil==='ADMIN'||currentUserData.perfil==='ANALISTA'))){
    showToast('Sem permissão para salvar frequência',true); return;
  }
  var ano=document.getElementById('freqAno').value;
  var mes=document.getElementById('freqMes').value;
  // diff: só manda o que mudou em relação ao original carregado
  var marcacoes=[];
  var chaves={};
  Object.keys(freqEstado).forEach(function(k){ chaves[k]=1; });
  Object.keys(freqOriginal).forEach(function(k){ chaves[k]=1; });
  Object.keys(chaves).forEach(function(k){
    var atual=freqEstado[k]||'';
    var orig=freqOriginal[k]||'';
    if(atual===orig) return; // não mudou
    var partes=k.split('||');
    if(partes[1].slice(0,7)!==(ano+'-'+mes)) return; // segurança: só o mês atual
    // recupera o nome original (com capitalização) a partir da lista
    var nomeReal=k.split('||')[0];
    for(var i=0;i<freqMotoristasMes.length;i++){ if(freqMotoristasMes[i].toUpperCase()===nomeReal){ nomeReal=freqMotoristasMes[i]; break; } }
    marcacoes.push({DATA:partes[1], MOTORISTA:nomeReal, CODIGO:atual}); // CODIGO vazio = remoção
  });

  if(!marcacoes.length){ showToast('Nada mudou para salvar'); return; }

  var btn=document.getElementById('freqBtnSalvar');
  if(btn){ btn.disabled=true; btn.textContent='Salvando...'; }
  var usuario=(currentUserData && (currentUserData.nome||currentUserData.usuario))||'';

  saveToSheets('saveFrequenciaMes', {marcacoes:marcacoes, usuario:usuario}, function(ok){
    if(btn){ btn.disabled=false; btn.textContent='💾 Salvar mês'; }
    if(ok){
      // aplica no DB local e atualiza o "original" para o novo estado salvo
      freqAplicarNoDBLocal(marcacoes);
      Object.keys(freqEstado).forEach(function(k){ freqOriginal[k]=freqEstado[k]; });
      // remove do original as chaves que viraram vazias
      marcacoes.forEach(function(m){ if(!m.CODIGO){ var k=m.MOTORISTA.toUpperCase()+'||'+m.DATA; delete freqOriginal[k]; } });
      showToast('✅ Frequência salva ('+marcacoes.length+' alteração(ões))');
    } else {
      showToast('⚠️ Falha ao salvar na planilha',true);
    }
  });
}

// Mantém DB.frequencia coerente com o que foi salvo (sem precisar recarregar tudo)
function freqAplicarNoDBLocal(marcacoes){
  if(!DB.frequencia) DB.frequencia=[];
  marcacoes.forEach(function(m){
    var alvoData=freqDatePart(m.DATA), alvoMot=String(m.MOTORISTA||'').trim().toUpperCase();
    var idx=-1;
    for(var i=0;i<DB.frequencia.length;i++){
      if(String(DB.frequencia[i].MOTORISTA||'').trim().toUpperCase()===alvoMot && freqDatePart(DB.frequencia[i].DATA)===alvoData){ idx=i; break; }
    }
    if(!m.CODIGO){ if(idx>=0) DB.frequencia.splice(idx,1); }
    else if(idx>=0){ DB.frequencia[idx].CODIGO=m.CODIGO; }
    else { DB.frequencia.push({DATA:alvoData, MOTORISTA:m.MOTORISTA, CODIGO:m.CODIGO}); }
  });
}

// ---------- CRUZAMENTO frequência × entregas ----------
// Período = mês/ano selecionado. Entrega = ENTREGA && QUANTIDADE>0 (mesma regra do sistema).
// 3 sinais: T sem entrega (vermelho); entregou em ausência FG/AT/F/FR (amarelo); entregou sem marcação (amarelo).
// "Sem marcação" só conta para motorista que tem ALGUM dia marcado no mês (grade iniciada).
function freqCalcCruzamento(ano, mes){
  var prefixo = ano+'-'+mes; // AAAA-MM
  // 1) entregas por MOTORISTA||DATA (contagem) no mês
  var entregasMap = {}; // chave -> qtd de entregas
  (DB.cadastro||[]).forEach(function(r){
    if(!(r.ENTREGA && r.QUANTIDADE && r.QUANTIDADE>0)) return;
    if(!r['LOCAL DESCARGA']) return;
    var dp = freqDatePart(r.DATA);
    if(dp.slice(0,7)!==prefixo) return;
    var nome=String(r.MOTORISTA||'').trim(); if(!nome) return;
    var k=nome.toUpperCase()+'||'+dp;
    entregasMap[k]=(entregasMap[k]||0)+1;
  });
  // 2) marcações do mês (estado salvo no DB) + saber quem tem grade iniciada
  var marcMap={}; // chave -> codigo
  var temAlgumaMarca={}; // motoristaUpper -> true
  (DB.frequencia||[]).forEach(function(r){
    var dp=freqDatePart(r.DATA);
    if(dp.slice(0,7)!==prefixo) return;
    var nome=String(r.MOTORISTA||'').trim(); if(!nome) return;
    var cod=String(r.CODIGO||'').trim().toUpperCase(); if(!cod) return;
    marcMap[nome.toUpperCase()+'||'+dp]=cod;
    temAlgumaMarca[nome.toUpperCase()]=true;
  });

  var trabSemEntrega=[]; // {motorista, data, cod}
  var entregaEmAusencia=[]; // {motorista, data, cod, entregas}
  var entregaSemMarca=[]; // {motorista, data, entregas}

  // A) percorre marcações: T sem entrega / entrega em ausência
  Object.keys(marcMap).forEach(function(k){
    var cod=marcMap[k];
    var partes=k.split('||');
    var nomeU=partes[0], dp=partes[1];
    var temEntrega=(entregasMap[k]||0)>0;
    var info=freqCodigoInfo(cod);
    var contaTrab=info?info.trabalho:false;
    if(contaTrab){
      if(!temEntrega) trabSemEntrega.push({motorista:nomeU, data:dp, cod:cod});
    } else {
      if(temEntrega) entregaEmAusencia.push({motorista:nomeU, data:dp, cod:cod, entregas:entregasMap[k]});
    }
  });

  // B) percorre entregas: entregou sem marcação (só p/ quem já tem grade iniciada no mês)
  Object.keys(entregasMap).forEach(function(k){
    if(marcMap[k]) return; // já tem código (tratado acima)
    var partes=k.split('||');
    var nomeU=partes[0], dp=partes[1];
    if(!temAlgumaMarca[nomeU]) return; // grade não iniciada -> não alarma
    entregaSemMarca.push({motorista:nomeU, data:dp, entregas:entregasMap[k]});
  });

  function ordena(a,b){ if(a.data!==b.data) return a.data<b.data?-1:1; return a.motorista<b.motorista?-1:1; }
  trabSemEntrega.sort(ordena); entregaEmAusencia.sort(ordena); entregaSemMarca.sort(ordena);

  // mapa para recuperar nome com capitalização original
  var nomeReal={};
  (MOTORISTAS_DATA||[]).forEach(function(r){ var n=String(r.NOME||'').trim(); if(n) nomeReal[n.toUpperCase()]=n; });
  function nomeBonito(u){ return nomeReal[u]||u; }
  [trabSemEntrega,entregaEmAusencia,entregaSemMarca].forEach(function(arr){ arr.forEach(function(x){ x.motorista=nomeBonito(x.motorista); }); });

  return { trabSemEntrega:trabSemEntrega, entregaEmAusencia:entregaEmAusencia, entregaSemMarca:entregaSemMarca };
}

function freqDataBR(ds){ var p=String(ds||'').split('-'); return p.length===3?(p[2]+'/'+p[1]+'/'+p[0]):ds; }
function freqDiaSemanaTxt(ds){
  var p=String(ds||'').split('-'); if(p.length!==3) return '';
  var nomes=['dom','seg','ter','qua','qui','sex','sáb'];
  var dw=new Date(Number(p[0]),Number(p[1])-1,Number(p[2])).getDay();
  return nomes[dw];
}

// cache do último cruzamento calculado (p/ filtrar por motorista sem recalcular)
var _freqCruzData=null;

// nomes únicos de motoristas presentes nas divergências (ordenados)
function _freqCruzNomes(c){
  var s={};
  [c.trabSemEntrega,c.entregaEmAusencia,c.entregaSemMarca].forEach(function(arr){ arr.forEach(function(x){ s[x.motorista]=true; }); });
  return Object.keys(s).sort(function(a,b){ return a.localeCompare(b,'pt-BR'); });
}
// filtra o resultado do cruzamento por um motorista (vazio = todos)
function _freqCruzFiltra(c, mot){
  if(!mot) return c;
  function f(arr){ return arr.filter(function(x){ return x.motorista===mot; }); }
  return { trabSemEntrega:f(c.trabSemEntrega), entregaEmAusencia:f(c.entregaEmAusencia), entregaSemMarca:f(c.entregaSemMarca) };
}

function freqGerarCruzamento(){
  var ano=document.getElementById('freqAno').value;
  var mes=document.getElementById('freqMes').value;
  _freqCruzData=freqCalcCruzamento(ano,mes);
  // popula o dropdown de motoristas (preserva seleção atual se ainda existir)
  var sel=document.getElementById('freqCruzMot');
  if(sel){
    var atual=sel.value;
    var nomes=_freqCruzNomes(_freqCruzData);
    var opts='<option value="">Todos os motoristas</option>';
    nomes.forEach(function(n){ opts+='<option value="'+String(n).replace(/"/g,'&quot;')+'">'+n+'</option>'; });
    sel.innerHTML=opts;
    sel.value=(atual && nomes.indexOf(atual)>=0)?atual:'';
  }
  freqRenderCruzamento();
}

function freqRenderCruzamento(){
  var cont=document.getElementById('freqCruzContainer'); if(!cont) return;
  if(!_freqCruzData){ cont.innerHTML=''; return; }
  var sel=document.getElementById('freqCruzMot');
  var mot=sel?sel.value:'';
  var c=_freqCruzFiltra(_freqCruzData, mot);
  var total=c.trabSemEntrega.length+c.entregaEmAusencia.length+c.entregaSemMarca.length;
  document.getElementById('freqCruzBadge').textContent=total+' divergência(s)';

  if(total===0){
    cont.innerHTML='<div style="padding:16px;color:var(--green);font-weight:500">✅ '+(mot?'Nenhuma divergência para '+mot+' no período.':'Nenhuma divergência no período. Tudo certo!')+'</div>';
    return;
  }

  function bloco(titulo, cor, itens, render){
    if(!itens.length) return '';
    var h='<div style="border:1px solid var(--border);border-left:4px solid '+cor+';border-radius:6px;padding:10px 12px;margin-bottom:10px">';
    h+='<div style="font-weight:600;margin-bottom:6px;color:'+cor+'">'+titulo+' — '+itens.length+'</div>';
    h+='<div style="font-size:12px;line-height:1.9">';
    itens.forEach(function(it){ h+=render(it)+'<br>'; });
    h+='</div></div>';
    return h;
  }

  var html='';
  html+=bloco('🔴 Trabalhou (T) e não entregou', 'var(--red)', c.trabSemEntrega, function(it){
    return it.motorista+' — '+freqDataBR(it.data)+' ('+freqDiaSemanaTxt(it.data)+')';
  });
  html+=bloco('🟡 Entregou em dia de ausência (FG/AT/F/FR)', 'var(--yellow)', c.entregaEmAusencia, function(it){
    return it.motorista+' — '+freqDataBR(it.data)+' ('+it.cod+') com '+it.entregas+' entrega(s)';
  });
  html+=bloco('🟡 Entregou sem marcação', 'var(--yellow)', c.entregaSemMarca, function(it){
    return it.motorista+' — '+freqDataBR(it.data)+' com '+it.entregas+' entrega(s)';
  });
  cont.innerHTML=html;
}

function freqExportCruzamentoPDF(){
  var ano=document.getElementById('freqAno').value;
  var mes=document.getElementById('freqMes').value;
  var nomesMes=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  var periodoTxt=nomesMes[Number(mes)-1]+'/'+ano;
  var _motSel=(document.getElementById('freqCruzMot')||{}).value||'';
  var c=_freqCruzFiltra(freqCalcCruzamento(ano,mes), _motSel);
  var total=c.trabSemEntrega.length+c.entregaEmAusencia.length+c.entregaSemMarca.length;

  var logoEl=document.querySelector('.sidebar-logo img');
  var logoSrc=logoEl?logoEl.src:'';

  var win=window.open('','_blank');
  var html='<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Cruzamento de Frequência</title>';
  html+='<style>';
  html+='*{margin:0;padding:0;box-sizing:border-box}';
  html+='body{font-family:Arial,sans-serif;padding:14px;color:#222;font-size:10px}';
  html+='.rep-head{display:flex;align-items:center;gap:14px;border-bottom:2px solid #0D692C;padding-bottom:10px;margin-bottom:12px}';
  html+='.rep-head img{width:54px;height:54px;border-radius:8px;object-fit:cover}';
  html+='.rep-head h1{font-size:18px;color:#085425;line-height:1.1}';
  html+='.rep-head .sub{font-size:11px;color:#444;margin-top:2px}';
  html+='.rep-head .gen{font-size:9px;color:#888;margin-top:3px}';
  html+='h2{font-size:12px;margin:12px 0 4px;padding:4px 8px;color:#fff;border-radius:4px}';
  html+='table{width:100%;border-collapse:collapse;margin-bottom:8px}';
  html+='th,td{border:1px solid #ccc;padding:4px 8px;font-size:9.5px;text-align:left}';
  html+='th{background:#0D692C;color:#fff;font-weight:600;text-transform:uppercase;font-size:8.5px}';
  html+='tbody tr:nth-child(even){background:#f4f8fb}';
  html+='.foot{margin-top:10px;font-size:9px;color:#666;text-align:center}';
  html+='.empty{padding:20px;text-align:center;color:#888}';
  html+='@page{size:landscape;margin:8mm}@media print{body{padding:0}}';
  html+='</style></head><body>';

  html+='<div class="rep-head">';
  if(logoSrc) html+='<img src="'+logoSrc+'" alt="Logo">';
  html+='<div><h1>BIOMASSA CHAPARINI</h1>';
  html+='<div class="sub">Cruzamento de Frequência × Entregas</div>';
  html+='<div class="sub"><b>Período:</b> '+periodoTxt+(_motSel?' &nbsp;·&nbsp; <b>Motorista:</b> '+_motSel:'')+'</div>';
  html+='<div class="gen">Gerado em '+new Date().toLocaleString('pt-BR')+'</div>';
  html+='</div></div>';

  if(total===0){
    html+='<p class="empty">✅ Nenhuma divergência encontrada no período.</p>';
  } else {
    if(c.trabSemEntrega.length){
      html+='<h2 style="background:#a32d2d">Trabalhou (T) e não entregou — '+c.trabSemEntrega.length+'</h2>';
      html+='<table><thead><tr><th>Motorista</th><th>Data</th><th>Dia</th></tr></thead><tbody>';
      c.trabSemEntrega.forEach(function(it){ html+='<tr><td>'+it.motorista+'</td><td>'+freqDataBR(it.data)+'</td><td>'+freqDiaSemanaTxt(it.data)+'</td></tr>'; });
      html+='</tbody></table>';
    }
    if(c.entregaEmAusencia.length){
      html+='<h2 style="background:#8a5a06">Entregou em dia de ausência — '+c.entregaEmAusencia.length+'</h2>';
      html+='<table><thead><tr><th>Motorista</th><th>Data</th><th>Código</th><th>Entregas</th></tr></thead><tbody>';
      c.entregaEmAusencia.forEach(function(it){ html+='<tr><td>'+it.motorista+'</td><td>'+freqDataBR(it.data)+'</td><td>'+it.cod+'</td><td>'+it.entregas+'</td></tr>'; });
      html+='</tbody></table>';
    }
    if(c.entregaSemMarca.length){
      html+='<h2 style="background:#8a5a06">Entregou sem marcação — '+c.entregaSemMarca.length+'</h2>';
      html+='<table><thead><tr><th>Motorista</th><th>Data</th><th>Entregas</th></tr></thead><tbody>';
      c.entregaSemMarca.forEach(function(it){ html+='<tr><td>'+it.motorista+'</td><td>'+freqDataBR(it.data)+'</td><td>'+it.entregas+'</td></tr>'; });
      html+='</tbody></table>';
    }
    html+='<div class="foot">Total: '+total+' divergência(s) · Período: '+periodoTxt+'</div>';
  }

  html+='<script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script>';
  html+='</body></html>';
  win.document.write(html);
  win.document.close();
}

// ---------- PDF da grade de frequência (mês × dia, padrão Biomassa) ----------
function freqExportGradePDF(){
  var ano=document.getElementById('freqAno').value;
  var mes=document.getElementById('freqMes').value;
  var nomesMes=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  var periodoTxt=nomesMes[Number(mes)-1]+'/'+ano;
  var dias=freqDiasNoMes(ano,mes);
  var diasSemana=['D','S','T','Q','Q','S','S'];

  if(!freqMotoristasMes.length){ showToast('Nada para exportar neste mês',true); return; }

  var logoEl=document.querySelector('.sidebar-logo img');
  var logoSrc=logoEl?logoEl.src:'';

  var win=window.open('','_blank');
  var html='<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Frequência '+periodoTxt+'</title>';
  html+='<style>';
  html+='*{margin:0;padding:0;box-sizing:border-box}';
  html+='body{font-family:Arial,sans-serif;padding:12px;color:#222;font-size:9px}';
  html+='.rep-head{display:flex;align-items:center;gap:14px;border-bottom:2px solid #0D692C;padding-bottom:8px;margin-bottom:8px}';
  html+='.rep-head img{width:48px;height:48px;border-radius:8px;object-fit:cover}';
  html+='.rep-head h1{font-size:16px;color:#085425;line-height:1.1}';
  html+='.rep-head .sub{font-size:10px;color:#444;margin-top:2px}';
  html+='.rep-head .gen{font-size:8px;color:#888;margin-top:2px}';
  html+='.leg{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px;font-size:8px}';
  html+='.leg span{display:inline-flex;align-items:center;gap:3px}';
  html+='.leg b{display:inline-block;min-width:18px;text-align:center;padding:1px 3px;border-radius:3px;color:#fff}';
  html+='table{width:100%;border-collapse:collapse}';
  html+='th,td{border:1px solid #bbb;padding:2px 1px;font-size:8px;text-align:center}';
  html+='th{background:#0D692C;color:#fff;font-weight:600}';
  html+='td.mot,th.mot{text-align:left;white-space:nowrap;padding:2px 6px;font-weight:bold;min-width:120px}';
  html+='th .dw{font-weight:400;font-size:6.5px;display:block}';
  html+='td.cell{font-weight:bold}';
  html+='.wknd{background:#eef1f4}';
  html+='.foot{margin-top:8px;font-size:8px;color:#666;text-align:center}';
  html+='@page{size:landscape;margin:6mm}@media print{body{padding:0}}';
  html+='</style></head><body>';

  html+='<div class="rep-head">';
  if(logoSrc) html+='<img src="'+logoSrc+'" alt="Logo">';
  html+='<div><h1>BIOMASSA CHAPARINI</h1>';
  html+='<div class="sub">Registro de Frequência de Motoristas</div>';
  html+='<div class="sub"><b>Período:</b> '+periodoTxt+'</div>';
  html+='<div class="gen">Gerado em '+new Date().toLocaleString('pt-BR')+'</div>';
  html+='</div></div>';

  // legenda
  html+='<div class="leg">';
  FREQ_CODIGOS.forEach(function(c){ html+='<span><b style="background:'+c.bg+'">'+c.cod+'</b>'+c.label+'</span>'; });
  html+='</div>';

  // tabela
  html+='<table><thead><tr><th class="mot">Motorista</th>';
  for(var d=1; d<=dias; d++){
    var dw=freqDiaSemana(ano,mes,d);
    var wk=(dw===0||dw===6)?' class="wknd"':'';
    html+='<th'+wk+'>'+d+'<span class="dw">'+diasSemana[dw]+'</span></th>';
  }
  html+='</tr></thead><tbody>';
  freqMotoristasMes.forEach(function(nome){
    html+='<tr><td class="mot">'+nome+'</td>';
    for(var d=1; d<=dias; d++){
      var ds=ano+'-'+mes+'-'+freqPad2(d);
      var k=nome.toUpperCase()+'||'+ds;
      var cod=freqEstado[k]||'';
      var info=freqCodigoInfo(cod);
      var dw=freqDiaSemana(ano,mes,d);
      var wk=(dw===0||dw===6)&&!info?' class="wknd"':'';
      if(info) html+='<td class="cell" style="background:'+info.bg+';color:'+info.fg+'">'+cod+'</td>';
      else html+='<td'+wk+'></td>';
    }
    html+='</tr>';
  });
  html+='</tbody></table>';
  html+='<div class="foot">'+freqMotoristasMes.length+' motorista(s) · '+dias+' dias · '+periodoTxt+'</div>';

  html+='<script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script>';
  html+='</body></html>';
  win.document.write(html);
  win.document.close();
}

