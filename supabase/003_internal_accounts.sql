-- Execute uma vez, depois de schema.sql e 002_roles_username.sql.
begin;
-- Marcador permanente: não depende do nome atual ou da existência da conta.
create table public.initial_admin_setup (
 singleton boolean primary key default true check(singleton),
 user_id uuid not null,
 created_at timestamptz not null default now()
);
alter table public.initial_admin_setup enable row level security;
revoke all on public.initial_admin_setup from public, anon, authenticated;
grant select on public.initial_admin_setup to service_role;
-- Nunca substitui conta admin preexistente.
insert into public.initial_admin_setup(singleton,user_id)
 select true,id from public.profiles where username='admin' limit 1;
create or replace function public.create_profile() returns trigger language plpgsql security definer set search_path = '' as $$
declare
 is_initial boolean := coalesce((new.raw_app_meta_data->>'initial_admin') = 'true',false);
 chosen_username text := lower(trim(new.raw_user_meta_data->>'username'));
begin
 if chosen_username = 'admin' and not is_initial then
  raise exception 'Nome de usuário reservado.';
 end if;
 if is_initial then
  if chosen_username <> 'admin' then raise exception 'Administrador inicial inválido.'; end if;
  -- PK também impede criação concorrente ou recriação após renomear/excluir.
  insert into public.initial_admin_setup(singleton,user_id) values(true,new.id);
 end if;
 insert into public.profiles(id,name,username,role,requested_role,active)
 values(new.id,left(coalesce(nullif(trim(new.raw_user_meta_data->>'name'),''),'Colaborador'),100),
 chosen_username,
 case when is_initial then 'admin' when new.raw_user_meta_data->>'requested_role'='repositor' then 'repositor' else 'vendedor' end,
 case when new.raw_user_meta_data->>'requested_role' in ('estoquista','repositor') then new.raw_user_meta_data->>'requested_role' else 'vendedor' end,
 is_initial);
 return new;
end; $$;
-- As contas da loja deixam de depender de confirmação de e-mail.
update auth.users set email_confirmed_at=now()
 where email_confirmed_at is null and id in(select id from public.profiles);
commit;
