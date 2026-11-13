-- Execute após 018_payment_conditions.sql no SQL Editor.
-- 1) Listas prontas ficam 120 dias (antes 60) com número e data; depois viram resumo diário.
-- 2) Relatórios aceitam até 124 dias por consulta (antes 93).
-- 3) Mais solicitados traz o número e a data das listas de cada produto.
-- 4) Nova consulta: em quais listas e datas um item foi pedido.
begin;

create or replace function public.purge_expired_restock_lists() returns integer
language plpgsql security definer set search_path='' as $$
declare ids uuid[]; removed integer;
begin
 select array_agg(id) into ids from (select id from public.restock_lists where status='pronta' and ready_at<now()-interval '120 days' for update skip locked) expired;
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
 if date_from is null or date_to is null or date_to<date_from or date_to-date_from>123 then raise exception 'Escolha até 124 dias por consulta.'; end if;
 if state is null or state not in ('all','pronta','pendente','em_separacao') then raise exception 'Situação inválida.'; end if;
 if requester is null or length(requester)>100 then raise exception 'Solicitante inválido.'; end if;
 with live_lists as (
 select l.* from public.restock_lists l where l.created_at >= (date_from::timestamp at time zone 'America/Fortaleza') and l.created_at < ((date_to+1)::timestamp at time zone 'America/Fortaleza')
 and (team or l.created_by=actor) and (state='all' or l.status=state)
 and (requester='' or strpos(lower(l.requester_name),lower(requester))>0)
 ), live_items as (select r.*,l.number list_number,l.created_at list_created from public.restock_requests r join live_lists l on l.id=r.list_id),
 archived_totals as (select * from public.restock_daily_totals t where state in ('all','pronta') and t.day between date_from and date_to and (team or t.requester_id=actor) and (requester='' or strpos(lower(t.requester_name),lower(requester))>0)),
 rows as (
 select product_code,product_name,unit,sum(quantity) quantity,count(distinct list_id) lists,count(*) occurrences,0::bigint archived from live_items group by 1,2,3
 union all
 select product_code,product_name,unit,quantity,list_count,item_count,list_count from public.restock_daily_products p where state in ('all','pronta') and p.day between date_from and date_to and (team or p.requester_id=actor) and (requester='' or strpos(lower(p.requester_name),lower(requester))>0)
 ), grouped as (select product_code code,product_name name,unit,sum(quantity) quantity,sum(lists) lists,sum(occurrences) occurrences,sum(archived) archived from rows group by 1,2,3),
 ranked as (
  select g.*,(select coalesce(jsonb_agg(jsonb_build_object('number',x.list_number,'date',x.list_created) order by x.list_created desc),'[]'::jsonb)
   from (select distinct i.list_number,i.list_created from live_items i where i.product_code=g.code and i.product_name=g.name and i.unit=g.unit order by i.list_created desc limit 30) x) recent
  from grouped g order by lists desc,occurrences desc,name,code,unit limit 50)
 select jsonb_build_object('listCount',(select count(*) from live_lists)+coalesce((select sum(list_count) from archived_totals),0),'itemCount',(select count(*) from live_items)+coalesce((select sum(item_count) from archived_totals),0),'productCount',(select count(*) from grouped),'products',coalesce((select jsonb_agg(to_jsonb(r) order by lists desc,occurrences desc,name,code,unit) from ranked r),'[]'::jsonb)) into result;
 return result;
end; $$;
revoke all on function public.restock_report(date,date,text,text) from public,anon;
grant execute on function public.restock_report(date,date,text,text) to authenticated;

-- Em quais listas (número, data, solicitante) um item foi pedido.
-- search: código ou palavras do nome; codes: códigos já resolvidos pelo site (ex.: código de barras bipado).
-- Limite de 300 pedidos e 100 dias resumidos por consulta para não pesar no banco.
create or replace function public.restock_item_history(date_from date,date_to date,search text,codes text[] default '{}') returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=auth.uid(); team boolean; words text[]; result jsonb;
begin
 if not public.has_role(array['admin','estoquista','vendedor','repositor']) then raise exception 'Acesso não autorizado.'; end if;
 team:=public.has_role(array['admin','estoquista']);
 if date_from is null or date_to is null or date_to<date_from or date_to-date_from>123 then raise exception 'Escolha até 124 dias por consulta.'; end if;
 search:=lower(trim(coalesce(search,'')));
 if search='' or length(search)>100 or (length(search)<2 and search !~ '^[0-9]+$') then raise exception 'Digite pelo menos 2 letras ou o código do item.'; end if;
 if coalesce(array_length(codes,1),0)>20 then raise exception 'Muitos códigos na busca.'; end if;
 words:=array(select w from unnest(string_to_array(search,' ')) w where w<>'');
 with matches as (
  select l.number,l.created_at,l.requester_name,l.status,r.product_code,r.product_name,r.unit,r.quantity
  from public.restock_requests r join public.restock_lists l on l.id=r.list_id
  where l.created_at >= (date_from::timestamp at time zone 'America/Fortaleza') and l.created_at < ((date_to+1)::timestamp at time zone 'America/Fortaleza')
  and (team or l.created_by=actor)
  and (r.product_code=any(codes) or lower(r.product_code)=search or not exists(select 1 from unnest(words) w where strpos(lower(r.product_name),w)=0))
 ), archived as (
  select p.day,p.requester_name,p.product_code,p.product_name,p.unit,p.quantity,p.list_count
  from public.restock_daily_products p
  where p.day between date_from and date_to and (team or p.requester_id=actor)
  and (p.product_code=any(codes) or lower(p.product_code)=search or not exists(select 1 from unnest(words) w where strpos(lower(p.product_name),w)=0))
 )
 select jsonb_build_object(
  'total',(select count(*) from matches),
  'items',coalesce((select jsonb_agg(to_jsonb(m) order by m.created_at desc,m.number desc) from (select * from matches order by created_at desc,number desc limit 300) m),'[]'::jsonb),
  'archived',coalesce((select jsonb_agg(to_jsonb(a) order by a.day desc) from (select * from archived order by day desc limit 100) a),'[]'::jsonb)
 ) into result;
 return result;
end; $$;
revoke all on function public.restock_item_history(date,date,text,text[]) from public,anon;
grant execute on function public.restock_item_history(date,date,text,text[]) to authenticated;

commit;
