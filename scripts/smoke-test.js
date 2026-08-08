// Smoke test da Fase C: simula o que o navegador faria (login por e-mail via
// Supabase Auth, carregar dados, inserir/editar/excluir um lançamento de teste),
// usando a chave ANON (a mesma que o front usa), não a service_role.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const SNAPSHOT_PATH = 'C:/Users/gusta/AppData/Local/Temp/claude/c--Users-gusta-OneDrive-Documentos-biomassa-gestao-frotas/88c9a751-27aa-4b8a-a2a5-1a4ab15519ea/scratchpad/sheets_snapshot.json';
const usuariosSheet = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8')).data.usuarios.rows;
const senhaAdmin = usuariosSheet.find(r => r.USUARIO === 'admin').SENHA;

const sb = createClient(process.env.SUPABASE_URL || 'https://lmkmntkqdlsrajdnyclr.supabase.co', process.env.SUPABASE_ANON_KEY);

function ok(label, cond, extra) { console.log((cond ? '✅' : '❌'), label, extra !== undefined ? JSON.stringify(extra) : ''); if (!cond) process.exitCode = 1; }

(async () => {
  // 1. login
  const { data: loginData, error: loginErr } = await sb.auth.signInWithPassword({ email: 'gustavojmtoledo@gmail.com', password: senhaAdmin });
  ok('login admin', !loginErr && !!loginData.user, loginErr && loginErr.message);
  if (loginErr) return;

  // 2. carregar profile
  const { data: profile, error: profErr } = await sb.from('profiles').select('*').eq('id', loginData.user.id).single();
  ok('perfil carregado', !profErr && profile && profile.perfil === 'ADMIN', profile);

  // 3. contagem cadastro (paginado, deve bater com 4475)
  let total = 0, from = 0;
  while (true) {
    const { data, error } = await sb.from('cadastro').select('id').range(from, from + 999);
    if (error) { ok('paginação cadastro', false, error.message); break; }
    total += data.length;
    if (data.length < 1000) break;
    from += 1000;
  }
  ok('total cadastro via paginação = 4475', total === 4475, total);

  // 4. insert de teste em cadastro (motorista/placa reais já existentes)
  const { data: motoristaAny } = await sb.from('motoristas').select('nome').limit(1).single();
  const { data: placaAny } = await sb.from('caminhoes').select('placa').limit(1).single();
  const { data: inserted, error: insErr } = await sb.from('cadastro').insert({
    motorista: motoristaAny.nome, data: '2026-08-04', placa: placaAny.placa,
    observacao: '__SMOKE_TEST__', usuario_id: loginData.user.id, usuario_nome_legado: 'Gustavo'
  }).select().single();
  ok('insert cadastro teste', !insErr && !!inserted, insErr && insErr.message);

  if (inserted) {
    // 5. valor_total é gerado pelo banco (não deve aceitar valor explícito, deve ficar null aqui)
    ok('valor_total calculado (null pois sem litros/preço)', inserted.valor_total === null, inserted.valor_total);

    // 6. update
    const { data: updated, error: updErr } = await sb.from('cadastro').update({ observacao: '__SMOKE_TEST_EDITADO__' }).eq('id', inserted.id).select().single();
    ok('update cadastro teste', !updErr && updated.observacao === '__SMOKE_TEST_EDITADO__', updErr && updErr.message);

    // 7. delete (limpeza)
    const { error: delErr } = await sb.from('cadastro').delete().eq('id', inserted.id);
    ok('delete cadastro teste (limpeza)', !delErr, delErr && delErr.message);
  }

  // 8. RLS: ANALISTA não deveria conseguir mexer em tabela de domínio (ex: motoristas)
  await sb.auth.signOut();
  const nathaliaSenha = usuariosSheet.find(r => r.USUARIO === 'nathaliabrito').SENHA;
  const { error: loginErr2 } = await sb.auth.signInWithPassword({ email: 'adm.chaparini@gmail.com', password: nathaliaSenha });
  ok('login analista (Nathalia)', !loginErr2, loginErr2 && loginErr2.message);
  const { data: blockedIns, error: blockedErr } = await sb.from('motoristas').insert({ nome: '__SMOKE_TEST_MOTORISTA__' }).select();
  ok('RLS bloqueia ANALISTA inserindo motorista (deve dar erro)', !!blockedErr, blockedErr ? blockedErr.message : blockedIns);

  await sb.auth.signOut();
})();
