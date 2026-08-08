// Compara agregados-chave entre o Sheets (fonte real) e o Supabase (cópia em teste),
// pra pegar qualquer divergência de número/cálculo sem depender só de teste manual na tela.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Client } = require('pg');

const API_URL = 'https://script.google.com/macros/s/AKfycbwCp2fQrVL62TTZfSOzDfGhPHIj3nabLayyrN1ljQ8RYH-TqpsithKX_e1Bw6dQHJFd5A/exec';
const EXCLUIR_LOCAL_CARGA = new Set(['FAZ TESTE NOVO']); // mesma exclusão da migração (dado de teste)

function round2(n) { n = Number(n) || 0; return Math.round((n + Number.EPSILON) * 100) / 100; }
function cmp(label, a, b, tol) {
  tol = tol === undefined ? 0.01 : tol;
  var okFlag = Math.abs((a || 0) - (b || 0)) <= tol;
  console.log((okFlag ? '✅' : '❌'), label, '| sheets:', a, '| supabase:', b, okFlag ? '' : '  <<< DIVERGÊNCIA');
  return okFlag;
}

(async () => {
  const snap = await fetch(API_URL + '?action=all').then(r => r.json());
  if (!snap.ok) { console.error('Falha ao buscar Sheets:', snap.error); process.exit(1); }
  const d = snap.data;

  const c = new Client({
    host: process.env.SUPABASE_DB_HOST, port: Number(process.env.SUPABASE_DB_PORT || 5432),
    database: process.env.SUPABASE_DB_NAME, user: process.env.SUPABASE_DB_USER,
    password: process.env.SUPABASE_DB_PASSWORD, ssl: { rejectUnauthorized: false },
  });
  await c.connect();

  let tudoOk = true;

  // ---------- CADASTRO ----------
  const cadValidas = d.cadastro.rows.filter(r => !EXCLUIR_LOCAL_CARGA.has(r['LOCAL CARGA']));
  const sSum = (arr, key) => arr.reduce((a, r) => a + (Number(r[key]) || 0), 0);

  tudoOk &= cmp('CADASTRO: total de linhas (excluindo teste)', cadValidas.length,
    (await c.query('select count(*) from public.cadastro')).rows[0].count * 1, 0);
  tudoOk &= cmp('CADASTRO: soma QUANTIDADE', round2(sSum(cadValidas, 'QUANTIDADE')),
    round2((await c.query('select coalesce(sum(quantidade),0) v from public.cadastro')).rows[0].v), 1);
  tudoOk &= cmp('CADASTRO: soma QTDADE LITROS', round2(sSum(cadValidas, 'QTDADE LITROS')),
    round2((await c.query('select coalesce(sum(qtdade_litros),0) v from public.cadastro')).rows[0].v), 1);
  tudoOk &= cmp('CADASTRO: soma VALOR TOTAL (combustível)', round2(sSum(cadValidas, 'VALOR TOTAL')),
    round2((await c.query('select coalesce(sum(valor_total),0) v from public.cadastro')).rows[0].v), 1);
  tudoOk &= cmp('CADASTRO: soma ARLA VALOR', round2(sSum(cadValidas, 'ARLA VALOR')),
    round2((await c.query('select coalesce(sum(arla_valor),0) v from public.cadastro')).rows[0].v), 1);
  tudoOk &= cmp('CADASTRO: soma VALOR DESPESA', round2(sSum(cadValidas, 'VALOR DESPESA')),
    round2((await c.query('select coalesce(sum(valor_despesa),0) v from public.cadastro')).rows[0].v), 1);
  tudoOk &= cmp('CADASTRO: quantidade de NOTAs preenchidas', cadValidas.filter(r => r.NOTA).length,
    (await c.query("select count(*) from public.cadastro where nota is not null")).rows[0].count * 1, 0);

  // por mês (QUANTIDADE) - pega os últimos 6 meses com dado
  const porMesSheets = {};
  cadValidas.forEach(r => { if (r.DATA && r.QUANTIDADE) { var m = r.DATA.slice(0, 7); porMesSheets[m] = (porMesSheets[m] || 0) + Number(r.QUANTIDADE); } });
  const porMesSupa = (await c.query("select to_char(data,'YYYY-MM') m, coalesce(sum(quantidade),0) v from public.cadastro group by 1")).rows;
  const mapSupa = {}; porMesSupa.forEach(r => { mapSupa[r.m] = Number(r.v); });
  Object.keys(porMesSheets).sort().forEach(m => { tudoOk &= cmp('QUANTIDADE em ' + m, round2(porMesSheets[m]), round2(mapSupa[m] || 0), 1); });

  // ---------- DOMÍNIO ----------
  tudoOk &= cmp('MOTORISTAS: total', d.motoristas.rows.length, (await c.query('select count(*) from public.motoristas')).rows[0].count * 1, 0);
  tudoOk &= cmp('CAMINHOES: total (Sheets originais, sem contar as 28 órfãs criadas)', d.caminhoes.rows.length,
    (await c.query('select count(*) from public.caminhoes')).rows[0].count * 1 - 28, 0);

  // ---------- MAQ_ABASTECIMENTO ----------
  tudoOk &= cmp('MAQ_ABASTECIMENTO: soma LITROS', round2(sSum(d.maqAbastecimento.rows, 'LITROS')),
    round2((await c.query('select coalesce(sum(litros),0) v from public.maq_abastecimento')).rows[0].v), 1);
  tudoOk &= cmp('MAQ_ABASTECIMENTO: soma VALOR_TOTAL', round2(sSum(d.maqAbastecimento.rows, 'VALOR_TOTAL')),
    round2((await c.query('select coalesce(sum(valor_total),0) v from public.maq_abastecimento')).rows[0].v), 1);

  // ---------- TANQUE_ENTRADAS ----------
  tudoOk &= cmp('TANQUE_ENTRADAS: soma LITROS', round2(sSum(d.tanqueEntradas.rows, 'LITROS')),
    round2((await c.query('select coalesce(sum(litros),0) v from public.tanque_entradas')).rows[0].v), 1);

  // ---------- FREQUENCIA por código ----------
  const codigos = ['T', 'FG', 'AT', 'F', 'FR'];
  for (const cod of codigos) {
    const nSheets = d.frequencia.rows.filter(r => r.CODIGO === cod).length;
    const nSupa = (await c.query('select count(*) from public.frequencia where codigo=$1', [cod])).rows[0].count * 1;
    tudoOk &= cmp('FREQUENCIA código ' + cod, nSheets, nSupa, 0);
  }

  // ---------- SALDO DOS TANQUES (view vs cálculo replicado do front) ----------
  console.log('\n--- Saldo dos tanques (view vw_saldo_tanques) ---');
  const saldos = await c.query('select local_abastecimento, saldo_atual from public.vw_saldo_tanques order by local_abastecimento');
  saldos.rows.forEach(r => console.log('  ', r.local_abastecimento, '->', r.saldo_atual));

  await c.end();
  console.log('\n' + (tudoOk ? '✅ TUDO BATEU' : '❌ EXISTEM DIVERGÊNCIAS — ver acima'));
  process.exitCode = tudoOk ? 0 : 1;
})();
