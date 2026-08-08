-- FKs que apontam pra locais(nome) precisam sair primeiro (nome vai deixar de ser
-- único sozinho). A validação de "esse nome existe com o tipo certo" já é feita pela
-- trigger trg_validar_tipos_locais em CADASTRO — mantemos essa validação lá.
-- Para os outros módulos (Maquinários, Comboio) o campo vira referência livre (texto),
-- mesmo padrão já usado em maq_abastecimento.tanque_posto.
alter table public.cadastro drop constraint if exists cadastro_local_carga_fkey;
alter table public.cadastro drop constraint if exists cadastro_local_descarga_fkey;
alter table public.cadastro drop constraint if exists cadastro_local_abastecimento_fkey;

alter table public.maq_localizacao drop constraint if exists maq_localizacao_floresta_fkey;
alter table public.maq_abastecimento drop constraint if exists maq_abastecimento_floresta_opc_fkey;
alter table public.maq_manutencao drop constraint if exists maq_manutencao_floresta_opc_fkey;
alter table public.tanques drop constraint if exists tanques_local_abastecimento_fkey;

-- "DEPÓSITO - NOVO ACORDO" existe na planilha LOCAIS duas vezes com o mesmo nome,
-- uma como tipo=carga e outra como tipo=descarga (mesmo lugar, dois papéis reais,
-- não é duplicata a limpar). NOME sozinho não pode mais ser a chave única.
alter table public.locais drop constraint if exists locais_nome_key;
alter table public.locais add constraint locais_nome_tipo_key unique (nome, tipo);
