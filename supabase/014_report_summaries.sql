-- Execute após 013 no SQL Editor. Mantém o agendamento semanal existente.
begin;
create table if not exists public.restock_daily_totals (
 day date not null, requester_id uuid not null, requester_name text not null,
 list_count bigint not null, item_count bigint not null,
 primary key(day,requester_id,requester_name)
);
create table if not exists public.restock_daily_products (
 day date not null, requester_id uuid not null, requester_name text not null,
 product_code text not null, product_name text not null, unit text not null,
 quantity numeric not null, list_count bigint not null, item_count bigint not null,
 primary key(day,requester_id,requester_name,product_code,product_name,unit)
);
alter table public.restock_daily_totals enable row level security;
alter table public.restock_daily_products enable row level security;
revoke all on public.restock_daily_totals,public.restock_daily_products from public,anon,authenticated;
create or replace function public.purge_expired_restock_lists() returns integer
language plpgsql security definer set search_path='' as $$
declare ids uuid[]; removed integer;
begin
 select array_agg(id) into ids from (select id from public.restock_lists where status='pronta' and ready_at<now()-interval '60 days' for update skip locked) expired;
 if ids is null then return 0; end if;
 insert into public.restock_daily_totals as existing
 select (l.created_at at time zone 'America/Fortaleza')::date,l.created_by,l.requester_name,count(distinct l.id),count(r.id)
 from public.restock_lists l join public.restock_requests r on r.list_id=l.id where l.id=any(ids) group by 1,2,3
 on conflict(day,requester_id,requester_name) do update set list_count=existing.list_count+excluded.list_count,item_count=existing.item_count+excluded.item_count;
 insert into public.restock_daily_products as existing
 select (l.created_at at time zone 'America/Fortaleza')::date,l.created_by,l.requester_name,r.product_code,r.product_name,r.unit,sum(r.quantity),count(distinct l.id),count(*)
 from public.restock_lists l join public.restock_requests r on r.list_id=l.id where l.id=any(ids) group by 1,2,3,4,5,6
 on conflict(day,requester_id,requester_name,product_code,product_name,unit) do update set quantity=existing.quantity+excluded.quantity,list_count=existing.list_count+excluded.list_count,item_count=existing.item_count+excluded.item_count;
 delete from public.restock_requests where list_id=any(ids);
 delete from public.restock_lists where id=any(ids);
 get diagnostics removed=row_count;return removed;
end; $$;
revoke all on function public.purge_expired_restock_lists() from public,anon,authenticated;
create or replace function public.restock_report(date_from date,date_to date,requester text default '',state text default 'all') returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); team boolean; result jsonb;
begin
 if not public.has_role(array['admin','estoquista','vendedor','repositor']) then raise exception 'Acesso não autorizado.'; end if;
 team:=public.has_role(array['admin','estoquista']);
 if date_from is null or date_to is null or date_to<date_from or date_to-date_from>92 then raise exception 'Escolha até 93 dias por consulta.'; end if;
 if state is null or state not in ('all','pronta','pendente','em_separacao') then raise exception 'Situação inválida.'; end if;
 if requester is null or length(requester)>100 then raise exception 'Solicitante inválido.'; end if;
 with live_lists as (
 select l.* from public.restock_lists l where l.created_at >= (date_from::timestamp at time zone 'America/Fortaleza') and l.created_at < ((date_to+1)::timestamp at time zone 'America/Fortaleza')
 and (team or l.created_by=actor) and (state='all' or l.status=state)
 and (requester='' or strpos(lower(l.requester_name),lower(requester))>0)
 ), live_items as (select r.* from public.restock_requests r join live_lists l on l.id=r.list_id),
 archived_totals as (select * from public.restock_daily_totals t where state in ('all','pronta') and t.day between date_from and date_to and (team or t.requester_id=actor) and (requester='' or strpos(lower(t.requester_name),lower(requester))>0)),
 rows as (
 select product_code,product_name,unit,sum(quantity) quantity,count(distinct list_id) lists,count(*) occurrences from live_items group by 1,2,3
 union all
 select product_code,product_name,unit,quantity,list_count,item_count from public.restock_daily_products p where state in ('all','pronta') and p.day between date_from and date_to and (team or p.requester_id=actor) and (requester='' or strpos(lower(p.requester_name),lower(requester))>0)
 ), grouped as (select product_code code,product_name name,unit,sum(quantity) quantity,sum(lists) lists,sum(occurrences) occurrences from rows group by 1,2,3),
 ranked as (select * from grouped order by lists desc,occurrences desc,name,code,unit limit 50)
 select jsonb_build_object('listCount',(select count(*) from live_lists)+coalesce((select sum(list_count) from archived_totals),0),'itemCount',(select count(*) from live_items)+coalesce((select sum(item_count) from archived_totals),0),'productCount',(select count(*) from grouped),'products',coalesce((select jsonb_agg(to_jsonb(r) order by lists desc,occurrences desc,name,code,unit) from ranked r),'[]'::jsonb)) into result;
 return result;
end; $$;
revoke all on function public.restock_report(date,date,text,text) from public,anon;
grant execute on function public.restock_report(date,date,text,text) to authenticated;
commit;
