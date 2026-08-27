// ==================== FILTER HELPER ====================
function getWeeksForMonth(monthVal, allWeeks){
  if(!monthVal) return allWeeks;
  var parts=monthVal.split('-');
  var year=parseInt(parts[0]), month=parseInt(parts[1]);
  return allWeeks.filter(function(w){
    var wp=w.split('-S');
    var wy=parseInt(wp[0]), wn=parseInt(wp[1]);
    if(wy!==year) return false;
    var jan1=new Date(year,0,1);
    var startDay=new Date(jan1.getTime()+((wn-1)*7-jan1.getDay()+1)*86400000);
    var endDay=new Date(startDay.getTime()+6*86400000);
    return (startDay.getMonth()+1===month || endDay.getMonth()+1===month);
  });
}

function createFilters(containerId,filterDefs,extraHtml,clearFn,noPdfBtn){
  var container=document.getElementById(containerId);
  var saved={};
  filterDefs.forEach(function(f){
    var el=document.getElementById(f.id);
    if(el) saved[f.id]=el.value;
    if(f.dayId){var el2=document.getElementById(f.dayId);if(el2) saved[f.dayId]=el2.value;}
    if(f.type==='dateRange'){
      var elIni=document.getElementById(f.idIni);if(elIni) saved[f.idIni]=elIni.value;
      var elFim=document.getElementById(f.idFim);if(elFim) saved[f.idFim]=elFim.value;
    }
  });
  container.innerHTML='';
  filterDefs.forEach(function(f){
    // NOVO: intervalo de datas (Data Início + Data Fim)
    if(f.type==='dateRange'){
      var wrap=document.createElement('div');
      wrap.style.display='inline-flex';
      wrap.style.alignItems='center';
      wrap.style.gap='4px';
      wrap.style.background='var(--surface2,#f3f4f6)';
      wrap.style.border='1px solid var(--border,#e5e7eb)';
      wrap.style.borderRadius='8px';
      wrap.style.padding='2px 6px';
      wrap.style.fontSize='11px';

      var lblIni=document.createElement('span');
      lblIni.textContent='📅 De ';
      lblIni.style.color='var(--text2,#6b7280)';
      lblIni.style.fontSize='11px';
      wrap.appendChild(lblIni);

      var inIni=document.createElement('input');
      inIni.type='date';
      inIni.id=f.idIni;
      inIni.className='filter-date';
      inIni.style.border='none';
      inIni.style.background='transparent';
      inIni.style.fontSize='11px';
      inIni.style.color='var(--text,#111827)';
      inIni.style.fontFamily='inherit';
      if(saved[f.idIni]) inIni.value=saved[f.idIni];
      inIni.onchange=f.onChange;
      wrap.appendChild(inIni);

      var lblFim=document.createElement('span');
      lblFim.textContent=' até ';
      lblFim.style.color='var(--text2,#6b7280)';
      lblFim.style.fontSize='11px';
      wrap.appendChild(lblFim);

      var inFim=document.createElement('input');
      inFim.type='date';
      inFim.id=f.idFim;
      inFim.className='filter-date';
      inFim.style.border='none';
      inFim.style.background='transparent';
      inFim.style.fontSize='11px';
      inFim.style.color='var(--text,#111827)';
      inFim.style.fontFamily='inherit';
      if(saved[f.idFim]) inFim.value=saved[f.idFim];
      inFim.onchange=f.onChange;
      wrap.appendChild(inFim);

      container.appendChild(wrap);
      return;
    }
    var sel=document.createElement('select');
    sel.className='filter-select';
    sel.id=f.id;
    sel.innerHTML='<option value="">Todos - '+f.label+'</option>';
    var displayOptions=f.options;
    var displayLabels=f.optionLabels;
    if(f.linkedMonthId){
      var monthVal=saved[f.linkedMonthId]||'';
      var filteredWeeks=getWeeksForMonth(monthVal, f.allWeeks||f.options);
      displayOptions=filteredWeeks;
      displayLabels=filteredWeeks.map(getWeekDisplay);
    }
    if(displayLabels){
      displayOptions.forEach(function(o,i){sel.innerHTML+='<option value="'+o+'">'+(displayLabels[i]||o)+'</option>'});
    } else {
      displayOptions.forEach(function(o){sel.innerHTML+='<option value="'+o+'">'+o+'</option>'});
    }
    if(saved[f.id]) sel.value=saved[f.id];
    sel.onchange=f.onChange;
    container.appendChild(sel);
    if(f.dayId&&f.daysData){
      var daySel=document.createElement('select');
      daySel.className='filter-select';
      daySel.id=f.dayId;
      daySel.style.minWidth='110px';
      var selectedMonth=saved[f.id]||sel.value;
      if(selectedMonth&&f.daysData[selectedMonth]){
        daySel.innerHTML='<option value="">Todos dias</option>';
        f.daysData[selectedMonth].forEach(function(d){daySel.innerHTML+='<option value="'+d+'">'+d.split('-')[2]+'/'+(d.split('-')[1])+'</option>'});
      } else {
        daySel.innerHTML='<option value="">Dia</option>';
        daySel.disabled=true;
      }
      if(saved[f.dayId]) daySel.value=saved[f.dayId];
      daySel.onchange=f.onChange;
      container.appendChild(daySel);
    }
  });
  if(extraHtml){
    var span=document.createElement('span');
    span.innerHTML=extraHtml;
    while(span.firstChild) container.appendChild(span.firstChild);
  }
  if(clearFn){
    var btn=document.createElement('button');
    btn.className='filter-btn-clear';
    btn.innerHTML='↺ Limpar filtros';
    btn.onclick=clearFn;
    container.appendChild(btn);
  }
  // Páginas com botão de exportação próprio (ex: Consumo, que tem relatório sob medida)
  // passam noPdfBtn=true pra não ganhar este botão genérico duplicado — o genérico usa
  // exportPagePDF(containerId), que só sabe montar relatório pras páginas cadastradas em
  // pageMap (utils.js); pra qualquer outra ele cai num fallback que clona a tela inteira
  // "como está", incluindo caixas com rolagem interna cortadas.
  if(!noPdfBtn){
    var pdfBtn=document.createElement('button');
    pdfBtn.className='filter-btn-pdf';
    pdfBtn.innerHTML='📄 Exportar PDF';
    pdfBtn.onclick=function(){exportPagePDF(containerId)};
    container.appendChild(pdfBtn);
  }
}

// Helper: aplica filtro de intervalo de datas a uma data ISO ou DD/MM/AAAA.
// Comportamento "permissivo":
//   - só início preenchido  -> de início até HOJE
//   - só fim preenchido     -> do começo dos tempos até fim
//   - ambos                 -> intervalo fechado
// Retorna true se a data passa no filtro (ou se nenhum dos dois foi preenchido).
function dateInRange(dateStr, ini, fim){
  if(!ini && !fim) return true;
  if(!dateStr) return false;
  // Normaliza pra YYYY-MM-DD
  var d=String(dateStr).slice(0,10);
  if(d.indexOf('/')>=0){
    // DD/MM/AAAA
    var p=d.split('/');
    if(p.length===3) d=p[2]+'-'+p[1]+'-'+p[0];
  }
  // Se só início foi dado, "fim" vira hoje (ISO)
  if(ini && !fim){
    var hoje=new Date();
    fim = hoje.getFullYear()+'-'+String(hoje.getMonth()+1).padStart(2,'0')+'-'+String(hoje.getDate()).padStart(2,'0');
  }
  if(ini && d < ini) return false;
  if(fim && d > fim) return false;
  return true;
}

