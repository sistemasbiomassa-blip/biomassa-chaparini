-- Manutenção: garantia por placa, catálogo de tipos com intervalo opcional,
-- e campos novos (valor/local do serviço/nota fiscal) em manut_realizada.
-- Decisões (conversa 2026-08-11):
--   - Garantia sai quando DATA_FIM ou KM_LIMITE vencer primeiro (os dois obrigatórios).
--   - Intervalo/alerta de garantia é por PLACA, independente do intervalo padrão do mesmo tipo.
--   - manut_programada continua sendo o catálogo único de tipos; intervalo/alerta viram opcionais
--     (tipo "só de log", sem controle de km, ex: troca de pneu).
--   - Só ADMIN cadastra/edita garantia, intervalos de garantia e o catálogo de tipos.

-- ---------- manut_programada: intervalo/alerta agora opcionais ----------
alter table public.manut_programada alter column intervalo_km drop not null;
alter table public.manut_programada alter column alerta_urgente drop not null;
alter table public.manut_programada alter column alerta_atencao drop not null;

alter table public.manut_programada drop constraint if exists manut_programada_check;
alter table public.manut_programada add constraint manut_programada_alerta_check
  check (alerta_urgente is null or alerta_atencao is null or alerta_urgente <= alerta_atencao);

-- ---------- manut_realizada: campos novos ----------
alter table public.manut_realizada add column valor numeric;
alter table public.manut_realizada add column local_servico text;
alter table public.manut_realizada add column nota_fiscal text;

-- ---------- garantia_caminhoes ----------
create table public.garantia_caminhoes (
  id bigint generated always as identity primary key,
  placa text not null unique references public.caminhoes(placa),
  data_fim date not null,
  km_limite numeric not null,
  obs text,
  usuario_id uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_updated_at_garantia_caminhoes
  before update on public.garantia_caminhoes for each row execute function public.set_updated_at();

-- ---------- manut_programada_garantia (intervalo/alerta por placa em garantia) ----------
create table public.manut_programada_garantia (
  id bigint generated always as identity primary key,
  placa text not null references public.caminhoes(placa),
  tipo_manutencao text not null references public.manut_programada(tipo_manutencao),
  intervalo_km numeric not null,
  alerta_urgente numeric not null,
  alerta_atencao numeric not null,
  usuario_id uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (placa, tipo_manutencao),
  check (alerta_urgente <= alerta_atencao)
);
create trigger trg_updated_at_manut_programada_garantia
  before update on public.manut_programada_garantia for each row execute function public.set_updated_at();

-- ---------- RLS: domínio, igual motoristas/caminhoes/manut_programada (rls_policies.sql:78-92) ----------
do $$
declare
  tbl text;
begin
  foreach tbl in array array['garantia_caminhoes','manut_programada_garantia']
  loop
    execute format('alter table public.%I enable row level security', tbl);
    execute format('create policy %I_select on public.%I for select using (auth.uid() is not null)', tbl, tbl);
    execute format('create policy %I_insert on public.%I for insert with check (public.is_admin())', tbl, tbl);
    execute format('create policy %I_update on public.%I for update using (public.is_admin())', tbl, tbl);
    execute format('create policy %I_delete on public.%I for delete using (public.is_admin())', tbl, tbl);
  end loop;
end $$;
