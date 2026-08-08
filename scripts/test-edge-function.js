// Cria um ADMIN temporário (via service_role, sem tocar em contas reais), testa a
// Edge Function gerenciar-usuarios de ponta a ponta, e apaga tudo no final.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const admin = createClient(process.env.SUPABASE_PROJECT_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const anon = createClient(process.env.SUPABASE_PROJECT_URL, process.env.SUPABASE_ANON_KEY);

function ok(label, cond, extra) { console.log((cond ? '✅' : '❌'), label, extra !== undefined ? JSON.stringify(extra) : ''); if (!cond) process.exitCode = 1; }

(async () => {
  const emailAdminTeste = 'admin-teste-ef+' + Date.now() + '@example.com';
  const senhaAdminTeste = 'SenhaTemp' + Date.now();
  const { data: adminCriado, error: adminCriarErr } = await admin.auth.admin.createUser({
    email: emailAdminTeste, password: senhaAdminTeste, email_confirm: true,
    user_metadata: { nome: 'Admin Teste EF', perfil: 'ADMIN' },
  });
  ok('criar ADMIN temporário (via service_role, direto)', !adminCriarErr && adminCriado, adminCriarErr);
  if (adminCriarErr) return;

  const { data: login, error: loginErr } = await anon.auth.signInWithPassword({ email: emailAdminTeste, password: senhaAdminTeste });
  ok('login como ADMIN temporário', !loginErr, loginErr && loginErr.message);

  let novoId;
  if (!loginErr) {
    const emailTeste = 'teste-edge-fn+' + Date.now() + '@example.com';
    const { data: addRes, error: addErr } = await anon.functions.invoke('gerenciar-usuarios', {
      body: { action: 'addUsuario', data: { EMAIL: emailTeste, NOME: 'Teste Edge Function', SENHA: 'senhaTeste123', PERFIL: 'ANALISTA', USUARIO: 'teste_ef' } }
    });
    ok('addUsuario', !addErr && addRes && addRes.ok, addErr || addRes);
    novoId = addRes && addRes.id;

    if (novoId) {
      const { data: updRes, error: updErr } = await anon.functions.invoke('gerenciar-usuarios', {
        body: { action: 'updateUsuario', data: { id: novoId, ATIVO: 'FALSE' } }
      });
      ok('updateUsuario (desativar)', !updErr && updRes && updRes.ok, updErr || updRes);

      const { data: pwRes, error: pwErr } = await anon.functions.invoke('gerenciar-usuarios', {
        body: { action: 'updatePassword', data: { id: novoId, novaSenha: 'outraSenha456' } }
      });
      ok('updatePassword', !pwErr && pwRes && pwRes.ok, pwErr || pwRes);

      const { data: delRes, error: delErr } = await anon.functions.invoke('gerenciar-usuarios', {
        body: { action: 'deleteUsuario', data: { id: novoId } }
      });
      ok('deleteUsuario (limpeza)', !delErr && delRes && delRes.ok, delErr || delRes);
    }
  }

  // RLS: um ANALISTA de verdade não deveria conseguir usar a função
  await anon.auth.signOut();
  const SNAPSHOT_PATH = 'C:/Users/gusta/AppData/Local/Temp/claude/c--Users-gusta-OneDrive-Documentos-biomassa-gestao-frotas/88c9a751-27aa-4b8a-a2a5-1a4ab15519ea/scratchpad/sheets_snapshot.json';
  const usuariosSheet = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8')).data.usuarios.rows;
  const emailAnalistaTeste = 'analista-teste-ef+' + Date.now() + '@example.com';
  const senhaAnalistaTeste = 'SenhaAnalista' + Date.now();
  const { data: analistaCriado } = await admin.auth.admin.createUser({
    email: emailAnalistaTeste, password: senhaAnalistaTeste, email_confirm: true,
    user_metadata: { nome: 'Analista Teste EF', perfil: 'ANALISTA' },
  });
  await anon.auth.signInWithPassword({ email: emailAnalistaTeste, password: senhaAnalistaTeste });
  const { data: blockedRes, error: blockedErr } = await anon.functions.invoke('gerenciar-usuarios', {
    body: { action: 'addUsuario', data: { EMAIL: 'nao-deveria@example.com', NOME: 'X', SENHA: 'x1234567', PERFIL: 'ANALISTA' } }
  });
  ok('ANALISTA bloqueado de criar usuário', blockedRes && blockedRes.ok === false, blockedRes || blockedErr);
  await anon.auth.signOut();

  // limpeza das contas temporárias
  await admin.auth.admin.deleteUser(adminCriado.user.id);
  if (analistaCriado) await admin.auth.admin.deleteUser(analistaCriado.user.id);
  console.log('contas temporárias de teste removidas.');
})();
