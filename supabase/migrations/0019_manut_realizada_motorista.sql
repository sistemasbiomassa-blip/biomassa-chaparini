-- Campo motorista em manut_realizada, pra saber quem fez a manutenção (ex: troca de pneu),
-- não só quem lançou no sistema (usuario_id).

alter table public.manut_realizada add column motorista text;
