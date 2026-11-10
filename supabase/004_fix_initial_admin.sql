-- Correção do administrador inicial. Execute após a migração 003.
begin;
create or replace function public.create_profile() returns trigger language plpgsql security definer set search_path='' as $$
declare chosen_username text := lower(trim(new.raw_user_meta_data->>'username'));
begin
 if chosen_username='admin' then raise exception 'Nome de usuário reservado.'; end if;
 insert into public.profiles(id,name,username,role,requested_role,active)
 values(new.id,left(coalesce(nullif(trim(new.raw_user_meta_data->>'name'),''),'Colaborador'),100),
 chosen_username,
 case when new.raw_user_meta_data->>'requested_role'='repositor' then 'repositor' else 'vendedor' end,
 case when new.raw_user_meta_data->>'requested_role' in ('estoquista','repositor') then new.raw_user_meta_data->>'requested_role' else 'vendedor' end,false);
 return new;
end; $$;

-- Somente o servidor pode finalizar a criação, após o Auth salvar os metadados.
create or replace function public.finish_initial_admin() returns uuid
language plpgsql security definer set search_path='' as $$
declare target_id uuid; previous_id uuid;
begin
 perform pg_catalog.pg_advisory_xact_lock(708142);
 select user_id into previous_id from public.initial_admin_setup where singleton=true;
 if previous_id is not null then return previous_id; end if;
 select id into target_id from auth.users
 where email='initial-admin@repoe.invalid'
 and raw_app_meta_data->>'initial_admin'='true'
 and raw_app_meta_data->>'password_format'='sha256-v1';
 if target_id is null then return null; end if;
 if exists(select 1 from public.profiles where username='admin' and id<>target_id)
 then raise exception 'Já existe uma conta admin; nenhuma conta foi alterada.'; end if;
 update public.profiles set username='admin',role='admin',active=true where id=target_id;
 if not found then raise exception 'Perfil inicial não encontrado.'; end if;
 insert into public.initial_admin_setup(singleton,user_id) values(true,target_id);
 return target_id;
end; $$;
revoke all on function public.finish_initial_admin() from public,anon,authenticated;
grant execute on function public.finish_initial_admin() to service_role;
commit;
