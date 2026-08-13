-- Correção: _comUsuarioAtual() (js/data.js) sempre grava usuario_nome_legado
-- junto com usuario_id em qualquer insert de tabela operacional — convenção
-- estabelecida em 0005_usuario_legado.sql, mas as tabelas criadas depois
-- (garantia_caminhoes, manut_programada_garantia em 0010; manut_pneus_itens em
-- 0011) ficaram sem essa coluna. Sem ela, o insert falha com "column does not
-- exist". Corrige adicionando a coluna nas três.
alter table public.garantia_caminhoes add column usuario_nome_legado text;
alter table public.manut_programada_garantia add column usuario_nome_legado text;
alter table public.manut_pneus_itens add column usuario_nome_legado text;
