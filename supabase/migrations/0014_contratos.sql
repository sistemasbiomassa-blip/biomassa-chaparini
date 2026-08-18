-- Contratos de entrega: meta de volume por período (mensal ou semanal), vinculada
-- a um Local Descarga. A "quantidade entregue" não é armazenada aqui — é calculada
-- ao vivo no front somando DB.cadastro filtrado por local_descarga + data dentro
-- do período vigente (decisão da conversa: sempre reflete o dado real, sem digitação
-- manual nem risco de ficar desatualizado).
create table public.contratos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  local_descarga text not null,
  periodicidade text not null check (periodicidade in ('mensal','semanal')),
  quantidade_meta numeric not null check (quantidade_meta > 0),
  usuario_id uuid references public.profiles(id),
  usuario_nome_legado text,
  criado_em timestamptz not null default now()
);

-- RLS: leitura pra DIRETOR e ADMIN; escrita só ADMIN (helpers is_admin()/is_diretor()
-- já definidos em rls_policies.sql).
alter table public.contratos enable row level security;

create policy contratos_select on public.contratos
  for select using (public.is_admin() or public.is_diretor());

create policy contratos_insert on public.contratos
  for insert with check (public.is_admin());

create policy contratos_update on public.contratos
  for update using (public.is_admin());

create policy contratos_delete on public.contratos
  for delete using (public.is_admin());
