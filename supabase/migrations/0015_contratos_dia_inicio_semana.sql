-- Contratos semanais nem sempre seguem semana civil (seg-dom) — ex: Cargill
-- fecha de quarta a terça. Permite configurar o dia de início por contrato
-- (0=domingo .. 6=sábado). Só é usado quando periodicidade='semanal'; nulo
-- equivale a segunda-feira (comportamento padrão anterior).
alter table public.contratos add column dia_inicio_semana smallint
  check (dia_inicio_semana between 0 and 6);
