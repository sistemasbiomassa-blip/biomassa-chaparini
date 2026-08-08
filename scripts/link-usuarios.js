// Liga usuario_id aos registros históricos cujo usuario_nome_legado bate com o
// nome de um perfil migrado (Fase B - usuários). Casamento por nome exato (trim).
// Registros cujo usuário não foi migrado (ex: José da Silva, João Gemelli) ficam
// sem usuario_id, mas mantêm usuario_nome_legado preservado.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Client } = require('pg');
const c = new Client({
  host: process.env.SUPABASE_DB_HOST,
  port: Number(process.env.SUPABASE_DB_PORT || 5432),
  database: process.env.SUPABASE_DB_NAME,
  user: process.env.SUPABASE_DB_USER,
  password: process.env.SUPABASE_DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
});

const TABELAS = ['cadastro', 'manut_realizada', 'maq_localizacao', 'maq_abastecimento', 'maq_manutencao', 'tanques', 'tanque_entradas', 'frequencia'];

(async () => {
  await c.connect();
  await c.query(`alter table public.cadastro disable trigger trg_validar_km_sequencia`);
  await c.query(`alter table public.cadastro disable trigger trg_validar_tipos_locais`);
  for (const t of TABELAS) {
    const r = await c.query(`
      update public.${t} tbl
      set usuario_id = p.id
      from public.profiles p
      where trim(tbl.usuario_nome_legado) = trim(p.nome)
        and tbl.usuario_id is distinct from p.id
    `);
    console.log(t, '-> usuario_id atualizado em', r.rowCount, 'linhas');
  }
  await c.query(`alter table public.cadastro enable trigger trg_validar_km_sequencia`);
  await c.query(`alter table public.cadastro enable trigger trg_validar_tipos_locais`);
  await c.end();
})();
