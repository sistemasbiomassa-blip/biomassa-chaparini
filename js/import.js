// ==================== IMPORT ====================
function showImportModal(){document.getElementById('importModal').classList.add('show');document.getElementById('importStats').innerHTML='';document.getElementById('importProgress').style.display='none';}
function closeImportModal(){document.getElementById('importModal').classList.remove('show');}

function doImport(){
  var file=document.getElementById('importFile').files[0];
  if(!file){showToast('Selecione um arquivo!',true);return;}
  document.getElementById('importProgress').style.display='block';
  document.getElementById('importProgressFill').style.width='20%';
  var reader=new FileReader();
  reader.onload=function(e){
    try{
      var wb=XLSX.read(e.target.result,{type:'array',cellDates:true});
      document.getElementById('importProgressFill').style.width='50%';
      var stats=[];
      if(wb.SheetNames.indexOf('CADASTRO')>=0){
        var rows=XLSX.utils.sheet_to_json(wb.Sheets['CADASTRO'],{defval:null});
        var processed=rows.map(function(r){
          var obj={};
          for(var key in r){
            var nk=key.trim();var val=r[key];
            if(val instanceof Date){
              if(val.getFullYear()>1900) obj[nk]=val.toISOString().slice(0,10);
              else obj[nk]=String(val.getHours()).padStart(2,'0')+':'+String(val.getMinutes()).padStart(2,'0');
            }else if(typeof val==='string') obj[nk]=val.trim();
            else obj[nk]=val;
          }
          return obj;
        });
        DB.cadastro=processed;
        stats.push('CADASTRO: '+processed.length+' registros');
      }
      document.getElementById('importProgressFill').style.width='70%';
      if(wb.SheetNames.indexOf('MANUT_REALIZADA')>=0){
        var rows2=XLSX.utils.sheet_to_json(wb.Sheets['MANUT_REALIZADA'],{defval:null});
        var p2=rows2.map(function(r){var o={};for(var k in r){var v=r[k];if(v instanceof Date) o[k.trim()]=v.toISOString().slice(0,10);else if(typeof v==='string') o[k.trim()]=v.trim();else o[k.trim()]=v;}return o});
        DB.manutRealizada=p2;
        stats.push('MANUT_REALIZADA: '+p2.length+' registros');
      }
      if(wb.SheetNames.indexOf('MANUT_PROGRAMADA')>=0){
        var rows3=XLSX.utils.sheet_to_json(wb.Sheets['MANUT_PROGRAMADA'],{defval:null}).filter(function(r){return r.TIPO_MANUTENCAO});
        DB.manutProgramada=rows3;
        stats.push('MANUT_PROGRAMADA: '+rows3.length+' registros');
      }
      document.getElementById('importProgressFill').style.width='100%';
      document.getElementById('importStats').innerHTML='<strong>✅ Importação concluída!</strong><br>'+stats.join('<br>');
      renderManutRealTable();renderManutProgTable();
      showToast('✅ Planilha importada com sucesso!');
      setTimeout(closeImportModal,2000);
    }catch(err){
      showToast('Erro: '+err.message,true);
      document.getElementById('importStats').innerHTML='<span style="color:var(--red)">❌ '+err.message+'</span>';
    }
  };
  reader.readAsArrayBuffer(file);
}

