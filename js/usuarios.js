// ==================== USUARIOS (ADMIN) ====================
function renderUsuariosTable(){
  var h='<div class="table-header"><h3>Usuários Cadastrados</h3><span class="chart-badge">'+USUARIOS.length+' usuários</span></div><div class="table-scroll"><table><thead><tr><th>Usuário</th><th>Nome</th><th>Perfil</th><th>Primeiro Acesso</th><th>Ativo</th><th>Ações</th></tr></thead><tbody>';
  USUARIOS.forEach(function(u,i){
    var perfil=(u.PERFIL||'ANALISTA').toUpperCase();
    var perfilClass=perfil==='ADMIN'?'admin':(perfil==='DIRETOR'?'diretor':'analista');
    var ativo=u.ATIVO?u.ATIVO.toUpperCase()!=='FALSE':true;
    var primeiroAcesso=u.PRIMEIRO_ACESSO?u.PRIMEIRO_ACESSO.toUpperCase()==='TRUE':false;
    h+='<tr>';
    h+='<td style="font-weight:600">'+u.USUARIO+'</td>';
    h+='<td>'+(u.NOME||'-')+'</td>';
    h+='<td><span class="historico-badge '+perfilClass+'">'+perfil+'</span></td>';
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
  var usuario=document.getElementById('nuUser').value.trim();
  var nome=document.getElementById('nuNome').value.trim();
  var senha=document.getElementById('nuSenha').value;
  var perfil=document.getElementById('nuPerfil').value;
  if(!usuario||!nome||!senha){showToast('Preencha todos os campos!',true);return;}
  // Check duplicate
  var dup=false;
  USUARIOS.forEach(function(u){if(u.USUARIO.toUpperCase()===usuario.toUpperCase())dup=true;});
  if(dup){showToast('Usuário já existe!',true);return;}
  var novoUser={USUARIO:usuario,SENHA:senha,PERFIL:perfil,NOME:nome,PRIMEIRO_ACESSO:'TRUE',ATIVO:'TRUE'};
  saveToSheets('addUsuario',novoUser,function(ok){
    if(ok){
      USUARIOS.push(novoUser);
      showToast('✅ Usuário '+nome+' criado!');
      document.getElementById('addUserForm').style.display='none';
      document.getElementById('nuUser').value='';
      document.getElementById('nuNome').value='';
      document.getElementById('nuSenha').value='';
      document.getElementById('nuPerfil').value='ANALISTA';
      renderUsuariosTable();
    } else {
      showToast('❌ Erro ao salvar usuário',true);
    }
  });
}

function toggleUsuario(idx,ativar){
  var u=USUARIOS[idx];
  if(!u)return;
  var novoStatus=ativar?'TRUE':'FALSE';
  saveToSheets('updateUsuario',{USUARIO:u.USUARIO,ATIVO:novoStatus},function(ok){
    if(ok){
      u.ATIVO=novoStatus;
      showToast(ativar?'✅ Usuário ativado':'⛔ Usuário desativado');
      renderUsuariosTable();
    } else {showToast('❌ Erro ao atualizar',true);}
  });
}

function resetSenhaUsuario(idx){
  var u=USUARIOS[idx];
  if(!u)return;
  if(!confirm('Resetar a senha de '+u.NOME+'?\nA nova senha será: 123456'))return;
  saveToSheets('updatePassword',{USUARIO:u.USUARIO,SENHA:'123456',PRIMEIRO_ACESSO:'TRUE'},function(ok){
    if(ok){
      u.SENHA='123456';
      u.PRIMEIRO_ACESSO='TRUE';
      showToast('✅ Senha resetada! Nova senha: 123456');
      renderUsuariosTable();
    } else {showToast('❌ Erro ao resetar senha',true);}
  });
}

