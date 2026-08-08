require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Client } = require('pg');

const API_URL = 'https://script.google.com/macros/s/AKfycbwCp2fQrVL62TTZfSOzDfGhPHIj3nabLayyrN1ljQ8RYH-TqpsithKX_e1Bw6dQHJFd5A/exec';

(async () => {
  const snap = await fetch(API_URL + '?action=all').then(r => r.json());
  const cad = snap.data.cadastro.rows;

  const c = new Client({
    host: process.env.SUPABASE_DB_HOST, port: Number(process.env.SUPABASE_DB_PORT || 5432),
    database: process.env.SUPABASE_DB_NAME, user: process.env.SUPABASE_DB_USER,
    password: process.env.SUPABASE_DB_PASSWORD, ssl: { rejectUnauthorized: false },
  });
  await c.connect();
  const supaRows = (await c.query('select sheet_id, qtdade_litros, valor_unitario, valor_total, nota from public.cadastro where sheet_id is not null')).rows;
  const supaById = {}; supaRows.forEach(r => { supaById[r.sheet_id] = r; });

  // ---- VALOR TOTAL: achar as maiores divergências por linha ----
  const diffs = [];
  cad.forEach(r => {
    const s = supaById[r.ID];
    if (!s) return;
    const vSheets = Number(r['VALOR TOTAL']) || 0;
    const vSupa = Number(s.valor_total) || 0;
    const diff = vSheets - vSupa;
    if (Math.abs(diff) > 0.02) {
      diffs.push({ ID: r.ID, MOTORISTA: r.MOTORISTA, DATA: r.DATA, litros: r['QTDADE LITROS'], valorUnit: r['VALOR UNITARIO'], vSheets, vSupa, diff });
    }
  });
  diffs.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
  console.log('Linhas com VALOR TOTAL divergente:', diffs.length, '| soma das diferenças:', diffs.reduce((a, d) => a + d.diff, 0).toFixed(2));
  console.log(JSON.stringify(diffs.slice(0, 15), null, 1));

  // ---- NOTA: quais sheet_ids têm NOTA num lado e não no outro ----
  console.log('\n--- NOTA: diferenças ---');
  const notaSheets = new Set(cad.filter(r => r.NOTA).map(r => String(r.ID)));
  const notaSupaSomenteReal = supaRows.filter(r => r.nota !== null).map(r => String(r.sheet_id));
  const notaSupaSet = new Set(notaSupaSomenteReal);
  const soSheets = [...notaSheets].filter(id => !notaSupaSet.has(id));
  const soSupa = [...notaSupaSet].filter(id => !notaSheets.has(id));
  console.log('tem NOTA só no Sheets (ID):', soSheets);
  console.log('tem NOTA só no Supabase (ID):', soSupa);

  await c.end();
})();
