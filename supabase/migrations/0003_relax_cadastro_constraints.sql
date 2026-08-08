-- ============================================================
-- Relaxa duas constraints de CADASTRO que os dados REAIS violam
-- (descoberto na análise da Fase B, 2026-08-04):
--   - NOTA duplicada é prática real do negócio (mesma nota usada em duas viagens
--     distintas de motoristas diferentes no mesmo dia), não erro de digitação.
--   - 32 linhas reais têm KM sem QTDADE LITROS ou vice-versa.
-- Essas validações continuam existindo no app (front), só não são mais
-- hard constraint no banco, para não travar a carga do histórico real.
-- ============================================================

drop index if exists public.cadastro_nota_unique;
alter table public.cadastro drop constraint if exists cadastro_check;
