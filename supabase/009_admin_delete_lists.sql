-- Execute após a migração 008.
begin;
create or replace function public.delete_restock_list(list_key uuid,expected_revision integer) returns void
language plpgsql security definer set search_path='' as $$
declare parent public.restock_lists%rowtype; is_admin boolean:=public.has_role(array['admin']);
begin
 if not public.has_role(array['admin','vendedor','repositor']) then raise exception 'Acesso não autorizado.'; end if;
 select * into parent from public.restock_lists where id=list_key for update;
 if not found then raise exception 'Lista não encontrada.'; end if;
 if not is_admin then
  if parent.created_by<>auth.uid() then raise exception 'Sem permissão para excluir esta lista.'; end if;
  if parent.status<>'pendente' then raise exception 'A separação já começou. Esta lista não pode ser excluída.'; end if;
 end if;
 if expected_revision is distinct from parent.revision then raise exception 'A lista foi alterada. Atualize antes de excluir.'; end if;
 delete from public.restock_requests where list_id=list_key;
 delete from public.restock_lists where id=list_key;
end; $$;
revoke all on function public.delete_restock_list(uuid,integer) from public;
grant execute on function public.delete_restock_list(uuid,integer) to authenticated;
commit;
