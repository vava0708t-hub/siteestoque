-- Execute após schema.sql. Migração da versão inicial; preserva pedidos e contas.
begin;
alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles drop constraint profiles_requested_role_check;
alter table public.profiles add constraint profiles_role_check check(role in ('vendedor','repositor','estoquista','admin'));
alter table public.profiles add constraint profiles_requested_role_check check(requested_role in ('vendedor','repositor','estoquista'));
alter table public.profiles add column username text;
update public.profiles set username = 'user_' || left(replace(id::text,'-',''),24);
alter table public.profiles alter column username set not null;
alter table public.profiles add constraint profiles_username_check check(username ~ '^[a-z0-9][a-z0-9._-]{2,29}$');
alter table public.profiles add constraint profiles_username_key unique(username);
alter table public.profiles add column active boolean not null default false;
-- Contas existentes mantêm o acesso anterior. Novos cadastros aguardam aprovação.
update public.profiles set active = true;
alter table public.restock_requests add column aisle text;
alter table public.restock_requests add column requester_name text;
update public.restock_requests r set requester_name = p.name from public.profiles p where p.id = r.created_by;
alter table public.restock_requests add constraint restock_aisle_check check(aisle is null or length(trim(aisle)) between 1 and 60);
create or replace function public.create_profile() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 insert into public.profiles(id,name,username,role,requested_role,active)
 values(new.id,left(coalesce(nullif(trim(new.raw_user_meta_data->>'name'),''),'Colaborador'),100),
 lower(trim(new.raw_user_meta_data->>'username')),
 case when new.raw_user_meta_data->>'requested_role' = 'repositor' then 'repositor' else 'vendedor' end,
 case when new.raw_user_meta_data->>'requested_role' in ('estoquista','repositor') then new.raw_user_meta_data->>'requested_role' else 'vendedor' end,false);
 return new;
end; $$;
create function public.has_role(allowed text[]) returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.profiles where id = auth.uid() and active and role = any(allowed));
$$;
revoke all on function public.has_role(text[]) from public;
grant execute on function public.has_role(text[]) to authenticated;
drop policy own_profile on public.profiles;
create policy own_or_admin_profile on public.profiles for select to authenticated using(id = (select auth.uid()) or public.has_role(array['admin']));
drop policy team_requests on public.restock_requests;
create policy team_requests on public.restock_requests for select to authenticated using(public.has_role(array['vendedor','repositor','estoquista','admin']));
drop policy create_own_request on public.restock_requests;
create policy create_own_request on public.restock_requests for insert to authenticated with check(
 created_by = (select auth.uid()) and public.has_role(array['vendedor','repositor'])
 and aisle is not null and length(trim(aisle)) between 1 and 60
 and unit in ('und','cx','pct','fardo','kg','lt')
);
grant insert(aisle) on public.restock_requests to authenticated;
create function public.stamp_requester() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 select name into new.requester_name from public.profiles where id = new.created_by;
 return new;
end; $$;
create trigger stamp_requester before insert on public.restock_requests for each row execute function public.stamp_requester();
revoke all on function public.stamp_requester() from public;
create or replace function public.complete_restock(request_id uuid) returns void language plpgsql security definer set search_path = '' as $$
begin
 if not public.has_role(array['estoquista','admin']) then raise exception 'Acesso não autorizado.'; end if;
 update public.restock_requests set status='concluido',completed_at=now(),completed_by=auth.uid() where id=request_id and status='pendente';
 if not found then raise exception 'Pedido já concluído ou não encontrado.'; end if;
end; $$;
create function public.admin_set_access(target_id uuid,new_role text,new_active boolean) returns void language plpgsql security definer set search_path = '' as $$
begin
 if not public.has_role(array['admin']) then raise exception 'Acesso não autorizado.'; end if;
 if target_id = auth.uid() then raise exception 'Não é permitido alterar seu próprio acesso.'; end if;
 if new_role is null or new_role not in ('admin','estoquista','repositor','vendedor') or new_active is null then raise exception 'Perfil inválido.'; end if;
 update public.profiles set role=new_role,active=new_active where id=target_id;
 if not found then raise exception 'Usuário não encontrado.'; end if;
end; $$;
revoke all on function public.admin_set_access(uuid,text,boolean) from public;
grant execute on function public.admin_set_access(uuid,text,boolean) to authenticated;
commit;

