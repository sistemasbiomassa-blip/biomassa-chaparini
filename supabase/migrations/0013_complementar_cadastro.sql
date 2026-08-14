-- ============================================================
-- Permite qualquer ANALISTA/DIRETOR "complementar" (preencher campos vazios)
-- de um lançamento de CADASTRO feito por outro usuário, sem poder sobrescrever
-- campos que já foram preenchidos (isso continua exclusivo do dono ou ADMIN).
-- Contexto: analista A lança chegada/saída da viagem, analista B lança o
-- abastecimento da mesma placa+data — hoje B não conseguia nem abrir o
-- registro de A pra complementar, porque a policy de UPDATE só liberava
-- o próprio dono. A trava fina (campo a campo) fica na trigger abaixo.
-- ============================================================

drop policy if exists cadastro_update on public.cadastro;

create policy cadastro_update on public.cadastro
  for update using (
    public.is_admin() or public.is_analista() or public.is_diretor()
  );

create or replace function public.cadastro_protect_owner_fields()
returns trigger language plpgsql as $$
declare
  is_owner boolean;
begin
  if public.is_admin() then
    return new;
  end if;

  is_owner := (old.usuario_id is not null and old.usuario_id = auth.uid());
  if is_owner then
    return new;
  end if;

  -- Não é dono nem ADMIN: pode só preencher campos vazios, nunca trocar o responsável
  -- do lançamento nem sobrescrever um campo que já tinha valor.
  if new.usuario_id is distinct from old.usuario_id then
    raise exception 'Não é permitido alterar o responsável do lançamento.';
  end if;

  if (old.motorista is not null and new.motorista is distinct from old.motorista) or
     (old.data is not null and new.data is distinct from old.data) or
     (old.situacao is not null and new.situacao is distinct from old.situacao) or
     (old.entrega is not null and new.entrega is distinct from old.entrega) or
     (old.placa is not null and new.placa is distinct from old.placa) or
     (old.local_carga is not null and new.local_carga is distinct from old.local_carga) or
     (old.local_descarga is not null and new.local_descarga is distinct from old.local_descarga) or
     (old.nota is not null and new.nota is distinct from old.nota) or
     (old.quantidade is not null and new.quantidade is distinct from old.quantidade) or
     (old.chegada_floresta is not null and new.chegada_floresta is distinct from old.chegada_floresta) or
     (old.saida_floresta is not null and new.saida_floresta is distinct from old.saida_floresta) or
     (old.chegada_cliente is not null and new.chegada_cliente is distinct from old.chegada_cliente) or
     (old.saida_cliente is not null and new.saida_cliente is distinct from old.saida_cliente) or
     (old.local_abastecimento is not null and new.local_abastecimento is distinct from old.local_abastecimento) or
     (old.km is not null and new.km is distinct from old.km) or
     (old.qtdade_litros is not null and new.qtdade_litros is distinct from old.qtdade_litros) or
     (old.valor_unitario is not null and new.valor_unitario is distinct from old.valor_unitario) or
     (old.arla_valor is not null and new.arla_valor is distinct from old.arla_valor) or
     (old.classe_despesa is not null and new.classe_despesa is distinct from old.classe_despesa) or
     (old.descr_despesa is not null and new.descr_despesa is distinct from old.descr_despesa) or
     (old.local_despesa is not null and new.local_despesa is distinct from old.local_despesa) or
     (old.valor_despesa is not null and new.valor_despesa is distinct from old.valor_despesa) or
     (old.observacao is not null and new.observacao is distinct from old.observacao)
  then
    raise exception 'Você só pode complementar campos vazios deste lançamento — campos já preenchidos só podem ser alterados por quem lançou ou por um ADMIN.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_cadastro_protect_owner_fields on public.cadastro;

create trigger trg_cadastro_protect_owner_fields
before update on public.cadastro
for each row execute function public.cadastro_protect_owner_fields();
