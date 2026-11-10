begin;
-- Confirmar lista pronta não exige mais marcar cada item como Separado/Em falta.
-- Itens sem quantidade informada são considerados separados por completo;
-- quantidades parciais já salvas são preservadas.
create or replace function public.mark_restock_list_ready(list_key uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform public.start_restock_separation(list_key);
 if not exists(select 1 from public.restock_requests where list_id=list_key) then raise exception 'A lista não possui itens.'; end if;
 update public.restock_requests set fulfilled_quantity=quantity,picked=true,unavailable=false where list_id=list_key and fulfilled_quantity is null;
 update public.restock_lists set status='pronta',ready_at=now(),ready_by=auth.uid() where id=list_key;
 update public.restock_requests set status='concluido',completed_at=now(),completed_by=auth.uid() where list_id=list_key;
end; $$;
commit;
