-- Execute após a migração 006. Preserva itens e listas existentes.
begin;
alter table public.restock_requests add column unavailable boolean not null default false;
alter table public.restock_requests add constraint restock_item_single_state check(not (picked and unavailable));
create or replace function public.set_restock_item_state(item_key uuid,item_state text) returns void
language plpgsql security definer set search_path='' as $$
declare parent_id uuid; current_status text;
begin
 if not public.has_role(array['estoquista','admin']) then raise exception 'Acesso não autorizado.'; end if;
 if item_state is null or item_state not in ('pendente','separado','em_falta') then raise exception 'Seleção inválida.'; end if;
 select list_id into parent_id from public.restock_requests where id=item_key;
 if not found then raise exception 'Item não encontrado.'; end if;
 select status into current_status from public.restock_lists where id=parent_id for update;
 if not found then raise exception 'Lista não encontrada.'; end if;
 if current_status='pronta' then raise exception 'Esta lista já está pronta.'; end if;
 update public.restock_requests set picked=(item_state='separado'), unavailable=(item_state='em_falta') where id=item_key;
 if not found then raise exception 'A lista foi editada. Atualize os itens antes de separar.'; end if;
 update public.restock_lists set status='em_separacao' where id=parent_id;
end; $$;


-- Compatibilidade com telas antigas: separado e em falta nunca coexistem.
create or replace function public.set_restock_item_picked(item_key uuid,is_picked boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
 if is_picked is null then raise exception 'Seleção inválida.'; end if;
 perform public.set_restock_item_state(item_key,case when is_picked then 'separado' else 'pendente' end);
end; $$;
create or replace function public.mark_restock_list_ready(list_key uuid) returns void
language plpgsql security definer set search_path='' as $$
declare current_status text;
begin
 if not public.has_role(array['estoquista','admin']) then raise exception 'Acesso não autorizado.'; end if;
 select status into current_status from public.restock_lists where id=list_key for update;
 if not found then raise exception 'Lista não encontrada.'; end if;
 if current_status='pronta' then return; end if;
 if not exists(select 1 from public.restock_requests where list_id=list_key)
 or exists(select 1 from public.restock_requests where list_id=list_key and not picked and not unavailable)
 then raise exception 'Marque cada item como separado ou em falta antes de confirmar.'; end if;
 update public.restock_lists set status='pronta',ready_at=now(),ready_by=auth.uid() where id=list_key;
 update public.restock_requests set status='concluido',completed_at=now(),completed_by=auth.uid() where list_id=list_key;
end; $$;

revoke all on function public.set_restock_item_state(uuid,text) from public;
grant execute on function public.set_restock_item_state(uuid,text) to authenticated;
commit;
