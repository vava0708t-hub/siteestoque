-- Execute uma vez depois da migração 004. Preserva solicitações antigas.
begin;
create table public.restock_lists (
 id uuid primary key,
 number bigint generated always as identity unique,
 created_by uuid not null references public.profiles(id),
 requester_name text not null,
 status text not null default 'pendente' check(status in ('pendente','em_separacao','pronta')),
 priority text not null default 'normal' check(priority in ('normal','urgente')),
 created_at timestamptz not null default now(),
 ready_at timestamptz,
 ready_by uuid references public.profiles(id)
);
alter table public.restock_requests add column list_id uuid references public.restock_lists(id);
alter table public.restock_requests add column picked boolean not null default false;
-- Cada pedido antigo se torna uma lista de um item, sem apagar seu histórico.
insert into public.restock_lists(id,created_by,requester_name,status,priority,created_at,ready_at,ready_by)
 select id,created_by,coalesce(requester_name,'Equipe'),
 case when status='concluido' then 'pronta' else 'pendente' end,
 priority,created_at,completed_at,completed_by from public.restock_requests order by created_at;
update public.restock_requests set list_id=id,picked=(status='concluido');
alter table public.restock_requests alter column list_id set not null;
create index restock_items_list on public.restock_requests(list_id);
create index restock_lists_created on public.restock_lists(created_at desc);
alter table public.restock_lists enable row level security;
revoke all on public.restock_lists from public,anon,authenticated;
grant select on public.restock_lists to authenticated;
create policy read_team_lists on public.restock_lists for select to authenticated
 using(public.has_role(array['vendedor','repositor','estoquista','admin']));
-- A criação passa exclusivamente pela função transacional abaixo.
drop policy create_own_request on public.restock_requests;
create or replace function public.complete_restock(request_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin raise exception 'Use a separação da lista e confirme como pronta.'; end; $$;

create function public.submit_restock_list(list_key uuid,items jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); actor_name text; existing_owner uuid; entry jsonb; qty numeric;
begin
 if not public.has_role(array['vendedor','repositor']) then raise exception 'Acesso não autorizado.'; end if;
 if list_key is null then raise exception 'Identificador da lista obrigatório.'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(list_key::text,0));
 select created_by into existing_owner from public.restock_lists where id=list_key;
 if found then
  if existing_owner<>actor then raise exception 'Identificador indisponível.'; end if;
  return list_key;
 end if;
 if items is null or jsonb_typeof(items)<>'array' then raise exception 'Lista inválida.'; end if;
 if jsonb_array_length(items)<1 or jsonb_array_length(items)>200 then raise exception 'A lista deve ter entre 1 e 200 itens.'; end if;
 select name into actor_name from public.profiles where id=actor;
 -- Qualquer falha cancela a lista inteira.
 insert into public.restock_lists(id,created_by,requester_name) values(list_key,actor,actor_name);
 for entry in select value from jsonb_array_elements(items) loop
  if jsonb_typeof(entry)<>'object' or coalesce(entry->>'quantity','') !~ '^[0-9]{1,5}$' then raise exception 'Quantidade inválida.'; end if;
  qty:=(entry->>'quantity')::numeric;
  if qty<1 or qty>99999
   or length(trim(coalesce(entry->>'product_code',''))) not between 1 and 100
   or length(trim(coalesce(entry->>'product_name',''))) not between 1 and 300
   or length(trim(coalesce(entry->>'aisle',''))) not between 1 and 60
   or coalesce(entry->>'unit','') not in ('und','cx','pct','fardo','kg','lt')
   or coalesce(entry->>'priority','') not in ('normal','urgente')
   or length(coalesce(entry->>'notes',''))>500 then raise exception 'Confira os dados de todos os itens.'; end if;
  insert into public.restock_requests(created_by,product_code,product_name,unit,quantity,priority,notes,aisle,list_id)
  values(actor,trim(entry->>'product_code'),trim(entry->>'product_name'),entry->>'unit',qty::integer,entry->>'priority',coalesce(entry->>'notes',''),trim(entry->>'aisle'),list_key);
 end loop;
 update public.restock_lists set priority='urgente' where id=list_key
 and exists(select 1 from public.restock_requests where list_id=list_key and priority='urgente');
 return list_key;
end; $$;

create function public.set_restock_item_picked(item_key uuid,is_picked boolean) returns void
language plpgsql security definer set search_path='' as $$
declare parent_id uuid; current_status text;
begin
 if not public.has_role(array['estoquista','admin']) then raise exception 'Acesso não autorizado.'; end if;
 if is_picked is null then raise exception 'Seleção inválida.'; end if;
 select list_id into parent_id from public.restock_requests where id=item_key;
 if not found then raise exception 'Item não encontrado.'; end if;
 select status into current_status from public.restock_lists where id=parent_id for update;
 if current_status='pronta' then raise exception 'Esta lista já está pronta.'; end if;
 update public.restock_requests set picked=is_picked where id=item_key;
 update public.restock_lists set status='em_separacao' where id=parent_id;
end; $$;

create function public.mark_restock_list_ready(list_key uuid) returns void
language plpgsql security definer set search_path='' as $$
declare current_status text;
begin
 if not public.has_role(array['estoquista','admin']) then raise exception 'Acesso não autorizado.'; end if;
 select status into current_status from public.restock_lists where id=list_key for update;
 if not found then raise exception 'Lista não encontrada.'; end if;
 if current_status='pronta' then return; end if;
 if not exists(select 1 from public.restock_requests where list_id=list_key)
 or exists(select 1 from public.restock_requests where list_id=list_key and not picked)
 then raise exception 'Separe todos os itens antes de confirmar.'; end if;
 update public.restock_lists set status='pronta',ready_at=now(),ready_by=auth.uid() where id=list_key;
 update public.restock_requests set status='concluido',completed_at=now(),completed_by=auth.uid() where list_id=list_key;
end; $$;
revoke all on function public.submit_restock_list(uuid,jsonb) from public;
revoke all on function public.set_restock_item_picked(uuid,boolean) from public;
revoke all on function public.mark_restock_list_ready(uuid) from public;
grant execute on function public.submit_restock_list(uuid,jsonb) to authenticated;
grant execute on function public.set_restock_item_picked(uuid,boolean) to authenticated;
grant execute on function public.mark_restock_list_ready(uuid) to authenticated;
commit;

