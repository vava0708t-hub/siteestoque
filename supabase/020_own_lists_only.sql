-- Execute após 019_report_lookup.sql no SQL Editor.
-- Vendedor e repositor veem só as listas que eles criaram.
-- Estoquista e administrador continuam vendo todas as listas.
begin;

drop policy if exists read_team_lists on public.restock_lists;
drop policy if exists read_lists on public.restock_lists;
create policy read_lists on public.restock_lists for select to authenticated using(
 public.has_role(array['estoquista','admin'])
 or (created_by=(select auth.uid()) and public.has_role(array['vendedor','repositor']))
);

drop policy if exists team_requests on public.restock_requests;
drop policy if exists read_requests on public.restock_requests;
create policy read_requests on public.restock_requests for select to authenticated using(
 public.has_role(array['estoquista','admin'])
 or (public.has_role(array['vendedor','repositor']) and exists(select 1 from public.restock_lists l where l.id=list_id and l.created_by=(select auth.uid())))
);
create index if not exists restock_lists_owner on public.restock_lists(created_by,created_at desc);

-- O aviso de "item já pedido em outra lista" continua olhando as listas de toda a equipe,
-- mas mostra só o número e quem pediu (sem abrir a lista).
create or replace function public.find_restock_duplicates(code text,corridor text,except_list uuid default null) returns table(number bigint,requester_name text)
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.has_role(array['admin','estoquista','vendedor','repositor']) then raise exception 'Acesso não autorizado.'; end if;
 return query select distinct l.number,l.requester_name from public.restock_lists l join public.restock_requests i on i.list_id=l.id
  where l.status<>'pronta' and (except_list is null or l.id<>except_list) and i.product_code=code and lower(trim(i.aisle))=lower(trim(corridor)) limit 5;
end; $$;
revoke all on function public.find_restock_duplicates(text,text,uuid) from public,anon;
grant execute on function public.find_restock_duplicates(text,text,uuid) to authenticated;

commit;
