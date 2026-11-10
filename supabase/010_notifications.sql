begin;
create table public.list_notifications(
 id uuid primary key default gen_random_uuid(),
 list_id uuid not null references public.restock_lists(id) on delete cascade,
 list_number bigint not null,
 requester_id uuid not null,
 requester_name text not null,
 event text not null check(event in ('submitted','ready')),
 created_at timestamptz not null default clock_timestamp(),
 unique(list_id,event)
);
create index list_notifications_recent on public.list_notifications(created_at desc);
alter table public.list_notifications enable row level security;
grant select on public.list_notifications to authenticated;
create policy notification_read on public.list_notifications for select to authenticated using(
 public.has_role(array['admin','estoquista']) or (requester_id=auth.uid() and event='ready' and public.has_role(array['vendedor','repositor']))
);
create function public.notify_restock_list() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='INSERT' then
  insert into public.list_notifications(list_id,list_number,requester_id,requester_name,event) values(new.id,new.number,new.created_by,new.requester_name,'submitted') on conflict do nothing;
 elsif new.status='pronta' and old.status is distinct from new.status then
  insert into public.list_notifications(list_id,list_number,requester_id,requester_name,event) values(new.id,new.number,new.created_by,new.requester_name,'ready') on conflict do nothing;
 end if;
 delete from public.list_notifications where created_at<clock_timestamp()-interval '30 days';
 return new;
end; $$;
revoke all on function public.notify_restock_list() from public;
create trigger notify_restock_list after insert or update of status on public.restock_lists for each row execute function public.notify_restock_list();
commit;
