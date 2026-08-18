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
  var email=document.getElementById('loginUser').value.trim();
  var p=document.getElementById('loginPass').value;
  if(!email||!p){document.getElementById('loginError').style.display='block';return;}
  document.getElementById('loginError').style.display='none';
  showToast('⏳ Verificando credenciais...');
  sb.auth.signInWithPassword({email:email,password:p}).then(function(res){
    if(res.error){
      document.getElementById('loginError').textContent='E-mail ou senha incorretos';
      document.getElementById('loginError').style.display='block';
      return;
    }
    carregarPerfilELogar(res.data.user);
  });
}

// Ao carregar a página, reaproveita a sessão do Supabase Auth se já existir
// (evita pedir login de novo só porque a página foi atualizada/F5).
sb.auth.getSession().then(function(res){
  var session = res.data && res.data.session;
  if(session && session.user){
    carregarPerfilELogar(session.user);
  }
});

function carregarPerfilELogar(user){
  sb.from('profiles').select('*').eq('id',user.id).single().then(function(res){
    if(res.error || !res.data){
      document.getElementById('loginError').textContent='Não foi possível carregar seu perfil. Contate o administrador.';
      document.getElementById('loginError').style.display='block';
      sb.auth.signOut();
      return;
    }
    var perfil=res.data;
    if(!perfil.ativo){
      document.getElementById('loginError').textContent='Usuário desativado. Contate o administrador.';
      document.getElementById('loginError').style.display='block';
      sb.auth.signOut();
      return;
    }
    currentUser=user.id;
    currentUserData={usuario:user.email,nome:perfil.nome||user.email,perfil:(perfil.perfil||'ANALISTA').toUpperCase(),primeiroAcesso:perfil.primeiro_acesso};
    if(!dataLoaded){
      loadFromSheets(function(){
        if(currentUserData.primeiroAcesso){ document.getElementById('changePassOverlay').classList.add('show'); return; }
        enterApp();
      });
    } else {
      if(currentUserData.primeiroAcesso){ document.getElementById('changePassOverlay').classList.add('show'); return; }
      enterApp();
    }
  });
}

function enterApp(){
  _comboioAlertDismissed=false;
  _alertasDismissed={};
  _alertasBannerVisible=false;
  document.getElementById('loginPage').style.display='none';
  document.getElementById('appPage').style.display='block';
  // Show/hide admin elements
  var isAdmin=currentUserData.perfil==='ADMIN';
  var isDiretor=currentUserData.perfil==='DIRETOR';
  document.querySelectorAll('.admin-only').forEach(function(el){el.style.display=isAdmin?'flex':'none'});
  document.querySelectorAll('.diretor-only').forEach(function(el){el.style.display=(isAdmin||isDiretor)?'flex':'none'});
  document.querySelectorAll('.freq-visible').forEach(function(el){el.style.display='flex'}); // DIRETOR também enxerga Frequência (decisão de RLS)
  document.getElementById('btnImport').style.display=isAdmin?'inline-flex':'none';
  ['tabLocaisBtn','tabMotoristasBtn','tabCaminhoesBtn','tabGarantiaBtn'].forEach(function(id){
    var el=document.getElementById(id);
    if(el) el.style.display=isAdmin?'':'none';
  });
  // User badge
  var roleClass=isAdmin?'role-admin':(isDiretor?'role-diretor':'role-analista');
  var roleLabel=isAdmin?'Admin':(isDiretor?'Diretor':'Analista');
  document.getElementById('userBadge').innerHTML='<span>👤</span><span class="user-name">'+currentUserData.nome+'</span><span class="user-role '+roleClass+'">'+roleLabel+'</span>';
  initApp();
  checkComboioAlert();
  renderAlertasBanner();
  // Sempre volta pra uma aba segura ao entrar — sem isso, se alguém logar como
  // outro usuário na mesma aba do navegador (sem dar F5), a última página aberta
  // (ex: Usuários, só de ADMIN) continuava visível pro novo usuário.
  navigateTo('cadastro');
}

function doChangePass(){
  var p1=document.getElementById('newPass1').value;
  var p2=document.getElementById('newPass2').value;
  var errEl=document.getElementById('changePassError');
  if(!p1||p1.length<4){errEl.textContent='A senha deve ter pelo menos 4 caracteres';errEl.style.display='block';return;}
  if(p1!==p2){errEl.textContent='As senhas não coincidem';errEl.style.display='block';return;}
  errEl.style.display='none';
  sb.auth.updateUser({password:p1}).then(function(res){
    if(res.error){ errEl.textContent='Erro ao salvar. Tente novamente.';errEl.style.display='block'; return; }
    sb.from('profiles').update({primeiro_acesso:false}).eq('id',currentUser).then(function(res2){
      if(res2.error){ errEl.textContent='Senha trocada, mas houve erro ao atualizar o perfil. Contate o administrador.';errEl.style.display='block'; return; }
      showToast('✅ Senha alterada com sucesso!');
      currentUserData.primeiroAcesso=false;
      document.getElementById('changePassOverlay').classList.remove('show');
      document.getElementById('newPass1').value='';
      document.getElementById('newPass2').value='';
      enterApp();
    });
  });
}

function doLogout(){
  sb.auth.signOut();
  currentUser=null;
  currentUserData=null;
  dataLoaded=false;
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
  var map={cadastro:'pageCadastro',producao:'pageProducao',financeiro:'pageFinanceiro',manutencao:'pageManutencao',consumo:'pageConsumo',tempoespera:'pageTempoEspera',mapa:'pageMapa',relatorio:'pageRelatorio',historico:'pageHistorico',usuarios:'pageUsuarios',maquinarios:'pageMaquinarios',comboio:'pageComboio',frequencia:'pageFrequencia',alertas:'pageAlertas',contratos:'pageContratos'};
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
  else if(page==='alertas') buildAlertas();
  else if(page==='contratos') buildContratos();
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

