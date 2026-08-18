-- Contratos que não são nem mensal nem semanal recorrente — ex: "entregar até
-- 30/09" (um período fixo só, sem repetir). Periodicidade 'personalizado' usa
-- data_inicio/data_fim em vez de recalcular mês/semana corrente.
alter table public.contratos drop constraint contratos_periodicidade_check;
alter table public.contratos add constraint contratos_periodicidade_check
  check (periodicidade in ('mensal','semanal','personalizado'));

alter table public.contratos add column data_inicio date;
alter table public.contratos add column data_fim date;

alter table public.contratos add constraint contratos_personalizado_datas
  check (periodicidade <> 'personalizado' or (data_inicio is not null and data_fim is not null and data_fim >= data_inicio));
