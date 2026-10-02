// ============================================================
// ===== MANUTENÇÃO > CUSTOS ==================================
// Junta numa tela só TODO o gasto de manutenção da frota, que até 2026-09-28 vivia
// partido em dois lugares: R$ 26 mil lançados na aba Manutenção e R$ 192 mil lançados
// como despesa de viagem, que só apareciam no Financeiro.
//
// As duas origens continuam gravadas onde sempre estiveram — nada é copiado. Aqui elas
// só são lidas juntas:
//   • despesa  → linha de cadastro com classe marcada em classes_despesa.manutencao
//   • lançamento → registro de manut_realizada (tem tipo, KM, nota, pneus)
// Por isso a coluna "Origem": o que veio da despesa não tem tipo de manutenção nem KM,
// e não gera alerta — é gasto, não é controle de periodicidade.
// ============================================================
var mcFiltro={dtIni:'',dtFim:'',placa:'',origem:'',classe:''};

function _mcLinhas(){
  var out=[];
  // 1) despesas de viagem marcadas como manutenção
  DB.cadastro.forEach(function(r){
    var v=despesaManutencao(r);
    if(v<=0) return;
    out.push({
      origem:'despesa', data:String(r.DATA||'').slice(0,10), placa:r.PLACA||'',
      categoria:r['CLASSE DESPESA']||'(sem classe)', descricao:r['DESCR. DESPESA']||'',
      local:r['LOCAL DESPESA']||'', valor:v, id:r.ID
    });
  });
  // 2) lançamentos da própria aba Manutenção
  DB.manutRealizada.forEach(function(r){
    var v=num(r.VALOR);
    if(v<=0) return;
    out.push({
      origem:'lancamento', data:String(r.DATA_MANUTENCAO||'').slice(0,10), placa:r.PLACA||'',
      categoria:r.TIPO_MANUTENCAO||'(sem tipo)', descricao:r['OBSERVAÇÃO']||'',
      local:r.LOCAL_SERVICO||'', valor:v, id:r.ID, km:r.KM_NA_MANUTENCAO
    });
  });
  return out.sort(function(a,b){ return String(b.data).localeCompare(String(a.data)); });
}

function _mcFiltrar(linhas){
  return linhas.filter(function(l){
    if(mcFiltro.placa && l.placa!==mcFiltro.placa) return false;
    if(mcFiltro.origem && l.origem!==mcFiltro.origem) return false;
    if(mcFiltro.classe && l.categoria!==mcFiltro.classe) return false;
    if((mcFiltro.dtIni||mcFiltro.dtFim) && !dateInRange(l.data,mcFiltro.dtIni,mcFiltro.dtFim)) return false;
    return true;
  });
}

function _mcSet(campo,valor){ mcFiltro[campo]=valor; buildManutCustos(); }
function resetMcFiltros(){ mcFiltro={dtIni:'',dtFim:'',placa:'',origem:'',classe:''}; buildManutCustos(); }

function buildManutCustos(){
  var wrap=document.getElementById('manutViewCustos');
  if(!wrap) return;
  var todas=_mcLinhas();
  var linhas=_mcFiltrar(todas);

  // ---------- barra de filtros ----------
  var placas={},cats={};
  todas.forEach(function(l){ if(l.placa) placas[l.placa]=1; cats[l.categoria]=1; });
  var fb=document.getElementById('filtersManutCusto');
  if(fb){
    var h='<span class="filter-label">Filtros</span>';
    h+='<div class="mc-date"><span>📅 De</span><input type="date" id="mcDtIni" value="'+mcFiltro.dtIni+'" onchange="_mcSet(\'dtIni\',this.value)">'+
       '<span>até</span><input type="date" id="mcDtFim" value="'+mcFiltro.dtFim+'" onchange="_mcSet(\'dtFim\',this.value)"></div>';
    h+='<select class="filter-select" onchange="_mcSet(\'placa\',this.value)"><option value="">🚛 Todas as placas</option>';
    Object.keys(placas).sort().forEach(function(p){ h+='<option'+(mcFiltro.placa===p?' selected':'')+'>'+p+'</option>'; });
    h+='</select>';
    h+='<select class="filter-select" onchange="_mcSet(\'classe\',this.value)"><option value="">🏷️ Todas as categorias</option>';
    Object.keys(cats).sort().forEach(function(c){ h+='<option'+(mcFiltro.classe===c?' selected':'')+'>'+_mcEsc(c)+'</option>'; });
    h+='</select>';
    h+='<select class="filter-select" onchange="_mcSet(\'origem\',this.value)"><option value="">Todas as origens</option>'+
       '<option value="despesa"'+(mcFiltro.origem==='despesa'?' selected':'')+'>Despesa de viagem</option>'+
       '<option value="lancamento"'+(mcFiltro.origem==='lancamento'?' selected':'')+'>Lançado na manutenção</option></select>';
    h+='<button class="manut-filter-reset" onclick="resetMcFiltros()">↺ Limpar filtros</button>';
    h+='<button class="filter-btn-pdf" onclick="exportSecaoPDF(\'mcTabelaBox\',\'Custos de Manutenção\',_mcResumoFiltros(),true,\'kpiManutCusto\')">📄 Exportar PDF</button>';
    fb.innerHTML=h;
  }

  // ---------- KPIs ----------
  var total=0,vDesp=0,vLanc=0,nDesp=0,nLanc=0,placasSet={};
  linhas.forEach(function(l){
    total+=l.valor;
    if(l.placa) placasSet[l.placa]=1;
    if(l.origem==='despesa'){ vDesp+=l.valor; nDesp++; } else { vLanc+=l.valor; nLanc++; }
  });
  var nPlacas=Object.keys(placasSet).length;
  document.getElementById('kpiManutCusto').innerHTML=
    '<div class="kpi-card red"><div class="kpi-icon">💰</div><div class="kpi-value">R$'+numBR(total,2)+'</div><div class="kpi-label">Custo total de manutenção</div></div>'+
    '<div class="kpi-card" title="Lançado como despesa na viagem — sem tipo de manutenção e sem KM, não gera alerta"><div class="kpi-icon">🧾</div><div class="kpi-value">R$'+numBR(vDesp,2)+'</div><div class="kpi-label">Despesa de viagem · '+nDesp+' lanç.</div></div>'+
    '<div class="kpi-card" title="Lançado direto na aba Manutenção, com tipo e KM"><div class="kpi-icon">🔧</div><div class="kpi-value">R$'+numBR(vLanc,2)+'</div><div class="kpi-label">Lançado na manutenção · '+nLanc+' lanç.</div></div>'+
    '<div class="kpi-card green"><div class="kpi-icon">🚛</div><div class="kpi-value">'+nPlacas+'</div><div class="kpi-label">Veículos com gasto</div></div>';

  // ---------- por categoria ----------
  var porCat={};
  linhas.forEach(function(l){ if(!porCat[l.categoria]) porCat[l.categoria]={v:0,n:0}; porCat[l.categoria].v+=l.valor; porCat[l.categoria].n++; });
  var cats2=Object.keys(porCat).sort(function(a,b){ return porCat[b].v-porCat[a].v; });
  var maxCat=cats2.length?porCat[cats2[0]].v:0;
  var ch='';
  cats2.forEach(function(c){
    var d=porCat[c], pct=maxCat>0?Math.round(d.v/maxCat*100):0;
    var pctTot=total>0?(d.v/total*100):0;
    ch+='<tr><td>'+_mcEsc(c)+'</td>'+
        '<td class="mc-num">'+d.n+'</td>'+
        '<td class="mc-num">R$'+numBR(d.v,2)+'</td>'+
        '<td class="mc-num">'+numBR(pctTot,1)+'%</td>'+
        '<td><div class="mc-bar-bg"><div class="mc-bar" style="width:'+pct+'%"></div></div></td></tr>';
  });
  document.getElementById('mcCategoriaBody').innerHTML=ch||'<tr><td colspan="5" class="mc-vazio">Nenhum gasto no período.</td></tr>';

  // ---------- por veículo ----------
  var porPla={};
  linhas.forEach(function(l){ var k=l.placa||'(sem placa)'; if(!porPla[k]) porPla[k]={v:0,n:0}; porPla[k].v+=l.valor; porPla[k].n++; });
  var plas=Object.keys(porPla).sort(function(a,b){ return porPla[b].v-porPla[a].v; });
  var maxPla=plas.length?porPla[plas[0]].v:0;
  var ph='';
  plas.forEach(function(p){
    var d=porPla[p], pct=maxPla>0?Math.round(d.v/maxPla*100):0;
    var cam=(typeof CAMINHOES_DATA!=='undefined')?CAMINHOES_DATA.filter(function(c){return c.PLACA===p})[0]:null;
    var tv=cam&&cam.TIPO_VEICULO?(String(cam.TIPO_VEICULO).indexOf('carreta')===0?'carreta':'cavalo'):'';
    ph+='<tr><td><span class="manut-placa-tag">'+_mcEsc(p)+'</span>'+(tv?' <span class="mc-tv">'+tv+'</span>':'')+'</td>'+
        '<td class="mc-num">'+d.n+'</td>'+
        '<td class="mc-num">R$'+numBR(d.v,2)+'</td>'+
        '<td><div class="mc-bar-bg"><div class="mc-bar" style="width:'+pct+'%"></div></div></td></tr>';
  });
  document.getElementById('mcVeiculoBody').innerHTML=ph||'<tr><td colspan="4" class="mc-vazio">Nenhum gasto no período.</td></tr>';

  // ---------- detalhe ----------
  var th='';
  linhas.forEach(function(l){
    var selo=l.origem==='despesa'
      ? '<span class="mc-org mc-org-d" title="Lançada como despesa na viagem. Não tem tipo de manutenção nem KM, então não entra na matriz e não gera alerta.">despesa</span>'
      : '<span class="mc-org mc-org-l" title="Lançada direto na aba Manutenção, com tipo e KM.">manutenção</span>';
    th+='<tr><td class="mc-num">'+formatDateBR(l.data)+'</td>'+
        '<td>'+(l.placa?'<span class="manut-placa-tag">'+_mcEsc(l.placa)+'</span>':'<span class="mc-vazio-cel">—</span>')+'</td>'+
        '<td>'+selo+'</td>'+
        '<td>'+_mcEsc(l.categoria)+'</td>'+
        '<td>'+(l.descricao?_mcEsc(l.descricao):'<span class="mc-vazio-cel">—</span>')+'</td>'+
        '<td>'+(l.local?_mcEsc(l.local):'<span class="mc-vazio-cel">—</span>')+'</td>'+
        '<td class="mc-num mc-val">R$'+numBR(l.valor,2)+'</td></tr>';
  });
  document.getElementById('mcDetalheBody').innerHTML=th||'<tr><td colspan="7" class="mc-vazio">Nenhum gasto no período.</td></tr>';

  // O quadro de peças e serviços é o detalhe DESTA mesma seleção: herda o filtro e é
  // redesenhado junto. Sem isso, duas tabelas vizinhas mostravam recortes diferentes.
  if(typeof nfRelSincronizar==='function'){ nfRelSincronizar(mcFiltro); buildNfRelatorio(); }
  document.getElementById('mcDetalheTotal').textContent=linhas.length+' lançamentos · R$'+numBR(total,2);
}

function _mcResumoFiltros(){
  var f=[];
  if(mcFiltro.dtIni||mcFiltro.dtFim) f.push('Período: '+(mcFiltro.dtIni?formatDateBR(mcFiltro.dtIni):'início')+' até '+(mcFiltro.dtFim?formatDateBR(mcFiltro.dtFim):'hoje'));
  if(mcFiltro.placa) f.push('Placa: '+mcFiltro.placa);
  if(mcFiltro.classe) f.push('Categoria: '+mcFiltro.classe);
  if(mcFiltro.origem) f.push('Origem: '+(mcFiltro.origem==='despesa'?'despesa de viagem':'lançado na manutenção'));
  return f.join(' · ')||'nenhum (todos os registros)';
}

function _mcEsc(v){ return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
