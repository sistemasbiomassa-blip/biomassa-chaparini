-- Reverte a exigência de um "tanque" cadastrado por combustível (0020).
-- O tanque volta a ser um só por Posto (como sempre foi); o combustível passa
-- a ser escolhido livremente em cada Entrada (tanque_entradas.tipo_combustivel,
-- que já existe desde 0020), e o saldo por combustível é calculado em tempo
-- real no front (Diesel usa o saldo_inicial do tanque; Gasolina começa do zero).

alter table public.tanque_entradas
  drop constraint tanque_entradas_local_abastecimento_tipo_combustivel_fkey;

alter table public.tanques
  drop constraint tanques_local_abastecimento_tipo_combustivel_key;

alter table public.tanques
  add constraint tanques_local_abastecimento_key unique (local_abastecimento);

alter table public.tanques
  drop column tipo_combustivel;

alter table public.tanque_entradas
  add constraint tanque_entradas_local_abastecimento_fkey
    foreign key (local_abastecimento) references public.tanques (local_abastecimento);
