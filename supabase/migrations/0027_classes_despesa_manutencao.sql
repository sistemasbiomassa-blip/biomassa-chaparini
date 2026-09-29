-- Marca quais classes de despesa são gasto de manutenção da frota.
--
-- Motivo: o gasto de manutenção sempre foi lançado como despesa de viagem
-- (R$ 192.373,98 em 2026) e só aparecia no Financeiro, enquanto a aba Manutenção
-- mostrava R$ 26 mil. Decisão do usuário (2026-09-28): concentrar TODA a manutenção
-- numa aba só — Financeiro fica com combustível, arla e despesa que não é manutenção.
--
-- Nada é copiado nem movido: o lançamento continua um só, em cadastro. Esta coluna
-- só diz em qual aba ele aparece. Desmarcar a classe desfaz a mudança.
--
-- Classes não marcadas (ficam no Financeiro): ALIMENTAÇÃO, BALSA, FLORESTA, LAVA JATO,
-- PERNOITE e SEM INFORMAÇÃO. Esta última tem 68 lançamentos e R$ 23.812,77, mas 58 deles
-- têm a descrição literalmente "SEM INFORMAÇÃO" — não há como saber o que foram, então
-- ficam de fora por ora (decisão do usuário).

alter table public.classes_despesa
  add column if not exists manutencao boolean not null default false;

update public.classes_despesa
   set manutencao = true
 where nome in (
   'OFICINA',
   'BORRACHARIA',
   'PEÇAS',
   'AUTO ELETRICA',
   'LUBRIFICANTES',
   'REVISÃO PROGRAMADA CAMINHÃO'
 );

comment on column public.classes_despesa.manutencao is
  'true = gasto de manutenção da frota: aparece na aba Manutenção e sai do Financeiro. Classe nova entra como false (Financeiro).';
