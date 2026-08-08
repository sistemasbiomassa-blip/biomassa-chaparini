-- ============================================================
-- BIOMASSA CHAPARINI — Row Level Security (Supabase)
-- Fase A da migração — RASCUNHO PARA REVISÃO, aplicar depois de schema.sql
-- Reproduz a matriz de permissões hoje verificada só no front (js/*.js),
-- agora garantida no banco também.
--
-- Matriz de perfis (confirmada em 2026-08-03):
--   ADMIN    -> acesso total em tudo (select/insert/update/delete)
--   ANALISTA -> lança dados; só edita/exclui os próprios registros; nunca gerencia
--               tabelas de domínio (motoristas/caminhões/locais/máquinas/manutenção programada)
--   DIRETOR  -> leitura em TUDO, sem exceção (inclusive FREQUENCIA — diferente do front atual,
--               que hoje esconde esse módulo dele; corrigido a pedido do usuário).
--               Em CADASTRO tem exceções extras confirmadas pelo usuário: pode INSERIR,
--               e pode EDITAR (só os próprios lançamentos, igual ANALISTA) — mas NUNCA exclui.
-- ============================================================

-- ---------- FUNÇÕES AUXILIARES ----------
create or replace function public.current_perfil()
returns text language sql stable security definer set search_path = public as $$
  select perfil from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean language sql stable as $$
  select public.current_perfil() = 'ADMIN';
$$;

create or replace function public.is_analista()
returns boolean language sql stable as $$
  select public.current_perfil() = 'ANALISTA';
$$;

create or replace function public.is_diretor()
returns boolean language sql stable as $$
  select public.current_perfil() = 'DIRETOR';
$$;

-- "lança" = pode inserir nos módulos operacionais (ADMIN ou ANALISTA)
create or replace function public.pode_lancar()
returns boolean language sql stable as $$
  select public.is_admin() or public.is_analista();
$$;

-- ---------- PROFILES ----------
alter table public.profiles enable row level security;

create policy profiles_select on public.profiles
  for select using (public.is_admin() or id = auth.uid());

create policy profiles_update on public.profiles
  for update using (public.is_admin() or id = auth.uid());

create policy profiles_delete on public.profiles
  for delete using (public.is_admin());

-- Inserção de profiles é feita via trigger automático em auth.users
-- (ver seção "NOVO USUÁRIO" abaixo), não via insert direto do client.
create policy profiles_insert on public.profiles
  for insert with check (public.is_admin());

-- Impede que ANALISTA/DIRETOR alterem o próprio perfil/status (só campos "de si mesmo" inofensivos)
create or replace function public.prevent_self_privilege_escalation()
returns trigger language plpgsql as $$
begin
  if not public.is_admin() then
    if new.perfil is distinct from old.perfil or new.ativo is distinct from old.ativo then
      raise exception 'Apenas ADMIN pode alterar perfil ou status ativo/inativo.';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_prevent_self_privilege_escalation
before update on public.profiles
for each row execute function public.prevent_self_privilege_escalation();

-- ---------- TABELAS DE DOMÍNIO (gestão só por ADMIN, leitura por todos logados) ----------
-- motoristas, caminhoes, locais, classes_despesa, manut_programada, maquinas
do $$
declare
  tbl text;
begin
  foreach tbl in array array['motoristas','caminhoes','locais','classes_despesa','manut_programada','maquinas']
  loop
    execute format('alter table public.%I enable row level security', tbl);
    execute format('create policy %I_select on public.%I for select using (auth.uid() is not null)', tbl, tbl);
    execute format('create policy %I_insert on public.%I for insert with check (public.is_admin())', tbl, tbl);
    execute format('create policy %I_update on public.%I for update using (public.is_admin())', tbl, tbl);
    execute format('create policy %I_delete on public.%I for delete using (public.is_admin())', tbl, tbl);
  end loop;
end $$;

-- ---------- MANUT_REALIZADA / COMBOIO (TANQUES, TANQUE_ENTRADAS) / MAQUINÁRIOS (LOCALIZAÇÃO, ABASTECIMENTO, MANUTENÇÃO) ----------
-- Padrão comum: leitura por todos logados; insere ADMIN ou ANALISTA;
-- edita ADMIN ou o próprio ANALISTA que lançou (usuario_id); exclui só ADMIN.
do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'manut_realizada',
    'tanques','tanque_entradas',
    'maq_localizacao','maq_abastecimento','maq_manutencao'
  ]
  loop
    execute format('alter table public.%I enable row level security', tbl);
    execute format('create policy %I_select on public.%I for select using (auth.uid() is not null)', tbl, tbl);
    execute format('create policy %I_insert on public.%I for insert with check (public.pode_lancar())', tbl, tbl);
    execute format(
      'create policy %I_update on public.%I for update using (public.is_admin() or (public.is_analista() and usuario_id = auth.uid()))',
      tbl, tbl
    );
    execute format('create policy %I_delete on public.%I for delete using (public.is_admin())', tbl, tbl);
  end loop;
end $$;

-- ---------- FREQUENCIA ----------
-- DIRETOR tem leitura aqui também (diferente do comportamento atual do front, que hoje
-- esconde este módulo dele via classe .freq-visible — corrigido a pedido do usuário).
-- Sem restrição de "dono" na edição — o app grava em lote (saveFrequenciaMes) e sempre
-- permitiu ADMIN/ANALISTA sobrescreverem qualquer marcação, não só a própria.
alter table public.frequencia enable row level security;

create policy frequencia_select on public.frequencia
  for select using (auth.uid() is not null);

create policy frequencia_insert on public.frequencia
  for insert with check (public.pode_lancar());

create policy frequencia_update on public.frequencia
  for update using (public.pode_lancar());

create policy frequencia_delete on public.frequencia
  for delete using (public.pode_lancar());

-- ---------- CADASTRO ----------
-- Exceções confirmadas pelo usuário para DIRETOR:
--   - PODE inserir
--   - PODE editar, mas só os próprios lançamentos (usuario_id = auth.uid()), igual ANALISTA
--   - NUNCA exclui (exclusão continua só ADMIN)
--   - Mantém acesso de leitura a tudo, inclusive Histórico
alter table public.cadastro enable row level security;

create policy cadastro_select on public.cadastro
  for select using (auth.uid() is not null);

create policy cadastro_insert on public.cadastro
  for insert with check (public.is_admin() or public.is_analista() or public.is_diretor());

create policy cadastro_update on public.cadastro
  for update using (
    public.is_admin()
    or (public.is_analista() and usuario_id = auth.uid())
    or (public.is_diretor() and usuario_id = auth.uid())
  );

create policy cadastro_delete on public.cadastro
  for delete using (public.is_admin());

-- ============================================================
-- NOVO USUÁRIO: cria profile automaticamente quando alguém é criado em auth.users
-- (usado no script de migração de usuários da Fase B, via API admin do Supabase)
-- ============================================================
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nome, perfil, ativo, primeiro_acesso)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nome', new.email),
    coalesce(new.raw_user_meta_data ->> 'perfil', 'ANALISTA'),
    true,
    true
  );
  return new;
end;
$$;

create trigger trg_handle_new_auth_user
after insert on auth.users
for each row execute function public.handle_new_auth_user();
