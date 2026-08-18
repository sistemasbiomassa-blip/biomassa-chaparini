// ==================== USUARIOS (ADMIN) ====================
function renderUsuariosTable(){
  var h='<div class="table-header"><h3>Usuários Cadastrados</h3><span class="chart-badge">'+USUARIOS.length+' usuários</span></div><div class="table-scroll"><table><thead><tr><th>E-mail</th><th>Nome</th><th>Perfil</th><th>Primeiro Acesso</th><th>Ativo</th><th>Ações</th></tr></thead><tbody>';
  USUARIOS.forEach(function(u,i){
    var perfil=(u.PERFIL||'ANALISTA').toUpperCase();
    var perfilClass=perfil==='ADMIN'?'admin':(perfil==='DIRETOR'?'diretor':'analista');
    var ativo=u.ATIVO?u.ATIVO.toUpperCase()!=='FALSE':true;
    var primeiroAcesso=u.PRIMEIRO_ACESSO?u.PRIMEIRO_ACESSO.toUpperCase()==='TRUE':false;
    h+='<tr>';
    h+='<td style="font-weight:600">'+(u.EMAIL||u.USUARIO||'-')+'</td>';
    h+='<td>'+(u.NOME||'-')+'</td>';
    h+='<td><span class="historico-badge '+perfilClass+'">'+perfil+'</span> '+
      '<span class="maq-act" title="Alterar perfil" onclick="openPerfilModal('+i+')">✏️</span></td>';
    h+='<td>'+(primeiroAcesso?'<span style="color:var(--yellow)">Sim</span>':'Não')+'</td>';
    h+='<td>'+(ativo?'<span style="color:var(--green)">✅ Ativo</span>':'<span style="color:var(--red)">❌ Inativo</span>')+'</td>';
    h+='<td>';
    if(ativo){
      h+='<button class="btn btn-danger btn-sm" onclick="toggleUsuario('+i+',false)" style="font-size:11px;padding:4px 10px">Desativar</button>';
    } else {
      h+='<button class="btn btn-secondary btn-sm" onclick="toggleUsuario('+i+',true)" style="font-size:11px;padding:4px 10px">Ativar</button>';
    }
    h+=' <button class="btn btn-secondary btn-sm" onclick="resetSenhaUsuario('+i+')" style="font-size:11px;padding:4px 10px">Resetar Senha</button>';
    h+='</td></tr>';
  });
  h+='</tbody></table></div>';
  document.getElementById('tblUsuarios').innerHTML=h;
}

function showAddUserForm(){document.getElementById('addUserForm').style.display='block';}

function salvarNovoUsuario(){
  var email=document.getElementById('nuEmail').value.trim();
  var usuario=document.getElementById('nuUser').value.trim();
  var nome=document.getElementById('nuNome').value.trim();
  var senha=document.getElementById('nuSenha').value;
  var perfil=document.getElementById('nuPerfil').value;
  if(!email||!nome||!senha){showToast('Preencha e-mail, nome e senha!',true);return;}
  var dup=USUARIOS.some(function(u){return (u.EMAIL||'').toLowerCase()===email.toLowerCase();});
  if(dup){showToast('Já existe usuário com esse e-mail!',true);return;}
  saveToSheets('addUsuario',{EMAIL:email,USUARIO:usuario,SENHA:senha,PERFIL:perfil,NOME:nome},function(ok,res){
    if(ok){
      showToast('✅ Usuário '+nome+' criado!');
      document.getElementById('addUserForm').style.display='none';
      document.getElementById('nuEmail').value='';
      document.getElementById('nuUser').value='';
      document.getElementById('nuNome').value='';
      document.getElementById('nuSenha').value='';
      document.getElementById('nuPerfil').value='ANALISTA';
      loadFromSheets(function(){ renderUsuariosTable(); });
    } else {
      showToast('❌ Erro ao salvar usuário: '+((res&&res.error)||'desconhecido'),true);
    }
  });
}

function toggleUsuario(idx,ativar){
  var u=USUARIOS[idx];
  if(!u)return;
  var novoStatus=ativar?'TRUE':'FALSE';
  saveToSheets('updateUsuario',{id:u._id,ATIVO:novoStatus},function(ok,res){
    if(ok){
      u.ATIVO=novoStatus;
      showToast(ativar?'✅ Usuário ativado':'⛔ Usuário desativado');
      renderUsuariosTable();
    } else {showToast('❌ Erro ao atualizar: '+((res&&res.error)||'desconhecido'),true);}
  });
}

// ---------- Alterar perfil (modal) ----------
var _perfilEditIdx=null;
function openPerfilModal(idx){
  var u=USUARIOS[idx];
  if(!u)return;
  _perfilEditIdx=idx;
  var perfilAtual=(u.PERFIL||'ANALISTA').toUpperCase();
  document.getElementById('perfilModalNome').textContent=u.NOME||u.EMAIL;
  var sel=document.getElementById('perfilModalSelect');
  sel.innerHTML=['ADMIN','DIRETOR','ANALISTA'].map(function(p){return '<option value="'+p+'"'+(p===perfilAtual?' selected':'')+'>'+p+'</option>';}).join('');
  document.getElementById('perfilModalOverlay').classList.add('show');
}
function closePerfilModal(){ document.getElementById('perfilModalOverlay').classList.remove('show'); _perfilEditIdx=null; }
function salvarPerfilModal(){
  if(_perfilEditIdx==null)return;
  var u=USUARIOS[_perfilEditIdx];
  if(!u){closePerfilModal();return;}
  var perfilAtual=(u.PERFIL||'ANALISTA').toUpperCase();
  var novoPerfil=document.getElementById('perfilModalSelect').value;
  if(novoPerfil===perfilAtual){closePerfilModal();return;}
  var btn=document.getElementById('perfilModalSalvarBtn'); if(btn){btn.disabled=true;btn.textContent='Salvando...';}
  saveToSheets('updateUsuario',{id:u._id,PERFIL:novoPerfil},function(ok,res){
    if(btn){btn.disabled=false;btn.textContent='💾 Salvar';}
    if(ok){
      u.PERFIL=novoPerfil;
      showToast('✅ Perfil de '+(u.NOME||u.EMAIL)+' alterado para '+novoPerfil);
      closePerfilModal();
      renderUsuariosTable();
    } else {
      showToast('❌ Erro ao alterar perfil: '+((res&&res.error)||'desconhecido'),true);
    }
  });
}

function resetSenhaUsuario(idx){
  var u=USUARIOS[idx];
  if(!u)return;
  if(!confirm('Resetar a senha de '+u.NOME+'?\nA nova senha será: 123456'))return;
  saveToSheets('updatePassword',{id:u._id,novaSenha:'123456'},function(ok,res){
    if(ok){
      u.PRIMEIRO_ACESSO='TRUE';
      showToast('✅ Senha resetada! Nova senha: 123456');
      renderUsuariosTable();
    } else {showToast('❌ Erro ao resetar senha: '+((res&&res.error)||'desconhecido'),true);}
  });
}
