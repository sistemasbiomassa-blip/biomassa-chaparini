-- Módulo de Alertas/Lembretes: cadastro livre de lembretes disparados por data
-- ou por km atingido numa placa. Aparece pra todo mundo logado quando a condição
-- bate (checado no front, não aqui); só quem criou (ou ADMIN) pode marcar como
-- concluído/não concluído.
create table public.alertas (
  id uuid primary key default gen_random_uuid(),
  descricao text not null,
  tipo_gatilho text not null check (tipo_gatilho in ('data','km')),
  data_alvo date,
  placa text,
  km_alvo numeric,
  status text not null default 'pendente' check (status in ('pendente','concluido','nao_concluido')),
  motivo_nao_concluido text,
  usuario_id uuid not null references auth.users(id),
  usuario_nome_legado text,
  criado_em timestamptz not null default now(),
  resolvido_em timestamptz,
  constraint alertas_gatilho_valido check (
    (tipo_gatilho = 'data' and data_alvo is not null)
    or (tipo_gatilho = 'km' and placa is not null and km_alvo is not null)
  )
);

-- Qualquer usuário logado pode criar um alerta (não é uma ação de lançamento
-- operacional/financeiro, é um lembrete de utilidade geral). Só o criador ou
-- ADMIN edita (resolve); exclusão só ADMIN, igual ao padrão das outras tabelas.
alter table public.alertas enable row level security;

create policy alertas_select on public.alertas
  for select using (auth.uid() is not null);

create policy alertas_insert on public.alertas
  for insert with check (auth.uid() is not null);

create policy alertas_update on public.alertas
  for update using (public.is_admin() or usuario_id = auth.uid());

create policy alertas_delete on public.alertas
  for delete using (public.is_admin());
