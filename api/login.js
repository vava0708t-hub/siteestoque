import { randomUUID } from 'node:crypto';
import { prepare, handleError, HttpError, normalizeUsername, usernameValid, encodePassword, findUser, signIn } from '../lib/auth-server.js';
export default async function handler(req,res) {
 try {
 const api=prepare(req,res);
 const username=normalizeUsername(req.body.username),password=req.body.password;
 if(!usernameValid(username)||typeof password!=='string'||!password.length||password.length>128)throw new HttpError(400,'Usuário ou senha inválidos.');
 let user=await findUser(api,username);
 if(!user && username==='admin' && password==='admin'){
  const setup=await api.request('/rest/v1/initial_admin_setup?select=singleton&limit=1');
  if(!setup.ok)throw new HttpError(503,'Execute as migrações do banco para ativar o administrador.');
  if(setup.data?.length)throw new HttpError(401,'Usuário ou senha inválidos.');
  // Recupera criação interrompida e verifica a migração antes de criar contas.
  let finalized=await api.request('/rest/v1/rpc/finish_initial_admin',{method:'POST',body:{}});
  if(!finalized.ok)throw new HttpError(503,'Execute 004_fix_initial_admin.sql no Supabase para concluir a correção.');
  if(!finalized.data){
   const created=await api.request('/auth/v1/admin/users',{method:'POST',body:{
    email:'initial-admin@repoe.invalid',password:encodePassword('admin'),email_confirm:true,
    app_metadata:{password_format:'sha256-v1',initial_admin:true},
    user_metadata:{username:'setup_'+randomUUID().replaceAll('-','').slice(0,24),name:'Administrador',requested_role:'vendedor'}
   }});
   finalized=await api.request('/rest/v1/rpc/finish_initial_admin',{method:'POST',body:{}});
   if(!finalized.ok || !finalized.data)throw new HttpError(503,created.ok?'Não foi possível finalizar o perfil administrativo. Tente novamente.':'Não foi possível criar o administrador no Supabase. Confira o log de Auth.');
  }
  user=await findUser(api,'admin');
  if(!user)throw new HttpError(401,'Usuário ou senha inválidos.');
 }
 return res.status(200).json(await signIn(api,user,password));
 }catch(error){return handleError(res,error);}
}
