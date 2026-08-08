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

(async () => {
  await c.connect();

  const antes = await c.query(`select id, nome, tipo from public.locais where nome ilike 'ACP MARI%'`);
  console.log('locais encontrados antes:', antes.rows);

  const afetados = await c.query(`select count(*) from public.cadastro where local_descarga = 'ACP MARINOPOLIS'`);
  console.log('lançamentos apontando pro nome errado:', afetados.rows[0].count);

  await c.query(`alter table public.cadastro disable trigger trg_validar_tipos_locais`);

  // Corrige o nome errado usado nos lançamentos
  await c.query(`update public.cadastro set local_descarga = 'ACP MARIANÓPOLIS' where local_descarga = 'ACP MARINOPOLIS'`);

  // Renomeia (ou cria, se por algum motivo não existir) o local correto e remove o errado
  const existeCerto = await c.query(`select id from public.locais where nome = 'ACP MARIANÓPOLIS' and tipo = 'descarga'`);
  if (existeCerto.rows.length) {
    await c.query(`delete from public.locais where nome = 'ACP MARINOPOLIS' and tipo = 'descarga'`);
  } else {
    await c.query(`update public.locais set nome = 'ACP MARIANÓPOLIS' where nome = 'ACP MARINOPOLIS' and tipo = 'descarga'`);
  }

  await c.query(`alter table public.cadastro enable trigger trg_validar_tipos_locais`);

  const depois = await c.query(`select id, nome, tipo from public.locais where nome ilike 'ACP MARI%'`);
  console.log('locais depois da correção:', depois.rows);
  const aindaErrado = await c.query(`select count(*) from public.cadastro where local_descarga = 'ACP MARINOPOLIS'`);
  console.log('lançamentos ainda com nome errado (deve ser 0):', aindaErrado.rows[0].count);

  await c.end();
})();
