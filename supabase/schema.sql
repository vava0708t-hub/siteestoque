-- Execute uma vez no SQL Editor do projeto Supabase.
begin;
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (length(name) between 1 and 100),
  role text not null default 'vendedor' check (role in ('vendedor','estoquista')),
  requested_role text not null default 'vendedor' check (requested_role in ('vendedor','estoquista'))
);
create function public.create_profile() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id,name,requested_role) values (
    new.id, left(coalesce(nullif(trim(new.raw_user_meta_data->>'name'),''),'Colaborador'),100),
    case when new.raw_user_meta_data->>'requested_role' = 'estoquista' then 'estoquista' else 'vendedor' end
  );
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.create_profile();
create table public.restock_requests (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles(id),
  product_code text not null check(length(product_code) between 1 and 100),
  product_name text not null check(length(product_name) between 1 and 300),
  unit text not null default 'un.' check(length(unit) between 1 and 30),
  quantity integer not null check(quantity between 1 and 99999),
  priority text not null default 'normal' check(priority in ('normal','urgente')),
  notes text not null default '' check(length(notes) <= 500),
  status text not null default 'pendente' check(status in ('pendente','concluido')),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  completed_by uuid references public.profiles(id)
);
create index restock_created_at on public.restock_requests(created_at desc);
alter table public.profiles enable row level security;
alter table public.restock_requests enable row level security;
revoke all on public.profiles, public.restock_requests from anon, authenticated;
grant select on public.profiles, public.restock_requests to authenticated;
grant insert(created_by,product_code,product_name,unit,quantity,priority,notes) on public.restock_requests to authenticated;
create policy own_profile on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy team_requests on public.restock_requests for select to authenticated using (exists(select 1 from public.profiles where id = (select auth.uid())));
create policy create_own_request on public.restock_requests for insert to authenticated with check (created_by = (select auth.uid()) and exists(select 1 from public.profiles where id = (select auth.uid())));
create function public.complete_restock(request_id uuid) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists(select 1 from public.profiles where id = auth.uid() and role = 'estoquista') then
    raise exception 'Apenas estoquistas aprovados podem concluir reposições.';
  end if;
  update public.restock_requests set status = 'concluido', completed_at = now(), completed_by = auth.uid() where id = request_id and status = 'pendente';
  if not found then raise exception 'Pedido já concluído ou não encontrado.'; end if;
end;
$$;
revoke all on function public.create_profile() from public;
revoke all on function public.complete_restock(uuid) from public;
grant execute on function public.complete_restock(uuid) to authenticated;
commit;
