-- NOTAS FISCAIS IMPORTADAS (NF-e de peças e NFS-e de serviço) com os itens.
--
-- Substitui a coluna maq_manutencao.nf_chave (0023), que não servia ao caso real:
--   * Uma revisão de caminhão vem em DUAS notas (NF-e das peças + NFS-e da mão de obra,
--     ligadas pela mesma OS). Um lançamento precisa guardar mais de uma chave.
--   * A NFS-e do Padrão Nacional tem chave de 50 dígitos, não 44 — o check de 0023
--     recusaria gravar qualquer nota de serviço.
--   * O usuário quer ver o descritivo de cada peça e serviço, não só o total.
--
-- Modelo:
--   nf_documentos  uma linha por documento fiscal; a chave única é o que impede
--                  importar a mesma nota duas vezes. Liga a UM lançamento (máquina OU
--                  caminhão).
--   nf_itens       peças e serviços de cada documento, com o valor LÍQUIDO (desconto
--                  aplicado), para a soma dos itens bater com o total da nota.
--   manut_realizada.nf_principal_id
--                  uma revisão cobre vários tipos (óleo, filtro de ar, filtro de
--                  combustível...) e a tabela guarda um tipo por linha. O valor e os
--                  itens ficam só no registro "principal"; os demais apontam para ele,
--                  para o custo não ser contado várias vezes.

-- ---------- tabelas ----------
create table public.nf_documentos (
  id                  bigint generated always as identity primary key,
  chave               text not null unique,
  modelo              text not null check (modelo in ('NFE','NFSE')),
  numero              text,
  serie               text,
  data_emissao        date,
  emitente_cnpj       text,
  emitente_nome       text,
  valor_total         numeric not null,
  os_numero           text,   -- ordem de serviço da oficina: é o que junta peças + serviço
  maq_manutencao_id   bigint references public.maq_manutencao(id)  on delete cascade,
  manut_realizada_id  bigint references public.manut_realizada(id) on delete cascade,
  usuario_id          uuid references public.profiles(id),
  data_registro       timestamptz not null default now(),
  -- NF-e = 44 dígitos; NFS-e do Padrão Nacional = 50
  constraint nf_documentos_chave_formato check (chave ~ '^[0-9]{44}$' or chave ~ '^[0-9]{50}$'),
  -- exatamente um destino
  constraint nf_documentos_um_destino check ((maq_manutencao_id is null) <> (manut_realizada_id is null))
);
create index nf_documentos_maq_idx  on public.nf_documentos (maq_manutencao_id)  where maq_manutencao_id  is not null;
create index nf_documentos_cam_idx  on public.nf_documentos (manut_realizada_id) where manut_realizada_id is not null;

create table public.nf_itens (
  id            bigint generated always as identity primary key,
  documento_id  bigint not null references public.nf_documentos(id) on delete cascade,
  n_item        int,
  tipo          text not null check (tipo in ('PECA','SERVICO')),
  codigo        text,
  descricao     text not null,
  quantidade    numeric,
  unidade       text,
  valor_bruto   numeric,
  desconto      numeric not null default 0,
  valor         numeric not null   -- líquido: é o que soma para o total da nota
);
create index nf_itens_documento_idx on public.nf_itens (documento_id);

-- Registros "acompanhantes" de uma revisão apontam para o principal. Apagar o principal
-- apaga os acompanhantes e as notas junto (cascade), liberando a nota para reimportar;
-- sem isso sobrariam tipos soltos zerando alertas de uma revisão que não existe mais.
alter table public.manut_realizada
  add column nf_principal_id bigint references public.manut_realizada(id) on delete cascade;
create index manut_realizada_nf_principal_idx on public.manut_realizada (nf_principal_id) where nf_principal_id is not null;

-- ---------- migra o que já foi importado pela 0023 (2 notas de óleo) ----------
-- Série e CNPJ do emitente saem da própria chave de acesso da NF-e
-- (posições: cUF 2 | AAMM 4 | CNPJ 14 | modelo 2 | série 3 | número 9 | ...).
insert into public.nf_documentos
  (chave, modelo, numero, serie, data_emissao, emitente_cnpj, emitente_nome, valor_total,
   maq_manutencao_id, usuario_id, data_registro)
select m.nf_chave, 'NFE', m.nf_numero, (substr(m.nf_chave,23,3))::int::text, m.data,
       substr(m.nf_chave,7,14), m.oficina_fornecedor, m.custo_pecas,
       m.id, m.usuario_id, m.data_registro
  from public.maq_manutencao m
 where m.nf_chave is not null;

-- O item foi gravado no texto do serviço como "DESCRIÇÃO (7 BB)"; separa de volta.
insert into public.nf_itens (documento_id, n_item, tipo, descricao, quantidade, unidade, valor_bruto, desconto, valor)
select d.id, 1, 'PECA',
       coalesce(x.p[1], m.servico),
       case when x.p is null then null else replace(replace(x.p[2], '.', ''), ',', '.')::numeric end,
       x.p[3],
       m.custo_pecas, 0, m.custo_pecas
  from public.maq_manutencao m
  join public.nf_documentos d on d.maq_manutencao_id = m.id
  cross join lateral (select regexp_match(m.servico, '^(.*) \(([0-9.,]+) (\S+)\)$') as p) x
 where m.nf_chave is not null;

alter table public.maq_manutencao drop column nf_chave;
alter table public.maq_manutencao drop column nf_numero;

-- ---------- RLS ----------
-- Leitura: todos logados. Grava: quem pode lançar. Documento fiscal importado não se
-- edita (sem política de update); exclusão só ADMIN, normalmente via cascade do lançamento.
alter table public.nf_documentos enable row level security;
create policy nf_documentos_select on public.nf_documentos for select using (auth.uid() is not null);
create policy nf_documentos_insert on public.nf_documentos for insert with check (public.pode_lancar());
create policy nf_documentos_delete on public.nf_documentos for delete using (public.is_admin());

alter table public.nf_itens enable row level security;
create policy nf_itens_select on public.nf_itens for select using (auth.uid() is not null);
create policy nf_itens_insert on public.nf_itens for insert with check (public.pode_lancar());
create policy nf_itens_delete on public.nf_itens for delete using (public.is_admin());

-- ---------- importação atômica ----------
-- Grava lançamento(s) + documentos + itens numa transação só. Se a nota já existir, a
-- chave única estoura e NADA fica gravado — em vários passos pelo navegador, o
-- lançamento entraria e a nota não, gerando custo em dobro sem nota ligada.
-- security invoker: roda com as permissões de quem chama, então o RLS continua valendo.
--
-- p = { destino: 'maq'|'caminhao',
--       lancamentos: [ {...colunas da tabela destino...}, ... ]   -- o 1º é o principal
--       documentos:  [ {chave, modelo, numero, serie, data_emissao, emitente_cnpj,
--                       emitente_nome, valor_total, os_numero, itens:[...]}, ... ] }
create or replace function public.importar_nf(p jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_destino   text := p->>'destino';
  v_lanc      jsonb;
  v_doc       jsonb;
  v_id        bigint;
  v_principal bigint;
  v_doc_id    bigint;
  v_ids       bigint[] := '{}';
begin
  if v_destino is null or v_destino not in ('maq','caminhao') then
    raise exception 'importar_nf: destino inválido (%)', v_destino;
  end if;
  if coalesce(jsonb_array_length(p->'lancamentos'),0) = 0 then
    raise exception 'importar_nf: nenhum lançamento';
  end if;
  if coalesce(jsonb_array_length(p->'documentos'),0) = 0 then
    raise exception 'importar_nf: nenhum documento fiscal';
  end if;
  if v_destino = 'maq' and jsonb_array_length(p->'lancamentos') <> 1 then
    raise exception 'importar_nf: maquinário recebe exatamente um lançamento por nota';
  end if;

  for v_lanc in select * from jsonb_array_elements(p->'lancamentos') loop
    if v_destino = 'maq' then
      insert into maq_manutencao
        (data, id_maquina, tipo, servico, horimetro, km, custo_pecas, custo_mao_obra, custo_terceiros,
         oficina_fornecedor, floresta_opc, obs, usuario_id, usuario_nome_legado)
      values
        ((v_lanc->>'data')::date,
         nullif(v_lanc->>'id_maquina','')::bigint,
         v_lanc->>'tipo',
         v_lanc->>'servico',
         nullif(v_lanc->>'horimetro','')::numeric,
         nullif(v_lanc->>'km','')::numeric,
         coalesce(nullif(v_lanc->>'custo_pecas','')::numeric, 0),
         coalesce(nullif(v_lanc->>'custo_mao_obra','')::numeric, 0),
         coalesce(nullif(v_lanc->>'custo_terceiros','')::numeric, 0),
         nullif(v_lanc->>'oficina_fornecedor',''),
         nullif(v_lanc->>'floresta_opc',''),
         nullif(v_lanc->>'obs',''),
         auth.uid(),
         nullif(v_lanc->>'usuario_nome_legado',''))
      returning id into v_id;
    else
      insert into manut_realizada
        (placa, tipo_manutencao, data_manutencao, km, observacao, valor, local_servico, nota_fiscal,
         motorista, usuario_id, usuario_nome_legado, nf_principal_id)
      values
        (v_lanc->>'placa',
         v_lanc->>'tipo_manutencao',
         (v_lanc->>'data_manutencao')::date,
         (v_lanc->>'km')::numeric,
         nullif(v_lanc->>'observacao',''),
         nullif(v_lanc->>'valor','')::numeric,
         nullif(v_lanc->>'local_servico',''),
         nullif(v_lanc->>'nota_fiscal',''),
         nullif(v_lanc->>'motorista',''),
         auth.uid(),
         nullif(v_lanc->>'usuario_nome_legado',''),
         v_principal)          -- null no 1º (é o principal); os demais apontam para ele
      returning id into v_id;
    end if;
    if v_principal is null then v_principal := v_id; end if;
    v_ids := v_ids || v_id;
  end loop;

  for v_doc in select * from jsonb_array_elements(p->'documentos') loop
    insert into nf_documentos
      (chave, modelo, numero, serie, data_emissao, emitente_cnpj, emitente_nome, valor_total,
       os_numero, maq_manutencao_id, manut_realizada_id, usuario_id)
    values
      (v_doc->>'chave',
       v_doc->>'modelo',
       nullif(v_doc->>'numero',''),
       nullif(v_doc->>'serie',''),
       nullif(v_doc->>'data_emissao','')::date,
       nullif(v_doc->>'emitente_cnpj',''),
       nullif(v_doc->>'emitente_nome',''),
       (v_doc->>'valor_total')::numeric,
       nullif(v_doc->>'os_numero',''),
       case when v_destino = 'maq'      then v_principal end,
       case when v_destino = 'caminhao' then v_principal end,
       auth.uid())
    returning id into v_doc_id;

    insert into nf_itens
      (documento_id, n_item, tipo, codigo, descricao, quantidade, unidade, valor_bruto, desconto, valor)
    select v_doc_id,
           nullif(i->>'n_item','')::int,
           i->>'tipo',
           nullif(i->>'codigo',''),
           i->>'descricao',
           nullif(i->>'quantidade','')::numeric,
           nullif(i->>'unidade',''),
           nullif(i->>'valor_bruto','')::numeric,
           coalesce(nullif(i->>'desconto','')::numeric, 0),
           (i->>'valor')::numeric
      from jsonb_array_elements(coalesce(v_doc->'itens','[]'::jsonb)) i;
  end loop;

  return jsonb_build_object('principal', v_principal, 'ids', to_jsonb(v_ids));
end
$$;

revoke all on function public.importar_nf(jsonb) from public, anon;
grant execute on function public.importar_nf(jsonb) to authenticated;
