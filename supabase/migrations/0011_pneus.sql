-- Rastreio de pneus por posição (decisões da conversa 2026-08-11):
--   - Tipo de veículo (cavalo/carreta 3/carreta 4 eixos) é cadastrado uma vez na placa,
--     não escolhido a cada lançamento — define qual diagrama de eixos aparece.
--   - O que ativa o diagrama num lançamento é um checkbox no catálogo de tipos
--     ("Controla pneus por posição"), não um nome fixo de tipo.
--   - Uma troca pode mexer em várias posições ao mesmo tempo (manut_pneus_itens).

alter table public.caminhoes add column tipo_veiculo text
  check (tipo_veiculo in ('cavalo','carreta_3_eixos','carreta_4_eixos'));

alter table public.manut_programada add column controla_pneus boolean not null default false;

create table public.manut_pneus_itens (
  id bigint generated always as identity primary key,
  manut_realizada_id bigint not null references public.manut_realizada(id) on delete cascade,
  eixo smallint not null,
  lado text not null check (lado in ('E','D')),
  posicao text check (posicao in ('interna','externa')), -- null quando o eixo é simples (ex: direção do cavalo)
  pneu_removido text,
  pneu_instalado text not null,
  usuario_id uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index manut_pneus_itens_manut_idx on public.manut_pneus_itens (manut_realizada_id);
create index manut_pneus_itens_instalado_idx on public.manut_pneus_itens (pneu_instalado);
create index manut_pneus_itens_removido_idx on public.manut_pneus_itens (pneu_removido);

-- RLS: mesmo padrão de manut_realizada (rls_policies.sql:94-116) — select qualquer
-- logado, insert ADMIN/ANALISTA, update ADMIN ou o próprio ANALISTA, delete só ADMIN.
alter table public.manut_pneus_itens enable row level security;

create policy manut_pneus_itens_select on public.manut_pneus_itens
  for select using (auth.uid() is not null);

create policy manut_pneus_itens_insert on public.manut_pneus_itens
  for insert with check (public.pode_lancar());

create policy manut_pneus_itens_update on public.manut_pneus_itens
  for update using (public.is_admin() or (public.is_analista() and usuario_id = auth.uid()));

create policy manut_pneus_itens_delete on public.manut_pneus_itens
  for delete using (public.is_admin() or (public.is_analista() and usuario_id = auth.uid()));
