// ==================== RELATORIO ====================
var relatorioFiltro = {dtIni:'', dtFim:'', motorista:'', localCarga:'', localDescarga:''};
var relMotModo='Ativos'; // filtro Ativos/Inativos/Todos do dropdown de motorista

function buildRelatorio(){
  // Coletar opções de filtro a partir do cadastro
  var motSet={}, cargaSet={}, descSet={};
  var uMot=[], uCarga=[], uDesc=[];
  DB.cadastro.forEach(function(r){
    if(r.MOTORISTA && !motSet[r.MOTORISTA]){motSet[r.MOTORISTA]=1; uMot.push(r.MOTORISTA);}
    if(r['LOCAL CARGA'] && !cargaSet[r['LOCAL CARGA']]){cargaSet[r['LOCAL CARGA']]=1; uCarga.push(r['LOCAL CARGA']);}
    if(r['LOCAL DESCARGA'] && !descSet[r['LOCAL DESCARGA']]){descSet[r['LOCAL DESCARGA']]=1; uDesc.push(r['LOCAL DESCARGA']);}
  });
  var ptSort=function(a,b){return String(a).localeCompare(String(b),'pt-BR',{sensitivity:'base'})};
  uMot.sort(ptSort); uCarga.sort(ptSort); uDesc.sort(ptSort);
  uMot=motoristasFiltrados(uMot, relMotModo); // filtro Ativos/Inativos/Todos

  function optsHtml(arr, sel){
    var hh='';
    arr.forEach(function(o){
      var v=String(o).replace(/"/g,'&quot;');
      hh+='<option value="'+v+'"'+(String(o)===String(sel)?' selected':'')+'>'+o+'</option>';
    });
    return hh;
  }

  var f=relatorioFiltro;
  var html='';
  // Intervalo de datas (mesmo visual usado nas outras abas)
  html+='<div style="display:inline-flex;align-items:center;gap:4px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:2px 6px;font-size:11px">';
  html+='<span style="color:var(--text2);font-size:11px">📅 De </span>';
  html+='<input type="date" id="frDtIni" class="filter-date" style="border:none;background:transparent;font-size:11px;color:var(--text);font-family:inherit" value="'+(f.dtIni||'')+'" onchange="onRelatorioFilterChange()">';
  html+='<span style="color:var(--text2);font-size:11px"> até </span>';
  html+='<input type="date" id="frDtFim" class="filter-date" style="border:none;background:transparent;font-size:11px;color:var(--text);font-family:inherit" value="'+(f.dtFim||'')+'" onchange="onRelatorioFilterChange()">';
  html+='</div>';
  html+=motoristaModoSelectHtml('relMotModo', relMotModo, 'buildRelatorio');
  html+='<select class="filter-select" id="frMot" onchange="onRelatorioFilterChange()"><option value="">Todos - Motorista</option>'+optsHtml(uMot,f.motorista)+'</select>';
  html+='<select class="filter-select" id="frCarga" onchange="onRelatorioFilterChange()"><option value="">Todos - Local Carga</option>'+optsHtml(uCarga,f.localCarga)+'</select>';
  html+='<select class="filter-select" id="frDesc" onchange="onRelatorioFilterChange()"><option value="">Todos - Local Descarga</option>'+optsHtml(uDesc,f.localDescarga)+'</select>';
  html+='<button class="filter-btn-clear" onclick="clearRelatorioFilters()">↺ Limpar filtros</button>';
  document.getElementById('filtersRelatorio').innerHTML=html;

  renderRelatorioTable();
}

function clearRelatorioFilters(){
  relatorioFiltro={dtIni:'', dtFim:'', motorista:'', localCarga:'', localDescarga:''};
  buildRelatorio();
}

function onRelatorioFilterChange(){
  relatorioFiltro.dtIni=document.getElementById('frDtIni')?document.getElementById('frDtIni').value:'';
  relatorioFiltro.dtFim=document.getElementById('frDtFim')?document.getElementById('frDtFim').value:'';
  relatorioFiltro.motorista=document.getElementById('frMot')?document.getElementById('frMot').value:'';
  relatorioFiltro.localCarga=document.getElementById('frCarga')?document.getElementById('frCarga').value:'';
  relatorioFiltro.localDescarga=document.getElementById('frDesc')?document.getElementById('frDesc').value:'';
  renderRelatorioTable();
}

// Agrega os dados do relatório aplicando os filtros.
// Entrega = linha com LOCAL DESCARGA preenchido + QUANTIDADE > 0.
// Colunas de descarga são dinâmicas (só locais que tiveram entrega no período).
function calcRelatorioData(){
  var f=relatorioFiltro;
  var hasRange=!!(f.dtIni||f.dtFim);

  var rows=DB.cadastro.filter(function(r){
    if(hasRange){ if(!dateInRange(r.DATA,f.dtIni,f.dtFim)) return false; }
    if(f.motorista && r.MOTORISTA!==f.motorista) return false;
    if(f.localCarga && r['LOCAL CARGA']!==f.localCarga) return false;
    if(f.localDescarga && r['LOCAL DESCARGA']!==f.localDescarga) return false;
    return true;
  });

  var motData={};   // motorista -> {totalEnt, totalTON, totalM3, porLocal:{local:{ent,vol,unit}}}
  var locaisSet={}; // locais de descarga que apareceram (viram colunas)
  rows.forEach(function(r){
    var local=r['LOCAL DESCARGA'];
    if(!local) return;
    var q=num(r.QUANTIDADE);
    if(isNaN(q) || q<=0) return;
    var mot=r.MOTORISTA||'(sem motorista)';
    var unit=getUnit(local); // 'TON' ou 'M³'
    if(!motData[mot]) motData[mot]={totalEnt:0, totalTON:0, totalM3:0, porLocal:{}};
    var md=motData[mot];
    md.totalEnt++;
    if(unit==='M³') md.totalM3+=q; else md.totalTON+=q;
    if(!md.porLocal[local]) md.porLocal[local]={ent:0, vol:0, unit:unit};
    md.porLocal[local].ent++;
    md.porLocal[local].vol+=q;
    locaisSet[local]=1;
  });

  // km/L por motorista — método individual + tanque-a-tanque (mesma lógica da aba Consumo), no mesmo período
  var rankCons=calcRankingConsumoMotoristaT2T('', f.dtIni, f.dtFim);
  var kmlMap={};
  rankCons.forEach(function(x){ kmlMap[x.motorista]=x.kmL; });

  var ptSort=function(a,b){return String(a).localeCompare(String(b),'pt-BR',{sensitivity:'base'})};
  var motoristas=Object.keys(motData).sort(ptSort);
  var locais=Object.keys(locaisSet).sort(ptSort);

  return {motoristas:motoristas, locais:locais, motData:motData, kmlMap:kmlMap};
}

function renderRelatorioTable(){
  var d=calcRelatorioData();
  var cnt=document.getElementById('relCount');
  if(cnt) cnt.textContent=d.motoristas.length+(d.motoristas.length===1?' motorista':' motoristas');

  if(!d.motoristas.length){
    document.getElementById('relTableContainer').innerHTML='<div style="padding:30px;text-align:center;color:var(--text2);font-size:13px">Nenhuma entrega encontrada para os filtros aplicados.<br><span style="font-size:11px">Verifique se há registros com Local de Descarga e Quantidade no período.</span></div>';
    return;
  }

  var mono='font-family:JetBrains Mono,monospace';
  var minW=420+d.locais.length*150;
  var h='<table style="width:100%;border-collapse:collapse;font-size:12px;min-width:'+minW+'px">';
  h+='<thead style="background:var(--surface2);position:sticky;top:0;z-index:2"><tr>';
  h+='<th style="text-align:left;padding:10px 14px;font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:var(--text2);position:sticky;left:0;background:var(--surface2);z-index:3">Motorista</th>';
  h+='<th style="text-align:center;padding:10px 14px;font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:var(--text2)">Total Entregas</th>';
  d.locais.forEach(function(loc){
    h+='<th style="text-align:center;padding:10px 14px;font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:var(--text2)">'+loc+'</th>';
  });
  h+='<th style="text-align:center;padding:10px 14px;font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:var(--text2)">Média km/L</th>';
  h+='</tr></thead><tbody>';

  d.motoristas.forEach(function(mot){
    var md=d.motData[mot];
    h+='<tr style="border-top:1px solid var(--border)">';
    h+='<td style="padding:10px 14px;font-weight:600;position:sticky;left:0;background:var(--surface);z-index:1">'+mot+'</td>';
    var totVol=[];
    if(md.totalTON>0) totVol.push(numBR(md.totalTON,1)+' TON');
    if(md.totalM3>0) totVol.push(numBR(md.totalM3,1)+' M³');
    h+='<td style="padding:10px 14px;text-align:center"><div style="'+mono+';font-weight:600">'+md.totalEnt+'</div><div style="font-size:10px;color:var(--text2)">'+(totVol.join(' · ')||'-')+'</div></td>';
    d.locais.forEach(function(loc){
      var cell=md.porLocal[loc];
      if(cell){
        h+='<td style="padding:10px 14px;text-align:center"><div style="'+mono+'">'+cell.ent+'</div><div style="font-size:10px;color:var(--text2)">'+numBR(cell.vol,1)+' '+cell.unit+'</div></td>';
      } else {
        h+='<td style="padding:10px 14px;text-align:center;color:var(--text2)">—</td>';
      }
    });
    var kml=d.kmlMap[mot];
    var kmlTxt=(kml!=null)?(numBR(kml,2)+' <span style="font-size:10px;color:var(--text2)">km/L</span>'):'<span style="color:var(--text2)">—</span>';
    h+='<td style="padding:10px 14px;text-align:center;'+mono+'">'+kmlTxt+'</td>';
    h+='</tr>';
  });
  h+='</tbody></table>';
  document.getElementById('relTableContainer').innerHTML=h;
}

function exportRelatorioPDF(){
  var f=relatorioFiltro;
  var d=calcRelatorioData();

  var periodoTxt;
  if(f.dtIni || f.dtFim){
    var de=f.dtIni?formatDateBR(f.dtIni):'(início)';
    var ate=f.dtFim?formatDateBR(f.dtFim):'(hoje)';
    periodoTxt=de+' até '+ate;
  } else {
    periodoTxt='Todos os períodos';
  }

  var filtrosExtra=[];
  if(f.motorista) filtrosExtra.push('Motorista: '+f.motorista);
  if(f.localCarga) filtrosExtra.push('Local Carga: '+f.localCarga);
  if(f.localDescarga) filtrosExtra.push('Local Descarga: '+f.localDescarga);

  // Reaproveita a logo já embutida no sistema (sem duplicar o base64)
  var logoEl=document.querySelector('.sidebar-logo img');
  var logoSrc=logoEl?logoEl.src:'';

  var win=window.open('','_blank');
  var html='<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Relatório Geral por Motorista</title>';
  html+='<style>';
  html+='*{margin:0;padding:0;box-sizing:border-box}';
  html+='body{font-family:Arial,sans-serif;padding:14px;color:#222;font-size:10px}';
  html+='.rep-head{display:flex;align-items:center;gap:14px;border-bottom:2px solid #0D692C;padding-bottom:10px;margin-bottom:10px}';
  html+='.rep-head img{width:54px;height:54px;border-radius:8px;object-fit:cover}';
  html+='.rep-head h1{font-size:18px;color:#085425;line-height:1.1}';
  html+='.rep-head .sub{font-size:11px;color:#444;margin-top:2px}';
  html+='.rep-head .gen{font-size:9px;color:#888;margin-top:3px}';
  html+='table{width:100%;border-collapse:collapse;margin-top:6px}';
  html+='th,td{border:1px solid #ccc;padding:4px 6px;font-size:9px;text-align:center;vertical-align:middle}';
  html+='th{background:#0D692C;color:#fff;font-weight:600;font-size:8.5px;text-transform:uppercase}';
  html+='td.mot{text-align:left;font-weight:bold;white-space:nowrap}';
  html+='td .vol{display:block;color:#666;font-size:8px}';
  html+='tbody tr:nth-child(even){background:#f4f8fb}';
  html+='.foot{margin-top:10px;font-size:9px;color:#666;text-align:center}';
  html+='@page{size:landscape;margin:8mm}';
  html+='@media print{body{padding:0}}';
  html+='</style></head><body>';

  html+='<div class="rep-head">';
  if(logoSrc) html+='<img src="'+logoSrc+'" alt="Logo">';
  html+='<div>';
  html+='<h1>BIOMASSA CHAPARINI</h1>';
  html+='<div class="sub">Sistema de Gestão de Frota — Relatório Geral por Motorista</div>';
  html+='<div class="sub"><b>Período:</b> '+periodoTxt+(filtrosExtra.length?' &nbsp;|&nbsp; '+filtrosExtra.join(' · '):'')+'</div>';
  html+='<div class="gen">Gerado em '+new Date().toLocaleString('pt-BR')+'</div>';
  html+='</div></div>';

  if(!d.motoristas.length){
    html+='<p style="padding:20px;text-align:center;color:#888">Nenhuma entrega encontrada para os filtros aplicados.</p>';
  } else {
    html+='<table><thead><tr>';
    html+='<th style="text-align:left">Motorista</th>';
    html+='<th>Total<br>Entregas</th>';
    d.locais.forEach(function(loc){ html+='<th>'+loc+'</th>'; });
    html+='<th>Média<br>km/L</th>';
    html+='</tr></thead><tbody>';
    d.motoristas.forEach(function(mot){
      var md=d.motData[mot];
      html+='<tr>';
      html+='<td class="mot">'+mot+'</td>';
      var totVol=[];
      if(md.totalTON>0) totVol.push(numBR(md.totalTON,1)+' TON');
      if(md.totalM3>0) totVol.push(numBR(md.totalM3,1)+' M³');
      html+='<td><b>'+md.totalEnt+'</b><span class="vol">'+(totVol.join(' · ')||'-')+'</span></td>';
      d.locais.forEach(function(loc){
        var cell=md.porLocal[loc];
        if(cell){ html+='<td>'+cell.ent+'<span class="vol">'+numBR(cell.vol,1)+' '+cell.unit+'</span></td>'; }
        else { html+='<td>—</td>'; }
      });
      var kml=d.kmlMap[mot];
      html+='<td>'+(kml!=null?numBR(kml,2)+' km/L':'—')+'</td>';
      html+='</tr>';
    });
    html+='</tbody></table>';
    html+='<div class="foot">'+d.motoristas.length+' motorista(s) · '+d.locais.length+' local(is) de descarga · Período: '+periodoTxt+'</div>';
  }

  html+='<script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script>';
  html+='</body></html>';
  win.document.write(html);
  win.document.close();
}

