-- ============================================================
-- BIOMASSA CHAPARINI — Schema Postgres (Supabase)
-- Fase A da migração (Google Sheets -> Supabase)
-- RASCUNHO PARA REVISÃO — nada disso foi aplicado no projeto Supabase ainda.
-- ============================================================

-- ---------- EXTENSÕES ----------
create extension if not exists "pgcrypto";

-- ---------- PERFIS DE USUÁRIO (ligado ao Supabase Auth) ----------
-- Decisão: login via Supabase Auth (não tabela usuarios própria).
-- auth.users já guarda email/senha (hash) e é gerenciado pelo Supabase.
-- profiles guarda o que o app precisa além disso (perfil, nome, status).
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  usuario text unique,              -- login antigo (USUARIO do Sheets), mantido só como referência/exibição
  nome text not null,
  perfil text not null default 'ANALISTA' check (perfil in ('ADMIN','DIRETOR','ANALISTA')),
  ativo boolean not null default true,
  primeiro_acesso boolean not null default true,  -- true = deve trocar a senha no próximo login
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.profiles is 'Dados de perfil/permissão dos usuários, complementando auth.users do Supabase Auth.';

-- ---------- DOMÍNIO: MOTORISTAS ----------
create table public.motoristas (
  id bigint generated always as identity primary key,
  nome text not null unique,
  cpf text,
  cnh text,
  validade_cnh date,
  data_admissao date,
  data_desligamento date,           -- null = ativo; preenchido = inativo (soft delete)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- DOMÍNIO: CAMINHÕES ----------
create table public.caminhoes (
  id bigint generated always as identity primary key,
  placa text not null unique,
  marca text,
  modelo text,
  ano smallint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- DOMÍNIO: LOCAIS ----------
create type public.local_tipo as enum ('carga','descarga','abastecimento','despesa');

create table public.locais (
  id bigint generated always as identity primary key,
  nome text not null unique,
  tipo public.local_tipo not null,
  unidade text check (unidade in ('M3','TON')),  -- só relevante quando tipo='descarga'
  endereco text,
  municipio text,
  estado text,
  latitude double precision,
  longitude double precision,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on column public.locais.unidade is 'M3 ou TON — define a unidade de QUANTIDADE no Cadastro quando este local é usado como Local Descarga. NULL/TON = tonelada.';

-- ---------- DOMÍNIO: CLASSES DE DESPESA ----------
create table public.classes_despesa (
  id bigint generated always as identity primary key,
  nome text not null unique
);

-- ---------- MANUTENÇÃO PROGRAMADA (tipos e regras de alerta) ----------
create table public.manut_programada (
  id bigint generated always as identity primary key,
  tipo_manutencao text not null unique,
  intervalo_km numeric not null,
  alerta_urgente numeric not null,
  alerta_atencao numeric not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (alerta_urgente <= alerta_atencao)
);

-- ---------- MANUTENÇÃO REALIZADA ----------
create table public.manut_realizada (
  id bigint generated always as identity primary key,
  placa text not null references public.caminhoes(placa),
  tipo_manutencao text not null references public.manut_programada(tipo_manutencao),
  data_manutencao date not null,
  km numeric not null,
  observacao text,
  usuario_id uuid references public.profiles(id),
  data_registro timestamptz not null default now()
);
create index manut_realizada_placa_tipo_data_idx
  on public.manut_realizada (placa, tipo_manutencao, data_manutencao desc);

-- ---------- COMBOIO: TANQUES ----------
-- Um tanque por Posto (não por combustível). Diesel e Gasolina de um mesmo
-- Posto dividem o mesmo cadastro físico; o combustível é escolhido em cada
-- Entrada (ver tanque_entradas.tipo_combustivel) e o saldo de cada tipo é
-- calculado no front — Diesel herda saldo_inicial (comportamento histórico),
-- Gasolina começa do zero.
create table public.tanques (
  id bigint generated always as identity primary key,
  local_abastecimento text not null unique references public.locais(nome),
  saldo_inicial numeric not null default 0,
  nivel_minimo numeric not null default 0,
  data_inicio date not null,
  obs text,
  usuario_id uuid references public.profiles(id),
  data_registro timestamptz not null default now()
);

-- ---------- COMBOIO: ENTRADAS NO TANQUE ----------
create table public.tanque_entradas (
  id bigint generated always as identity primary key,
  data date not null,
  local_abastecimento text not null references public.tanques(local_abastecimento),
  tipo_combustivel text not null default 'Diesel' check (tipo_combustivel in ('Diesel','Gasolina')),
  litros numeric not null,
  preco_litro numeric not null,
  valor_total numeric generated always as (round((litros * preco_litro)::numeric, 2)) stored,
  fornecedor text,
  nota_fiscal text,
  obs text,
  usuario_id uuid references public.profiles(id),
  data_registro timestamptz not null default now()
);
create index tanque_entradas_local_data_idx
  on public.tanque_entradas (local_abastecimento, data desc);

-- ---------- MAQUINÁRIOS: MÁQUINAS ----------
create type public.maq_metrica as enum ('HORIMETRO','KM','AMBOS');

create table public.maquinas (
  id bigint generated always as identity primary key,
  identificacao text not null,
  tipo text not null check (tipo in (
    'Harvester','Forwarder','Skidder','Trator','Escavadeira',
    'Caminhão Florestal','Carregadeira','Feller Florestal',
    'Picador Florestal','Apoio Florestal','Outro'
  )),
  marca text,
  modelo text,
  ano smallint,
  serie_patrimonio text,
  metrica public.maq_metrica not null,
  status text not null default 'Ativa' check (status in ('Ativa','Manutenção','Inativa')),
  obs text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- MAQUINÁRIOS: LOCALIZAÇÃO (histórico de transferência) ----------
create table public.maq_localizacao (
  id bigint generated always as identity primary key,
  id_maquina bigint not null references public.maquinas(id) on delete restrict,
  floresta text not null references public.locais(nome),
  data_entrada date not null,
  obs text,
  usuario_id uuid references public.profiles(id),
  data_registro timestamptz not null default now()
);
create index maq_localizacao_maquina_data_idx
  on public.maq_localizacao (id_maquina, data_entrada desc);

-- ---------- MAQUINÁRIOS: ABASTECIMENTO ----------
create table public.maq_abastecimento (
  id bigint generated always as identity primary key,
  data date not null,
  id_maquina bigint not null references public.maquinas(id) on delete restrict,
  horimetro numeric,
  km numeric,
  litros numeric not null,
  preco_litro numeric not null,
  valor_total numeric generated always as (round((litros * preco_litro)::numeric, 2)) stored,
  tipo_combustivel text check (tipo_combustivel in ('Diesel S10','Diesel comum','Gasolina','Arla 32','Outro')),
  tanque_posto text,   -- referência livre ao posto/tanque; sem FK estrita (há valores legados "Interno"/"Externo" que não batem com TANQUES)
  operador text,
  floresta_opc text references public.locais(nome),
  obs text,
  usuario_id uuid references public.profiles(id),
  data_registro timestamptz not null default now()
);
create index maq_abastecimento_maquina_data_idx
  on public.maq_abastecimento (id_maquina, data desc);

-- ---------- MAQUINÁRIOS: MANUTENÇÃO ----------
create table public.maq_manutencao (
  id bigint generated always as identity primary key,
  data date not null,
  id_maquina bigint not null references public.maquinas(id) on delete restrict,
  tipo text not null check (tipo in ('Preventiva','Corretiva')),
  servico text not null,
  horimetro numeric,
  km numeric,
  custo_pecas numeric not null default 0,
  custo_mao_obra numeric not null default 0,
  custo_terceiros numeric not null default 0,
  custo_total numeric generated always as (
    round((custo_pecas + custo_mao_obra + custo_terceiros)::numeric, 2)
  ) stored,
  oficina_fornecedor text,
  floresta_opc text references public.locais(nome),
  obs text,
  usuario_id uuid references public.profiles(id),
  data_registro timestamptz not null default now()
);
create index maq_manutencao_maquina_data_idx
  on public.maq_manutencao (id_maquina, data desc);

-- ---------- FREQUÊNCIA ----------
create type public.freq_codigo as enum ('T','FG','AT','F','FR');

create table public.frequencia (
  id bigint generated always as identity primary key,
  data date not null,
  motorista text not null references public.motoristas(nome),
  codigo public.freq_codigo not null,
  usuario_id uuid references public.profiles(id),
  data_registro timestamptz not null default now(),
  unique (motorista, data)
);

-- ---------- CADASTRO (lançamentos de viagem/produção) ----------
create table public.cadastro (
  id bigint generated always as identity primary key,
  motorista text not null references public.motoristas(nome),
  data date not null,
  situacao text,
  entrega numeric,
  placa text not null references public.caminhoes(placa),
  local_carga text references public.locais(nome),
  local_descarga text references public.locais(nome),
  nota numeric,
  quantidade numeric,
  chegada_floresta time,
  saida_floresta time,
  chegada_cliente time,
  saida_cliente time,
  local_abastecimento text references public.locais(nome),
  km numeric,
  qtdade_litros numeric,
  valor_unitario numeric,
  valor_total numeric generated always as (round((qtdade_litros * valor_unitario)::numeric, 2)) stored,
  arla_valor numeric,
  classe_despesa text references public.classes_despesa(nome),
  descr_despesa text,
  local_despesa text,
  valor_despesa numeric,
  observacao text,
  usuario_id uuid references public.profiles(id),
  -- Decisão registrada: lançamentos legados sem DATA_REGISTRO ficam NULL (não inventar data).
  -- Lançamentos novos: o app/trigger preenche com now() no insert.
  data_registro timestamptz,
  created_at timestamptz not null default now(),
  check ((km is null) = (qtdade_litros is null))  -- KM e Litros: ou os dois, ou nenhum
);

create unique index cadastro_nota_unique on public.cadastro (nota) where nota is not null;
create index cadastro_placa_data_idx on public.cadastro (placa, data);
create index cadastro_motorista_data_idx on public.cadastro (motorista, data);

-- ============================================================
-- TRIGGERS
-- ============================================================

-- ---------- updated_at automático ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_updated_at_profiles      before update on public.profiles      for each row execute function public.set_updated_at();
create trigger trg_updated_at_motoristas    before update on public.motoristas    for each row execute function public.set_updated_at();
create trigger trg_updated_at_caminhoes     before update on public.caminhoes     for each row execute function public.set_updated_at();
create trigger trg_updated_at_locais        before update on public.locais        for each row execute function public.set_updated_at();
create trigger trg_updated_at_manut_prog    before update on public.manut_programada for each row execute function public.set_updated_at();
create trigger trg_updated_at_maquinas      before update on public.maquinas      for each row execute function public.set_updated_at();

-- ---------- data_registro automático em CADASTRO para linhas novas ----------
create or replace function public.set_data_registro_cadastro()
returns trigger language plpgsql as $$
begin
  if new.data_registro is null then
    new.data_registro := now();
  end if;
  return new;
end;
$$;

create trigger trg_set_data_registro_cadastro
before insert on public.cadastro
for each row execute function public.set_data_registro_cadastro();
-- OBS: durante a importação/migração da Fase B, desabilitar esta trigger
-- (ALTER TABLE cadastro DISABLE TRIGGER trg_set_data_registro_cadastro)
-- para preservar NULL nos 709 registros legados sem DATA_REGISTRO.

-- ---------- Validação de sequência de KM por placa+mês (mesma regra hoje no front) ----------
create or replace function public.validar_km_sequencia_cadastro()
returns trigger language plpgsql as $$
declare
  anterior_max numeric;
  posterior_min numeric;
begin
  if new.km is null then
    return new;
  end if;

  select max(km) into anterior_max
  from public.cadastro
  where placa = new.placa
    and date_trunc('month', data) = date_trunc('month', new.data)
    and km is not null
    and data <= new.data
    and id is distinct from new.id;

  if anterior_max is not null then
    if new.km <= anterior_max then
      raise exception 'KM inválido: o último KM da placa % até % é %. Informe um valor maior.',
        new.placa, new.data, anterior_max;
    end if;
    if new.km > anterior_max + 2500 then
      raise exception 'KM inválido: % ultrapassa o limite de 2.500 km acima do último registrado (%).',
        new.km, anterior_max;
    end if;
  end if;

  select min(km) into posterior_min
  from public.cadastro
  where placa = new.placa
    and date_trunc('month', data) = date_trunc('month', new.data)
    and km is not null
    and data > new.data
    and id is distinct from new.id;

  if posterior_min is not null and new.km >= posterior_min then
    raise exception 'KM inválido: já existe um lançamento posterior com KM %. Informe um valor menor.',
      posterior_min;
  end if;

  return new;
end;
$$;

create trigger trg_validar_km_sequencia
before insert or update on public.cadastro
for each row execute function public.validar_km_sequencia_cadastro();
-- OBS: durante a importação da Fase B, também recomendável desabilitar temporariamente
-- (dados legados podem ter inconsistências que precisam de limpeza manual antes,
-- não durante, a carga em massa).

-- ---------- Validação de tipo do local usado em cada campo do CADASTRO ----------
create or replace function public.validar_tipos_locais_cadastro()
returns trigger language plpgsql as $$
begin
  if new.local_carga is not null and not exists (
    select 1 from public.locais where nome = new.local_carga and tipo = 'carga'
  ) then
    raise exception 'Local Carga "%" não está cadastrado como local do tipo carga', new.local_carga;
  end if;

  if new.local_descarga is not null and not exists (
    select 1 from public.locais where nome = new.local_descarga and tipo = 'descarga'
  ) then
    raise exception 'Local Descarga "%" não está cadastrado como local do tipo descarga', new.local_descarga;
  end if;

  if new.local_abastecimento is not null and not exists (
    select 1 from public.locais where nome = new.local_abastecimento and tipo = 'abastecimento'
  ) then
    raise exception 'Local Abastecimento "%" não está cadastrado como local do tipo abastecimento', new.local_abastecimento;
  end if;

  return new;
end;
$$;

create trigger trg_validar_tipos_locais
before insert or update on public.cadastro
for each row execute function public.validar_tipos_locais_cadastro();

-- ============================================================
-- VIEW: saldo atual dos tanques (Comboio)
-- Reproduz o cálculo hoje feito só no front (js/comboio.js):
-- saldo = saldo_inicial + entradas - saídas(maq_abastecimento) - saídas(cadastro)
-- considerando apenas movimentos a partir de tanques.data_inicio
-- ============================================================
create or replace view public.vw_saldo_tanques as
select
  t.id,
  t.local_abastecimento,
  t.saldo_inicial,
  t.nivel_minimo,
  t.data_inicio,
  t.saldo_inicial
    + coalesce((select sum(te.litros) from public.tanque_entradas te
                where te.local_abastecimento = t.local_abastecimento
                  and te.data >= t.data_inicio), 0)
    - coalesce((select sum(ma.litros) from public.maq_abastecimento ma
                where ma.tanque_posto = t.local_abastecimento
                  and ma.data >= t.data_inicio), 0)
    - coalesce((select sum(c.qtdade_litros) from public.cadastro c
                where c.local_abastecimento = t.local_abastecimento
                  and c.data >= t.data_inicio), 0)
    as saldo_atual
from public.tanques t;
