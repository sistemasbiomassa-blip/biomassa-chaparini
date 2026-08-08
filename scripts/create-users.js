// Cria as contas reais no Supabase Auth (Fase B - usuários), preservando a senha
// atual de cada pessoa. Perfil/nome vão como user_metadata; a trigger
// trg_handle_new_auth_user (rls_policies.sql) cria a linha em public.profiles
// automaticamente com primeiro_acesso=true (força troca de senha no próximo login).
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');

const SNAPSHOT_PATH = 'C:/Users/gusta/AppData/Local/Temp/claude/c--Users-gusta-OneDrive-Documentos-biomassa-gestao-frotas/88c9a751-27aa-4b8a-a2a5-1a4ab15519ea/scratchpad/sheets_snapshot.json';
const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'));
const usuariosSheet = snapshot.data.usuarios.rows;

function senhaDe(usuario) {
  const linhas = usuariosSheet.filter(r => r.USUARIO === usuario);
  // fernandoabreu tem 2 linhas (duplicata) — usar a ativa (ATIVO=TRUE)
  const linha = linhas.find(r => r.ATIVO === 'TRUE') || linhas[0];
  return linha ? linha.SENHA : null;
}

// Decisões confirmadas com o usuário em 2026-08-04:
// - "analista"/José da Silva: excluído
// - "joaogemelli": desativado, sem e-mail informado -> não cria conta Auth
// - "fernandoabreu": usar a linha ativa (duplicata resolvida)
const USUARIOS_MIGRAR = [
  { usuario: 'admin', email: 'gustavojmtoledo@gmail.com', nome: 'Gustavo', perfil: 'ADMIN' },
  { usuario: 'marcosvinicios', email: 'marcos.biomassachaparini@gmail.com', nome: 'Marcos Vinicios de Oliveira', perfil: 'ANALISTA' },
  { usuario: 'nathaliabrito', email: 'adm.chaparini@gmail.com', nome: 'Nathalia Brito', perfil: 'ANALISTA' },
  { usuario: 'fernandoabreu', email: 'rhbiomassachaparini@gmail.com', nome: 'Fernando Abreu', perfil: 'ANALISTA' },
  { usuario: 'mariaeduarda', email: 'chaparinimariaeduarda@gmail.com', nome: 'Maria Eduarda', perfil: 'ANALISTA' },
  { usuario: 'brunomacedo', email: 'brunomacedomota.1@gmail.com', nome: 'Bruno Macedo', perfil: 'ANALISTA' },
];

const ADMIN_URL = process.env.SUPABASE_PROJECT_URL + '/auth/v1/admin/users';
const HEADERS = {
  apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  Authorization: 'Bearer ' + process.env.SUPABASE_SERVICE_ROLE_KEY,
  'Content-Type': 'application/json',
};

(async () => {
  const resultados = [];
  for (const u of USUARIOS_MIGRAR) {
    const senha = senhaDe(u.usuario);
    if (!senha) { resultados.push({ usuario: u.usuario, ok: false, erro: 'senha não encontrada no snapshot' }); continue; }

    const resp = await fetch(ADMIN_URL, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({
        email: u.email,
        password: senha,
        email_confirm: true,
        user_metadata: { nome: u.nome, perfil: u.perfil },
      }),
    });
    const body = await resp.json();
    if (!resp.ok) {
      resultados.push({ usuario: u.usuario, email: u.email, ok: false, status: resp.status, erro: body.msg || body.message || JSON.stringify(body) });
    } else {
      resultados.push({ usuario: u.usuario, email: u.email, ok: true, id: body.id });
    }
  }
  console.log(JSON.stringify(resultados, null, 2));
})();
