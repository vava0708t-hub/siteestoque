-- Executar no SQL Editor do Supabase como postgres.
-- Remove apenas listas prontas há mais de 60 dias; pendentes não são removidas.
begin;
create extension if not exists pg_cron;
create index if not exists restock_lists_ready_retention on public.restock_lists(ready_at) where status='pronta';
create or replace function public.purge_expired_restock_lists() returns integer
language plpgsql security definer set search_path='' as $$
declare ids uuid[]; removed integer;
begin
 select array_agg(id) into ids from (select id from public.restock_lists
 where status='pronta' and ready_at < now()-interval '60 days'
 for update skip locked) expired;
 if ids is null then return 0; end if;
 delete from public.restock_requests where list_id=any(ids);
 delete from public.restock_lists where id=any(ids);
 get diagnostics removed=row_count;
 return removed;
end; $$;
revoke all on function public.purge_expired_restock_lists() from public,anon,authenticated;
select cron.schedule('restock-history-retention','15 6 * * 1','select public.purge_expired_restock_lists();');
commit;
