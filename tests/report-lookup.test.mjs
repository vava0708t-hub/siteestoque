import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

const ANA='00000000-0000-0000-0000-000000000001',BIA='00000000-0000-0000-0000-000000000002';
async function setup(){
 const db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create schema auth;
 create function auth.uid() returns uuid language sql as $$select current_setting('app.user_id')::uuid$$;
 create function public.has_role(text[]) returns boolean language sql as $$select current_setting('app.role')=any($1)$$;
 set app.role='admin';set app.user_id='${ANA}';
 create table restock_lists(id uuid primary key,number bigint,created_by uuid,requester_name text,status text,created_at timestamptz,ready_at timestamptz);
 create table restock_requests(id int,list_id uuid references restock_lists(id),product_code text,product_name text,unit text,quantity int);
 insert into restock_lists values
  ('10000000-0000-0000-0000-000000000001',11,'${ANA}','Ana','pronta',now()-interval '130 days',now()-interval '125 days'),
  ('10000000-0000-0000-0000-000000000002',12,'${ANA}','Ana','pronta',now()-interval '90 days',now()-interval '89 days'),
  ('10000000-0000-0000-0000-000000000003',13,'${BIA}','Bia','pendente',now()-interval '1 day',null);
 insert into restock_requests values
  (1,'10000000-0000-0000-0000-000000000001','7','Caneta Azul BIC','und',2),
  (2,'10000000-0000-0000-0000-000000000002','7','Caneta Azul BIC','und',3),
  (3,'10000000-0000-0000-0000-000000000003','7','Caneta Azul BIC','und',4),
  (4,'10000000-0000-0000-0000-000000000003','9','Papel A4','cx',1);`);
 await db.exec(await readFile(new URL('../supabase/014_report_summaries.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../supabase/019_report_lookup.sql',import.meta.url),'utf8'));
 return db;
}

test('019: listas prontas ficam 120 dias e o relatório mostra número e data das listas',async()=>{
 const db=await setup();
 try{
  assert.equal((await db.query('select purge_expired_restock_lists() n')).rows[0].n,1,'só a lista pronta há mais de 120 dias sai');
  assert.deepEqual((await db.query('select number from restock_lists order by number')).rows.map(r=>Number(r.number)),[12,13]);
  const report=async(from=123)=>(await db.query(`select restock_report(current_date-${from},current_date,'','all') r`)).rows[0].r;
  const r=await report(123);
  const pen=r.products.find(p=>p.code==='7');
  assert.equal(pen.lists,2);assert.deepEqual(pen.recent.map(l=>l.number),[13,12],'mais recente primeiro');
  assert.ok(pen.recent[0].date);assert.equal(pen.archived,0);
  await assert.rejects(()=>db.query(`select restock_report(current_date-124,current_date,'','all')`),'até 124 dias');
  const old=(await db.query(`select restock_report(current_date-140,current_date-100,'','all') r`)).rows[0].r;
  assert.equal(old.products[0].archived,1,'lista antiga aparece só como resumo, sem número');assert.deepEqual(old.products[0].recent,[]);
 }finally{await db.close();}
});

test('019: consulta de item mostra listas, datas e respeita permissões',async()=>{
 const db=await setup();
 try{
  const look=async(search,codes=[])=>(await db.query(`select restock_item_history(current_date-123,current_date,$1,$2) r`,[search,codes])).rows[0].r;
  let r=await look('azul caneta');
  assert.equal(r.total,2);assert.deepEqual(r.items.map(i=>Number(i.number)),[13,12]);assert.equal(r.items[0].requester_name,'Bia');assert.equal(r.items[0].quantity,4);
  assert.equal((await look('7')).total,2,'pelo código');
  assert.equal((await look('xx',['9'])).total,1,'pelo código resolvido do código de barras');
  assert.equal((await look('caneta vermelha')).total,0,'todas as palavras precisam bater');
  await db.query('select purge_expired_restock_lists()');
  const old=(await db.query(`select restock_item_history(current_date-140,current_date-100,'caneta','{}') r`)).rows[0].r;
  assert.equal(old.total,0);assert.equal(old.archived.length,1);assert.equal(old.archived[0].list_count,1);
  await assert.rejects(()=>look('a'),'mínimo 2 letras');
  await db.exec("set app.role='vendedor'");
  assert.deepEqual((await look('caneta')).items.map(i=>Number(i.number)),[12],'vendedor vê só as próprias listas');
  await db.exec("set app.role='blocked'");await assert.rejects(()=>look('caneta'));
 }finally{await db.close();}
});
