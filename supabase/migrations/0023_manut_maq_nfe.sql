-- MAQUINÁRIOS > MANUTENÇÃO: origem em nota fiscal (importação de XML da NF-e).
--
-- nf_chave guarda a chave de acesso da NF-e (44 dígitos, única por nota em todo o
-- país). É o que impede a mesma nota ser lançada duas vezes — o usuário vai importar
-- lotes de XML e é fácil repetir um arquivo sem perceber.
--
-- Fica nulo para lançamento digitado à mão (manutenção sem nota, serviço de oficina
-- sem XML etc.). No Postgres, unique permite vários nulos, então isso não atrapalha.

alter table public.maq_manutencao add column if not exists nf_chave text;
alter table public.maq_manutencao add column if not exists nf_numero text;

-- Chave de acesso válida: exatamente 44 dígitos. Evita gravar lixo vindo de um XML
-- estranho e transformar o controle de duplicata em algo que não funciona.
alter table public.maq_manutencao drop constraint if exists maq_manutencao_nf_chave_formato;
alter table public.maq_manutencao add constraint maq_manutencao_nf_chave_formato
  check (nf_chave is null or nf_chave ~ '^[0-9]{44}$');

alter table public.maq_manutencao drop constraint if exists maq_manutencao_nf_chave_key;
alter table public.maq_manutencao add constraint maq_manutencao_nf_chave_key unique (nf_chave);
