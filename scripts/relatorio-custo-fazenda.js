// Relatório Excel de custo por fazenda (transporte + maquinário + folha), com fórmulas vivas.
// Uso: node relatorio-custo-fazenda.js <perfil>   (perfis em PERFIS abaixo)
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const path = require('path');
const fs = require('fs');
const { Client } = require('pg');
const XLSX = require('xlsx');

// motoristas: null = todos que fizeram pelo menos 1 viagem saindo dessas cargas (derivado do banco)
const PERFIS = {
  alvorada: {
    cargas: ['FAZ. ALVORADA', 'FAZ. SANTIAGO'],
    motoristas: ['JOSIMAR RAFAEL','REGINALDO DIAS','RAIMUNDO','HEBERSON','RICARDO FENELON','JULIESLEY'],
    arquivo: 'custo-alvorada-santiago-jul-set-2026.xlsx',
  },
  'novo-acordo': {
    cargas: ['FAZ. NOVO ACORDO'],
    motoristas: null,
    arquivo: 'custo-novo-acordo-jul-set-2026.xlsx',
    // A bomba do tanque parou de registrar as saídas, então o combustível de máquina
    // vem das ENTRADAS no tanque (aba Comboio), adotando que tudo que entrou foi usado.
    tanqueComboio: 'FLORESTA - NOVO ACORDO',
  },
};

const MESES = { '2026-07-01': 'Julho/2026', '2026-08-01': 'Agosto/2026', '2026-09-01': 'Setembro/2026' };
const MESES_ORD = Object.keys(MESES);
const LINHAS_FOLHA_POR_MES = 15;

const FMT = { din: '#,##0.00', qtd: '#,##0.00', int: '0', pct: '0.0%', dinSemZero: '#,##0.00;-#,##0.00;;@' };

// Unidade: ADM PF/ADM LEM sempre M3 (exceção fixa do front), senão locais.unidade
const UNIDADE = `case when c.local_descarga in ('ADM PF','ADM LEM') or l.unidade='M3' then 'M3' else 'TON' end`;

// Floresta efetiva da máquina: floresta_opc do lançamento, senão localização da máquina na data
const florestaEfetiva = (tbl) => `
  coalesce(${tbl}.floresta_opc,
    (select loc.floresta from public.maq_localizacao loc
     where loc.id_maquina = ${tbl}.id_maquina and loc.data_entrada <= ${tbl}.data
     order by loc.data_entrada desc limit 1))`;

// ================= AVALIADOR DE FÓRMULAS =================
// A lib xlsx grava fórmulas mas não calcula. Calculamos aqui para gravar o valor junto
// (a planilha abre certa em qualquer visualizador) e para conferir as referências.
// Suporta só o que este relatório usa: + - * / =, parênteses, SUM(...) e IF(...).
function tokenizar(f) {
  const re = /\s*(?:(?:'((?:[^']|'')+)'!)?([A-Z]+\d+(?::[A-Z]+\d+)?)|(\d+(?:\.\d+)?)|([A-Z]+)\(|([-+*/=(),]))/y;
  const toks = [];
  while (re.lastIndex < f.length) {
    const ini = re.lastIndex;
    const m = re.exec(f);
    if (!m || re.lastIndex === ini) throw new Error(`Fórmula não reconhecida: ${f} (posição ${ini})`);
    if (m[2]) toks.push({ tipo: m[2].includes(':') ? 'intervalo' : 'ref', aba: m[1] ? m[1].replace(/''/g, "'") : null, ref: m[2] });
    else if (m[3]) toks.push({ tipo: 'num', v: Number(m[3]) });
    else if (m[4]) toks.push({ tipo: 'fn', nome: m[4] });
    else toks.push({ tipo: 'op', v: m[5] });
  }
  return toks;
}

function parsear(f) {
  const t = tokenizar(f.trim());
  let i = 0;
  const ehOp = v => t[i] && t[i].tipo === 'op' && t[i].v === v;
  const espera = v => { if (!ehOp(v)) throw new Error(`Esperado "${v}" em ${f}`); i++; };
  const comparacao = () => { const a = soma(); if (ehOp('=')) { i++; return { k: 'bin', op: '=', a, b: soma() }; } return a; };
  const soma = () => { let a = produto(); while (ehOp('+') || ehOp('-')) { const op = t[i++].v; a = { k: 'bin', op, a, b: produto() }; } return a; };
  const produto = () => { let a = unario(); while (ehOp('*') || ehOp('/')) { const op = t[i++].v; a = { k: 'bin', op, a, b: unario() }; } return a; };
  const unario = () => { if (ehOp('-')) { i++; return { k: 'neg', a: unario() }; } return primario(); };
  const primario = () => {
    const tk = t[i++];
    if (!tk) throw new Error(`Fórmula incompleta: ${f}`);
    if (tk.tipo === 'num') return { k: 'num', v: tk.v };
    if (tk.tipo === 'ref' || tk.tipo === 'intervalo') return { k: tk.tipo, aba: tk.aba, ref: tk.ref };
    if (tk.tipo === 'op' && tk.v === '(') { const e = comparacao(); espera(')'); return e; }
    if (tk.tipo === 'fn') {
      const args = [];
      if (!ehOp(')')) { do { args.push(comparacao()); } while (ehOp(',') && ++i); }
      espera(')');
      return { k: 'fn', nome: tk.nome, args };
    }
    throw new Error(`Token inesperado em ${f}`);
  };
  const ast = comparacao();
  if (i !== t.length) throw new Error(`Sobrou texto na fórmula: ${f}`);
  return ast;
}

function calcularPlanilha(wb) {
  const EM_CALCULO = Symbol('em cálculo');
  const memo = new Map();

  const valorCelula = (aba, addr) => {
    const chave = `${aba}!${addr}`;
    if (memo.has(chave)) {
      if (memo.get(chave) === EM_CALCULO) throw new Error(`Referência circular em ${chave}`);
      return memo.get(chave);
    }
    const ws = wb.Sheets[aba];
    if (!ws) throw new Error(`Aba inexistente na fórmula: ${aba}`);
    const cel = ws[addr];
    let v = 0;
    if (cel && cel.f) {
      memo.set(chave, EM_CALCULO);
      v = avaliar(parsear(cel.f), aba, chave);
    } else if (cel && typeof cel.v === 'number') {
      v = cel.v;
    }
    memo.set(chave, v);
    return v;
  };

  const avaliar = (no, aba, onde) => {
    switch (no.k) {
      case 'num': return no.v;
      case 'ref': return valorCelula(no.aba || aba, no.ref);
      case 'neg': return -avaliar(no.a, aba, onde);
      case 'intervalo': throw new Error(`Intervalo fora de SUM em ${onde}`);
      case 'bin': {
        const a = avaliar(no.a, aba, onde), b = avaliar(no.b, aba, onde);
        if (no.op === '=') return a === b ? 1 : 0;
        if (no.op === '+') return a + b;
        if (no.op === '-') return a - b;
        if (no.op === '*') return a * b;
        if (b === 0) throw new Error(`Divisão por zero em ${onde}`);
        return a / b;
      }
      case 'fn':
        if (no.nome === 'IF') return avaliar(no.args[0], aba, onde) ? avaliar(no.args[1], aba, onde) : avaliar(no.args[2], aba, onde);
        if (no.nome === 'SUM') return no.args.reduce((s, arg) => {
          if (arg.k !== 'intervalo') return s + avaliar(arg, aba, onde);
          const r = XLSX.utils.decode_range(arg.ref);
          for (let lin = r.s.r; lin <= r.e.r; lin++)
            for (let col = r.s.c; col <= r.e.c; col++)
              s += valorCelula(arg.aba || aba, XLSX.utils.encode_cell({ r: lin, c: col }));
          return s;
        }, 0);
        throw new Error(`Função não suportada: ${no.nome} em ${onde}`);
    }
  };

  wb.SheetNames.forEach(aba => {
    const ws = wb.Sheets[aba];
    Object.keys(ws).forEach(addr => {
      if (addr[0] === '!' || !ws[addr].f) return;
      ws[addr].v = valorCelula(aba, addr);
      ws[addr].t = 'n';
    });
  });
}

// ================= MONTAGEM DE ABA =================
const num = (v, z) => ({ v: v == null ? 0 : Number(v), z });
const fx = (f, z) => ({ f, z });
const col = i => XLSX.utils.encode_col(i);
const refAba = (aba, c, linha) => `'${aba.replace(/'/g, "''")}'!${c}${linha}`;

function criarAba(linhas, larguraMin = 14) {
  const ws = {};
  linhas.forEach((linha, r) => linha.forEach((cel, c) => {
    if (cel == null || cel === '') return;
    const addr = XLSX.utils.encode_cell({ r, c });
    if (typeof cel === 'object') {
      ws[addr] = { t: 'n', v: cel.v ?? 0 };
      if (cel.f) ws[addr].f = cel.f;
      if (cel.z) ws[addr].z = cel.z;
    } else if (typeof cel === 'number') {
      ws[addr] = { t: 'n', v: cel };
    } else {
      ws[addr] = { t: 's', v: String(cel) };
    }
  }));
  const nCols = linhas[0].length;
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: linhas.length - 1, c: nCols - 1 } });
  ws['!cols'] = linhas[0].map(h => ({ wch: Math.max(larguraMin, String(h).length + 2) }));
  return ws;
}

// Soma de uma coluna num bloco de linhas (1-based, inclusive); bloco vazio vira 0
const somaBloco = (c, ini, fim, z) => (fim >= ini ? fx(`SUM(${c}${ini}:${c}${fim})`, z) : num(0, z));

async function main() {
  const nomePerfil = process.argv[2] || 'alvorada';
  const PERFIL = PERFIS[nomePerfil];
  if (!PERFIL) throw new Error('Perfil inválido. Opções: ' + Object.keys(PERFIS).join(', '));
  const CARGAS = PERFIL.cargas;
  const comboio = Boolean(PERFIL.tanqueComboio);
  const rotuloCargas = CARGAS.map(c => c.replace(/^FAZ\.\s*/, '')).join('+');

  const client = new Client({
    host: process.env.SUPABASE_DB_HOST,
    port: Number(process.env.SUPABASE_DB_PORT || 5432),
    database: process.env.SUPABASE_DB_NAME,
    user: process.env.SUPABASE_DB_USER,
    password: process.env.SUPABASE_DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  let MOTORISTAS = PERFIL.motoristas;
  if (!MOTORISTAS) {
    const { rows } = await client.query(`
      select distinct motorista from public.cadastro
      where local_carga = any($1::text[]) and data >= '2026-07-01' and data < '2026-10-01'
        and quantidade is not null
      order by motorista
    `, [CARGAS]);
    MOTORISTAS = rows.map(r => r.motorista);
    console.log(`Motoristas derivados do banco: ${MOTORISTAS.length}`);
  }

  // ---------- TRANSPORTE: custo total e entregas por motorista/mês ----------
  const transporte = await client.query(`
    with base as (
      select motorista, date_trunc('month', data)::date as mes, quantidade, local_carga,
        coalesce(valor_total,0) as valor_total, coalesce(arla_valor,0) as arla_valor, coalesce(valor_despesa,0) as valor_despesa
      from public.cadastro
      where motorista = any($1::text[]) and data >= '2026-07-01' and data < '2026-10-01'
    )
    select motorista, mes,
      count(*) filter (where quantidade is not null and local_carga = any($2::text[])) as viagens_grupo,
      count(*) filter (where quantidade is not null and not (local_carga = any($2::text[])) and local_carga is not null) as viagens_outras,
      count(*) filter (where quantidade is not null) as viagens_total,
      sum(valor_total) as comb_total, sum(arla_valor) as arla_total, sum(valor_despesa) as desp_total
    from base group by motorista, mes order by mes, motorista
  `, [MOTORISTAS, CARGAS]);

  // ---------- QUANTIDADES: TON x M3 por motorista/mês ----------
  const quantidades = await client.query(`
    select motorista, mes,
      count(*) filter (where unidade='TON') as viagens_ton,
      count(*) filter (where unidade='M3') as viagens_m3,
      coalesce(sum(quantidade) filter (where unidade='TON'),0) as ton,
      coalesce(sum(quantidade) filter (where unidade='M3'),0) as m3
    from (
      select c.motorista, date_trunc('month', c.data)::date as mes, c.quantidade, ${UNIDADE} as unidade
      from public.cadastro c
      left join public.locais l on l.nome = c.local_descarga and l.tipo='descarga'
      where c.motorista = any($1::text[]) and c.local_carga = any($2::text[])
        and c.data >= '2026-07-01' and c.data < '2026-10-01' and c.quantidade is not null
    ) x group by motorista, mes order by mes, motorista
  `, [MOTORISTAS, CARGAS]);

  // ---------- MAQUINÁRIO: abastecimento + manutenção por fazenda/mês ----------
  const maquinario = await client.query(`
    with ab as (
      select ${florestaEfetiva('a')} as floresta, date_trunc('month', a.data)::date as mes,
        count(*) as lancs, sum(a.litros) as litros, sum(a.valor_total) as valor
      from public.maq_abastecimento a
      where a.data >= '2026-07-01' and a.data < '2026-10-01'
      group by 1, 2
    ),
    mn as (
      select ${florestaEfetiva('m')} as floresta, date_trunc('month', m.data)::date as mes,
        count(*) as lancs, sum(m.custo_total) as valor
      from public.maq_manutencao m
      where m.data >= '2026-07-01' and m.data < '2026-10-01'
      group by 1, 2
    )
    select coalesce(ab.floresta, mn.floresta) as floresta, coalesce(ab.mes, mn.mes) as mes,
      coalesce(ab.lancs,0) as abast_lancs, coalesce(ab.litros,0) as litros, coalesce(ab.valor,0) as comb_maquina,
      coalesce(mn.lancs,0) as manut_lancs, coalesce(mn.valor,0) as manut_valor
    from ab full outer join mn on mn.floresta = ab.floresta and mn.mes = ab.mes
    where coalesce(ab.floresta, mn.floresta) = any($1::text[])
    order by mes, floresta
  `, [CARGAS]);

  // ---------- COMBOIO: entradas no tanque da fazenda ----------
  let comboioEntradas = { rows: [] }, comboioCaminhoes = { rows: [] }, comboioDetalhe = { rows: [] };
  if (comboio) {
    comboioEntradas = await client.query(`
      select date_trunc('month', data)::date as mes, count(*) as entradas,
        sum(litros) as litros, sum(valor_total) as valor
      from public.tanque_entradas
      where local_abastecimento = $1 and data >= '2026-07-01' and data < '2026-10-01'
      group by 1 order by 1
    `, [PERFIL.tanqueComboio]);

    // Caminhões que abasteceram nesse tanque COM preço lançado: esse valor já está no custo de
    // transporte (cadastro.valor_total), então precisa ser abatido para não contar duas vezes.
    comboioCaminhoes = await client.query(`
      select date_trunc('month', data)::date as mes,
        coalesce(sum(qtdade_litros) filter (where valor_unitario is not null),0) as litros_com_preco,
        coalesce(sum(valor_total),0) as valor_ja_no_transporte,
        coalesce(sum(qtdade_litros) filter (where valor_unitario is null),0) as litros_sem_preco
      from public.cadastro
      where local_abastecimento = $1 and data >= '2026-07-01' and data < '2026-10-01'
        and qtdade_litros is not null
      group by 1 order by 1
    `, [PERFIL.tanqueComboio]);

    comboioDetalhe = await client.query(`
      select data, tipo_combustivel, litros, preco_litro, valor_total, fornecedor, nota_fiscal
      from public.tanque_entradas
      where local_abastecimento = $1 and data >= '2026-07-01' and data < '2026-10-01'
      order by data
    `, [PERFIL.tanqueComboio]);
  }

  await client.end();

  const keyMes = d => new Date(d).toISOString().slice(0, 10);
  const doMes = (rows, mk) => rows.filter(r => keyMes(r.mes) === mk);
  const ABA = {
    resumo: 'Resumo por Mês',
    transp: 'Transporte por Motorista',
    maq: comboio ? 'Maquinário (bomba)' : 'Maquinário por Fazenda',
    combR: 'Comboio - Resumo',
    combE: 'Comboio - Entradas',
    folha: 'Folha de Pagamento',
    met: 'Metodologia',
  };

  // ---- TRANSPORTE POR MOTORISTA (rateio em fórmula) ----
  // A=Mês B=Motorista C=Entregas carga D=Outras E=Totais F=%rateio G=TON H=M3
  // I/J/K = custo total do mês  L/M/N = rateado (total x %)  O = total rateado
  const tLinhas = [['Mês', 'Motorista', `Entregas ${rotuloCargas}`, 'Entregas outras cargas', 'Entregas totais no mês', '% rateio',
    'Quantidade TON', 'Quantidade M3', 'Combustível total do mês (R$)', 'ARLA total do mês (R$)', 'Despesas total do mês (R$)',
    'Combustível rateado (R$)', 'ARLA rateado (R$)', 'Despesas rateadas (R$)', 'TOTAL RATEADO (R$)']];
  const subTransp = {};
  MESES_ORD.forEach(mk => {
    const ini = tLinhas.length + 1;
    doMes(transporte.rows, mk).filter(r => Number(r.viagens_grupo) > 0).forEach(r => {
      const q = quantidades.rows.find(x => keyMes(x.mes) === mk && x.motorista === r.motorista) || {};
      const n = tLinhas.length + 1;
      tLinhas.push([MESES[mk], r.motorista,
        num(r.viagens_grupo, FMT.int), num(r.viagens_outras, FMT.int), num(r.viagens_total, FMT.int),
        fx(`IF(E${n}=0,0,C${n}/E${n})`, FMT.pct),
        num(q.ton, FMT.qtd), num(q.m3, FMT.qtd),
        num(r.comb_total, FMT.din), num(r.arla_total, FMT.din), num(r.desp_total, FMT.din),
        fx(`I${n}*F${n}`, FMT.din), fx(`J${n}*F${n}`, FMT.din), fx(`K${n}*F${n}`, FMT.din),
        fx(`L${n}+M${n}+N${n}`, FMT.din)]);
    });
    const fim = tLinhas.length;
    subTransp[mk] = fim + 1;
    tLinhas.push(['TOTAL ' + MESES[mk], '',
      somaBloco('C', ini, fim, FMT.int), somaBloco('D', ini, fim, FMT.int), somaBloco('E', ini, fim, FMT.int), '',
      somaBloco('G', ini, fim, FMT.qtd), somaBloco('H', ini, fim, FMT.qtd),
      ...['I', 'J', 'K', 'L', 'M', 'N', 'O'].map(c => somaBloco(c, ini, fim, FMT.din))]);
  });

  // ---- MAQUINÁRIO ----
  // A=Mês B=Fazenda C=Lanç.abast D=Litros E=Combustível F=Lanç.manut G=Manutenção H=Total
  const mLinhas = [['Mês', 'Fazenda', 'Lanç. abastecimento', 'Litros', 'Combustível máquina (R$)', 'Lanç. manutenção', 'Manutenção (R$)', 'TOTAL (R$)']];
  const subMaq = {};
  MESES_ORD.forEach(mk => {
    const ini = mLinhas.length + 1;
    CARGAS.forEach(f => {
      const r = maquinario.rows.find(x => keyMes(x.mes) === mk && x.floresta === f) || {};
      const n = mLinhas.length + 1;
      mLinhas.push([MESES[mk], f, num(r.abast_lancs, FMT.int), num(r.litros, FMT.qtd), num(r.comb_maquina, FMT.din),
        num(r.manut_lancs, FMT.int), num(r.manut_valor, FMT.din), fx(`E${n}+G${n}`, FMT.din)]);
    });
    const fim = mLinhas.length;
    subMaq[mk] = fim + 1;
    mLinhas.push(['TOTAL ' + MESES[mk], '', somaBloco('C', ini, fim, FMT.int), somaBloco('D', ini, fim, FMT.qtd),
      somaBloco('E', ini, fim, FMT.din), somaBloco('F', ini, fim, FMT.int), somaBloco('G', ini, fim, FMT.din), somaBloco('H', ini, fim, FMT.din)]);
  });

  // ---- COMBOIO ----
  // A=Mês B=Tanque C=Nº entradas D=Litros E=Valor F=Preço médio G/H=litros caminhão I=(-)já no transporte J=Líquido
  const cLinhas = [['Mês', 'Tanque', 'Nº de entradas', 'Litros que entraram', 'Valor que entrou (R$)', 'Preço médio (R$/L)',
    'Litros p/ caminhão (com preço lançado)', 'Litros p/ caminhão (sem preço lançado)', '(-) Já contado no transporte (R$)', 'COMBUSTÍVEL MÁQUINA LÍQUIDO (R$)']];
  const linhaComboio = {};
  const eLinhas = [['Data', 'Combustível', 'Litros', 'Preço/L (R$)', 'Valor total (R$)', 'Fornecedor', 'Nota fiscal']];
  if (comboio) {
    MESES_ORD.forEach(mk => {
      const e = comboioEntradas.rows.find(r => keyMes(r.mes) === mk) || {};
      const cam = comboioCaminhoes.rows.find(r => keyMes(r.mes) === mk) || {};
      const n = cLinhas.length + 1;
      linhaComboio[mk] = n;
      cLinhas.push([MESES[mk], PERFIL.tanqueComboio, num(e.entradas, FMT.int), num(e.litros, FMT.qtd), num(e.valor, FMT.din),
        fx(`IF(D${n}=0,0,E${n}/D${n})`, FMT.din), num(cam.litros_com_preco, FMT.qtd), num(cam.litros_sem_preco, FMT.qtd),
        num(cam.valor_ja_no_transporte, FMT.din), fx(`E${n}-I${n}`, FMT.din)]);
    });
    const fim = cLinhas.length, n = fim + 1;
    cLinhas.push(['TOTAL', PERFIL.tanqueComboio, somaBloco('C', 2, fim, FMT.int), somaBloco('D', 2, fim, FMT.qtd), somaBloco('E', 2, fim, FMT.din),
      fx(`IF(D${n}=0,0,E${n}/D${n})`, FMT.din), somaBloco('G', 2, fim, FMT.qtd), somaBloco('H', 2, fim, FMT.qtd),
      somaBloco('I', 2, fim, FMT.din), somaBloco('J', 2, fim, FMT.din)]);

    comboioDetalhe.rows.forEach(r => eLinhas.push([new Date(r.data).toLocaleDateString('pt-BR', { timeZone: 'UTC' }), r.tipo_combustivel,
      num(r.litros, FMT.qtd), num(r.preco_litro, FMT.din), num(r.valor_total, FMT.din), r.fornecedor || '', r.nota_fiscal || '']));
    const fimE = eLinhas.length;
    eLinhas.push(['TOTAL', '', somaBloco('C', 2, fimE, FMT.qtd), '', somaBloco('E', 2, fimE, FMT.din), '', '']);
  }

  // ---- FOLHA DE PAGAMENTO (entrada manual; total da linha e do mês são fórmulas) ----
  // A=Mês B=Fazenda C=Função D=Qtd E=Salários F=Encargos G=Benefícios H=Total I=Obs
  const fLinhas = [['Mês', 'Fazenda / Setor', 'Função', 'Qtd. funcionários', 'Salários (R$)', 'Encargos (R$)', 'Benefícios (R$)', 'TOTAL FOLHA (R$)', 'Observação']];
  const subFolha = {};
  MESES_ORD.forEach(mk => {
    const ini = fLinhas.length + 1;
    for (let k = 0; k < LINHAS_FOLHA_POR_MES; k++) {
      const n = fLinhas.length + 1;
      fLinhas.push([MESES[mk], '', '', '', '', '', '', fx(`E${n}+F${n}+G${n}`, FMT.dinSemZero), '']);
    }
    const fim = fLinhas.length;
    subFolha[mk] = fim + 1;
    fLinhas.push(['TOTAL ' + MESES[mk], '', '', somaBloco('D', ini, fim, FMT.int), somaBloco('E', ini, fim, FMT.din),
      somaBloco('F', ini, fim, FMT.din), somaBloco('G', ini, fim, FMT.din), somaBloco('H', ini, fim, FMT.din), '']);
  });

  // ---- RESUMO POR MÊS (tudo referência às outras abas) ----
  // Custo por unidade só na unidade predominante (por nº de viagens): dividir o custo total pela
  // quantidade da unidade minoritária dá número sem sentido (ex.: 0,03 t de lançamento de depósito)
  const somaViagens = campo => quantidades.rows.reduce((s, r) => s + Number(r[campo]), 0);
  const unidadePrincipal = somaViagens('viagens_m3') >= somaViagens('viagens_ton') ? 'M3' : 'TON';
  const temM3 = unidadePrincipal === 'M3';
  const temTon = unidadePrincipal === 'TON';
  const colunas = [
    ['mes', 'Mês'], ['ent', 'Entregas (viagens)'], ['ton', 'Quantidade TON'], ['m3', 'Quantidade M3'],
    ['comb', 'Combustível caminhão (R$)'], ['arla', 'ARLA (R$)'], ['desp', 'Despesas de viagem (R$)'], ['totT', 'TOTAL TRANSPORTE (R$)'],
    ['litM', 'Litros máquina'],
    ...(comboio ? [['abat', '(-) Abast. caminhão já no transporte (R$)']] : []),
    ['combM', 'Combustível máquina (R$)'], ['manM', 'Manutenção máquina (R$)'], ['totM', 'TOTAL MAQUINÁRIO (R$)'],
    ['folha', 'FOLHA DE PAGAMENTO (R$)'], ['tot', 'CUSTO TOTAL (R$)'], ['pEnt', 'Custo por entrega (R$)'],
    ...(temM3 ? [['pM3', 'Custo por M3 (R$)']] : []),
    ...(temTon ? [['pTon', 'Custo por TON (R$)']] : []),
  ];
  const X = Object.fromEntries(colunas.map(([k], i) => [k, col(i)]));
  const razao = (numer, denom, n) => fx(`IF(${X[denom]}${n}=0,0,${X[numer]}${n}/${X[denom]}${n})`, FMT.din);
  const rLinhas = [colunas.map(c => c[1])];
  MESES_ORD.forEach(mk => {
    const n = rLinhas.length + 1;
    const st = subTransp[mk], sm = subMaq[mk], lc = linhaComboio[mk];
    const cel = {
      mes: MESES[mk],
      ent: fx(refAba(ABA.transp, 'C', st), FMT.int),
      ton: fx(refAba(ABA.transp, 'G', st), FMT.qtd),
      m3: fx(refAba(ABA.transp, 'H', st), FMT.qtd),
      comb: fx(refAba(ABA.transp, 'L', st), FMT.din),
      arla: fx(refAba(ABA.transp, 'M', st), FMT.din),
      desp: fx(refAba(ABA.transp, 'N', st), FMT.din),
      totT: fx(`${X.comb}${n}+${X.arla}${n}+${X.desp}${n}`, FMT.din),
      litM: comboio ? fx(refAba(ABA.combR, 'D', lc), FMT.qtd) : fx(refAba(ABA.maq, 'D', sm), FMT.qtd),
      abat: comboio ? fx(refAba(ABA.combR, 'I', lc), FMT.din) : null,
      combM: comboio ? fx(refAba(ABA.combR, 'J', lc), FMT.din) : fx(refAba(ABA.maq, 'E', sm), FMT.din),
      manM: fx(refAba(ABA.maq, 'G', sm), FMT.din),
      totM: fx(`${X.combM}${n}+${X.manM}${n}`, FMT.din),
      folha: fx(refAba(ABA.folha, 'H', subFolha[mk]), FMT.din),
      tot: fx(`${X.totT}${n}+${X.totM}${n}+${X.folha}${n}`, FMT.din),
      pEnt: razao('tot', 'ent', n),
      pM3: razao('tot', 'm3', n),
      pTon: razao('tot', 'ton', n),
    };
    rLinhas.push(colunas.map(([k]) => cel[k]));
  });
  const nTot = rLinhas.length + 1, fimMeses = rLinhas.length;
  rLinhas.push(colunas.map(([k]) => {
    if (k === 'mes') return 'TOTAL';
    if (k === 'pEnt') return razao('tot', 'ent', nTot);
    if (k === 'pM3') return razao('tot', 'm3', nTot);
    if (k === 'pTon') return razao('tot', 'ton', nTot);
    const z = k === 'ent' ? FMT.int : (k === 'ton' || k === 'm3' || k === 'litM') ? FMT.qtd : FMT.din;
    return somaBloco(X[k], 2, fimMeses, z);
  }));

  // ---- METODOLOGIA ----
  const metodologia = [
    ['Item', 'Descrição'],
    ['Como lançar a folha', `Preencha Salários, Encargos e Benefícios nas linhas do mês na aba "${ABA.folha}". O total da linha, o total do mês e o Resumo (Folha, Custo total e custos unitários) recalculam sozinhos. Se precisar de mais linhas, insira a linha NO MEIO do bloco do mês (acima da linha TOTAL do mês), senão ela fica fora da soma.`],
    ['Período', 'Julho, Agosto e Setembro de 2026'],
    ['Escopo de transporte', `Viagens de ${MOTORISTAS.length} motorista(s) com local de carga = ${CARGAS.join(' ou ')}. ` + (PERFIL.motoristas ? 'Grupo fixo definido manualmente.' : 'Todo motorista com pelo menos 1 viagem saindo dessas cargas no período.')],
    ['Rateio do custo de transporte', `Cada motorista tem custo total no mês (combustível + arla + despesa, todas as rotas). Atribuído a este relatório = custo total x (entregas ${rotuloCargas} / entregas totais do motorista no mês). Na aba "${ABA.transp}" o rateio é fórmula, dá pra conferir linha a linha.`],
    ['Por que o rateio', 'O abastecimento não é lançado a cada viagem (o motorista abastece a cada poucos dias) e os mesmos caminhões rodam outras rotas. Não existe custo por viagem individual no sistema.'],
    ['Unidade TON x M3', 'ADM PF e ADM LEM são sempre M3 (exceção fixa do sistema); demais destinos seguem o campo Unidade do cadastro de locais (vazio = TON).'],
    [`Custo por ${unidadePrincipal}`, `Divide o CUSTO TOTAL pela quantidade em ${unidadePrincipal}, a unidade da maioria das viagens desta operação. As poucas viagens na outra unidade entram no custo mas não na quantidade, então esse valor fica levemente acima do real.`],
    ...(comboio ? [
      ['Combustível de máquina — FONTE', `A bomba do tanque ${PERFIL.tanqueComboio} quebrou e parou de registrar as saídas. Adotado: TODO combustível que ENTROU no tanque no período foi consumido (fonte: aba Comboio / entradas no tanque).`],
      ['Abatimento do caminhão', 'Do valor que entrou no tanque foi abatido o que os caminhões abasteceram ali COM preço lançado, porque esse valor já está no custo de transporte. Sem esse abatimento haveria dupla contagem.'],
      ['Litros de caminhão sem preço', `ATENÇÃO: parte dos abastecimentos de caminhão nesse tanque foi lançada sem preço unitário (valor zerado no custo de transporte). Esses litros ficam dentro do custo de máquina — ver aba "${ABA.combR}".`],
      [`Aba "${ABA.maq}"`, 'O COMBUSTÍVEL dessa aba (registro da bomba) NÃO entra no Resumo — foi substituído pelas entradas do Comboio. A MANUTENÇÃO dessa aba entra normalmente.'],
    ] : []),
    ['Escopo de maquinário', `Abastecimento e manutenção de máquinas alocadas em ${CARGAS.join(' e ')} (100% do valor, sem rateio).`],
    ['Fazenda da máquina', 'Mesma regra da aba Maquinários do sistema: usa a floresta marcada no lançamento; se vazia, usa a localização da máquina naquela data (histórico de transferências).'],
    ['Manutenção subnotificada', 'ATENÇÃO: o módulo de manutenção de máquina é pouco usado (no trimestre inteiro, todas as fazendas, só 5 registros). O custo de maquinário está subestimado.'],
    ['Folha de pagamento', 'Não existe no sistema — preenchimento manual a partir do RH.'],
    ['Gerado em', new Date().toLocaleString('pt-BR')],
  ];

  // ---- MONTA O ARQUIVO ----
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, criarAba(rLinhas), ABA.resumo);
  XLSX.utils.book_append_sheet(wb, criarAba(tLinhas), ABA.transp);
  XLSX.utils.book_append_sheet(wb, criarAba(mLinhas), ABA.maq);
  if (comboio) {
    XLSX.utils.book_append_sheet(wb, criarAba(cLinhas), ABA.combR);
    XLSX.utils.book_append_sheet(wb, criarAba(eLinhas), ABA.combE);
  }
  XLSX.utils.book_append_sheet(wb, criarAba(fLinhas, 16), ABA.folha);
  const wsMet = criarAba(metodologia);
  wsMet['!cols'] = [{ wch: 32 }, { wch: 140 }];
  XLSX.utils.book_append_sheet(wb, wsMet, ABA.met);

  calcularPlanilha(wb);

  // Confere as fórmulas do Resumo contra a conta feita direto nos dados do banco
  const wsR = wb.Sheets[ABA.resumo];
  const lido = (k, n) => wsR[`${X[k]}${n}`].v;
  MESES_ORD.forEach((mk, i) => {
    const n = i + 2;
    let transp = 0, ent = 0;
    doMes(transporte.rows, mk).forEach(r => {
      const razaoMot = Number(r.viagens_total) ? Number(r.viagens_grupo) / Number(r.viagens_total) : 0;
      transp += (Number(r.comb_total) + Number(r.arla_total) + Number(r.desp_total)) * razaoMot;
      ent += Number(r.viagens_grupo);
    });
    const maqMes = doMes(maquinario.rows, mk);
    const manut = maqMes.reduce((s, r) => s + Number(r.manut_valor), 0);
    const combMaq = comboio
      ? Number((comboioEntradas.rows.find(r => keyMes(r.mes) === mk) || {}).valor || 0) - Number((comboioCaminhoes.rows.find(r => keyMes(r.mes) === mk) || {}).valor_ja_no_transporte || 0)
      : maqMes.reduce((s, r) => s + Number(r.comb_maquina), 0);
    const esperado = { ent, totT: transp, totM: combMaq + manut, tot: transp + combMaq + manut };
    Object.entries(esperado).forEach(([k, v]) => {
      if (Math.abs(lido(k, n) - v) > 0.01) throw new Error(`Conferência falhou: ${MESES[mk]} ${k} fórmula=${lido(k, n)} dados=${v}`);
    });
  });

  const outDir = path.join(__dirname, 'exports');
  fs.mkdirSync(outDir, { recursive: true });
  let outPath = path.join(outDir, PERFIL.arquivo);
  try {
    XLSX.writeFile(wb, outPath);
  } catch (e) {
    if (e.code !== 'EBUSY') throw e;
    outPath = outPath.replace(/\.xlsx$/, ' (atualizado).xlsx');
    XLSX.writeFile(wb, outPath);
    console.log(`AVISO: ${PERFIL.arquivo} está aberto no Excel; salvo como "${path.basename(outPath)}"`);
  }
  console.log('Arquivo gerado:', outPath);
  console.table(rLinhas.slice(1).map(linha => Object.fromEntries(colunas.map(([k, h], i) => [h, typeof linha[i] === 'object' && linha[i] ? Math.round(wsR[`${col(i)}${rLinhas.indexOf(linha) + 1}`].v * 100) / 100 : linha[i]]))));
}

if (require.main === module) {
  main().catch(e => { console.error(e.message || e); process.exit(1); });
}

module.exports = { calcularPlanilha };
