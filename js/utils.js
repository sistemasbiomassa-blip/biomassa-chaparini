// ==================== UTILITIES ====================
function n(v){ return v==null||v===''?null:v; }
function num(v){ if(v===null||v===undefined||v==='') return 0; if(typeof v==='number') return v; var s=String(v).trim(); if(s.indexOf(',')>=0){ return parseFloat(s.replace(/\./g,'').replace(',','.'))|| 0; } if(/\.\d{3}$/.test(s)){ return parseFloat(s.replace(/\./g,''))||0; } return parseFloat(s)||0; }
function fmt(v,d){ if(d===undefined)d=2; return v!=null?Number(v).toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d}):'-'; }
function fmtR(v){ return v!=null?'R$ '+fmt(v):'-'; }
function getUnit(client){ return BASE.clientesM3.includes(client)?'M³':'TON'; }

function parseTime(t){
  if(!t && t!==0) return null;
  // Date object (raro chegar aqui, mas defendendo)
  if(Object.prototype.toString.call(t)==='[object Date]'){
    if(isNaN(t)) return null;
    return t.getHours()*60+t.getMinutes();
  }
  var s=String(t).trim();
  if(!s) return null;
  // Dummy 1899-12-30 sem hora → vazio
  if(s==='1899-12-30' || (s.indexOf('1899-12-30')===0 && s.length<=10)) return null;
  // Formato ISO (1899-12-30T14:55:00.000Z)
  if(s.indexOf('T')>-1){
    var tPart=s.split('T')[1];
    if(!tPart) return null;
    var tp=tPart.split(':');
    if(tp.length<2) return null;
    var h=parseInt(tp[0],10), m=parseInt(tp[1],10);
    if(isNaN(h)||isNaN(m)) return null;
    return h*60+m;
  }
  // Formato "1899-12-30 HH:mm:ss"
  if(s.indexOf('1899-12-30 ')===0){
    var tp2=s.substring(11).split(':');
    if(tp2.length>=2){
      var h2=parseInt(tp2[0],10), m2=parseInt(tp2[1],10);
      if(isNaN(h2)||isNaN(m2)) return null;
      return h2*60+m2;
    }
  }
  // Formato HH:mm ou HH:mm:ss
  var parts=s.split(':');
  if(parts.length<2) return null;
  var h3=parseInt(parts[0],10), m3=parseInt(parts[1],10);
  if(isNaN(h3)||isNaN(m3)) return null;
  return h3*60+m3;
}

function normalizeTimeDisplay(t){
  if(!t && t!==0) return '-';
  // Date object
  if(Object.prototype.toString.call(t)==='[object Date]'){
    if(isNaN(t)) return '-';
    return String(t.getHours()).padStart(2,'0')+':'+String(t.getMinutes()).padStart(2,'0');
  }
  var s=String(t).trim();
  if(!s) return '-';
  // Dummy 1899-12-30 puro -> vazio
  if(s==='1899-12-30' || (s.indexOf('1899-12-30')===0 && s.length<=10)) return '-';
  // ISO completo
  if(s.indexOf('T')>-1){
    var tPart=s.split('T')[1];
    if(!tPart) return s;
    var tp=tPart.split(':');
    if(tp.length<2) return s;
    var h=parseInt(tp[0],10), m=parseInt(tp[1],10);
    if(isNaN(h)||isNaN(m)) return s;
    return String(h).padStart(2,'0')+':'+String(m).padStart(2,'0');
  }
  // "1899-12-30 14:55:00"
  if(s.indexOf('1899-12-30 ')===0){
    var tp2=s.substring(11).split(':');
    if(tp2.length>=2){
      var h2=parseInt(tp2[0],10), m2=parseInt(tp2[1],10);
      if(isNaN(h2)||isNaN(m2)) return '-';
      return String(h2).padStart(2,'0')+':'+String(m2).padStart(2,'0');
    }
  }
  // HH:mm puro ou HH:mm:ss
  if(/^\d{1,2}:\d{2}/.test(s)){
    var tp3=s.split(':');
    var h3=parseInt(tp3[0],10), m3=parseInt(tp3[1],10);
    if(isNaN(h3)||isNaN(m3)) return '-';
    return String(h3).padStart(2,'0')+':'+String(m3).padStart(2,'0');
  }
  return s;
}

function formatDateBR(d){
  if(!d) return '-';
  // Date object
  if(Object.prototype.toString.call(d)==='[object Date]'){
    if(isNaN(d)) return '-';
    var yy=d.getFullYear();
    if(yy===1899) return '-';
    return String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0')+'/'+yy;
  }
  var s=String(d).trim();
  if(!s) return '-';
  // Dummy 1899-12-30
  if(s.indexOf('1899-12-30')===0) return '-';
  // Já em formato BR DD/MM/AAAA
  if(/^\d{2}\/\d{2}\/\d{4}/.test(s)) return s.slice(0,10);
  // ISO YYYY-MM-DD
  s=s.slice(0,10);
  if(s.length<10) return s;
  var p=s.split('-');
  if(p.length===3) return p[2]+'/'+p[1]+'/'+p[0];
  return s;
}

function timeDiff(chegada,saida){
  var c=parseTime(chegada),s=parseTime(saida);
  if(c==null||s==null) return null;
  var diff=s-c;
  if(diff<0) diff+=24*60;
  return diff;
}

function minToHHMM(min){
  if(min==null) return '-';
  var h=Math.floor(min/60);
  var m=Math.round(min%60);
  return String(h).padStart(2,'0')+':'+String(m).padStart(2,'0');
}

function showToast(msg,isError){
  var t=document.getElementById('toast');
  t.textContent=msg;
  t.className='toast show'+(isError?' error':'');
  setTimeout(function(){t.className='toast'},3000);
}

function getMonthYear(ds){
  if(!ds) return null;
  // Date object
  if(Object.prototype.toString.call(ds)==='[object Date]'){
    if(isNaN(ds)) return null;
    return ds.getFullYear()+'-'+String(ds.getMonth()+1).padStart(2,'0');
  }
  var s=String(ds).trim();
  if(!s) return null;
  // YYYY-MM-DD (ou ISO)
  var m=s.match(/^(\d{4})-(\d{2})/);
  if(m) return m[1]+'-'+m[2];
  // DD/MM/AAAA
  m=s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if(m) return m[3]+'-'+m[2];
  return null;
}

function getMonthLabel(my){
  if(!my) return '';
  var months=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  var p=my.split('-');
  return months[parseInt(p[1])-1]+'/'+p[0].slice(2);
}

function destroyChart(id){
  if(chartInstances[id]){chartInstances[id].destroy();delete chartInstances[id];}
}

function getWeekLabel(dateStr){
  if(!dateStr) return null;
  var ds=String(dateStr).slice(0,10);
  var d=new Date(ds+'T12:00:00');
  if(isNaN(d.getTime())) return null;
  var onejan=new Date(d.getFullYear(),0,1);
  var week=Math.ceil(((d-onejan)/86400000+onejan.getDay()+1)/7);
  return d.getFullYear()+'-S'+String(week).padStart(2,'0');
}

function getWeekDisplay(weekLabel){
  if(!weekLabel) return '';
  var parts=weekLabel.split('-S');
  var year=parseInt(parts[0]);
  var week=parseInt(parts[1]);
  var jan1=new Date(year,0,1);
  var startDay=new Date(jan1.getTime()+((week-1)*7-jan1.getDay()+1)*86400000);
  var endDay=new Date(startDay.getTime()+6*86400000);
  return 'S'+String(week).padStart(2,'0')+' ('+startDay.getDate()+'/'+(startDay.getMonth()+1)+' a '+endDay.getDate()+'/'+(endDay.getMonth()+1)+')';
}

function cc(){
  var isDark=!document.body.classList.contains('light');
  return {text:isDark?'#8b95a8':'#57606a',grid:isDark?'rgba(255,255,255,0.04)':'rgba(0,0,0,0.06)'};
}

function makeGrad(ctx,c1,c2){var g=ctx.createLinearGradient(0,0,0,320);g.addColorStop(0,c1);g.addColorStop(1,c2);return g;}
function makeGradH(ctx,c1,c2){var g=ctx.createLinearGradient(0,0,400,0);g.addColorStop(0,c1);g.addColorStop(1,c2);return g;}
var modernColors=['#3b82f6','#00e5ff','#f97316','#22c55e','#a855f7','#ef4444','#facc15','#ec4899'];
function numBR(v,d){if(v==null)return'-';if(d===undefined)d=0;return Number(v).toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d});}

function trendBadge(current,previous){
  if(!previous||previous===0) return '<span class="kpi-badge neutral">—</span>';
  var pct=Math.round(((current-previous)/previous)*100);
  if(pct>0) return '<span class="kpi-badge up">▲ '+pct+'%</span>';
  if(pct<0) return '<span class="kpi-badge down">▼ '+Math.abs(pct)+'%</span>';
  return '<span class="kpi-badge neutral">= 0%</span>';
}

function calcMonthTrend(allData,field,filterFn,selectedMonth){
  var byMonth={};
  allData.forEach(function(r){
    var my=getMonthYear(r.DATA);if(!my)return;
    if(!byMonth[my]) byMonth[my]=0;
    if(filterFn) { if(filterFn(r)) byMonth[my]+=field?num(r[field]):1; }
    else byMonth[my]+=field?num(r[field]):1;
  });
  var months=Object.keys(byMonth).sort();
  if(months.length<1) return {current:0,previous:0};
  var curIdx;
  if(selectedMonth){
    curIdx=months.indexOf(selectedMonth);
    if(curIdx<0) return {current:0,previous:0};
  } else {
    curIdx=months.length-1;
  }
  var current=byMonth[months[curIdx]]||0;
  var previous=curIdx>0?(byMonth[months[curIdx-1]]||0):0;
  return {current:current,previous:previous};
}

function parseKM(v){
  if(typeof v==='number') return v;
  if(!v) return NaN;
  var s=String(v).trim();
  var dots=s.split('.').length-1;
  if(dots>1){
    var parts=s.split('.');
    var last=parts.pop();
    s=parts.join('')+'.'+last;
  }
  s=s.replace(',','.');
  return parseFloat(s);
}

// Km atual (mais alto já registrado) de uma placa, a partir de DB.cadastro.
function kmAtualPorPlaca(placa){
  if(!placa) return null;
  var alvo=String(placa).replace(/\s+/g,'');
  var km=null;
  DB.cadastro.forEach(function(r){
    if(!r.PLACA||!r.KM) return;
    if(String(r.PLACA).replace(/\s+/g,'')!==alvo) return;
    var v=parseKM(r.KM);
    if(isNaN(v)||v<=0) return;
    if(km===null||v>km) km=v;
  });
  return km;
}

function clearFilters(ids,rebuildFn){
  ids.forEach(function(id){var el=document.getElementById(id);if(el)el.value='';});
  if(rebuildFn) rebuildFn();
}

var finFilteredData=[];
function openDetailModal(title,subtitle,html){
  document.getElementById('detailTitle').innerHTML=title;
  document.getElementById('detailSubtitle').innerHTML=subtitle;
  document.getElementById('detailContent').innerHTML=html;
  document.getElementById('detailModal').classList.add('show');
}
function closeDetailModal(){document.getElementById('detailModal').classList.remove('show');}

function showDespesaDetail(categoria){
  var items=finFilteredData.filter(function(r){return r['CLASSE DESPESA']===categoria&&r['VALOR DESPESA']});
  var total=0;items.forEach(function(r){total+=num(r['VALOR DESPESA'])});
  var byMot={};items.forEach(function(r){
    var m=r.MOTORISTA||'Sem motorista';
    if(!byMot[m]) byMot[m]=0;
    byMot[m]+=num(r['VALOR DESPESA']);
  });
  var motEntries=Object.entries(byMot).sort(function(a,b){return b[1]-a[1]});

  var h='<div style="display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap">';
  h+='<div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:14px 18px;flex:1;min-width:140px"><div style="font-size:10px;color:var(--text2);text-transform:uppercase;margin-bottom:4px">Total</div><div style="font-family:Outfit,sans-serif;font-size:22px;font-weight:800;color:#ef4444">R$'+numBR(total,2)+'</div></div>';
  h+='<div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:14px 18px;flex:1;min-width:140px"><div style="font-size:10px;color:var(--text2);text-transform:uppercase;margin-bottom:4px">Lançamentos</div><div style="font-family:Outfit,sans-serif;font-size:22px;font-weight:800">'+items.length+'</div></div>';
  h+='<div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:14px 18px;flex:1;min-width:140px"><div style="font-size:10px;color:var(--text2);text-transform:uppercase;margin-bottom:4px">Motoristas</div><div style="font-family:Outfit,sans-serif;font-size:22px;font-weight:800">'+motEntries.length+'</div></div>';
  h+='</div>';

  // Summary by motorista
  if(motEntries.length>0){
    h+='<div style="margin-bottom:16px"><div style="font-family:Outfit,sans-serif;font-size:12px;font-weight:600;color:var(--text2);text-transform:uppercase;margin-bottom:8px">Por Motorista</div>';
    motEntries.forEach(function(me){
      var pct=total>0?Math.round((me[1]/total)*100):0;
      h+='<div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid var(--border)">';
      h+='<div style="flex:1;font-size:12px;font-weight:500">'+me[0]+'</div>';
      h+='<div style="width:120px"><div style="height:4px;background:var(--surface2);border-radius:2px;overflow:hidden"><div style="height:100%;width:'+pct+'%;background:linear-gradient(90deg,#ef4444,#f97316);border-radius:2px"></div></div></div>';
      h+='<div style="font-family:JetBrains Mono,monospace;font-size:11px;color:#ef4444;min-width:90px;text-align:right">R$'+numBR(me[1],2)+'</div>';
      h+='</div>';
    });
    h+='</div>';
  }

  // Detail table
  h+='<div style="font-family:Outfit,sans-serif;font-size:12px;font-weight:600;color:var(--text2);text-transform:uppercase;margin-bottom:8px">Lançamentos</div>';
  h+='<div style="overflow-x:auto;max-height:300px;overflow-y:auto"><table style="width:100%;border-collapse:collapse;font-size:11px"><thead><tr>';
  h+='<th style="padding:8px 10px;text-align:left;font-size:10px;color:var(--text2);border-bottom:1px solid var(--border);background:var(--surface2)">Data</th>';
  h+='<th style="padding:8px 10px;text-align:left;font-size:10px;color:var(--text2);border-bottom:1px solid var(--border);background:var(--surface2)">Motorista</th>';
  h+='<th style="padding:8px 10px;text-align:left;font-size:10px;color:var(--text2);border-bottom:1px solid var(--border);background:var(--surface2)">Placa</th>';
  h+='<th style="padding:8px 10px;text-align:left;font-size:10px;color:var(--text2);border-bottom:1px solid var(--border);background:var(--surface2)">Descrição</th>';
  h+='<th style="padding:8px 10px;text-align:left;font-size:10px;color:var(--text2);border-bottom:1px solid var(--border);background:var(--surface2)">Local</th>';
  h+='<th style="padding:8px 10px;text-align:right;font-size:10px;color:var(--text2);border-bottom:1px solid var(--border);background:var(--surface2)">Valor</th>';
  h+='</tr></thead><tbody>';
  items.sort(function(a,b){return(b.DATA||'').localeCompare(a.DATA||'')}).forEach(function(r){
    h+='<tr style="border-bottom:1px solid var(--border)">';
    h+='<td style="padding:6px 10px;font-family:JetBrains Mono,monospace;font-size:10px">'+formatDateBR(r.DATA)+'</td>';
    h+='<td style="padding:6px 10px;font-size:11px">'+(r.MOTORISTA||'-')+'</td>';
    h+='<td style="padding:6px 10px;font-family:JetBrains Mono,monospace;font-size:10px;color:var(--accent)">'+(r.PLACA||'-')+'</td>';
    h+='<td style="padding:6px 10px;font-size:11px">'+(r['DESCR. DESPESA']||'-')+'</td>';
    h+='<td style="padding:6px 10px;font-size:11px">'+(r['LOCAL DESPESA']||'-')+'</td>';
    h+='<td style="padding:6px 10px;font-family:JetBrains Mono,monospace;font-size:10px;color:#ef4444;text-align:right">R$'+numBR(num(r['VALOR DESPESA']),2)+'</td>';
    h+='</tr>';
  });
  h+='</tbody></table></div>';

  openDetailModal('💸 '+categoria,'Detalhamento de despesas nesta categoria',h);
}

function exportPagePDF(filterContainerId){
  var pageMap={filtersProd:'pageProducao',filtersFin:'pageFinanceiro',filtersTempo:'pageTempoEspera',filtersManut:'pageManutencao'};
  var pageId=pageMap[filterContainerId];
  var page=pageId?document.getElementById(pageId):document.querySelector('.page.active');
  if(!page){showToast('Nenhuma página ativa',true);return;}
  var title=page.querySelector('.page-title');
  var titleText=title?title.textContent:'Relatório';
  // Convert all canvas to images BEFORE cloning
  var canvases=page.querySelectorAll('canvas');
  var origData=[];
  canvases.forEach(function(cv){
    try{
      var dataUrl=cv.toDataURL('image/png');
      origData.push({canvas:cv,dataUrl:dataUrl,parent:cv.parentNode});
    }catch(e){origData.push(null);}
  });
  // Clone page
  var clone=page.cloneNode(true);
  // Replace canvas elements in clone with img
  var cloneCanvases=clone.querySelectorAll('canvas');
  cloneCanvases.forEach(function(cv,i){
    if(origData[i]&&origData[i].dataUrl){
      var img=document.createElement('img');
      img.src=origData[i].dataUrl;
      img.style.width='100%';
      img.style.height='100%';
      img.style.objectFit='contain';
      cv.parentNode.replaceChild(img,cv);
    }
  });
  // Remove filters from clone
  var filters=clone.querySelector('.filters,.manut-filter-bar');
  if(filters) filters.style.display='none';
  var isDark=!document.body.classList.contains('light');
  var bg='#ffffff';
  var txt='#111111';
  var surf='#f8f9fa';
  var brd='#cccccc';
  var logoData='data:image/jpeg;base64,/9j/4AAQSkZJRgABAgAAAQABAAD/wAARCAD8APwDACIAAREBAhEB/9sAQwAIBgYHBgUIBwcHCQkICgwUDQwLCwwZEhMPFB0aHx4dGhwcICQuJyAiLCMcHCg3KSwwMTQ0NB8nOT04MjwuMzQy/9sAQwEJCQkMCwwYDQ0YMiEcITIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIy/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMAAAERAhEAPwD3+iiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooASiiql5fW9hD5tw+yPOM7SefwpSkoq72BJt2RboNZI8SaSf+Xsf98t/hT117THO0Xkf61kq9N7SX3lulUX2X9xjQeIph4he3udsdtuMSr6HOASff8ArXVDpXAeJ7fyNbdh92RRJ/Q/qK6jQNT/ALR09WdszR/K/wBfX8RXn4TFSeInQqPVPQ7MRh4+xhVgtLamz2o7VSvdRtbBVe6l2bjtXqc/gKnt7mK5iWWF1kjboy16nPHm5b6nBZ2vbQnoooqgCiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAaeuapajp8Wo2jQSlgp53KeQRV6iolFSTi9mNNxd0cVdeDrhBm2uEk/wBmRdv6jNZg0bULW7i861k2+YvzL8w6juK2fE+syJOtlbSsjL8zsrd+w/r+VW/Dms3eo74riLd5a/65eB9CPX6V89UwuEeI9jBtP71c9mGIxSo+0kk1+I7xFo02ptatb7dysVZm/hB5z+n61DFBaeFbRpZJWluZF27emfoPT3P/ANaunPSuU17w9cXU7XlvK0rf8827D0Xt+Fd+Kw6pt4inG8/61scVCs5pUZytEwQbrXdUVXbdJJ+SL/gK9CtbZLS2S3iXbGi4FY3hrSTZWv2idNtxJ/Cf4F9P6/lXQilluHlGPt6vxSHjqsW/ZU/hQtFFFescIUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFACVm6xqSaZYNKf9YflRfU/55rSqvc20N1F5U8ayJ/dYVFRScGoOzHFx5k5bHAaXpdxrN07szeXu3Sze/Xj1NbmpawmhL9gsbXayr95/u89/c+9dJb20NrCsMEapGvRRWH4q00XNj9qjX97D8x917/l1/OvHWDqYahKrB3qd/8AI9F4qFarGElaHRCaVqU174dummbdPGsis34ZH88fhXK2uq3tpzBdSKv91m3D8jxWv4RlT7XPayfMs0e7a3fHH8jXTnRtMJ5sLf8A79is6ca+MoQnTnZq6ZpKVHDVpxnG6ZzNt4wuU/4+YI5f9pPlP9R/Kuts7lLu0juI/uyKGGarHQtMP/LlD/3zVyGCO2hWKJAsa/dUdq78JTxNNtVpXRxV50J/wo2ZPRRRXoHMFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFIRleaWigDl9N8Oy2WuNdCVVt1J2L3II6H0Az+ldPSd6M1z0MPCimodXc0q1ZVHeXoOoooroMwooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAOd8W+LrHwdpkV9fxXEiSzCFVt1BbOC3cgYwp71x3/C9fDv8A0DdX/wC/cX/xym/Hb/kVNN/7CA/9FSVzHw5tfAk3huV/Ez6Ut99qfb9smEb+XhccEjjOf1qraGEpS5rJnY2fxs8MXNwkM0Go2it/y1mhUoPrtZj+ldxfaxaWOhXGsM5ktIbdrjdFht6Absr2OR0r5/8AiVB4Kgnsv+EVlt3mbPnrayF4scbeckA5zwPx7V6Fp9hfab8Ary31FGin/s25by5M5RW3lQQeh2kcdulJoIzldpm54S+JGleMNTl0+xtr6CaOHzv9IRdrKCFOCrHnLDrW9rviHS/Dmn/bNUu1t4vuruyWc+iqOWP0rxH4IHHjq7/7Bsn/AKMirD8WarfeN/HzxQvu3XX2OyjZvlRd20H2yRuJ9/YU7aiVV8t+p6TP8dtFWXZDo+oyR/3m8tf03Gum8MfEnw/4om+y200lvenpb3KhXb6EEqfoDn2rK034NeFbawWK9hnvbjb80zTvHz7KjAAegOfqa8p+IHg5/A+u25s7iV7SfM1tIzfvYnUjIyMcglSGGOo9M0aA5zjqz6bzXCeH/iXY674xu/D6WksLxNKsM7SBlmKHBwO2QCRyeAelWNA8XtffC8eI7gfvoLWVpuOrx7gTj3K5x71846Rqdzo+r2WpwfNc20wm/wB/HUE+4yD9TSSHOpZKx9c3t3Dp9jcXtw+yCCNpZG9FUZJ/IVyXgb4g2/jaW+iispLOS2CNtkkDb1bcM8AYI28j3HNYHxa8WRf8INZ29hNv/tnbIrr/AM8BhifxJUfQmuF+Dmo/YfiBDbs2VvYJLf8AEAOP/QCPxotoE6nvpH0fXJ+OPG1t4KsLeea2a5muZPLjhWQLwBksSQeBwOnUiusr5v8AiNqNx4v+I39maf8AvVgkFlbKrcNJn5z6D5sgn0UGhF1Jcq0Pb/B/im28X6Emp28TQfvDHJCzBjGw7EjrkEH6EV0DMFG49K8C+DOuPpfim40K5+SO9Vtqt/DNHnj2JXcD/uivVviIl3J8P9ZSw3Gc254TqUyN4Hvt3UNBCd43Oc1f40eHdPunt7OK61Db96WEKsX4MxBb6gY96r2nx00CWTZeafqFqv8Az02o6r7nDZ/IGvM/h5c+E7bWJX8UxJLG0a/ZmmjLxBsnO5RnPGMEggc+1ezp4Y+Hfiq1ZbKx0a4XHzNYbUdfxjIYU2kRGc5apnW3eoWmnafLf3k6wWsS73kk4CivNr3456FDOy2mn391Gv8Ay1wqBvcAnd+YFSfGyK5XwRa/Z932aO8T7Rt/u7WC7vbcV/HFcX8NLzwLb2twniKK1/tJpPlkvo/Mi8vAwFyCqnOc5wT6+iSCc3zcq0PQNA+MGh67qVvpxtL62uZ5BHH5iqyMx6DKsSPxFeiVyFl4T8FajcWmq6XY6eZLaRZop7Bgq7hyM7Dtb6HNdJqV9b6Vpd3qF02yC2jaaRvZRn+lI0je2pwvi74sWPhXXm0r+z5bx441aZo5AuwnnaARycYPbqK761uYby0iu4HDwzRrJGw7qRkH8jXybcnUPEd3q+ttE0jLm6uWX/lmGYKB9BkD6D2r274Ma/8A2n4TbTJW/f6a3lr/ANcmyU/Llf8AgIptERqNysz0yiiikbBRRRQAUUUUAFFFFAHlXx2/5FTTf+wgP/RUlcr8PPhtpHi/w5NqF9d30UqXTw7LdkUYAU/xITn5vWvRPib4V1PxdollY6Z9nEsV35zNcOVULsdewJzlh2rz2D4XfEDR4imnatFEm7d5dpqEqbj642qM+9UtjmqR9+9rj/GfgRPh9YW+u6Drd5FOswh2ysu9s5PylVGfu8gg8fTne0rxdd+K/hB4kfUMfbbS2mhkkVdvmDy8hsDgHnBx6Z74rkLn4dfEfW7tE1NJZdv3ZrvUFdE+mGZh+C16Zp3gF9E+GmqaDaSifUL63l8yRvlVpWTaAPRRgD8z3oYRT5nZWR5z8EBnxzdf9g2T/wBGRVzMEj+EPiKst3E3/Et1BvMX+Ix7jyPXKncPqK9N+GPgDX/C3ii41DU47dYHs3hXy5tx3F0YcY6YU1vePvhtaeLf9OtZVs9WVdvmFfkmA6BwOcjsw59jxgvqJU3yeZ2tjf2mo2UV3ZXEc9tIu5JI2yGFeGfGnxDaanrFhptlKspslka4eNtwDttG3PqAOfqPSsl/hZ48sme3t7LfE33mt71FR/qCyk/iK6bwp8FLlbuK78SSweTG277FA27f7M2AAPYZz6ijYcpTmrWK9w02g/s9W8Uo2z6pcfKv+y8hf9UXP41heGfBn9u/DfX9Tji3XsFwGtvl+ZhGu51H+8HIx3Kr6V6V8UfCWueKINKtdGig+zWzPJIskgT5sBVwMdhu/Ouh8BeHpvDHg6y0y62faU3yTbORuZy2M98AgfhSuP2d5JPax8++GNPu/GPiLRdHmlaW2gXb/wBcoAS7AfXcQD7qOwq7qqp4Q+LUrxqsUNpqKTKq/KFiYq5A9trEV7f4W8AaT4S1O/1CweVnvOivt2wpknYmAPl5HXP3RXG/Ez4b6z4l8SpqekJbNHJbrHMskmxt6luenIKkD8KdyXTaj5nfeM9fTw14Tv8AU+PNWPbAPWVvlX9Tn6A188+BNd0vw74oXWNXiuZ/Ijfy/JVWbzW43Hcw/hLfia9R8deFvF/ibQtA0+CK2/0eFZL3dcAbp9gXjjkD5uf9r2q54S+FWk2Xh6JPEOmWt1qTM7SNuLAAnhQeOwH4k0KxU1KTsuh41rut2z+NbjXdBWWBWulvIVmUKwk4Zs4JGC2T16Gvpiy17T7zw9a621xFb2U8KSeZM4UJuxwxPAIJx9a4Hxx8KLS80y3/AOEX0+2tbyOb94u4qJIyCOpzyDg/nTNH+H2v3Xw8uvCmsXEdmq3AmtpIWEqlc7ijDg43/N17j0xQwgpRbNXXfhD4a1uZ7u183T55PmZrVh5bk99hBA/4DivJ/Gfgi++H95ZXcWp+asjHyLiHMUqOPxJHB6g+vTv0CeAviZ4bXydH1BpYOy2l9tX/AL4k2gH6VEnwz8d+J9QSbxBceQi/K0l3cCUov+wiEj8MqKETJJ7R1PSvB/iC38R+A9Nl157Zpb7faMs+3FyyllICnglgpJUe9Yur/BHQLyRpdOu7rT2b/lnxLGPoG+b8N1TeK/hWmr+GtK0rStQ+yrpkbrHFMu5Ji2Ms5HIJIJzg/ePFcePCnxY0dTb2V7c3Ef8AD5WoKyj6eYQR+VIuXaaucrq+n6z8M/FiJbagv2tY1mjmiyqyxkkYdfTKnIOexr0b4teLN/gvSrKH91Jq8aXEq/3IgFbB+rED6BqxdH+EfiLWtVN74quPKhZt0ytcebNL/s7gSFGOM5OB0FWfGnw68W+J/Fk97BHZxWS7ILbdN9yJeBwB6ktj3pma5lF2W5z/AIH8WeG9A8Navp+rWl9PNqWY5mt40YeVt2gZLA5yzHp3FUPhlr//AAj/AI3smkf/AEa8/wBFm+jY2t+DBfoC1e3wfDPwhFBGjaJbSsqhTIwOWxxk89a8/wDGnwgvp9c87wzb20VhJCu6IzbNkgyDjIPBGD165ougcJqz7HuFFZuhf2iNCsl1ZVXUFhVbja24FxwSD74z+NaVSdYUUUUAFFFFABRRRQAUUUUAFRu6RpuZgoHc1J2rzzxBaxeIfifZaFq373SY9MN5HaOSEnm8zb8w6NtXnB/xoE3Y7mG+s7lttvdQSsO0cgb+RqaSRI0Luyqq9WPauL8Q+BfCq6PPcJaWmhyW0Zkj1G0iET25H8WVxke2eak8Xv5/wn1V2ulud+ls32gLtEuU+/t7A9ce9Ars7INuHFM81PN8revmY3bd3OPXHpXFab4g8Tppdmkfgmd1WFNrf2jAuRgc4zxWfo15f33xieXUdKbTJx4fKrE0yS7l89TuyvHUkY9qBcx6SaihuIZlzFMkn+6wP8q4r4neJE0XQotPjvYrO81WT7PHPI21YYzgPKT2ABx9SK5LR9Z8K+EPGWmp4d1ezn0nUoks7uGKYM0cy8JMR/tZwx9yaAcrM9kd1jQu7BVXqx7VD/aFl/z9wf8Af1f8ayfHHPgDxF/2C7n/ANFNXAaPN8NBoVh9s0G1a5+yx+a39iSybm2jJ3CMhuc855oG5WZ64rq67lbK0yW4hhXMsyR/7zAfzriPhxbGBtcls7S5s9Bmu1fTbe4RkKjYPMKo3KqW5AwO9cpq+seFfGHi/VU8RaxZQaXp8L2NlBLMFZ5W/wBZOB7YAU9OAaA5tD2ioJbm3g/1s0cX+8wX+dcX8MfEq634ffT5buO6vdKk+yyTRtuEyDISUHPIZR19QazPHJ0NfiFobeILSK5sPsFz+7ktWn+fcmDsVWPrzigObS56LHd28z7I7iN29FYGpZJEiTe7Kq+prxnxG3ge6037F4W0jyvEc7D+zmtNOktpFlBB3ByqgADk89K634rq5+FGqrNtZ/Lh3ehPmJn9aBc253EsyRRlpHVV/vM2B+dKjrIgdGDK3Rh3rifiiiP8O5ldFZWuLXcrd/3yVQDXPwxvdr+ZP4Onk+VuWfTXY9D3MRJ/D6/eY3KzPRBKjSModdy9V3cj6ihZUZmUOpZfvLnp9a4rw9Ik3xP8VTROrRyWdgysvIYFXwQe4pvhIY+Jnjz/AK6WP/ok0gud5RRRQUFFFFABRRRQAUUUUAFFFFABRRRQAVh674X0vxEtub+KTzrZt1vcwytFLCx6lXUgjPp06VuUUAcefh5pdyyDUr7V9VhjYMtvf3zyRZHIynAb8c1v6rpVtrGj3WlXW77PcwmGTy22ttPHB7Vo5ozQKyILeBba2it4/uRKEXPoBiqX9h2n/CS/29+8+2/ZPsf3vk8vfv6eue9alFAWMb/hHrFvEja7J5st75H2ePzGykaZydq9ASep61JrWhafruk3GmX8CvbTrtbbwR3BB7EHnNatFAWM250iC80GbR7l5pLee1a2kZm+cqV2klv72D1qxY2kVhYW1lDu8qCNYkz1woAGffAq1RQMr3UAubSWAvJH5ild0bbWGeMg9jVLRtC0/QdJt9NsbdUtYF2ru5PqST3JJJJrVooAxh4esU8RjXkEkV6bf7PJsbCSJnI3L3IPQ9all0W0n1611h/M+120Lwx/N8u1yCcjuflFalFArGPrWgWeuC1Nz5qTWk63FvNC2143HofQ9CDwad4g0K08SaHPpN8ZBbT48zym2twQ3Bwe4rWooCxlazodpr2kHTbzzPI3I37ttrZRgw5+qir1xbw3dtLb3ESywyqVeN13BgeCCO4qeigZzXhvwZpHhSa6l0wTqblUVllmLqqruKquegG41e0/w/aabrOq6rAZPtOpNG1xub5fkXaMDtxWtRmgVkhaKKKBhRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAf/9k=';
  var printWin=window.open('','_blank');
  var html='<!DOCTYPE html><html><head><meta charset="UTF-8">';
  html+='<title>'+titleText+' - Biomassa Chaparini</title>';
  html+='<link href="https://fonts.googleapis.com/css2?family=Barlow:wght@300;400;500;600;700&family=Barlow+Condensed:wght@400;500;600;700&display=swap" rel="stylesheet">';
  html+='<style>';
  html+='*{margin:0;padding:0;box-sizing:border-box}';
  html+='body{font-family:"Barlow",sans-serif;background:#ffffff;color:#111111;padding:20px 30px}';
  html+='h1,h2,h3,h4{font-family:"Barlow Condensed",sans-serif;color:#111111}';
  html+='.page-header{margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid '+brd+'}';
  html+='.page-title{font-size:24px;color:#111111}';
  html+='.kpi-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:20px}';
  html+='.kpi-card{background:'+surf+';border:1px solid '+brd+';border-radius:8px;padding:14px;text-align:center}';
  html+='.kpi-value{font-family:"Barlow Condensed",sans-serif;font-size:28px;font-weight:700;color:#111111}';
  html+='.kpi-label{font-size:10px;text-transform:uppercase;color:#444444;margin-top:2px}';
  html+='.kpi-icon{font-size:16px;margin-bottom:6px}';
  html+='.kpi-card::before{display:none}';
  html+='.charts-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:20px}';
  html+='.chart-card{background:'+surf+';border:1px solid '+brd+';border-radius:8px;padding:14px;page-break-inside:avoid}';
  html+='.chart-card.full{grid-column:1/-1}';
  html+='.chart-title{font-family:"Barlow Condensed",sans-serif;font-size:13px;font-weight:600;margin-bottom:10px;text-transform:uppercase;color:#444444}';
  html+='.chart-container{position:relative;width:100%;height:280px}';
  html+='.chart-container img{width:100%;height:280px;object-fit:contain}';
  html+='.table-container{background:'+surf+';border:1px solid '+brd+';border-radius:8px;overflow:hidden;margin-bottom:16px;page-break-inside:avoid}';
  html+='.table-header{padding:10px 14px;border-bottom:1px solid '+brd+'}';
  html+='.table-header h3{color:#111111}';
  html+='.table-scroll{overflow-x:auto}';
  html+='table{width:100%;border-collapse:collapse;font-size:11px}';
  html+='th{background:#f0f0f0;padding:8px 10px;text-align:left;font-weight:600;border-bottom:2px solid '+brd+';color:#111111}';
  html+='td{padding:6px 10px;border-bottom:1px solid '+brd+';color:#111111}';
  html+='.btn-edit-row,.btn-delete-row{display:none!important}';
  html+='.filters,.manut-filter-bar{display:none!important}';
  html+='.manut-main-grid{display:grid;grid-template-columns:1fr 350px;gap:12px;margin-bottom:12px}';
  html+='.manut-bottom-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}';
  html+='.manut-panel{background:'+surf+';border:1px solid '+brd+';border-radius:8px;padding:14px;page-break-inside:avoid}';
  html+='.manut-ph{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid '+brd+'}';
  html+='.manut-ph-title{font-family:"Barlow Condensed",sans-serif;font-size:14px;font-weight:600;color:#111111}';
  html+='.manut-ph-badge{font-size:9px;color:#444444;background:#f0f0f0;border:1px solid '+brd+';border-radius:20px;padding:2px 8px}';
  html+='.manut-matrix{width:100%;border-collapse:collapse;font-size:11px}';
  html+='.manut-matrix th{font-size:9px;padding:4px;text-align:center;color:#111111}';
  html+='.manut-matrix th:first-child{text-align:left}';
  html+='.manut-matrix td{padding:5px 4px;border-bottom:1px solid '+brd+';text-align:center;font-size:10px;color:#111111}';
  html+='.manut-matrix td:first-child{text-align:left}';
  html+='.manut-chip{display:inline-block;padding:2px 6px;border-radius:10px;font-size:9px}';
  html+='.manut-chip.g{background:rgba(46,160,67,0.15);color:#1a7a2e}';
  html+='.manut-chip.y{background:rgba(210,153,34,0.15);color:#8a6400}';
  html+='.manut-chip.r{background:rgba(248,81,73,0.15);color:#c0392b}';
  html+='.manut-chip.x{background:rgba(139,148,158,0.12);color:#555555}';
  html+='.manut-placa-tag{font-family:"Barlow Condensed",sans-serif;font-size:11px;font-weight:600;color:#0066aa}';
  html+='.manut-alert{display:flex;align-items:center;gap:10px;background:rgba(248,81,73,0.08);border:1px solid rgba(248,81,73,0.25);border-radius:8px;padding:10px;margin-bottom:12px;font-size:11px}';
  html+='.manut-km-item,.manut-consumo-item,.manut-hist-item{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid '+brd+';font-size:11px}';
  html+='.manut-km-placa,.manut-consumo-placa{font-family:"Barlow Condensed",sans-serif;font-size:11px;font-weight:600;color:#0066aa}';
  html+='.manut-km-val,.manut-consumo-val{font-family:"Barlow Condensed",sans-serif;font-size:18px;font-weight:700;color:#111111}';
  html+='.manut-km-meta,.manut-consumo-meta,.manut-hist-meta{font-size:9px;color:#555555}';
  html+='.manut-km-body,.manut-consumo-body{flex:1}';
  html+='.manut-km-bar-wrap,.manut-consumo-bg{width:100px}';
  html+='.manut-km-bg{height:4px;background:#dddddd;border-radius:2px;overflow:hidden}';
  html+='.manut-km-fill{height:100%;border-radius:2px}';
  html+='.manut-km-fill.g{background:#2ea043}.manut-km-fill.y{background:#d29922}.manut-km-fill.r{background:#f85149}';
  html+='.manut-km-bar-lbl,.manut-km-rest{font-size:9px;color:#555555}';
  html+='.manut-hist-ico{width:24px;height:24px;border-radius:6px;background:#f0f0f0;border:1px solid '+brd+';display:flex;align-items:center;justify-content:center;font-size:12px}';
  html+='.manut-hist-tipo{font-size:11px;font-weight:500;color:#111111}';
  html+='.manut-hist-km{font-size:10px;color:#555555}';
  html+='.manut-hist-placa-tag{font-family:"Barlow Condensed",sans-serif;font-size:10px;color:#0066aa}';
  html+='.manut-consumo-top{display:flex;align-items:baseline;gap:4px;margin-bottom:4px}';
  html+='.manut-consumo-unit{font-size:12px;color:#555555}';
  html+='.manut-consumo-fill{height:4px;border-radius:2px}';
  html+='.manut-alert-ico{font-size:16px}.manut-alert-txt{font-size:12px;line-height:1.5;color:#111111}';
  html+='.manut-alert-txt strong{color:#c0392b}.manut-alert-txt em{color:#0066aa;font-style:normal}';
  html+='.status-badge{padding:2px 6px;border-radius:4px;font-size:10px}';
  html+='.chart-badge{font-size:10px;color:#555555;background:#eeeeee;border:1px solid #cccccc;border-radius:20px;padding:2px 8px;margin-left:6px}';
  html+='.pdf-header{position:fixed;top:0;left:0;right:0;height:62px;display:flex;align-items:center;justify-content:space-between;padding:0 20px;background:#ffffff;border-bottom:2px solid #cccccc;z-index:9999}';
  html+='.pdf-body{margin-top:78px}';
  html+='#tblTempo{page-break-before:always}';
  html+='@media print{';
  html+='  body{padding:10px}';
  html+='  @page{size:landscape;margin:22mm 10mm 10mm 10mm}';
  html+='  .pdf-header{position:fixed;top:0;left:0;right:0}';
  html+='  #tblTempo{page-break-before:always}';
  html+='}';
  html+='</style></head><body>';
  html+='<div class="pdf-header">';
  html+='<div style="display:flex;align-items:center;gap:12px">';
  html+='<img src="'+logoData+'" style="height:44px;width:auto;object-fit:contain" alt="Biomassa Chaparini">';
  html+='<div><div style="font-family:Barlow Condensed,sans-serif;font-size:17px;font-weight:700;color:#1a4a2e;letter-spacing:0.5px">BIOMASSA CHAPARINI</div>';
  html+='<div style="font-size:10px;color:#555555;margin-top:1px">Sistema de Gestão de Frota</div></div></div>';
  html+='<div style="text-align:right"><div style="font-family:Barlow Condensed,sans-serif;font-size:13px;font-weight:600;color:#111111">'+titleText+'</div>';
  html+='<div style="font-size:10px;color:#555555;margin-top:2px">Gerado em '+new Date().toLocaleDateString('pt-BR')+' às '+new Date().toLocaleTimeString('pt-BR')+'</div></div>';
  html+='</div>';
  html+='<div class="pdf-body">';
  html+=clone.innerHTML;
  html+='</div>';
  html+='<script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script>';
  html+='</body></html>';
  printWin.document.write(html);
  printWin.document.close();
}

