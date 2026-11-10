-- Execute depois de 005_restock_lists.sql, antes de publicar.
begin;
alter table public.restock_lists add column revision integer not null default 1;
alter table public.restock_lists add column last_edit uuid;
create function public.edit_restock_list(list_key uuid,expected_revision integer,edit_key uuid,items jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); parent public.restock_lists%rowtype; entry jsonb; qty numeric;
begin
 if not public.has_role(array['vendedor','repositor']) then raise exception 'Acesso não autorizado.'; end if;
 select * into parent from public.restock_lists where id=list_key for update;
 if not found or parent.created_by<>actor then raise exception 'Lista não encontrada ou sem permissão.'; end if;
 if edit_key is null then raise exception 'Identificador da edição obrigatório.'; end if;
 if parent.last_edit=edit_key then return; end if;
 if parent.status<>'pendente' then raise exception 'A separação já começou. Esta lista não pode ser editada.'; end if;
 if expected_revision is distinct from parent.revision then raise exception 'A lista foi alterada. Atualize e abra a edição novamente.'; end if;
 if items is null or jsonb_typeof(items)<>'array' then raise exception 'Lista inválida.'; end if;
 if jsonb_array_length(items)<1 or jsonb_array_length(items)>200 then raise exception 'A lista deve ter entre 1 e 200 itens.'; end if;
 delete from public.restock_requests where list_id=list_key;
 update public.restock_lists set priority='normal' where id=list_key;
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
 update public.restock_lists set revision=revision+1,last_edit=edit_key where id=list_key;
end; $$;
create function public.delete_restock_list(list_key uuid,expected_revision integer) returns void
language plpgsql security definer set search_path='' as $$
declare parent public.restock_lists%rowtype;
begin
 if not public.has_role(array['vendedor','repositor']) then raise exception 'Acesso não autorizado.'; end if;
 select * into parent from public.restock_lists where id=list_key for update;
 if not found or parent.created_by<>auth.uid() then raise exception 'Lista não encontrada ou sem permissão.'; end if;
 if parent.status<>'pendente' then raise exception 'A separação já começou. Esta lista não pode ser excluída.'; end if;
 if expected_revision is distinct from parent.revision then raise exception 'A lista foi alterada. Atualize antes de excluir.'; end if;
 delete from public.restock_requests where list_id=list_key;
 delete from public.restock_lists where id=list_key;
end; $$;
revoke all on function public.edit_restock_list(uuid,integer,uuid,jsonb) from public;
revoke all on function public.delete_restock_list(uuid,integer) from public;
grant execute on function public.edit_restock_list(uuid,integer,uuid,jsonb) to authenticated;
grant execute on function public.delete_restock_list(uuid,integer) to authenticated;
create or replace function public.set_restock_item_picked(item_key uuid,is_picked boolean) returns void
language plpgsql security definer set search_path='' as $$
declare parent_id uuid; current_status text;
begin
 if not public.has_role(array['estoquista','admin']) then raise exception 'Acesso não autorizado.'; end if;
 if is_picked is null then raise exception 'Seleção inválida.'; end if;
 select list_id into parent_id from public.restock_requests where id=item_key;
 if not found then raise exception 'Item não encontrado.'; end if;
 select status into current_status from public.restock_lists where id=parent_id for update;
 if not found then raise exception 'Lista não encontrada.'; end if;
 if current_status='pronta' then raise exception 'Esta lista já está pronta.'; end if;
 update public.restock_requests set picked=is_picked where id=item_key;
 if not found then raise exception 'A lista foi editada. Atualize os itens antes de separar.'; end if;
 update public.restock_lists set status='em_separacao' where id=parent_id;
end; $$;

commit;
