-- ============================================================
-- Adiciona coluna sheet_id: âncora para upsert idempotente na migração (Fase B).
-- Guarda o ID original da linha no Google Sheets, para o script de sincronização
-- saber se um registro já foi importado antes (ON CONFLICT (sheet_id) DO UPDATE)
-- em vez de duplicar a cada rodada. NULL para registros criados direto no Supabase
-- depois do corte (Fase E) — essas linhas nunca tiveram um ID de planilha.
-- ============================================================

alter table public.cadastro          add column sheet_id bigint unique;
alter table public.manut_realizada   add column sheet_id bigint unique;
alter table public.manut_programada  add column sheet_id bigint unique;
alter table public.maquinas          add column sheet_id bigint unique;
alter table public.maq_localizacao   add column sheet_id bigint unique;
alter table public.maq_abastecimento add column sheet_id bigint unique;
alter table public.maq_manutencao    add column sheet_id bigint unique;
alter table public.tanques           add column sheet_id bigint unique;
alter table public.tanque_entradas   add column sheet_id bigint unique;
alter table public.frequencia        add column sheet_id bigint unique;
