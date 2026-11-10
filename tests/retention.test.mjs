import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
test('retenção remove somente listas prontas vencidas e seus itens',async()=>{const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create table restock_lists(id uuid primary key,status text,ready_at timestamptz);create table restock_requests(list_id uuid references restock_lists(id));insert into restock_lists values ('00000000-0000-0000-0000-000000000001','pronta',now()-interval '61 days'),('00000000-0000-0000-0000-000000000002','pronta',now()-interval '59 days'),('00000000-0000-0000-0000-000000000003','pendente',now()-interval '90 days');insert into restock_requests select id from restock_lists;`);
 const sql=(await readFile(new URL('../supabase/013_history_retention.sql',import.meta.url),'utf8')).replace('create extension if not exists pg_cron;','').replace(/select cron.schedule[^\n]+/,'');await db.exec(sql);assert.equal((await db.query('select public.purge_expired_restock_lists() as n')).rows[0].n,1);assert.equal((await db.query('select count(*)::int as n from restock_requests')).rows[0].n,2);assert.equal((await db.query('select public.purge_expired_restock_lists() as n')).rows[0].n,0);
 }finally{await db.close();}});
