-- Execute após 007_unavailable_items.sql.
begin;
create table public.catalog_settings (
 id uuid primary key default gen_random_uuid(),
 kind text not null check(kind in ('brand','aisle')),
 name text not null check(name=trim(name) and length(name) between 1 and 60)
);
create unique index catalog_settings_unique on public.catalog_settings(kind,lower(name));
alter table public.catalog_settings enable row level security;
grant select,insert,update,delete on public.catalog_settings to authenticated;
create policy read_settings on public.catalog_settings for select to authenticated using(public.has_role(array['admin','estoquista','vendedor','repositor']));
create policy manage_settings on public.catalog_settings for all to authenticated using(public.has_role(array['admin'])) with check(public.has_role(array['admin']));
insert into public.catalog_settings(kind,name) values ('brand','VMP'),('brand','Futuro'),('brand','Mercur'),('brand','Master Print');
insert into public.catalog_settings(kind,name)
 select 'aisle',min(trim(aisle)) from public.restock_requests where nullif(trim(aisle),'') is not null group by lower(trim(aisle));
commit;
