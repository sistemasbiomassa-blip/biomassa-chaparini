-- Campo livre marca/modelo do pneu instalado, pra bater com a folha de impressão
-- (folha já tinha a coluna "Marca/Modelo (instalado)", faltava no lançamento digital).

alter table public.manut_pneus_itens add column marca_modelo text;
