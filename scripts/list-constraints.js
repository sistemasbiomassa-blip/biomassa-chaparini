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
c.connect().then(async () => {
  const r = await c.query("select conname, pg_get_constraintdef(oid) as def from pg_constraint where conrelid='public.cadastro'::regclass");
  console.log(r.rows);
  const idx = await c.query("select indexname, indexdef from pg_indexes where tablename='cadastro'");
  console.log(idx.rows);
  await c.end();
});
