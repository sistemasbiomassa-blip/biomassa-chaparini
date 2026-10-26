-- CAMINHÕES: uma nota pode ser dividida entre placas, item a item.
--
-- Caso real (NF-e 128215, ROLAPARTS, 23/10/2026): duas peças na mesma nota, uma para cada
-- caminhão. No maquinário isso já era possível desde a 0029; na aba Manutenção Realizada
-- a nota só podia ir para UMA placa, e como a chave é única, importar de novo para a
-- segunda placa era barrado como duplicata.
--
-- Aqui o desenho é diferente do maquinário porque uma revisão de caminhão vira um
-- registro por TIPO (óleo, freios...), e cada placa tem KM e tipos próprios. Então a nota
-- dividida gera, para cada placa, os registros dos tipos dela — o primeiro registro da
-- placa leva o valor dos itens daquela placa, os outros ficam zerados apontando para ele,
-- como já era. O primeiro registro de todos continua sendo o principal que guarda a nota.
--
--   * nf_itens.manut_realizada_id — de qual registro é cada peça, para o relatório de
--     peças somar por placa. Mesmo papel do maq_manutencao_id da 0029. Nulo = item da
--     nota inteira (comportamento de antes, quando não há divisão).

alter table public.nf_itens
  add column if not exists manut_realizada_id bigint references public.manut_realizada(id) on delete set null;
create index if not exists nf_itens_manut_idx
  on public.nf_itens (manut_realizada_id) where manut_realizada_id is not null;

-- importar_nf: o destino_idx do item passa a valer também para caminhão. Só esta parte
-- muda em relação à 0029; o resto da função é o mesmo.
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
      select count(*) into v_n from maq_manutencao where id = v_anexar and nf_principal_id is null;
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

    for v_lanc in select * from jsonb_array_elements(p->'lancamentos') loop
      if v_destino = 'maq' then
        insert into maq_manutencao
          (data, id_maquina, tipo, servico, horimetro, km, custo_pecas, custo_mao_obra, custo_terceiros,
           oficina_fornecedor, floresta_opc, obs, usuario_id, usuario_nome_legado, nf_principal_id)
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
           nullif(v_lanc->>'usuario_nome_legado',''),
           v_principal)      -- null no 1º (principal); os demais apontam para ele
        returning id into v_id;
      else
        insert into manut_realizada
          (placa, tipo_manutencao, data_manutencao, km, observacao, valor, local_servico, nota_fiscal,
           motorista, usuario_id, usuario_nome_legado, nf_principal_id)
        values
          (v_lanc->>'placa',
           v_lanc->>'tipo_manutencao',
           (v_lanc->>'data_manutencao')::date,
           nullif(v_lanc->>'km','')::numeric,
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

    -- destino_idx diz a qual lançamento o item pertence (nota dividida entre máquinas ou
    -- entre placas); sem ele, o item fica solto na nota, como sempre foi
    insert into nf_itens
      (documento_id, n_item, tipo, codigo, descricao, quantidade, unidade, valor_bruto, desconto, valor,
       maq_manutencao_id, manut_realizada_id)
    select v_doc_id,
           nullif(i->>'n_item','')::int,
           i->>'tipo',
           nullif(i->>'codigo',''),
           i->>'descricao',
           nullif(i->>'quantidade','')::numeric,
           nullif(i->>'unidade',''),
           nullif(i->>'valor_bruto','')::numeric,
           coalesce(nullif(i->>'desconto','')::numeric, 0),
           (i->>'valor')::numeric,
           case when v_destino = 'maq' and (i->>'destino_idx') is not null
                then v_ids[(i->>'destino_idx')::int + 1] end,
           case when v_destino = 'caminhao' and (i->>'destino_idx') is not null
                then v_ids[(i->>'destino_idx')::int + 1] end
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
