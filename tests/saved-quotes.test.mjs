import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { quoteFromSaved, quotePayload, quoteValidUntil, restoreQuote, emptyQuote } from '../dist/quote-domain.js';

test('PostgreSQL: orçamentos salvos respeitam dono, admin e validade',async()=>{
 const db=new PGlite();
 const seller='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002',admin='00000000-0000-4000-8000-000000000003',blocked='00000000-0000-4000-8000-000000000004';
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;grant usage on schema auth to authenticated;
  create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb,raw_app_meta_data jsonb,email_confirmed_at timestamptz);
  create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('app.user_id',true),'')::uuid$$;`);
  for(const name of ['schema','002_roles_username','003_internal_accounts','004_fix_initial_admin'])await db.exec(await readFile(new URL('../supabase/'+name+'.sql',import.meta.url),'utf8'));
  for(const [id,username] of [[seller,'seller'],[other,'other'],[admin,'chefe'],[blocked,'blocked']])await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)',[id,JSON.stringify({name:username,username})]);
  await db.query("update public.profiles set active=true where id<>$1",[blocked]);await db.query("update public.profiles set role='admin' where id=$1",[admin]);
  const sql=(await readFile(new URL('../supabase/017_saved_quotes.sql',import.meta.url),'utf8')).replace('create extension if not exists pg_cron;','').replace(/select cron.schedule[^\n]+/,'');
  await db.exec(sql);
  const actor=async id=>{await db.exec('reset role');await db.query("select set_config('app.user_id',$1,false)",[id]);await db.exec('set role authenticated');};
  const payload=(validity=7,extra={})=>JSON.stringify({items:[{id:'1',code:'1',name:'Caneta',unit:'UN',price:250,quantity:2,discount:0}],customer:'Maria',phone:'11',document:'',notes:'Pix',validity,discount:{type:'percent',value:0},total:500,...extra});
  await actor(seller);
  const saved=(await db.query('select public.save_quote($1::jsonb) r',[payload(7)])).rows[0].r;
  assert.ok(saved.id);assert.ok(saved.number>0);
  const days=(new Date(saved.expires_at)-new Date(saved.created_at))/86400000;assert.equal(Math.round(days),7);
  const noValidity=(await db.query('select public.save_quote($1::jsonb) r',[payload(0)])).rows[0].r;
  assert.equal(Math.round((new Date(noValidity.expires_at)-new Date(noValidity.created_at))/86400000),30,'sem validade guarda 30 dias');
  assert.equal((await db.query('select count(*)::int n from public.saved_quotes')).rows[0].n,2);
  // Atualizar mantém número e recalcula a validade a partir da criação.
  const updated=(await db.query('select public.save_quote($1::jsonb,$2) r',[payload(15,{customer:'Maria Souza'}),saved.id])).rows[0].r;
  assert.equal(updated.number,saved.number);assert.equal(Math.round((new Date(updated.expires_at)-new Date(updated.created_at))/86400000),15);
  // Outro vendedor não vê nem altera; admin vê todos.
  await actor(other);
  assert.equal((await db.query('select count(*)::int n from public.saved_quotes')).rows[0].n,0);
  await assert.rejects(()=>db.query('select public.save_quote($1::jsonb,$2)',[payload(7),saved.id]));
  await assert.rejects(()=>db.query('select public.delete_quote($1)',[saved.id]));
  await assert.rejects(()=>db.query("insert into public.saved_quotes(items,expires_at) values('[]',now())"));
  await actor(admin);
  assert.equal((await db.query('select count(*)::int n from public.saved_quotes')).rows[0].n,2);
  await actor(blocked);
  await assert.rejects(()=>db.query('select public.save_quote($1::jsonb)',[payload(7)]));
  // Validação de itens e validade.
  await actor(seller);
  await assert.rejects(()=>db.query('select public.save_quote($1::jsonb)',[payload(7,{items:[]})]));
  await assert.rejects(()=>db.query('select public.save_quote($1::jsonb)',[payload(91)]));
  // Vencido some da leitura e é removido pela limpeza.
  await db.exec('reset role');await db.query("update public.saved_quotes set expires_at=now()-interval '1 minute' where id=$1",[noValidity.id]);
  await actor(seller);
  assert.equal((await db.query('select count(*)::int n from public.saved_quotes')).rows[0].n,1);
  await assert.rejects(()=>db.query('select public.save_quote($1::jsonb,$2)',[payload(7),noValidity.id]));
  await db.exec('reset role');
  assert.equal((await db.query('select public.purge_expired_quotes() n')).rows[0].n,1);
  await actor(seller);await db.query('select public.delete_quote($1)',[saved.id]);
  assert.equal((await db.query('select count(*)::int n from public.saved_quotes')).rows[0].n,0);
 }finally{await db.close();}
});

test('orçamento salvo vira rascunho e a validade conta da criação',()=>{
 const row={id:'11111111-2222-3333-4444-555555555555',number:12,customer:'Ana',phone:'',document:'',notes:'',validity:7,discount:{type:'percent',value:0},items:[{id:'1',code:'1',name:'A',unit:'UN',price:1000,quantity:1,discount:0}],created_at:'2026-11-01T12:00:00.000Z',expires_at:'2026-11-08T12:00:00.000Z'};
 const quote=quoteFromSaved(row);
 assert.equal(quote.savedNumber,12);assert.equal(quote.customer,'Ana');
 assert.equal(quoteValidUntil(quote).toISOString(),'2026-11-08T12:00:00.000Z');
 assert.equal(quotePayload(quote).total,1000);assert.ok(!('savedId' in quotePayload(quote)));
 assert.equal(restoreQuote({...quote,savedId:'x'}).savedId,null,'id inválido é ignorado');
 assert.equal(quoteValidUntil({...emptyQuote(),validity:0}),null);
});
