-- Execute após 017_saved_quotes.sql.
-- Formas de pagamento das etiquetas de oferta, cadastradas pelo administrador em Configurações.
begin;
alter table public.catalog_settings drop constraint if exists catalog_settings_kind_check;
alter table public.catalog_settings drop constraint if exists catalog_settings_name_check;
alter table public.catalog_settings add constraint catalog_settings_kind_check check(kind in ('brand','aisle','payment'));
alter table public.catalog_settings add constraint catalog_settings_name_check check(name=trim(name) and length(name) between 1 and (case when kind='payment' then 80 else 60 end));
insert into public.catalog_settings(kind,name) values
 ('payment','À vista no Pix ou dinheiro'),
 ('payment','No dinheiro, Pix ou débito'),
 ('payment','À vista')
on conflict do nothing;
commit;
