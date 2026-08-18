-- Permite inativar um Local (carga/descarga/abastecimento) sem apagá-lo —
-- continua existindo pro histórico (lançamentos antigos, relatórios), só
-- some das listas de seleção usadas pra criar/editar lançamentos novos.
-- Mesmo padrão já usado pra Motoristas (DATA_DESLIGAMENTO), só que aqui como
-- flag simples porque local não tem uma data de "desligamento" natural.
alter table public.locais add column ativo boolean not null default true;
