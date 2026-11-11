import { test } from 'node:test';
import assert from 'node:assert/strict';
import login from '../api/login.js';
import register from '../api/register.js';
import account from '../api/account.js';
import { encodePassword } from '../lib/auth-server.js';
import { canRequest, canComplete, validUsername, findProduct } from '../dist/domain.js';
process.env.SUPABASE_URL='https://example.supabase.co';
process.env.SUPABASE_SECRET_KEY='server-only';
process.env.SUPABASE_PUBLISHABLE_KEY='public-key';
function response() { return { headers:{},setHeader(k,v){this.headers[k]=v;},status(v){this.code=v;return this;},json(v){this.body=v;return this;} }; }
function mockAPI(t, replies) {
 const calls=[];
 t.mock.method(globalThis,'fetch',async(url,options) => {
  calls.push({url,options,body:options.body?JSON.parse(options.body):undefined});
  const next=replies.shift(); assert.ok(next, 'Chamada inesperada: '+url);
  return {ok:next.status===undefined || next.status<400,status:next.status||200,json:async()=>next.data};
 });
 return calls;
}
test('perfis de solicitação e conclusão são separados', () => {
 for(const r of ['repositor','vendedor']) { assert.equal(canRequest(r),true); assert.equal(canComplete(r),false); }
 for(const r of ['admin','estoquista']) { assert.equal(canRequest(r),false); assert.equal(canComplete(r),true); }
 assert.equal(canRequest('intruso'),false);
});
test('usuário e código preservam regras de identificação', () => {
 assert.equal(validUsername('maria.silva'),true); assert.equal(validUsername('a b'),false); assert.equal(validUsername('ab'),false);
 const product={codigo:'0001',codigo_barras:'0789'};
 assert.equal(findProduct([product],' 0789 '),product); assert.equal(findProduct([product],'789'),undefined);
});
test('conta legada continua usando sua senha existente', async t => {
 const calls=mockAPI(t,[{data:[{id:'id1'}]},{data:{email:'legacy@example.com'}},{data:{access_token:'a',refresh_token:'r',user:{email:'legacy@example.com'}}}]);
 const res=response(); await login({method:'POST',body:{username:'maria',password:'old-password'}},res);
 assert.equal(res.code,200); assert.deepEqual(res.body,{access_token:'a',refresh_token:'r'});
 assert.equal(calls[2].body.password,'old-password'); assert.equal(calls[2].options.headers.apikey,'public-key');
});
test('admin inicial é confirmado e criado uma vez com senha solicitada', async t => {
 const user={id:'admin-id',email:'initial-admin@repoe.invalid',app_metadata:{password_format:'sha256-v1',initial_admin:true}};
 const calls=mockAPI(t,[{data:[]},{data:[]},{data:null},{data:user},{data:'admin-id'},{data:[{id:'admin-id'}]},{data:user},{data:{access_token:'a',refresh_token:'r'}}]);
 const res=response(); await login({method:'POST',body:{username:'admin',password:'admin'}},res);
 assert.equal(res.code,200); assert.equal(calls[3].body.email_confirm,true);
 assert.equal(calls[3].body.app_metadata.initial_admin,true); assert.match(calls[3].body.user_metadata.username,/^setup_/);
 assert.equal(calls[3].body.password,encodePassword('admin'));
 assert.equal(calls[7].body.password,calls[3].body.password);
 assert.equal(JSON.stringify(res.body).includes('server-only'),false);
});
test('admin não é recriado depois de renomeado ou excluído', async t => {
 const calls=mockAPI(t,[{data:[]},{data:[{singleton:true}]}]);
 const res=response(); await login({method:'POST',body:{username:'admin',password:'admin'}},res);
 assert.equal(res.code,401); assert.equal(calls.length,2); assert.equal(calls.some(c=>c.options.method==='POST'),false);
});
test('admin existente não tem senha redefinida pelo login padrão', async t => {
 const calls=mockAPI(t,[{data:[{id:'id1'}]},{data:{email:'admin@repoe.invalid',app_metadata:{password_format:'sha256-v1'}}},{status:400,data:{error:'private detail',error_code:'invalid_credentials'}}]);
 const res=response(); await login({method:'POST',body:{username:'admin',password:'admin'}},res);
 assert.equal(res.code,401); assert.equal(calls.some(c=>c.options.method==='PUT'),false);
 assert.equal(JSON.stringify(res.body).includes('private detail'),false);
});
test('migração ausente não cria administrador incompleto', async t => {
 const calls=mockAPI(t,[{data:[]},{status:404,data:{}}]); const res=response();
 await login({method:'POST',body:{username:'admin',password:'admin'}},res);
 assert.equal(res.code,503); assert.equal(calls.length,2);
});
test('cadastro não pede e-mail e não aceita privilégio vindo do cliente', async t => {
 const calls=mockAPI(t,[{data:{id:'u1'}}]),res=response();
 await register({method:'POST',body:{username:'ana',name:'Ana',password:'123456',role:'repositor',app_metadata:{initial_admin:true},active:true}},res);
 assert.equal(res.code,201); assert.equal(calls[0].body.email_confirm,true);
 assert.match(calls[0].body.email,/@repoe.invalid$/);
 assert.deepEqual(calls[0].body.app_metadata,{password_format:'sha256-v1'});
 assert.equal(calls[0].body.user_metadata.requested_role,'repositor');
});
test('cadastro não permite reservar admin ou selecionar perfil admin', async t => {
 const calls=mockAPI(t,[]);
 for(const body of [{username:'admin',role:'vendedor'},{username:'ana',role:'admin'}]) {
 const res=response(); await register({method:'POST',body:{...body,name:'Ana',password:'123456'}},res); assert.equal(res.code,400);
 } assert.equal(calls.length,0);
});
test('configurações exigem uma sessão válida', async t => {
 const calls=mockAPI(t,[]),res=response(); await account({method:'POST',body:{action:'profile',username:'ana',name:'Ana'}},res);
 assert.equal(res.code,401); assert.equal(calls.length,0);
});
test('edição de perfil só altera nome e usuário da própria conta', async t => {
 const calls=mockAPI(t,[{data:{id:'real-user'}},{data:[{username:'ana'}]},{status:204,data:null}]),res=response();
 await account({method:'POST',headers:{authorization:'Bearer token'},body:{action:'profile',username:'ana.nova',name:'Ana Silva',id:'other-user',role:'admin',active:true}},res);
 assert.equal(res.code,200); assert.match(calls[2].url,/id=eq.real-user$/);
 assert.deepEqual(calls[2].body,{name:'Ana Silva',username:'ana.nova'});
});
test('nome de usuário duplicado retorna conflito sem sucesso falso', async t => {
 mockAPI(t,[{data:{id:'u1'}},{data:[{username:'ana'}]},{status:409,data:{}}]); const res=response();
 await account({method:'POST',headers:{authorization:'Bearer token'},body:{action:'profile',username:'maria',name:'Ana'}},res);
 assert.equal(res.code,409);
});
test('senha atual incorreta impede alterar a senha', async t => {
 const calls=mockAPI(t,[{data:{id:'u1',email:'u@repoe.invalid',app_metadata:{password_format:'sha256-v1'}}},{status:400,data:{error_code:'invalid_credentials'}}]),res=response();
 await account({method:'POST',headers:{authorization:'Bearer token'},body:{action:'password',currentPassword:'wrong',newPassword:'new-password'}},res);
 assert.equal(res.code,401); assert.equal(calls.some(c=>c.options.method==='PUT'),false);
});
test('troca de senha verifica a atual e conserva metadados administrativos', async t => {
 const user={id:'u1',email:'u@repoe.invalid',app_metadata:{password_format:'sha256-v1',initial_admin:true}};
 const calls=mockAPI(t,[{data:user},{data:{access_token:'verification',refresh_token:'r'}},{data:user},{status:204,data:null}]),res=response();
 await account({method:'POST',headers:{authorization:'Bearer token'},body:{action:'password',currentPassword:'admin',newPassword:'new-password'}},res);
 assert.equal(res.code,200); assert.equal(calls[1].body.password,encodePassword('admin'));
 assert.equal(calls[2].body.password,encodePassword('new-password')); assert.equal(calls[2].body.app_metadata.initial_admin,true);
 assert.match(calls[3].url,/logout\?scope=local$/);
});
test('GET é recusado em todos os endpoints de autenticação', async () => {
 for(const handler of [login,register,account]) { const res=response(); await handler({method:'GET'},res); assert.equal(res.code,405); }
});


test('falha da chave pública não é apresentada como senha inválida', async t => {
 mockAPI(t,[{data:[{id:'u1'}]},{data:{email:'u@repoe.invalid'}},{status:401,data:{message:'Invalid API key'}}]);const res=response();
 await login({method:'POST',body:{username:'ana',password:'example'}},res);assert.equal(res.code,503);assert.match(res.body.error,/conexão/);
});

test('edição administrativa recusa vendedor sem escrever',async t=>{const calls=mockAPI(t,[{data:{id:'actor'}},{data:[{role:'vendedor',active:true}]}]);const res=response();await account({method:'POST',headers:{authorization:'Bearer test'},body:{action:'admin-profile',targetId:'00000000-0000-4000-8000-000000000001',name:'Novo',username:'novo'}},res);assert.equal(res.code,403);assert.equal(calls.length,2);});
test('admin altera somente nome e login do alvo',async t=>{const calls=mockAPI(t,[{data:{id:'actor'}},{data:[{role:'admin',active:true}]},{data:[{username:'antigo'}]},{data:null}]);const res=response();await account({method:'POST',headers:{authorization:'Bearer test'},body:{action:'admin-profile',targetId:'00000000-0000-4000-8000-000000000001',name:' Novo ',username:'NOVO',role:'admin'}},res);assert.equal(res.code,200);assert.deepEqual(calls[3].body,{name:'Novo',username:'novo'});});
test('admin redefine senha preservando metadados e formato do login',async t=>{const calls=mockAPI(t,[{data:{id:'actor'}},{data:[{role:'admin',active:true}]},{data:[{username:'teste'}]},{data:{app_metadata:{provider:'email'}}},{data:{}}]);const res=response();await account({method:'POST',headers:{authorization:'Bearer test'},body:{action:'admin-password',targetId:'00000000-0000-4000-8000-000000000001',newPassword:'segredo123'}},res);assert.equal(res.code,200);assert.equal(calls[4].body.password,encodePassword('segredo123'));assert.deepEqual(calls[4].body.app_metadata,{provider:'email',password_format:'sha256-v1'});});
const targetId='00000000-0000-4000-8000-000000000001';
const removeBody={method:'POST',headers:{authorization:'Bearer test'},body:{action:'admin-remove',targetId}};
test('admin remove de vez usuário sem histórico',async t=>{const calls=mockAPI(t,[{data:{id:'actor'}},{data:[{role:'admin',active:true}]},{data:[{username:'novo',removed_at:null}]},{data:[]},{data:[]},{data:{}}]);const res=response();await account(removeBody,res);assert.equal(res.code,200);assert.equal(calls[5].options.method,'DELETE');assert.match(calls[5].url,new RegExp('/auth/v1/admin/users/'+targetId+'$'));});
test('usuário com histórico é arquivado, libera o login e é bloqueado',async t=>{const calls=mockAPI(t,[{data:{id:'actor'}},{data:[{role:'admin',active:true}]},{data:[{username:'antigo',removed_at:null}]},{data:[{id:'lista'}]},{data:[]},{data:null},{data:{}}]);const res=response();await account(removeBody,res);assert.equal(res.code,200);assert.equal(calls[5].options.method,'PATCH');assert.equal(calls[5].body.active,false);assert.equal(calls[5].body.username,'removido-00000000000040008000');assert.ok(calls[5].body.removed_at);assert.deepEqual(calls[6].body,{ban_duration:'876000h'});});
test('admin não remove a própria conta nem usuário já removido',async t=>{mockAPI(t,[{data:{id:targetId}},{data:[{role:'admin',active:true}]},{data:[{username:'eu',removed_at:null}]}]);const res=response();await account(removeBody,res);assert.equal(res.code,400);t.mock.restoreAll();mockAPI(t,[{data:{id:'actor'}},{data:[{role:'admin',active:true}]},{data:[{username:'removido-x',removed_at:'2026-01-01'}]}]);const again=response();await account(removeBody,again);assert.equal(again.code,404);});
test('vendedor não remove usuários',async t=>{const calls=mockAPI(t,[{data:{id:'actor'}},{data:[{role:'vendedor',active:true}]}]);const res=response();await account(removeBody,res);assert.equal(res.code,403);assert.equal(calls.length,2);});
