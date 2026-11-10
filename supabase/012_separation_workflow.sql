begin;
alter table public.restock_lists add column separating_by uuid references public.profiles(id), add column separating_name text, add column separation_started_at timestamptz;
alter table public.restock_requests add column fulfilled_quantity integer;
update public.restock_requests set fulfilled_quantity=case when picked then quantity when unavailable then 0 end;
alter table public.restock_requests add constraint fulfilled_range check(fulfilled_quantity between 0 and quantity);
create function public.start_restock_separation(list_key uuid) returns void language plpgsql security definer set search_path='' as $$
declare parent public.restock_lists%rowtype;
begin
 if not public.has_role(array['estoquista','admin']) then raise exception 'Acesso não autorizado.'; end if;
 select * into parent from public.restock_lists where id=list_key for update;
 if not found or parent.status='pronta' then raise exception 'Lista indisponível para separação.'; end if;
 if parent.separating_by is not null and parent.separating_by<>auth.uid() and not public.has_role(array['admin']) then raise exception 'Esta lista está sendo separada por %.',parent.separating_name; end if;
 if parent.separating_by is null then
 update public.restock_lists set separating_by=auth.uid(),separating_name=(select name from public.profiles where id=auth.uid()),separation_started_at=now(),status='em_separacao' where id=list_key;
 end if;
end; $$;
create function public.set_restock_quantity(item_key uuid,amount integer) returns void language plpgsql security definer set search_path='' as $$
declare parent_id uuid; requested integer;
begin
 select list_id into parent_id from public.restock_requests where id=item_key;
 if not found then raise exception 'Item não encontrado.'; end if;
 perform public.start_restock_separation(parent_id);
 select quantity into requested from public.restock_requests where id=item_key;
 if not found then raise exception 'Lista alterada. Atualize a tela.'; end if;
 if amount is null or amount<0 or amount>requested then raise exception 'Quantidade deve estar entre zero e %.',requested; end if;
 update public.restock_requests set fulfilled_quantity=amount,picked=(amount=requested),unavailable=(amount<requested) where id=item_key;
end; $$;
create or replace function public.set_restock_item_state(item_key uuid,item_state text) returns void language plpgsql security definer set search_path='' as $$
declare parent_id uuid; requested integer;
begin
 select list_id,quantity into parent_id,requested from public.restock_requests where id=item_key;
 if not found then raise exception 'Item não encontrado.'; end if;
 if item_state is null or item_state not in ('pendente','separado','em_falta') then raise exception 'Situação inválida.'; end if;
 perform public.start_restock_separation(parent_id);
 if item_state='pendente' then update public.restock_requests set fulfilled_quantity=null,picked=false,unavailable=false where id=item_key;
 else perform public.set_restock_quantity(item_key,case when item_state='separado' then requested else 0 end); end if;
end; $$;
create or replace function public.mark_restock_list_ready(list_key uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform public.start_restock_separation(list_key);
 if not exists(select 1 from public.restock_requests where list_id=list_key) or exists(select 1 from public.restock_requests where list_id=list_key and fulfilled_quantity is null) then raise exception 'Confira a quantidade atendida de todos os itens.'; end if;
 update public.restock_lists set status='pronta',ready_at=now(),ready_by=auth.uid() where id=list_key;
 update public.restock_requests set status='concluido',completed_at=now(),completed_by=auth.uid() where list_id=list_key;
end; $$;
create index restock_history_date on public.restock_lists(created_at desc,number desc);
create index restock_duplicate_code on public.restock_requests(product_code,aisle,list_id);
create function public.find_restock_duplicates(code text,corridor text,except_list uuid default null) returns table(number bigint,requester_name text) language sql stable security invoker set search_path='' as $$
 select distinct l.number,l.requester_name from public.restock_lists l join public.restock_requests i on i.list_id=l.id where l.status<>'pronta' and (except_list is null or l.id<>except_list) and i.product_code=code and lower(trim(i.aisle))=lower(trim(corridor)) limit 5;
$$;
revoke all on function public.start_restock_separation(uuid),public.set_restock_quantity(uuid,integer),public.find_restock_duplicates(text,text,uuid) from public;
grant execute on function public.start_restock_separation(uuid),public.set_restock_quantity(uuid,integer),public.find_restock_duplicates(text,text,uuid) to authenticated;
commit;
