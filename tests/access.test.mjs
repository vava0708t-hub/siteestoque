import { test } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/login.js';
import { canRequest, canComplete, validUsername, findProduct } from '../dist/domain.js';
test('perfis de solicitação e conclusão são separados', () => {
 for(const r of ['repositor','vendedor']) { assert.equal(canRequest(r),true); assert.equal(canComplete(r),false); }
 for(const r of ['admin','estoquista']) { assert.equal(canRequest(r),false); assert.equal(canComplete(r),true); }
 assert.equal(canRequest('intruso'),false);
});
test('usuário e código preservam regras de identificação', () => {
 assert.equal(validUsername('maria.silva'),true); assert.equal(validUsername('a b'),false); assert.equal(validUsername('ab'),false);
 const product = {codigo:'0001',codigo_barras:'0789'};
 assert.equal(findProduct([product],' 0789 '),product); assert.equal(findProduct([product],'789'),undefined);
});
test('login usa senha no Supabase e não devolve dados administrativos', async t => {
 process.env.SUPABASE_URL='https://example.supabase.co'; process.env.SUPABASE_SECRET_KEY='server-only'; process.env.SUPABASE_PUBLISHABLE_KEY='public-key';
 const calls=[];
 t.mock.method(globalThis,'fetch',async (url, options) => {
 calls.push({url,options});
 const body = calls.length === 1 ? [{id:'id1'}] : calls.length === 2 ? {email:'private@example.com'} : {access_token:'access',refresh_token:'refresh',user:{email:'private@example.com'}};
 return {ok:true,json:async()=>body};
 });
 const res={setHeader(){},status(value){this.code=value;return this;},json(value){this.body=value;return this;}};
 await handler({method:'POST',body:{username:'maria',password:'a-password'}},res);
 assert.equal(res.code,200); assert.deepEqual(res.body,{access_token:'access',refresh_token:'refresh'});
 assert.equal(JSON.parse(calls[2].options.body).password,'a-password');
 assert.equal(calls[2].options.headers.apikey,'public-key');
});
test('senha inválida não expõe detalhes do provedor', async t => {
 let n=0;
 t.mock.method(globalThis,'fetch',async()=> { n++; return {ok:n<3,status:400,json:async()=>n===1?[{id:'id1'}]:n===2?{email:'private@example.com'}:{error:'internal detail'}}; });
 const res={setHeader(){},status(v){this.code=v;return this;},json(v){this.body=v;}};
 await handler({method:'POST',body:{username:'maria',password:'bad'}},res);
 assert.equal(res.code,401); assert.equal(JSON.stringify(res.body).includes('internal detail'),false);
});
test('método de leitura é recusado', async () => {
 const res={setHeader(){},status(v){this.code=v;return this;},json(){}};
 await handler({method:'GET'},res); assert.equal(res.code,405);
});

