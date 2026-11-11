-- Executar no SQL Editor do Supabase como postgres, depois da 016.
-- Orçamentos salvos: ficam guardados até o fim da validade escolhida.
-- "Sem validade" guarda por 30 dias. Cada pessoa vê os próprios; administrador vê todos.
begin;
create extension if not exists pg_cron;
create table if not exists public.saved_quotes(
 id uuid primary key default gen_random_uuid(),
 number bigint generated always as identity unique,
 created_by uuid references public.profiles(id) on delete set null,
 created_name text not null default '',
 customer text not null default '' check(length(customer)<=120),
 phone text not null default '' check(length(phone)<=30),
 document text not null default '' check(length(document)<=30),
 notes text not null default '' check(length(notes)<=500),
 validity integer not null default 7 check(validity between 0 and 90),
 discount jsonb not null default '{"type":"percent","value":0}'::jsonb,
 items jsonb not null check(jsonb_typeof(items)='array' and jsonb_array_length(items) between 1 and 100),
 total bigint not null default 0 check(total>=0),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 expires_at timestamptz not null
);
create index if not exists saved_quotes_owner on public.saved_quotes(created_by,created_at desc);
create index if not exists saved_quotes_expiry on public.saved_quotes(expires_at);
alter table public.saved_quotes enable row level security;
drop policy if exists saved_quotes_read on public.saved_quotes;
create policy saved_quotes_read on public.saved_quotes for select to authenticated using(
 expires_at>now() and ((created_by=(select auth.uid()) and public.has_role(array['vendedor','repositor','estoquista','admin'])) or public.has_role(array['admin'])));
revoke all on public.saved_quotes from anon,authenticated;
grant select on public.saved_quotes to authenticated;

-- Salva um orçamento novo (quote_key nulo) ou atualiza um salvo ainda válido.
create or replace function public.save_quote(payload jsonb,quote_key uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_validity integer; v_days integer; v_row public.saved_quotes%rowtype; v_name text;
begin
 if not public.has_role(array['vendedor','repositor','estoquista','admin']) then raise exception 'Acesso não autorizado.'; end if;
 if payload is null or jsonb_typeof(payload)<>'object' then raise exception 'Orçamento inválido.'; end if;
 if jsonb_typeof(payload->'items')<>'array' or jsonb_array_length(payload->'items') not between 1 and 100 then raise exception 'O orçamento precisa ter de 1 a 100 itens.'; end if;
 v_validity:=coalesce((payload->>'validity')::integer,7);
 if v_validity not between 0 and 90 then raise exception 'Validade inválida.'; end if;
 v_days:=case when v_validity=0 then 30 else v_validity end;
 select name into v_name from public.profiles where id=auth.uid();
 if quote_key is null then
  insert into public.saved_quotes(created_by,created_name,customer,phone,document,notes,validity,discount,items,total,expires_at)
  values(auth.uid(),coalesce(v_name,''),left(coalesce(payload->>'customer',''),120),left(coalesce(payload->>'phone',''),30),left(coalesce(payload->>'document',''),30),left(coalesce(payload->>'notes',''),500),v_validity,coalesce(payload->'discount','{"type":"percent","value":0}'::jsonb),payload->'items',greatest(coalesce((payload->>'total')::bigint,0),0),now()+make_interval(days=>v_days))
  returning * into v_row;
 else
  update public.saved_quotes set customer=left(coalesce(payload->>'customer',''),120),phone=left(coalesce(payload->>'phone',''),30),document=left(coalesce(payload->>'document',''),30),notes=left(coalesce(payload->>'notes',''),500),validity=v_validity,discount=coalesce(payload->'discount','{"type":"percent","value":0}'::jsonb),items=payload->'items',total=greatest(coalesce((payload->>'total')::bigint,0),0),updated_at=now(),expires_at=created_at+make_interval(days=>v_days)
  where id=quote_key and expires_at>now() and (created_by=auth.uid() or public.has_role(array['admin']))
  returning * into v_row;
  if not found then raise exception 'Orçamento não encontrado ou já vencido.'; end if;
  if v_row.expires_at<=now() then raise exception 'Com essa validade o orçamento já estaria vencido.'; end if;
 end if;
 return jsonb_build_object('id',v_row.id,'number',v_row.number,'created_at',v_row.created_at,'expires_at',v_row.expires_at);
end; $$;

create or replace function public.delete_quote(quote_key uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not public.has_role(array['vendedor','repositor','estoquista','admin']) then raise exception 'Acesso não autorizado.'; end if;
 delete from public.saved_quotes where id=quote_key and (created_by=auth.uid() or public.has_role(array['admin']));
 if not found then raise exception 'Orçamento não encontrado.'; end if;
end; $$;

create or replace function public.purge_expired_quotes() returns integer
language plpgsql security definer set search_path='' as $$
declare removed integer;
begin
 delete from public.saved_quotes where expires_at<=now();
 get diagnostics removed=row_count;
 return removed;
end; $$;

revoke all on function public.save_quote(jsonb,uuid),public.delete_quote(uuid),public.purge_expired_quotes() from public,anon,authenticated;
grant execute on function public.save_quote(jsonb,uuid),public.delete_quote(uuid) to authenticated;
select cron.schedule('saved-quotes-expiry','30 5 * * *','select public.purge_expired_quotes();');
commit;
