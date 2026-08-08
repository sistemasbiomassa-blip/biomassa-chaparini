-- 467 linhas reais do CADASTRO (10% do total) não têm PLACA preenchida —
-- maioria são placeholders de dia sem viagem (só MOTORISTA+DATA), mas há
-- pelo menos um caso com dados de viagem completos faltando só a placa.
-- Preservar como está (NULL), não inventar valor.
alter table public.cadastro alter column placa drop not null;
