// ==================== THEME ====================
function toggleTheme(){
  document.body.classList.toggle('light');
  var btn=document.querySelector('.theme-toggle');
  btn.textContent=document.body.classList.contains('light')?'☀️':'🌙';
  localStorage.setItem('theme',document.body.classList.contains('light')?'light':'dark');
  var ap=document.querySelector('.page.active');
  if(ap){
    var pid=ap.id;
    if(pid==='pageProducao') buildProducao();
    else if(pid==='pageFinanceiro') buildFinanceiro();
    else if(pid==='pageManutencao') buildManutencao();
    else if(pid==='pageTempoEspera') buildTempoEspera();
  }
}

// ==================== LOGIN ====================
function togglePass(inputId, iconEl){
  var inp=document.getElementById(inputId);
  if(!inp) return;
  if(inp.type==='password'){ inp.type='text'; iconEl.textContent='🙈'; }
  else { inp.type='password'; iconEl.textContent='👁️'; }
}

function doLogin(){
  var u=document.getElementById('loginUser').value.trim();
  var p=document.getElementById('loginPass').value;
  if(!u||!p){document.getElementById('loginError').style.display='block';return;}
  document.getElementById('loginError').style.display='none';
  showToast('⏳ Verificando credenciais...');
  // First load data if not loaded
  if(!dataLoaded){
    loadFromSheets(function(){
      checkCredentials(u,p);
    });
  } else {
    checkCredentials(u,p);
  }
}

function checkCredentials(u,p){
  var found=null;
  USUARIOS.forEach(function(usr){
    if(usr.USUARIO && usr.USUARIO.toUpperCase()===u.toUpperCase() && usr.SENHA===p){
      found=usr;
    }
  });
  if(!found){
    document.getElementById('loginError').textContent='Usuário ou senha incorretos';
    document.getElementById('loginError').style.display='block';
    return;
  }
  if(found.ATIVO && found.ATIVO.toUpperCase()==='FALSE'){
    document.getElementById('loginError').textContent='Usuário desativado. Contate o administrador.';
    document.getElementById('loginError').style.display='block';
    return;
  }
  currentUser=found.USUARIO;
  currentUserData={usuario:found.USUARIO,nome:found.NOME||found.USUARIO,perfil:(found.PERFIL||'ANALISTA').toUpperCase(),primeiroAcesso:found.PRIMEIRO_ACESSO};
  // Check primeiro acesso
  if(currentUserData.primeiroAcesso && currentUserData.primeiroAcesso.toUpperCase()==='TRUE'){
    document.getElementById('changePassOverlay').classList.add('show');
    return;
  }
  enterApp();
}

function enterApp(){
  _comboioAlertDismissed=false;
  document.getElementById('loginPage').style.display='none';
  document.getElementById('appPage').style.display='block';
  // Show/hide admin elements
  var isAdmin=currentUserData.perfil==='ADMIN';
  var isDiretor=currentUserData.perfil==='DIRETOR';
  document.querySelectorAll('.admin-only').forEach(function(el){el.style.display=isAdmin?'flex':'none'});
  document.querySelectorAll('.diretor-only').forEach(function(el){el.style.display=(isAdmin||isDiretor)?'flex':'none'});
  document.querySelectorAll('.freq-visible').forEach(function(el){el.style.display=(isAdmin||currentUserData.perfil==='ANALISTA')?'flex':'none'});
  document.getElementById('btnImport').style.display=isAdmin?'inline-flex':'none';
  ['tabLocaisBtn','tabMotoristasBtn','tabCaminhoesBtn'].forEach(function(id){
    var el=document.getElementById(id);
    if(el) el.style.display=isAdmin?'':'none';
  });
  // User badge
  var roleClass=isAdmin?'role-admin':(isDiretor?'role-diretor':'role-analista');
  var roleLabel=isAdmin?'Admin':(isDiretor?'Diretor':'Analista');
  document.getElementById('userBadge').innerHTML='<span>👤</span><span class="user-name">'+currentUserData.nome+'</span><span class="user-role '+roleClass+'">'+roleLabel+'</span>';
  initApp();
  checkComboioAlert();
}

function doChangePass(){
  var p1=document.getElementById('newPass1').value;
  var p2=document.getElementById('newPass2').value;
  var errEl=document.getElementById('changePassError');
  if(!p1||p1.length<4){errEl.textContent='A senha deve ter pelo menos 4 caracteres';errEl.style.display='block';return;}
  if(p1!==p2){errEl.textContent='As senhas não coincidem';errEl.style.display='block';return;}
  errEl.style.display='none';
  // Update password via API
  saveToSheets('updatePassword',{USUARIO:currentUser,SENHA:p1,PRIMEIRO_ACESSO:'FALSE'},function(ok){
    if(ok){
      showToast('✅ Senha alterada com sucesso!');
      // Update local
      USUARIOS.forEach(function(usr){
        if(usr.USUARIO===currentUser){usr.SENHA=p1;usr.PRIMEIRO_ACESSO='FALSE';}
      });
      currentUserData.primeiroAcesso='FALSE';
      document.getElementById('changePassOverlay').classList.remove('show');
      document.getElementById('newPass1').value='';
      document.getElementById('newPass2').value='';
      enterApp();
    } else {
      errEl.textContent='Erro ao salvar. Tente novamente.';errEl.style.display='block';
    }
  });
}

function doLogout(){
  currentUser=null;
  currentUserData=null;
  document.getElementById('appPage').style.display='none';
  document.getElementById('loginPage').style.display='flex';
  document.getElementById('loginUser').value='';
  document.getElementById('loginPass').value='';
  document.getElementById('loginError').style.display='none';
  document.getElementById('userBadge').innerHTML='';
}

// ==================== NAVIGATION ====================
function navigateTo(page){
  document.querySelectorAll('.nav-item').forEach(function(n){n.classList.remove('active')});
  var ni=document.querySelector('.nav-item[data-page="'+page+'"]');
  if(ni) ni.classList.add('active');
  document.querySelectorAll('.page').forEach(function(p){p.classList.remove('active')});
  var map={cadastro:'pageCadastro',producao:'pageProducao',financeiro:'pageFinanceiro',manutencao:'pageManutencao',consumo:'pageConsumo',tempoespera:'pageTempoEspera',mapa:'pageMapa',relatorio:'pageRelatorio',historico:'pageHistorico',usuarios:'pageUsuarios',maquinarios:'pageMaquinarios',comboio:'pageComboio',frequencia:'pageFrequencia'};
  document.getElementById(map[page]).classList.add('active');
  if(page==='producao') buildProducao();
  else if(page==='financeiro') buildFinanceiro();
  else if(page==='manutencao') buildManutencao();
  else if(page==='consumo') buildConsumo();
  else if(page==='tempoespera') buildTempoEspera();
  else if(page==='mapa') buildMapa();
  else if(page==='relatorio') buildRelatorio();
  else if(page==='historico') buildHistorico();
  else if(page==='usuarios') renderUsuariosTable();
  else if(page==='maquinarios') buildMaquinarios();
  else if(page==='comboio') buildComboio();
  else if(page==='frequencia') buildFrequencia();
  if(page==='cadastro') setTimeout(iniciarMascaras,100);
}

function switchTab(el,tabId){
  el.parentElement.querySelectorAll('.tab').forEach(function(t){t.classList.remove('active')});
  el.classList.add('active');
  var parent=el.closest('.page');
  parent.querySelectorAll('.tab-content').forEach(function(c){c.classList.remove('active')});
  document.getElementById(tabId).classList.add('active');
  if(tabId==='tabManutReal') renderManutRealTable();
  if(tabId==='tabManutProg') renderManutProgTable();
  if(tabId==='tabLocais') renderLocaisTable();
  if(tabId==='tabMotoristas') renderMotoristasTable();
  if(tabId==='tabCaminhoes') renderCaminhoesTable();
  if(tabId==='tabMaquinas') renderMaquinasTable();
  if(tabId==='tabMaqLocal') renderMaqLocalTable();
  if(tabId==='tabMaqAbast') renderMaqAbastTable();
  if(tabId==='tabMaqManut') renderMaqManutTable();
  if(tabId==='tabMaqCusto') renderMaqCusto();
  if(tabId==='tabComboioSaldos') renderComboioSaldos();
  if(tabId==='tabComboioEntradas') renderComboioEntradas();
  if(tabId==='tabComboioSaidas') renderComboioSaidas();
  if(tabId==='tabComboioTanques') renderComboioTanques();
}

