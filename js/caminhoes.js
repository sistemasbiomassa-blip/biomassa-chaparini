// ==================== CAMINHOES ====================

function renderCaminhoesTable(){
  var h='<table><thead><tr><th>Placa</th><th>Marca</th><th>Modelo</th><th>Ano</th></tr></thead><tbody>';
  CAMINHOES_DATA.forEach(function(r){
    h+='<tr><td style="color:var(--accent);font-weight:600;font-family:JetBrains Mono,monospace">'+(r.PLACA||'-')+'</td><td>'+(r.MARCA||'-')+'</td><td>'+(r.MODELO||'-')+'</td><td style="font-family:JetBrains Mono,monospace;font-size:11px">'+(r.ANO||'-')+'</td></tr>';
  });
  h+='</tbody></table>';
  document.getElementById('tblCaminhoesContainer').innerHTML=h;
}

function salvarCaminhao(){
  var placa=document.getElementById('fcmPlaca').value.trim().toUpperCase().replace(/\s+/g,'');
  if(!placa){showToast('Placa é obrigatória!',true);return;}
  var rec={
    PLACA:placa,
    MARCA:document.getElementById('fcmMarca').value.trim(),
    MODELO:document.getElementById('fcmModelo').value.trim(),
    ANO:document.getElementById('fcmAno').value
  };
  CAMINHOES_DATA.push(rec);
  if(!BASE.placas.includes(placa)){BASE.placas.push(placa);populateSelects();}
  saveToSheets('addCaminhao', rec, function(ok){
    if(ok) showToast('✅ Caminhão cadastrado! '+placa);
    else showToast('⚠️ Salvo local, falha na planilha',true);
  });
  renderCaminhoesTable();
  limparFormCaminhao();
}

function limparFormCaminhao(){
  ['fcmPlaca','fcmMarca','fcmModelo','fcmAno'].forEach(function(id){document.getElementById(id).value='';});
}

