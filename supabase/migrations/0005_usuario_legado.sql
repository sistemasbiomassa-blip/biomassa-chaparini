-- Guarda o nome de usuário original do Sheets (coluna USUARIO) enquanto os logins
-- ainda não foram migrados pro Supabase Auth. usuario_id fica NULL até lincarmos
-- depois (Fase B-usuários), usuario_nome_legado preserva o dado pra não perder nada.
alter table public.cadastro          add column usuario_nome_legado text;
alter table public.manut_realizada   add column usuario_nome_legado text;
alter table public.maq_localizacao   add column usuario_nome_legado text;
alter table public.maq_abastecimento add column usuario_nome_legado text;
alter table public.maq_manutencao    add column usuario_nome_legado text;
alter table public.tanques           add column usuario_nome_legado text;
alter table public.tanque_entradas   add column usuario_nome_legado text;
alter table public.frequencia        add column usuario_nome_legado text;
