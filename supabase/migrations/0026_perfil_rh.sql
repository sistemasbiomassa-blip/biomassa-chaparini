-- ============================================================
-- PERFIL "RH" — acesso exclusivo ao módulo Frequência
--
-- Pedido do usuário (2026-09-22): um perfil novo que enxerga e preenche
-- SOMENTE a Frequência. Nada de Cadastro, Produção, Financeiro, Manutenção,
-- Comboio, Maquinários, Contratos, Histórico, Alertas nem Usuários.
--
-- O front esconde os outros módulos (js/auth.js), mas quem garante de verdade
-- é o RLS aqui: mesmo que o RH abra o console do navegador, as outras tabelas
-- voltam vazias. As únicas leituras liberadas são:
--   - frequencia  (leitura + escrita, é o trabalho dele)
--   - motoristas  (a grade é montada a partir da ficha de motoristas)
--   - profiles    (só a própria linha, regra que já existia)
-- ============================================================

-- ---------- 1) Aceitar 'RH' no check de profiles.perfil ----------
-- O check é inline no schema.sql (nome gerado pelo Postgres), então o nome é
-- descoberto em vez de chutado.
do $$
declare
  cname text;
begin
  select conname into cname
  from pg_constraint
  where conrelid = 'public.profiles'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%perfil%';
  if cname is not null then
    execute format('alter table public.profiles drop constraint %I', cname);
  end if;
end $$;

alter table public.profiles
  add constraint profiles_perfil_check
  check (perfil in ('ADMIN','DIRETOR','ANALISTA','RH'));

-- ---------- 2) Helpers ----------
create or replace function public.is_rh()
returns boolean language sql stable as $$
  select public.current_perfil() = 'RH';
$$;

-- "vê o operacional" = qualquer usuário logado que NÃO seja RH.
-- Substitui o antigo `auth.uid() is not null` das policies de SELECT.
create or replace function public.pode_ver_operacional()
returns boolean language sql stable as $$
  select auth.uid() is not null and not public.is_rh();
$$;

-- ---------- 3) Fechar o SELECT das tabelas operacionais para o RH ----------
-- motoristas fica de fora de propósito (a grade de frequência depende dela).
do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'caminhoes','locais','classes_despesa','manut_programada','maquinas',
    'manut_realizada','tanques','tanque_entradas',
    'maq_localizacao','maq_abastecimento','maq_manutencao',
    'cadastro','alertas',
    'garantia_caminhoes','manut_programada_garantia','manut_pneus_itens',
    'nf_documentos','nf_itens'
  ]
  loop
    execute format('drop policy if exists %I_select on public.%I', tbl, tbl);
    execute format(
      'create policy %I_select on public.%I for select using (public.pode_ver_operacional())',
      tbl, tbl
    );
  end loop;
end $$;

-- Alertas: qualquer logado criava; RH não cria mais (nem enxerga o módulo).
drop policy if exists alertas_insert on public.alertas;
create policy alertas_insert on public.alertas
  for insert with check (public.pode_ver_operacional());

-- ---------- 4) Liberar FREQUENCIA para o RH ----------
-- Leitura continua aberta a todo mundo logado (ADMIN/ANALISTA/DIRETOR/RH).
-- Escrita passa a ser "quem lança" (ADMIN/ANALISTA) OU RH.
drop policy if exists frequencia_insert on public.frequencia;
create policy frequencia_insert on public.frequencia
  for insert with check (public.pode_lancar() or public.is_rh());

drop policy if exists frequencia_update on public.frequencia;
create policy frequencia_update on public.frequencia
  for update using (public.pode_lancar() or public.is_rh());

drop policy if exists frequencia_delete on public.frequencia;
create policy frequencia_delete on public.frequencia
  for delete using (public.pode_lancar() or public.is_rh());
