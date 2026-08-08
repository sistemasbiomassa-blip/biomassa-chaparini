// Fase B — migração de dados do Google Sheets (via action=all) para o Supabase.
// Idempotente: pode ser rodado várias vezes (upsert por sheet_id/chave natural).
// Uso:
//   node migrate.js            -> busca dados frescos do Sheets e aplica no Supabase
//   node migrate.js --cached   -> usa o snapshot salvo em scratchpad (dev/teste, sem bater no Sheets)
//   node migrate.js --dry-run  -> só mostra o que faria, não escreve nada no Supabase

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const { Client } = require('pg');

const API_URL = 'https://script.google.com/macros/s/AKfycbwCp2fQrVL62TTZfSOzDfGhPHIj3nabLayyrN1ljQ8RYH-TqpsithKX_e1Bw6dQHJFd5A/exec';
const SNAPSHOT_PATH = 'C:/Users/gusta/AppData/Local/Temp/claude/c--Users-gusta-OneDrive-Documentos-biomassa-gestao-frotas/88c9a751-27aa-4b8a-a2a5-1a4ab15519ea/scratchpad/sheets_snapshot.json';

const USE_CACHED = process.argv.includes('--cached');
const DRY_RUN = process.argv.includes('--dry-run');

// ---------- decisões de limpeza confirmadas com o usuário (2026-08-04) ----------
const TANQUE_DATA_INICIO_OVERRIDE = {
  'FLORESTA - FSTG': '2026-01-01',
  'FLORESTA - NOVO ACORDO': '2026-06-01',
  'FLORESTA - ALVORADA': '2026-07-13',
  'FLORESTA - PEDRA FURADA': '2026-06-01',
};
// "ACP MARINOPOLIS" NÃO é local novo — é grafia errada de "ACP MARIANÓPOLIS", que já existia
// cadastrado antes da migração (descoberto em 2026-08-04 durante teste do usuário). Por isso
// não entra mais em LOCAIS_EXTRA_DESCARGA; vira uma normalização de nome, igual DEPOSITO->DEPÓSITO.
const LOCAIS_EXTRA_DESCARGA = ['MASTER BOI SÃO GERALDO PA'];
const LOCAL_CARGA_EXCLUIR_LINHAS = new Set(['FAZ TESTE NOVO']); // dado de teste, não migrar
const LOCAL_DESCARGA_LIMPAR = new Set(['APENAS ABASTECIMENTO']); // não é destino real, só zera o campo
const LOCAL_DESCARGA_RENOMEAR = { 'ACP MARINOPOLIS': 'ACP MARIANÓPOLIS' };

// ---------- helpers ----------
function normalizeAccent(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
}
function nn(v) { return (v === '' || v === undefined) ? null : v; } // vazio -> null
function toText(v) { const s = nn(v); return s === null ? null : String(s).trim(); }
function toNum(v) { const s = nn(v); if (s === null) return null; const n = Number(s); return isNaN(n) ? null : n; }
function parseTime(v) {
  const s = nn(v);
  if (s === null) return null;
  let t = String(s).trim().replace(/;/g, ':').replace(/:+/g, ':');
  const m = t.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  return m ? t : null; // valores tipo "NÃO POSTOU" viram null
}

async function main() {
  const snapshot = USE_CACHED
    ? JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'))
    : await fetch(API_URL + '?action=all').then(r => r.json());
  if (!snapshot.ok) throw new Error('Falha ao buscar dados do Sheets: ' + snapshot.error);
  const d = snapshot.data;

  const client = new Client({
    host: process.env.SUPABASE_DB_HOST,
    port: Number(process.env.SUPABASE_DB_PORT || 5432),
    database: process.env.SUPABASE_DB_NAME,
    user: process.env.SUPABASE_DB_USER,
    password: process.env.SUPABASE_DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const stats = {};
  const q = async (sql, params) => { if (DRY_RUN) return { rows: [] }; return client.query(sql, params); };

  // ================= 1. LOCAIS =================
  {
    let n = 0;
    for (const r of d.locais.rows) {
      const nome = toText(r.NOME);
      if (!nome) continue;
      await q(`
        insert into public.locais (nome, tipo, unidade, endereco, municipio, estado, latitude, longitude)
        values ($1,$2,$3,$4,$5,$6,$7,$8)
        on conflict (nome, tipo) do update set
          unidade=excluded.unidade, endereco=excluded.endereco,
          municipio=excluded.municipio, estado=excluded.estado, latitude=excluded.latitude, longitude=excluded.longitude
      `, [nome, String(r.TIPO || '').toLowerCase().trim(), toText(r.UNIDADE), toText(r['ENDEREÇO'] || r.ENDERECO), toText(r.MUNICIPIO), toText(r.ESTADO), toNum(r.LATITUDE), toNum(r.LONGITUDE)]);
      n++;
    }
    // locais extras confirmados como reais, ausentes do cadastro original (Local Descarga)
    for (const nome of LOCAIS_EXTRA_DESCARGA) {
      await q(`insert into public.locais (nome, tipo) values ($1,'descarga') on conflict (nome, tipo) do nothing`, [nome]);
      n++;
    }
    stats.locais = n;
  }

  // ================= 2. CLASSES_DESPESA =================
  {
    const nomes = [...new Set(d.base.rows.map(r => r['CLASSE DESPESA']).filter(Boolean))];
    for (const nome of nomes) {
      await q(`insert into public.classes_despesa (nome) values ($1) on conflict (nome) do nothing`, [nome]);
    }
    stats.classes_despesa = nomes.length;
  }

  // ================= 3. MOTORISTAS =================
  {
    let n = 0;
    for (const r of d.motoristas.rows) {
      const nome = toText(r.NOME);
      if (!nome) continue;
      await q(`
        insert into public.motoristas (nome, cpf, cnh, validade_cnh, data_admissao, data_desligamento)
        values ($1,$2,$3,$4,$5,$6)
        on conflict (nome) do update set
          cpf=excluded.cpf, cnh=excluded.cnh, validade_cnh=excluded.validade_cnh,
          data_admissao=excluded.data_admissao, data_desligamento=excluded.data_desligamento
      `, [nome, toText(r.CPF), toText(r.CNH), toText(r.VALIDADE_CNH), toText(r.DATA_ADMISSAO), toText(r.DATA_DESLIGAMENTO)]);
      n++;
    }
    stats.motoristas = n;
  }

  // ================= 4. CAMINHOES (+ stubs das 28 placas órfãs) =================
  {
    let n = 0;
    for (const r of d.caminhoes.rows) {
      const placa = toText(r.PLACA);
      if (!placa) continue;
      await q(`
        insert into public.caminhoes (placa, marca, modelo, ano)
        values ($1,$2,$3,$4)
        on conflict (placa) do update set marca=excluded.marca, modelo=excluded.modelo, ano=excluded.ano
      `, [placa, toText(r.MARCA), toText(r.MODELO), toNum(r.ANO)]);
      n++;
    }
    const placasRegistradas = new Set(d.caminhoes.rows.map(r => r.PLACA));
    const placasUsadas = new Set([
      ...d.cadastro.rows.map(r => r.PLACA),
      ...d.manutRealizada.rows.map(r => r.PLACA),
    ].filter(Boolean));
    const orfas = [...placasUsadas].filter(p => !placasRegistradas.has(p));
    for (const placa of orfas) {
      await q(`insert into public.caminhoes (placa) values ($1) on conflict (placa) do nothing`, [placa]);
      n++;
    }
    stats.caminhoes = n;
    stats.caminhoes_orfas_criadas = orfas.length;
  }

  // ================= 5. MANUT_PROGRAMADA =================
  {
    let n = 0;
    for (const r of d.manutProgramada.rows) {
      const tipo = toText(r['TIPO MANUTENÇÃO']);
      if (!tipo) continue;
      await q(`
        insert into public.manut_programada (tipo_manutencao, intervalo_km, alerta_urgente, alerta_atencao)
        values ($1,$2,$3,$4)
        on conflict (tipo_manutencao) do update set
          intervalo_km=excluded.intervalo_km, alerta_urgente=excluded.alerta_urgente, alerta_atencao=excluded.alerta_atencao
      `, [tipo, toNum(r['INTERVALO KM']) || 0, toNum(r['ALERTA URGENTE']) || 0, toNum(r['ALERTA ATENCAO']) || 0]);
      n++;
    }
    stats.manut_programada = n;
  }

  // ================= 6. MANUT_REALIZADA (sem sheet_id confiável -> dedupe manual) =================
  {
    let n = 0, skip = 0;
    for (const r of d.manutRealizada.rows) {
      const placa = toText(r.PLACA), tipo = toText(r.TIPO_MANUTENCAO), data = toText(r['DATA MANUTENÇÃO']), km = toNum(r.KM);
      if (!placa || !tipo || !data || km === null) { skip++; continue; }
      const existe = DRY_RUN ? { rows: [] } : await client.query(
        `select 1 from public.manut_realizada where placa=$1 and tipo_manutencao=$2 and data_manutencao=$3 and km=$4`,
        [placa, tipo, data, km]
      );
      if (existe.rows.length) continue;
      await q(`
        insert into public.manut_realizada (placa, tipo_manutencao, data_manutencao, km, observacao, usuario_nome_legado)
        values ($1,$2,$3,$4,$5,$6)
      `, [placa, tipo, data, km, toText(r['OBSERVAÇÃO']), toText(r.USUARIO)]);
      n++;
    }
    stats.manut_realizada = n;
    stats.manut_realizada_puladas = skip;
  }

  // ================= 7. TANQUES (com override do bug DATA_INICIO) =================
  {
    let n = 0;
    for (const r of d.tanques.rows) {
      const local = toText(r.LOCAL_ABASTECIMENTO);
      if (!local) continue;
      const dataInicio = TANQUE_DATA_INICIO_OVERRIDE[local] || null;
      await q(`
        insert into public.tanques (sheet_id, local_abastecimento, saldo_inicial, nivel_minimo, data_inicio, obs, usuario_nome_legado, data_registro)
        values ($1,$2,$3,$4,$5,$6,$7,$8)
        on conflict (local_abastecimento) do update set
          sheet_id=excluded.sheet_id, saldo_inicial=excluded.saldo_inicial, nivel_minimo=excluded.nivel_minimo,
          data_inicio=excluded.data_inicio, obs=excluded.obs
      `, [toNum(r.ID), local, toNum(r.SALDO_INICIAL) || 0, toNum(r.NIVEL_MINIMO) || 0, dataInicio, toText(r.OBS), toText(r.USUARIO), toText(r.DATA_REGISTRO)]);
      n++;
    }
    stats.tanques = n;
  }

  // ================= 8. TANQUE_ENTRADAS =================
  {
    let n = 0;
    for (const r of d.tanqueEntradas.rows) {
      await q(`
        insert into public.tanque_entradas (sheet_id, data, local_abastecimento, litros, preco_litro, fornecedor, nota_fiscal, obs, usuario_nome_legado, data_registro)
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        on conflict (sheet_id) do update set
          data=excluded.data, litros=excluded.litros, preco_litro=excluded.preco_litro,
          fornecedor=excluded.fornecedor, nota_fiscal=excluded.nota_fiscal, obs=excluded.obs
      `, [toNum(r.ID), toText(r.DATA), toText(r.LOCAL_ABASTECIMENTO), toNum(r.LITROS), toNum(r.PRECO_LITRO), toText(r.FORNECEDOR), toText(r.NOTA_FISCAL), toText(r.OBS), toText(r.USUARIO), toText(r.DATA_REGISTRO)]);
      n++;
    }
    stats.tanque_entradas = n;
  }

  // ================= 9. MAQUINAS =================
  {
    let n = 0;
    for (const r of d.maquinas.rows) {
      await q(`
        insert into public.maquinas (sheet_id, identificacao, tipo, marca, modelo, ano, serie_patrimonio, metrica, status, obs)
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        on conflict (sheet_id) do update set
          identificacao=excluded.identificacao, tipo=excluded.tipo, marca=excluded.marca, modelo=excluded.modelo,
          ano=excluded.ano, serie_patrimonio=excluded.serie_patrimonio, metrica=excluded.metrica, status=excluded.status, obs=excluded.obs
      `, [toNum(r.ID), toText(r.IDENTIFICACAO), toText(r.TIPO), toText(r.MARCA), toText(r.MODELO), toNum(r.ANO), toText(r.SERIE_PATRIMONIO), toText(r.METRICA), toText(r.STATUS) || 'Ativa', toText(r.OBS)]);
      n++;
    }
    stats.maquinas = n;
  }

  // mapa sheet_id(maquina) -> id real no Postgres, pra remapear ID_MAQUINA nas tabelas filhas
  const maquinaIdMap = {};
  if (!DRY_RUN) {
    const rows = (await client.query(`select id, sheet_id from public.maquinas where sheet_id is not null`)).rows;
    rows.forEach(r => { maquinaIdMap[r.sheet_id] = r.id; });
  }

  // ================= 10. MAQ_LOCALIZACAO =================
  {
    let n = 0, semMaquina = 0;
    for (const r of d.maqLocalizacao.rows) {
      const idMaquina = maquinaIdMap[r.ID_MAQUINA];
      if (!DRY_RUN && !idMaquina) { semMaquina++; continue; }
      await q(`
        insert into public.maq_localizacao (sheet_id, id_maquina, floresta, data_entrada, obs, usuario_nome_legado, data_registro)
        values ($1,$2,$3,$4,$5,$6,$7)
        on conflict (sheet_id) do update set
          id_maquina=excluded.id_maquina, floresta=excluded.floresta, data_entrada=excluded.data_entrada, obs=excluded.obs
      `, [toNum(r.ID), idMaquina, toText(r.FLORESTA), toText(r.DATA_ENTRADA), toText(r.OBS), toText(r.USUARIO), toText(r.DATA_REGISTRO)]);
      n++;
    }
    stats.maq_localizacao = n;
    stats.maq_localizacao_sem_maquina = semMaquina;
  }

  // ================= 11. MAQ_ABASTECIMENTO =================
  {
    let n = 0, semMaquina = 0;
    for (const r of d.maqAbastecimento.rows) {
      const idMaquina = maquinaIdMap[r.ID_MAQUINA];
      if (!DRY_RUN && !idMaquina) { semMaquina++; continue; }
      await q(`
        insert into public.maq_abastecimento (sheet_id, data, id_maquina, horimetro, km, litros, preco_litro, tipo_combustivel, tanque_posto, operador, floresta_opc, obs, usuario_nome_legado, data_registro)
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
        on conflict (sheet_id) do update set
          data=excluded.data, id_maquina=excluded.id_maquina, horimetro=excluded.horimetro, km=excluded.km,
          litros=excluded.litros, preco_litro=excluded.preco_litro, tipo_combustivel=excluded.tipo_combustivel,
          tanque_posto=excluded.tanque_posto, operador=excluded.operador, floresta_opc=excluded.floresta_opc, obs=excluded.obs
      `, [toNum(r.ID), toText(r.DATA), idMaquina, toNum(r.HORIMETRO), toNum(r.KM), toNum(r.LITROS), toNum(r.PRECO_LITRO), toText(r.TIPO_COMBUSTIVEL), toText(r.TANQUE_POSTO), toText(r.OPERADOR), toText(r.FLORESTA_OPC), toText(r.OBS), toText(r.USUARIO), toText(r.DATA_REGISTRO)]);
      n++;
    }
    stats.maq_abastecimento = n;
    stats.maq_abastecimento_sem_maquina = semMaquina;
  }

  // ================= 12. MAQ_MANUTENCAO =================
  {
    let n = 0, semMaquina = 0;
    for (const r of d.maqManutencao.rows) {
      const idMaquina = maquinaIdMap[r.ID_MAQUINA];
      if (!DRY_RUN && !idMaquina) { semMaquina++; continue; }
      await q(`
        insert into public.maq_manutencao (sheet_id, data, id_maquina, tipo, servico, horimetro, km, custo_pecas, custo_mao_obra, custo_terceiros, oficina_fornecedor, floresta_opc, obs, usuario_nome_legado, data_registro)
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
        on conflict (sheet_id) do update set
          data=excluded.data, id_maquina=excluded.id_maquina, tipo=excluded.tipo, servico=excluded.servico,
          horimetro=excluded.horimetro, km=excluded.km, custo_pecas=excluded.custo_pecas, custo_mao_obra=excluded.custo_mao_obra,
          custo_terceiros=excluded.custo_terceiros, oficina_fornecedor=excluded.oficina_fornecedor, floresta_opc=excluded.floresta_opc, obs=excluded.obs
      `, [toNum(r.ID), toText(r.DATA), idMaquina, toText(r.TIPO), toText(r.SERVICO), toNum(r.HORIMETRO), toNum(r.KM), toNum(r.CUSTO_PECAS) || 0, toNum(r.CUSTO_MAO_OBRA) || 0, toNum(r.CUSTO_TERCEIROS) || 0, toText(r.OFICINA_FORNECEDOR), toText(r.FLORESTA_OPC), toText(r.OBS), toText(r.USUARIO), toText(r.DATA_REGISTRO)]);
      n++;
    }
    stats.maq_manutencao = n;
    stats.maq_manutencao_sem_maquina = semMaquina;
  }

  // ================= 13. CADASTRO =================
  {
    if (!DRY_RUN) {
      await client.query(`alter table public.cadastro disable trigger trg_set_data_registro_cadastro`);
      await client.query(`alter table public.cadastro disable trigger trg_validar_km_sequencia`);
      await client.query(`alter table public.cadastro disable trigger trg_validar_tipos_locais`);
    }
    let n = 0, excluidas = 0, idsColididos = 0;
    // ID duplicado na planilha de origem (bug do _proximoId em condição de corrida):
    // a 2ª+ ocorrência de um mesmo ID vira uma linha nova estável (ID negativo),
    // em vez de sobrescrever a 1ª ocorrência e perder dado real.
    const seenSheetIds = new Set();
    for (const r of d.cadastro.rows) {
      if (LOCAL_CARGA_EXCLUIR_LINHAS.has(r['LOCAL CARGA'])) { excluidas++; continue; }

      let localCarga = toText(r['LOCAL CARGA']);
      let localDescarga = toText(r['LOCAL DESCARGA']);
      if (localCarga && normalizeAccent(localCarga) === 'DEPOSITO') localCarga = 'DEPÓSITO';
      if (localDescarga && normalizeAccent(localDescarga) === 'DEPOSITO') localDescarga = 'DEPÓSITO';
      if (localDescarga && LOCAL_DESCARGA_RENOMEAR[localDescarga]) localDescarga = LOCAL_DESCARGA_RENOMEAR[localDescarga];
      if (localDescarga && LOCAL_DESCARGA_LIMPAR.has(localDescarga)) localDescarga = null;

      let sheetId = toNum(r.ID);
      if (sheetId !== null) {
        if (seenSheetIds.has(sheetId)) {
          idsColididos++;
          sheetId = -sheetId; // âncora estável e distinta, nunca colide com um ID real do Sheets (sempre positivo)
        } else {
          seenSheetIds.add(sheetId);
        }
      }

      await q(`
        insert into public.cadastro (
          sheet_id, motorista, data, situacao, entrega, placa, local_carga, local_descarga, nota, quantidade,
          chegada_floresta, saida_floresta, chegada_cliente, saida_cliente, local_abastecimento,
          km, qtdade_litros, valor_unitario, arla_valor, classe_despesa, descr_despesa, local_despesa,
          valor_despesa, observacao, usuario_nome_legado, data_registro
        ) values (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26
        )
        on conflict (sheet_id) do update set
          motorista=excluded.motorista, data=excluded.data, situacao=excluded.situacao, entrega=excluded.entrega,
          placa=excluded.placa, local_carga=excluded.local_carga, local_descarga=excluded.local_descarga,
          nota=excluded.nota, quantidade=excluded.quantidade, chegada_floresta=excluded.chegada_floresta,
          saida_floresta=excluded.saida_floresta, chegada_cliente=excluded.chegada_cliente, saida_cliente=excluded.saida_cliente,
          local_abastecimento=excluded.local_abastecimento, km=excluded.km, qtdade_litros=excluded.qtdade_litros,
          valor_unitario=excluded.valor_unitario, arla_valor=excluded.arla_valor, classe_despesa=excluded.classe_despesa,
          descr_despesa=excluded.descr_despesa, local_despesa=excluded.local_despesa, valor_despesa=excluded.valor_despesa,
          observacao=excluded.observacao
      `, [
        sheetId, toText(r.MOTORISTA), toText(r.DATA), toText(r['SITUAÇÃO']), toNum(r.ENTREGA), toText(r.PLACA),
        localCarga, localDescarga, toNum(r.NOTA), toNum(r.QUANTIDADE),
        parseTime(r['CHEGADA FLORESTA']), parseTime(r['SAIDA FLORESTA']), parseTime(r['CHEGADA CLIENTE']), parseTime(r['SAIDA CLIENTE']),
        toText(r['LOCAL ABASTECIMENTO']), toNum(r.KM), toNum(r['QTDADE LITROS']), toNum(r['VALOR UNITARIO']), toNum(r['ARLA VALOR']),
        toText(r['CLASSE DESPESA']), toText(r['DESCR. DESPESA']), toText(r['LOCAL DESPESA']), toNum(r['VALOR DESPESA']),
        toText(r['OBSERVAÇÃO']), toText(r.USUARIO), toText(r.DATA_REGISTRO),
      ]);
      n++;
    }
    if (!DRY_RUN) {
      await client.query(`alter table public.cadastro enable trigger trg_set_data_registro_cadastro`);
      await client.query(`alter table public.cadastro enable trigger trg_validar_km_sequencia`);
      await client.query(`alter table public.cadastro enable trigger trg_validar_tipos_locais`);
    }
    stats.cadastro = n;
    stats.cadastro_excluidas_teste = excluidas;
    stats.cadastro_ids_colididos_recuperados = idsColididos;
  }

  // ================= 14. FREQUENCIA =================
  {
    let n = 0;
    for (const r of d.frequencia.rows) {
      await q(`
        insert into public.frequencia (sheet_id, data, motorista, codigo, usuario_nome_legado, data_registro)
        values ($1,$2,$3,$4,$5,$6)
        on conflict (sheet_id) do update set
          data=excluded.data, motorista=excluded.motorista, codigo=excluded.codigo
      `, [toNum(r.ID), toText(r.DATA), toText(r.MOTORISTA), toText(r.CODIGO), toText(r.USUARIO), toText(r.DATA_REGISTRO)]);
      n++;
    }
    stats.frequencia = n;
  }

  // ================= SINCRONIZAR EXCLUSÕES =================
  // Linhas que existiam no Sheets (têm sheet_id) mas o ID já não está mais lá
  // foram excluídas na fonte -> excluir também no Supabase. Nunca mexe em linhas
  // com sheet_id NULL (criadas direto no Supabase, ex: testes da Fase D).
  {
    const tabelasComSheetId = {
      cadastro: d.cadastro.rows.filter(r => !LOCAL_CARGA_EXCLUIR_LINHAS.has(r['LOCAL CARGA'])).map(r => r.ID),
      tanques: d.tanques.rows.map(r => r.ID),
      tanque_entradas: d.tanqueEntradas.rows.map(r => r.ID),
      maquinas: d.maquinas.rows.map(r => r.ID),
      maq_localizacao: d.maqLocalizacao.rows.map(r => r.ID),
      maq_abastecimento: d.maqAbastecimento.rows.map(r => r.ID),
      maq_manutencao: d.maqManutencao.rows.map(r => r.ID),
      frequencia: d.frequencia.rows.map(r => r.ID),
    };
    stats.excluidos_detectados = {};
    for (const [tabela, idsAtuais] of Object.entries(tabelasComSheetId)) {
      const idsValidos = new Set(idsAtuais.filter(id => id !== undefined && id !== null && id !== '').map(Number));
      if (DRY_RUN) { stats.excluidos_detectados[tabela] = '(pulado no dry-run)'; continue; }
      const existentes = await client.query(`select sheet_id from public.${tabela} where sheet_id is not null and sheet_id > 0`);
      const paraExcluir = existentes.rows.map(r => Number(r.sheet_id)).filter(id => !idsValidos.has(id));
      if (paraExcluir.length) {
        await client.query(`delete from public.${tabela} where sheet_id = any($1::bigint[])`, [paraExcluir]);
      }
      stats.excluidos_detectados[tabela] = paraExcluir.length;
    }
  }

  console.log(DRY_RUN ? '--- DRY RUN (nada foi escrito no Supabase) ---' : '--- MIGRAÇÃO APLICADA ---');
  console.log(stats);
  await client.end();
}

main().catch(e => { console.error('ERRO NA MIGRAÇÃO:', e); process.exit(1); });
