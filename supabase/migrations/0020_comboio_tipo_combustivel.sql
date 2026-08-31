-- Comboio: separa saldo por tipo de combustível (Diesel/Gasolina) dentro do
-- mesmo Posto. Histórico existente é tratado como Diesel.

alter table public.tanque_entradas
  drop constraint tanque_entradas_local_abastecimento_fkey;

alter table public.tanques
  add column tipo_combustivel text not null default 'Diesel'
    check (tipo_combustivel in ('Diesel','Gasolina'));

alter table public.tanques
  drop constraint tanques_local_abastecimento_key;

alter table public.tanques
  add constraint tanques_local_abastecimento_tipo_combustivel_key
    unique (local_abastecimento, tipo_combustivel);

alter table public.tanque_entradas
  add column tipo_combustivel text not null default 'Diesel'
    check (tipo_combustivel in ('Diesel','Gasolina'));

alter table public.tanque_entradas
  add constraint tanque_entradas_local_abastecimento_tipo_combustivel_fkey
    foreign key (local_abastecimento, tipo_combustivel)
    references public.tanques (local_abastecimento, tipo_combustivel);
