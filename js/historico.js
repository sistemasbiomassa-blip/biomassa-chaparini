// ==================== HISTORICO ====================
function buildHistorico(){
  var colors=cc();
  var uMot=[],uUsr=[],uMon=[],uPla=[];
  var motSet={},usrSet={},monSet={},plaSet={};
  DB.cadastro.forEach(function(r){
    if(r.MOTORISTA&&!motSet[r.MOTORISTA]){motSet[r.MOTORISTA]=1;uMot.push(r.MOTORISTA)}
    if(r.USUARIO&&!usrSet[r.USUARIO]){usrSet[r.USUARIO]=1;uUsr.push(r.USUARIO)}
    if(r.DATA){var my=getMonthYear(r.DATA);if(my&&!monSet[my]){monSet[my]=1;uMon.push(my)}}
    if(r.PLACA){
      var p=String(r.PLACA).replace(/\s+/g,'');
      if(p&&!plaSet[p]){plaSet[p]=1;uPla.push(p)}
    }
  });
  uMot.sort();uUsr.sort();uMon.sort();uPla.sort();
  createFilters('filtersHistorico',[
    {id:'fhUser',label:'Lançado por',options:uUsr,onChange:buildHistorico},
    {id:'fhMot',label:'Motorista',options:uMot,onChange:buildHistorico},
    {id:'fhPla',label:'Placa',options:uPla,onChange:buildHistorico},
    {id:'fhMes',label:'Mês',options:uMon,optionLabels:uMon.map(getMonthLabel),onChange:buildHistorico},
    {type:'dateRange',idIni:'fhDtIni',idFim:'fhDtFim',onChange:buildHistorico}
  ],null,function(){clearFilters(['fhUser','fhMot','fhPla','fhMes','fhDtIni','fhDtFim'],buildHistorico);});
  var fU=document.getElementById('fhUser')?document.getElementById('fhUser').value:'';
  var fM=document.getElementById('fhMot')?document.getElementById('fhMot').value:'';
  var fPla=document.getElementById('fhPla')?document.getElementById('fhPla').value:'';
  var fMes=document.getElementById('fhMes')?document.getElementById('fhMes').value:'';
  var fDtIni=document.getElementById('fhDtIni')?document.getElementById('fhDtIni').value:'';
  var fDtFim=document.getElementById('fhDtFim')?document.getElementById('fhDtFim').value:'';
  var hasRangeH=!!(fDtIni||fDtFim);
  var rows=DB.cadastro.filter(function(r){
    if(fU&&r.USUARIO!==fU) return false;
    if(fM&&r.MOTORISTA!==fM) return false;
    if(fPla){
      var p=r.PLACA?String(r.PLACA).replace(/\s+/g,''):'';
      if(p!==fPla) return false;
    }
    if(hasRangeH){
      if(!dateInRange(r.DATA,fDtIni,fDtFim)) return false;
    } else if(fMes&&getMonthYear(r.DATA)!==fMes){
      return false;
    }
    return true;
  }).sort(function(a,b){return(b.DATA_REGISTRO||b.DATA||'').localeCompare(a.DATA_REGISTRO||a.DATA||'')});
  var isAdmin=currentUserData&&currentUserData.perfil==='ADMIN';
  var mono='font-family:JetBrains Mono,monospace;font-size:11px';
  var h='<div class="table-header"><h3>Lançamentos</h3><span class="chart-badge">'+rows.length+' registros</span></div><div class="table-scroll" style="max-height:65vh;overflow:auto"><table style="font-size:11px;min-width:2400px"><thead style="position:sticky;top:0;z-index:5"><tr>';
  h+='<th>Lançado por</th><th>Data Registro</th><th>Data Oper.</th><th>Motorista</th><th>Situação</th><th>Entrega</th><th>Placa</th><th>Local Carga</th><th>Local Descarga</th><th>Nota</th><th>Qtde</th><th>Cheg.Flor.</th><th>Saida Flor.</th><th>Cheg.Cli.</th><th>Saida Cli.</th><th>Posto</th><th>KM</th><th>Litros</th><th>Vlr Unit.</th><th>Vlr Total</th><th>ARLA</th><th>Classe Desp.</th><th>Descr. Desp.</th><th>Local Desp.</th><th>Vlr Desp.</th><th>Observação</th>';
  if(isAdmin) h+='<th style="position:sticky;right:0;background:var(--bg);box-shadow:-4px 0 6px -2px rgba(0,0,0,0.15)">Ações</th>';
  h+='</tr></thead><tbody>';
  rows.forEach(function(r){
    var usr=r.USUARIO||'-';
    var usrPerf='analista';
    USUARIOS.forEach(function(u){if(u.NOME===usr||u.USUARIO===usr){usrPerf=(u.PERFIL||'ANALISTA').toLowerCase();}});
    h+='<tr>';
    h+='<td><span class="historico-badge '+usrPerf+'">'+usr+'</span></td>';
    h+='<td style="'+mono+'">'+formatDateBR(r.DATA_REGISTRO)+'</td>';
    h+='<td style="'+mono+'">'+formatDateBR(r.DATA)+'</td>';
    h+='<td>'+(r.MOTORISTA||'-')+'</td>';
    h+='<td>'+(r['SITUAÇÃO']||'-')+'</td>';
    h+='<td style="'+mono+'">'+(r.ENTREGA||'-')+'</td>';
    h+='<td style="'+mono+';color:var(--accent)">'+(r.PLACA||'-')+'</td>';
    h+='<td>'+(r['LOCAL CARGA']||'-')+'</td>';
    h+='<td>'+(r['LOCAL DESCARGA']||'-')+'</td>';
    h+='<td style="'+mono+'">'+(r.NOTA||'-')+'</td>';
    h+='<td style="'+mono+'">'+(r.QUANTIDADE?fmt(r.QUANTIDADE):'-')+'</td>';
    h+='<td style="'+mono+'">'+normalizeTimeDisplay(r['CHEGADA FLORESTA'])+'</td>';
    h+='<td style="'+mono+'">'+normalizeTimeDisplay(r['SAIDA FLORESTA'])+'</td>';
    h+='<td style="'+mono+'">'+normalizeTimeDisplay(r['CHEGADA CLIENTE'])+'</td>';
    h+='<td style="'+mono+'">'+normalizeTimeDisplay(r['SAIDA CLIENTE'])+'</td>';
    h+='<td>'+(r['LOCAL ABASTECIMENTO']||'-')+'</td>';
    h+='<td style="'+mono+'">'+(r.KM?fmt(r.KM,0):'-')+'</td>';
    h+='<td style="'+mono+'">'+(r['QTDADE LITROS']?fmt(r['QTDADE LITROS'],1):'-')+'</td>';
    h+='<td style="'+mono+'">'+(r['VALOR UNITARIO']?'R$'+fmt(r['VALOR UNITARIO']):'-')+'</td>';
    h+='<td style="'+mono+';color:#22c55e">'+(r['VALOR TOTAL']?'R$'+fmt(r['VALOR TOTAL']):'-')+'</td>';
    h+='<td style="'+mono+'">'+(r['ARLA VALOR']?'R$'+fmt(r['ARLA VALOR']):'-')+'</td>';
    h+='<td>'+(r['CLASSE DESPESA']||'-')+'</td>';
    h+='<td>'+(r['DESCR. DESPESA']||'-')+'</td>';
    h+='<td>'+(r['LOCAL DESPESA']||'-')+'</td>';
    h+='<td style="'+mono+';color:#ef4444">'+(r['VALOR DESPESA']?'R$'+fmt(r['VALOR DESPESA']):'-')+'</td>';
    h+='<td style="font-size:11px;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+((r['OBSERVAÇÃO']||'')+'').replace(/"/g,'&quot;')+'">'+(r['OBSERVAÇÃO']||'-')+'</td>';
    if(isAdmin){
      h+='<td style="position:sticky;right:0;background:var(--surface);box-shadow:-4px 0 6px -2px rgba(0,0,0,0.15);text-align:center"><button class="btn-delete-row" onclick="openDeleteModal(\''+rowKeyAttr(r)+'\')" title="Excluir">🗑️</button></td>';
    }
    h+='</tr>';
  });
  h+='</tbody></table></div>';
  document.getElementById('tblHistorico').innerHTML=h;
}

