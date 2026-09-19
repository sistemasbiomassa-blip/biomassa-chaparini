-- MAQUINÁRIOS > MANUTENÇÃO: lançamento de insumo a granel (sem máquina definida).
--
-- Motivo: notas de compra de insumo (ex: 7 baldes de óleo 15W40 numa NF-e só) não
-- pertencem a UMA máquina — o óleo vai ser usado em várias ao longo das semanas.
-- Forçar a escolha de uma máquina jogava o custo inteiro numa máquina que não gastou
-- tudo aquilo e distorcia o custo por fazenda. Agora a máquina é opcional: o custo
-- pode ser atribuído só à fazenda (floresta_opc), que é o nível em que esse gasto
-- realmente é conhecido.
--
-- O front (js/maq-custo.js) já tolerava lançamento sem máquina: agrupa por floresta e
-- só conta a máquina no resumo quando ela existe. Nada a mudar lá.

alter table public.maq_manutencao alter column id_maquina drop not null;

-- Novo tipo 'Insumo', para separar compra de insumo de manutenção de fato nos filtros.
-- O check de tipo é localizado pelo catálogo em vez de pelo nome fixo: a tabela nasceu
-- com constraint sem nome explícito (schema.sql), então o nome gerado não é garantido.
do $$
declare c record;
begin
  for c in
    select con.conname
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace ns on ns.oid = rel.relnamespace
     where ns.nspname = 'public'
       and rel.relname = 'maq_manutencao'
       and con.contype = 'c'
       and pg_get_constraintdef(con.oid) ilike '%tipo%'
  loop
    execute format('alter table public.maq_manutencao drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.maq_manutencao add constraint maq_manutencao_tipo_check
  check (tipo in ('Preventiva','Corretiva','Insumo'));

-- Um lançamento sem máquina E sem fazenda não cairia em nenhum relatório (ficaria
-- órfão, invisível no custo por fazenda e no custo por máquina). Exige ao menos um dos
-- dois. nullif(btrim(...)) porque o front pode mandar string vazia em vez de null.
alter table public.maq_manutencao drop constraint if exists maq_manutencao_destino_check;
alter table public.maq_manutencao add constraint maq_manutencao_destino_check
  check (id_maquina is not null or nullif(btrim(floresta_opc), '') is not null);
