-- Guarda o e-mail no profile também (facilita exibir/gerenciar na tela de Usuários
-- sem precisar consultar auth.users, que não é acessível via API normal).
alter table public.profiles add column if not exists email text;

create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nome, perfil, ativo, primeiro_acesso, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nome', new.email),
    coalesce(new.raw_user_meta_data ->> 'perfil', 'ANALISTA'),
    true,
    true,
    new.email
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

-- Preenche o e-mail dos 6 usuários já migrados antes dessa coluna existir
update public.profiles set email = au.email
from auth.users au
where profiles.id = au.id and profiles.email is null;
