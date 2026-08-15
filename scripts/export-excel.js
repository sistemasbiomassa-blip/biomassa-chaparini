// Exporta todas as tabelas do banco Supabase para um arquivo .xlsx (uma aba por tabela).
// Uso: node scripts/export-excel.js
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const path = require('path');
const fs = require('fs');
const { Client } = require('pg');
const XLSX = require('xlsx');

// Usa o pooler (Supavisor) em vez da conexão direta: tem endereço IPv4,
// enquanto a conexão direta (db.*.supabase.co) só responde em IPv6.
const client = new Client({
  host: 'aws-0-sa-east-1.pooler.supabase.com',
  port: 5432,
  user: 'postgres.lmkmntkqdlsrajdnyclr',
  password: process.env.SUPABASE_DB_PASSWORD,
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
});

(async () => {
  await client.connect();

  const { rows: tables } = await client.query(`
    select table_name from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE'
    order by table_name
  `);

  const workbook = XLSX.utils.book_new();

  for (const { table_name } of tables) {
    const { rows } = await client.query(`select * from "${table_name}"`);
    const sheet = XLSX.utils.json_to_sheet(rows);
    // Nome de aba no Excel tem limite de 31 caracteres
    XLSX.utils.book_append_sheet(workbook, sheet, table_name.slice(0, 31));
    console.log(`✅ ${table_name}: ${rows.length} linhas`);
  }

  await client.end();

  const outDir = path.join(__dirname, 'exports');
  fs.mkdirSync(outDir, { recursive: true });
  const filename = `backup-${new Date().toISOString().slice(0, 10)}.xlsx`;
  const outPath = path.join(outDir, filename);
  XLSX.writeFile(workbook, outPath);
  console.log(`\nArquivo gerado: ${outPath}`);
})();
