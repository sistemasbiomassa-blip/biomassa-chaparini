// ============================================================
// ===== MÓDULO CONTRATOS =====================================
// Acompanhamento de meta de entrega por contrato (mensal ou semanal),
// vinculado a um Local Descarga. Visível pra DIRETOR e ADMIN; só ADMIN
// cadastra/edita/exclui (RLS em supabase/migrations/0014_contratos.sql).
// "Quantidade entregue" nunca é digitada — é sempre calculada ao vivo
// somando DB.cadastro (QUANTIDADE) do local vinculado, dentro do período
// vigente (mês ou semana corrente).
// ============================================================
var CONTRATO_FIELDS=[
  {key:'NOME', label:'Nome do Contrato *', type:'text', ph:'ex: Contrato Serraria XYZ'},
  {key:'LOCAL_DESCARGA', label:'Local Descarga *', type:'select', srcBase:'localDescarga'},
  {key:'PERIODICIDADE', label:'Periodicidade *', type:'select', opts:['mensal','semanal','personalizado']},
  {key:'DIA_INICIO_SEMANA', label:'Início da semana do contrato', type:'select', opts:[0,1,2,3,4,5,6], def:1, grupo:'semanal'},
  {key:'DATA_INICIO', label:'Data início *', type:'date', grupo:'personalizado'},
  {key:'DATA_FIM', label:'Data fim *', type:'date', grupo:'personalizado'},
  {key:'QUANTIDADE_META', label:'Quantidade contratada (por período) *', type:'moneynum'}
];
var WEEKDAY_NOMES=['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
var WEEKDAY_ABREV=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
var _ctrEditId=null, _ctrDelId=null;

function findContratoById(id){
  id=String(id);
  for(var i=0;i<DB.contratos.length;i++){ if(String(DB.contratos[i].ID)===id) return DB.contratos[i]; }
  return null;
}
function _ctrEsc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'); }
function _ctrISO(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }

// Período vigente (mensal): 1º ao último dia do mês corrente.
function _ctrMonthRange(hoje){
  var y=hoje.getFullYear(), m=hoje.getMonth();
  var iniD=new Date(y,m,1), fimD=new Date(y,m+1,0);
  var diasNoMes=fimD.getDate();
  var elapsedFrac=Math.min(1,Math.max(0,hoje.getDate()/diasNoMes));
  return {ini:_ctrISO(iniD), fim:_ctrISO(fimD), elapsedFrac:elapsedFrac, label:getMonthLabel(getMonthYear(_ctrISO(hoje)))};
}
// Período vigente (semanal): semana "customizada" começando no dia da semana
// configurado no contrato (0=domingo..6=sábado; padrão segunda-feira). Cobre
// tanto semana civil quanto casos como o contrato Cargill (quarta a terça).
function _ctrWeekRange(hoje,diaInicio){
  diaInicio=(diaInicio==null)?1:Number(diaInicio);
  var diff=(hoje.getDay()-diaInicio+7)%7; // dias desde o último "diaInicio"
  var iniD=new Date(hoje.getFullYear(),hoje.getMonth(),hoje.getDate()-diff);
  var fimD=new Date(iniD.getFullYear(),iniD.getMonth(),iniD.getDate()+6);
  var elapsedFrac=Math.min(1,Math.max(0,(diff+1)/7));
  var label=WEEKDAY_ABREV[iniD.getDay()]+' '+String(iniD.getDate()).padStart(2,'0')+'/'+String(iniD.getMonth()+1).padStart(2,'0')+
    ' a '+WEEKDAY_ABREV[fimD.getDay()]+' '+String(fimD.getDate()).padStart(2,'0')+'/'+String(fimD.getMonth()+1).padStart(2,'0');
  return {ini:_ctrISO(iniD), fim:_ctrISO(fimD), elapsedFrac:elapsedFrac, label:label};
}
// Período fixo (personalizado): data início/fim cadastradas no contrato, sem
// recalcular a cada mês/semana. Antes do início, nada é esperado ainda (0%);
// depois do fim, o prazo já era 100% (mostra o resultado final, não some).
function _ctrPersonalizadoRange(contrato,hoje){
  var iniD=new Date(contrato.DATA_INICIO+'T12:00:00');
  var fimD=new Date(contrato.DATA_FIM+'T12:00:00');
  var hojeD=new Date(hoje.getFullYear(),hoje.getMonth(),hoje.getDate(),12,0,0);
  var totalDias=Math.max(1,Math.round((fimD-iniD)/86400000)+1);
  var diasPassados=Math.round((hojeD-iniD)/86400000)+1;
  var elapsedFrac=Math.min(1,Math.max(0,diasPassados/totalDias));
  var label=formatDateBR(contrato.DATA_INICIO)+' a '+formatDateBR(contrato.DATA_FIM);
  return {ini:contrato.DATA_INICIO, fim:contrato.DATA_FIM, elapsedFrac:elapsedFrac, label:label};
}
function _ctrPeriodoAtual(contrato,hoje){
  if(contrato.PERIODICIDADE==='semanal') return _ctrWeekRange(hoje,contrato.DIA_INICIO_SEMANA);
  if(contrato.PERIODICIDADE==='personalizado') return _ctrPersonalizadoRange(contrato,hoje);
  return _ctrMonthRange(hoje);
}

// Soma QUANTIDADE de DB.cadastro pro local do contrato, dentro do período.
function calcContratoEntregue(contrato,ini,fim){
  var total=0;
  DB.cadastro.forEach(function(r){
    if(!r['LOCAL DESCARGA'] || r['LOCAL DESCARGA']!==contrato.LOCAL_DESCARGA) return;
    if(!dateInRange(r.DATA,ini,fim)) return;
    if(r.QUANTIDADE) total+=num(r.QUANTIDADE);
  });
  return total;
}

// Ritmo linear: compara % já entregue com % do prazo já passado.
function contratoStatus(pctEntregue,elapsedFrac){
  if(pctEntregue>=elapsedFrac) return {cor:'#22c55e', label:'No ritmo'};
  if(pctEntregue>=elapsedFrac*0.7) return {cor:'#f59e0b', label:'Atenção'};
  return {cor:'#ef4444', label:'Atrasado'};
}

function buildContratos(){ renderContratosCards(); }

function renderContratosCards(){
  var cont=document.getElementById('contratosCards');
  if(!cont) return;
  var admin=maqIsAdmin();
  var addBtn=document.getElementById('ctrAddBtn');
  if(addBtn) addBtn.style.display=admin?'inline-flex':'none';
  var lista=DB.contratos.slice().sort(function(a,b){return String(a.NOME||'').localeCompare(String(b.NOME||''),'pt-BR',{sensitivity:'base'})});
  if(!lista.length){
    cont.innerHTML='<div style="padding:30px;text-align:center;color:var(--text2)">Nenhum contrato cadastrado'+(admin?'. Clique em "Novo Contrato".':'.')+'</div>';
    return;
  }
  var hoje=new Date();
  var h='';
  lista.forEach(function(c){
    var periodo=_ctrPeriodoAtual(c,hoje);
    var entregue=calcContratoEntregue(c,periodo.ini,periodo.fim);
    var meta=num(c.QUANTIDADE_META);
    var pct=meta>0?entregue/meta:0;
    var st=contratoStatus(pct,periodo.elapsedFrac);
    var unidade=getUnit(c.LOCAL_DESCARGA);
    var barWidth=Math.min(100,pct*100);
    h+='<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:12px;position:relative">';
    if(admin){
      h+='<div style="position:absolute;top:14px;right:14px;display:flex;gap:8px">'+
        '<span class="maq-act" title="Editar" onclick="openContratoModal(\''+c.ID+'\')">✏️</span>'+
        '<span class="maq-act" title="Excluir" onclick="openContratoDelete(\''+c.ID+'\')">🗑️</span>'+
      '</div>';
    }
    h+='<div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;padding-right:'+(admin?'60px':'0')+'">';
    h+='<div style="font-weight:700;font-size:14px">'+_ctrEsc(c.NOME)+'</div>';
    h+='<div style="font-size:11px;color:var(--text2)">'+_ctrEsc(c.LOCAL_DESCARGA)+' · '+periodo.label+'</div>';
    h+='</div>';
    h+='<div style="height:12px;border-radius:6px;background:var(--surface2);overflow:hidden;margin:10px 0 8px">';
    h+='<div style="height:100%;width:'+barWidth+'%;border-radius:6px;background:'+st.cor+'"></div>';
    h+='</div>';
    h+='<div style="display:flex;justify-content:space-between;align-items:center;font-size:12px">';
    h+='<div style="font-family:JetBrains Mono,monospace">'+numBR(entregue,0)+' / '+numBR(meta,0)+' '+unidade+' ('+Math.round(pct*100)+'%)</div>';
    h+='<div style="font-weight:600;color:'+st.cor+'">'+st.label+'</div>';
    h+='</div>';
    h+='</div>';
  });
  cont.innerHTML=h;
}

function openContratoModal(id){
  if(!maqIsAdmin()){ showToast('Apenas ADMIN pode cadastrar/editar contratos',true); return; }
  _ctrEditId=(id!==undefined&&id!==null&&id!=='')?String(id):null;
  var row=_ctrEditId?findContratoById(_ctrEditId):{};
  if(_ctrEditId&&!row){ showToast('Contrato não encontrado',true); return; }
  document.getElementById('contratoModalTitle').textContent=_ctrEditId?'✏️ Editar Contrato':'📑 Novo Contrato';
  var periodicidadeAtual=(row&&row.PERIODICIDADE)||'';
  var PERIODICIDADE_LABELS={mensal:'Mensal',semanal:'Semanal',personalizado:'Personalizado'};
  var html='';
  CONTRATO_FIELDS.forEach(function(f){
    var val=(row&&row[f.key]!=null)?row[f.key]:(f.def!=null?f.def:'');
    var fid='ctrf_'+f.key;
    var isDiaInicio=f.key==='DIA_INICIO_SEMANA';
    var grpAttrs=f.grupo?' data-ctr-grupo="'+f.grupo+'"'+(periodicidadeAtual!==f.grupo?' style="display:none"':''):'';
    html+='<div class="form-group"'+grpAttrs+'><label>'+f.label+'</label>';
    if(f.type==='select'){
      var opts=f.srcBase?locaisFiltrados(BASE[f.srcBase],'Ativos').slice().sort(function(a,b){return String(a).localeCompare(String(b),'pt-BR',{sensitivity:'base'})}):f.opts;
      // Preserva o local atual mesmo se ele tiver sido inativado depois que o contrato foi criado
      if(f.srcBase && val && opts.indexOf(val)===-1) opts=opts.concat([val]);
      var onch=f.key==='PERIODICIDADE'?' onchange="_ctrTogglePeriodicidade()"':'';
      html+='<select id="'+fid+'"'+onch+'><option value="">—</option>';
      opts.forEach(function(o){
        var lbl=f.key==='PERIODICIDADE'?PERIODICIDADE_LABELS[o]:(isDiaInicio?WEEKDAY_NOMES[o]:(f.srcBase&&o===val&&localEstaInativo(o)?o+' (inativo)':o));
        html+='<option value="'+_ctrEsc(o)+'"'+(String(val)===String(o)?' selected':'')+'>'+_ctrEsc(lbl)+'</option>';
      });
      html+='</select>';
    } else if(f.type==='moneynum'){
      var mval=(val===''||val==null)?'':fmt(val,2);
      html+='<input id="'+fid+'" type="text" inputmode="decimal" value="'+_ctrEsc(mval)+'"'+(f.ph?' placeholder="'+f.ph+'"':'')+'>';
    } else if(f.type==='date'){
      html+='<input id="'+fid+'" type="date" value="'+_ctrEsc(String(val).slice(0,10))+'">';
    } else {
      html+='<input id="'+fid+'" type="'+f.type+'" value="'+_ctrEsc(val)+'"'+(f.ph?' placeholder="'+f.ph+'"':'')+'>';
    }
    html+='</div>';
  });
  document.getElementById('contratoModalGrid').innerHTML=html;
  mascaraNumero(document.getElementById('ctrf_QUANTIDADE_META'),LIMITES_CAMPOS.contratoMeta,2);
  document.getElementById('contratoModalOverlay').classList.add('show');
}
function closeContratoModal(){ document.getElementById('contratoModalOverlay').classList.remove('show'); _ctrEditId=null; }

// Mostra só os campos extras da periodicidade escolhida (dia de início da
// semana pra "semanal"; data início/fim pra "personalizado").
function _ctrTogglePeriodicidade(){
  var v=document.getElementById('ctrf_PERIODICIDADE').value;
  document.querySelectorAll('#contratoModalGrid [data-ctr-grupo]').forEach(function(el){
    el.style.display=el.getAttribute('data-ctr-grupo')===v?'':'none';
  });
}

function salvarContrato(){
  if(!maqIsAdmin()){ showToast('Sem permissão',true); return; }
  var row={};
  CONTRATO_FIELDS.forEach(function(f){
    var el=document.getElementById('ctrf_'+f.key);
    if(!el){ row[f.key]=null; return; }
    row[f.key]=f.type==='moneynum'?(el.value?num(el.value):null):String(el.value).trim();
  });
  // Cada campo extra só faz sentido pra sua periodicidade — zera os outros
  row.DIA_INICIO_SEMANA=(row.PERIODICIDADE==='semanal'&&row.DIA_INICIO_SEMANA!=='')?Number(row.DIA_INICIO_SEMANA):null;
  if(row.PERIODICIDADE!=='personalizado'){ row.DATA_INICIO=null; row.DATA_FIM=null; }
  else { if(!row.DATA_INICIO) row.DATA_INICIO=null; if(!row.DATA_FIM) row.DATA_FIM=null; }
  if(!row.NOME){ showToast('Informe o nome do contrato',true); return; }
  if(!row.LOCAL_DESCARGA){ showToast('Selecione o local de descarga',true); return; }
  if(!row.PERIODICIDADE){ showToast('Selecione a periodicidade',true); return; }
  if(row.PERIODICIDADE==='personalizado'){
    if(!row.DATA_INICIO||!row.DATA_FIM){ showToast('Informe a data início e a data fim do contrato',true); return; }
    if(row.DATA_FIM<row.DATA_INICIO){ showToast('A data fim não pode ser antes da data início',true); return; }
  }
  if(!row.QUANTIDADE_META||row.QUANTIDADE_META<=0){ showToast('Informe a quantidade contratada',true); return; }
  var btn=document.getElementById('ctrSalvarBtn'); if(btn){ btn.disabled=true; btn.textContent='Salvando...'; }
  function done(ok,res){
    if(btn){ btn.disabled=false; btn.textContent='💾 Salvar'; }
    if(!ok){ showToast('❌ Erro ao salvar: '+((res&&res.error)||'desconhecido'),true); return; }
    showToast('✅ Contrato salvo!');
    closeContratoModal();
    loadFromSheets(function(){ if(document.getElementById('pageContratos').classList.contains('active')) renderContratosCards(); });
  }
  if(_ctrEditId) saveToSheets('updateContrato',{id:_ctrEditId,row:row},done);
  else saveToSheets('addContrato',row,done);
}

function openContratoDelete(id){
  if(!maqIsAdmin()){ showToast('Apenas ADMIN pode excluir',true); return; }
  var c=findContratoById(id); if(!c){ showToast('Contrato não encontrado',true); return; }
  _ctrDelId=String(id);
  document.getElementById('contratoDelDetails').innerHTML='<div><strong>Contrato:</strong> '+_ctrEsc(c.NOME||'-')+'</div><div><strong>Local:</strong> '+_ctrEsc(c.LOCAL_DESCARGA||'-')+'</div>';
  document.getElementById('contratoDelOverlay').classList.add('show');
}
function closeContratoDelete(){ document.getElementById('contratoDelOverlay').classList.remove('show'); _ctrDelId=null; }
function confirmContratoDelete(){
  if(!_ctrDelId) return;
  var btn=document.getElementById('contratoDelBtn'); if(btn){ btn.disabled=true; btn.textContent='Excluindo...'; }
  saveToSheets('deleteContrato',{id:_ctrDelId},function(ok,res){
    if(btn){ btn.disabled=false; btn.textContent='🗑️ Excluir'; }
    if(!ok){ showToast('❌ Erro ao excluir: '+((res&&res.error)||'desconhecido'),true); return; }
    showToast('✅ Contrato excluído');
    closeContratoDelete();
    loadFromSheets(function(){ if(document.getElementById('pageContratos').classList.contains('active')) renderContratosCards(); });
  });
}
// ===== FIM MÓDULO CONTRATOS =====
