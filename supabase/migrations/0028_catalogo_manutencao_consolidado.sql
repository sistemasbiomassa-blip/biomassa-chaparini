-- Consolida o catálogo de manutenção de 17 nomes para 8 serviços, aplica os intervalos
-- reais de operação severa e marca o corte de histórico. Aprovado pelo usuário em 2026-09-29.
--
-- POR QUÊ
-- O catálogo tinha 11 tipos + 6 órfãos usados nos lançamentos, e os dados mostraram que
-- praticamente todo filtro era trocado NO MESMO DIA da troca de óleo (Filro de Óleo 2/2,
-- Filtro Secador 2/2, Filtro Suspiro 2/2, Filtro ARLA 2/2, Ar Condicionado 2/2, Filtro de
-- Ar 4/5). Não eram manutenções diferentes: era UMA revisão quebrada em cinco lançamentos,
-- o que fazia o histórico parecer cheio e a matriz continuar vazia.
--
-- INTERVALOS
-- Os antigos nunca foram calibrados (óleo a 100.000 km, freios a 80.000). A frota roda
-- 259 km/dia em média (7.778 km/mês) carregando madeira em estrada de terra — serviço
-- severo, que corta o intervalo de catálogo pela metade. Os valores abaixo são um ponto
-- de partida conservador, a ser refinado com análise de óleo. O usuário edita sozinho em
-- Cadastro > Manutenção Programada; o alerta é calculado na hora, nada fica congelado.
--
-- ALERTAS IGUAIS PARA TODOS (atenção 5.000 km, urgente 2.000 km)
-- No ritmo da frota são ~3 semanas e ~1 semana. Alerta serve para agendar oficina e pedir
-- peça, então o que importa é tempo, não percentual: 5% de 100.000 são 19 dias, 5% de
-- 20.000 são 4 dias — o mesmo percentual daria avisos incomparáveis.
--
-- NÃO APAGA LANÇAMENTO NENHUM. Só renomeia tipos e remapeia o texto de tipo_manutencao.
-- Snapshot do estado anterior foi salvo antes de aplicar.

begin;

-- ---------- 1. Remapeia os lançamentos para os nomes novos ----------
-- Feito ANTES de mexer no catálogo: não há FK entre as duas tabelas (migration 0004
-- afrouxou), então a ordem é livre, mas assim o passo é auditável sozinho.

update public.manut_realizada set tipo_manutencao = 'Revisão de óleo e filtros'
 where tipo_manutencao in ('Troca de Óleo Motor','Filro de Óleo','Troca de Óleo e Filtro',
                           'Filtro de Ar','Filtro de Combustível','Filtro Secador',
                           'Filtro Suspiro tanque','Filtro Ar Condicionado');

update public.manut_realizada set tipo_manutencao = 'Freios'
 where tipo_manutencao = 'Revisão de Freios';

update public.manut_realizada set tipo_manutencao = 'Alinhamento e balanceamento'
 where tipo_manutencao = 'Alinhamento e Balanceamento';

update public.manut_realizada set tipo_manutencao = 'Câmbio e diferencial'
 where tipo_manutencao in ('Caixa','Diferencial');

update public.manut_realizada set tipo_manutencao = 'Sistema de Arla'
 where tipo_manutencao in ('Filtro ARLA','Troca de Fluido de Arla 32');

update public.manut_realizada set tipo_manutencao = 'Pneus'
 where tipo_manutencao = 'Troca de Pneus';

-- ---------- 2. Renomeia os tipos que sobrevivem e aplica os intervalos ----------
-- Renomear em vez de apagar+criar preserva o id, e com ele o histórico de quem é quem.

update public.manut_programada
   set tipo_manutencao = 'Revisão de óleo e filtros',
       intervalo_km = 20000, alerta_atencao = 5000, alerta_urgente = 2000
 where tipo_manutencao = 'Troca de Óleo Motor';

update public.manut_programada
   set tipo_manutencao = 'Freios',
       intervalo_km = 25000, alerta_atencao = 5000, alerta_urgente = 2000
 where tipo_manutencao = 'Revisão de Freios';

update public.manut_programada
   set tipo_manutencao = 'Alinhamento e balanceamento',
       intervalo_km = 25000, alerta_atencao = 5000, alerta_urgente = 2000
 where tipo_manutencao = 'Alinhamento e Balanceamento';

update public.manut_programada
   set tipo_manutencao = 'Sistema de Arla',
       intervalo_km = 60000, alerta_atencao = 5000, alerta_urgente = 2000
 where tipo_manutencao = 'Troca de Fluido de Arla 32';

update public.manut_programada
   set tipo_manutencao = 'Pneus'
 where tipo_manutencao = 'Troca de Pneus';   -- sem intervalo: controlado por posição

-- ---------- 3. Tipos novos ----------
-- Câmbio e diferencial existia só como lançamento órfão ("Caixa", "Diferencial"), sem
-- catálogo — por isso nunca gerou alerta. Corretiva é nova, para conserto não programado.

insert into public.manut_programada (tipo_manutencao, intervalo_km, alerta_atencao, alerta_urgente, controla_pneus)
values ('Câmbio e diferencial', 100000, 5000, 2000, false)
on conflict (tipo_manutencao) do nothing;

insert into public.manut_programada (tipo_manutencao, intervalo_km, alerta_atencao, alerta_urgente, controla_pneus)
values ('Corretiva', null, null, null, false)
on conflict (tipo_manutencao) do nothing;

-- ---------- 4. Remove os tipos que foram absorvidos ----------
-- Seguro: nenhum lançamento aponta mais para eles (passo 1) e a única FK que existe vem
-- de manut_programada_garantia, que está vazia.

delete from public.manut_programada
 where tipo_manutencao in ('Filro de Óleo','Filtro de Ar','Filtro de Combustível',
                           'Troca de Óleo e Filtro',
                           'Troca de Correia Dentada');  -- motor diesel não tem correia dentada

-- ---------- 5. Corte de histórico ----------
-- Lançamento anterior a 01/07/2026 continua no custo e no histórico, mas não serve de
-- base para calcular a próxima manutenção. Motivo: são registros de 2024/2025 em caminhões
-- que rodaram 250 mil km desde então — certamente foram revisados sem registro. Dizer
-- "vencido há 172.000 km" afirma algo que não sabemos; "sem registro" é a verdade.
-- Nenhum dos 18 afetados tem valor lançado, então o corte não tira R$ 0,01 do custo.

alter table public.manut_realizada
  add column if not exists base_alerta boolean not null default true;

update public.manut_realizada
   set base_alerta = false
 where data_manutencao < date '2026-07-01';

comment on column public.manut_realizada.base_alerta is
  'false = lançamento histórico: conta no custo e aparece no histórico, mas não serve de base para calcular a próxima manutenção. Corte inicial em 01/07/2026, quando o controle passou a ser feito de verdade.';

commit;
