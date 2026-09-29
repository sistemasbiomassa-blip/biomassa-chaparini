-- MANUTENÇÃO DE CAMINHÃO: KM deixa de ser obrigatório.
--
-- Numerada 0026b porque 0026_perfil_rh.sql já estava commitada com esse número. Esta foi
-- aplicada depois dela e antes da 0027 — o sufixo preserva a ordem real sem empatar o
-- número com uma migration que já está no histórico.
--
-- Motivo: nota de conserto avulso (tipo "Outros") muitas vezes não traz o KM, e obrigar
-- o campo forçava inventar um número — que depois vira base de cálculo errada. O KM só é
-- usado para saber quando vence a próxima manutenção, ou seja, só faz falta nos tipos que
-- têm intervalo de KM cadastrado (manut_programada.intervalo_km). Para "Outros" e
-- "Troca de Óleo e Filtro", que não têm intervalo, ele não serve para nada.
--
-- A exigência por tipo fica no front (formulário, edição e importador de nota), não numa
-- trigger: o catálogo de tipos muda com o tempo e uma trigger olhando outra tabela
-- travaria a edição de lançamentos antigos, como já acontece com a validação de KM do
-- CADASTRO (ver trg_validar_km_sequencia, que impede editar vizinhos de lançamentos
-- com KM 0).
--
-- js/manutencao.js (_manutCalcLastManut) passa a ignorar lançamento sem KM ao procurar o
-- último de cada placa+tipo: sem isso, um lançamento sem KM viraria a âncora do cálculo e
-- o caminhão apareceria "vencido" sem ser.

alter table public.manut_realizada alter column km drop not null;

-- importar_nf: aceitar KM vazio vindo da tela (antes '' estourava no cast para numeric)
create or replace function public.importar_nf(p jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_destino   text := p->>'destino';
  v_anexar    bigint := nullif(p->>'anexar_a','')::bigint;
  v_lanc      jsonb;
  v_doc       jsonb;
  v_id        bigint;
  v_principal bigint;
  v_doc_id    bigint;
  v_ids       bigint[] := '{}';
  v_soma_nfe  numeric := 0;
  v_soma_nfse numeric := 0;
  v_n         int;
begin
  if v_destino is null or v_destino not in ('maq','caminhao') then
    raise exception 'importar_nf: destino inválido (%)', v_destino;
  end if;
  if coalesce(jsonb_array_length(p->'documentos'),0) = 0 then
    raise exception 'importar_nf: nenhum documento fiscal';
  end if;

  if v_anexar is not null then
    if coalesce(jsonb_array_length(p->'lancamentos'),0) > 0 then
      raise exception 'importar_nf: ao anexar não se cria lançamento novo';
    end if;
    if v_destino = 'caminhao' then
      select count(*) into v_n from manut_realizada where id = v_anexar and nf_principal_id is null;
    else
      select count(*) into v_n from maq_manutencao where id = v_anexar;
    end if;
    if v_n = 0 then
      raise exception 'importar_nf: lançamento % não encontrado para anexar', v_anexar;
    end if;
    v_principal := v_anexar;
    v_ids := array[v_anexar];
  else
    if coalesce(jsonb_array_length(p->'lancamentos'),0) = 0 then
      raise exception 'importar_nf: nenhum lançamento';
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
           nullif(v_lanc->>'km','')::numeric,   -- KM opcional (tipo sem alerta de KM)
           nullif(v_lanc->>'observacao',''),
           nullif(v_lanc->>'valor','')::numeric,
           nullif(v_lanc->>'local_servico',''),
           nullif(v_lanc->>'nota_fiscal',''),
           nullif(v_lanc->>'motorista',''),
           auth.uid(),
           nullif(v_lanc->>'usuario_nome_legado',''),
           v_principal)
        returning id into v_id;
      end if;
      if v_principal is null then v_principal := v_id; end if;
      v_ids := v_ids || v_id;
    end loop;
  end if;

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

    if v_doc->>'modelo' = 'NFSE' then v_soma_nfse := v_soma_nfse + (v_doc->>'valor_total')::numeric;
    else                              v_soma_nfe  := v_soma_nfe  + (v_doc->>'valor_total')::numeric;
    end if;

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

  if v_anexar is not null then
    if v_destino = 'caminhao' then
      update manut_realizada
         set valor = coalesce(valor,0) + v_soma_nfe + v_soma_nfse,
             nota_fiscal = concat_ws(' + ', nullif(nota_fiscal,''), nullif(p->>'nota_fiscal_txt',''))
       where id = v_anexar;
    else
      update maq_manutencao
         set custo_pecas    = custo_pecas    + v_soma_nfe,
             custo_mao_obra = custo_mao_obra + v_soma_nfse
       where id = v_anexar;
    end if;
    get diagnostics v_n = row_count;
    if v_n = 0 then
      raise exception 'importar_nf: sem permissão para alterar o lançamento % (só ADMIN ou quem lançou)', v_anexar;
    end if;
  end if;

  return jsonb_build_object('principal', v_principal, 'ids', to_jsonb(v_ids), 'anexado', v_anexar is not null);
end
$$;

revoke all on function public.importar_nf(jsonb) from public, anon;
grant execute on function public.importar_nf(jsonb) to authenticated;
