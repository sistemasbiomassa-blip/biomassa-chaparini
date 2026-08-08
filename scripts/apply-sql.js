// Aplica um arquivo .sql direto no Postgres do Supabase, usando a connection string do .env.
// Uso: node scripts/apply-sql.js ../supabase/schema.sql
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const fileArg = process.argv[2];
if (!fileArg) {
  console.error('Uso: node apply-sql.js <caminho-do-arquivo.sql>');
  process.exit(1);
}
const sqlPath = path.resolve(__dirname, fileArg);
const sql = fs.readFileSync(sqlPath, 'utf8');

const client = new Client({
  host: process.env.SUPABASE_DB_HOST,
  port: Number(process.env.SUPABASE_DB_PORT || 5432),
  database: process.env.SUPABASE_DB_NAME,
  user: process.env.SUPABASE_DB_USER,
  password: process.env.SUPABASE_DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
});

(async () => {
  try {
    await client.connect();
    console.log('Conectado. Aplicando:', sqlPath);
    await client.query(sql);
    console.log('OK — aplicado com sucesso.');
  } catch (err) {
    console.error('ERRO ao aplicar SQL:', err.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
})();
