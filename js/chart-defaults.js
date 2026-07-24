// ==================== INIT ====================
if(localStorage.getItem('theme')==='light'){document.body.classList.add('light');document.querySelector('.theme-toggle').textContent='☀️';}
Chart.defaults.font.family="'Outfit',sans-serif";
Chart.defaults.font.size=11;
Chart.defaults.maintainAspectRatio=false;
Chart.defaults.responsive=true;
Chart.defaults.plugins.tooltip.backgroundColor='#1a2235';
Chart.defaults.plugins.tooltip.titleColor='#eaf0f6';
Chart.defaults.plugins.tooltip.bodyColor='#8b95a8';
Chart.defaults.plugins.tooltip.borderColor='rgba(255,255,255,0.1)';
Chart.defaults.plugins.tooltip.borderWidth=1;
Chart.defaults.plugins.tooltip.padding=12;
Chart.defaults.plugins.tooltip.cornerRadius=10;
Chart.defaults.plugins.tooltip.displayColors=true;
Chart.defaults.plugins.tooltip.usePointStyle=true;
Chart.defaults.plugins.tooltip.enabled=true;
Chart.defaults.plugins.tooltip.callbacks.label=function(ctx){
  var lbl=ctx.dataset.label||'';
  var chartLabel=ctx.label||'';
  var val=ctx.raw;
  if(ctx.parsed!==undefined&&typeof ctx.parsed==='object'){
    // For horizontal bars: x is value, y is index
    // For vertical bars: y is value, x is index
    // Detect: if indexAxis=y OR if x > y and y is small integer
    var px=ctx.parsed.x, py=ctx.parsed.y, pr=ctx.parsed.r;
    if(pr!==undefined){ val=pr; }
    else if(px!==undefined&&py!==undefined){
      // Horizontal bar: value is x
      if(ctx.chart.options.indexAxis==='y') val=px;
      else val=py;
    } else if(py!==undefined){ val=py; }
    else if(px!==undefined){ val=px; }
  }
  var formatted=typeof val==='number'?numBR(val,2):String(val);
  if(lbl) return lbl+': '+formatted;
  if(chartLabel) return chartLabel+': '+formatted;
  return formatted;
};
Chart.defaults.plugins.legend.labels.usePointStyle=true;
Chart.defaults.plugins.legend.labels.pointStyle='circle';
Chart.defaults.plugins.legend.labels.padding=14;

