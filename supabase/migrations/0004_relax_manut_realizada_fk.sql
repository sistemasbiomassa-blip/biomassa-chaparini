-- MANUT_REALIZADA guarda o histórico real de serviços (inclui reparos pontuais,
-- não só os itens da lista de manutenção programada/recorrente). 6 tipos reais
-- encontrados nos dados (Diferencial, Caixa, Filtro Secador, Filtro ARLA,
-- Filtro Suspiro tanque, Filtro Ar Condicionado) não existem em MANUT_PROGRAMADA.
-- Solto a FK — tipo_manutencao continua texto livre aqui.
alter table public.manut_realizada drop constraint if exists manut_realizada_tipo_manutencao_fkey;
