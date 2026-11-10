import { prepare, handleError, HttpError, authenticate, normalizeUsername, usernameValid, passwordValid, encodePassword, signIn } from '../lib/auth-server.js';
export default async function handler(req, res) {
 try {
  const api = prepare(req, res);
  const user = await authenticate(api, req);
  if (['admin-profile','admin-password'].includes(req.body.action)) {
   const actor=await api.request('/rest/v1/profiles?id=eq.'+user.id+'&select=role,active&limit=1');
   if(!actor.ok||actor.data?.[0]?.role!=='admin'||actor.data[0].active!==true)throw new HttpError(403,'Somente administradores ativos podem editar usuários.');
   const id=req.body.targetId;
   if(typeof id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))throw new HttpError(400,'Usuário inválido.');
   const target=await api.request('/rest/v1/profiles?id=eq.'+id+'&select=username&limit=1');
   if(!target.ok||!target.data?.length)throw new HttpError(404,'Usuário não encontrado.');
   if(req.body.action==='admin-profile'){
    const username=normalizeUsername(req.body.username),name=req.body.name;
    if(!usernameValid(username)||typeof name!=='string'||!name.trim()||name.trim().length>100)throw new HttpError(400,'Confira o nome e o login.');
    if(username==='admin'&&target.data[0].username!=='admin')throw new HttpError(400,'O nome admin é reservado.');
    const result=await api.request('/rest/v1/profiles?id=eq.'+id,{method:'PATCH',body:{name:name.trim(),username}});
    if(!result.ok)throw new HttpError(result.status===409?409:400,result.status===409?'Esse login já está em uso.':'Não foi possível salvar o cadastro.');
    return res.status(200).json({message:'Cadastro atualizado.'});
   }
   if(!passwordValid(req.body.newPassword))throw new HttpError(400,'Informe uma senha de 6 a 128 caracteres.');
   const auth=await api.request('/auth/v1/admin/users/'+id);if(!auth.ok)throw new HttpError(404,'Conta não encontrada.');
   const targetUser=auth.data?.user||auth.data;
   const result=await api.request('/auth/v1/admin/users/'+id,{method:'PUT',body:{password:encodePassword(req.body.newPassword),app_metadata:{...targetUser.app_metadata,password_format:'sha256-v1'}}});
   if(!result.ok)throw new HttpError(400,'Não foi possível redefinir a senha.');
   return res.status(200).json({message:'Nova senha definida.'});
  }
  if (req.body.action === 'profile') {
   const username = normalizeUsername(req.body.username), name = req.body.name;
   if (!usernameValid(username) || typeof name !== 'string' || !name.trim() || name.trim().length > 100) throw new HttpError(400, 'Confira o nome e o usuário.');
   const current = await api.request('/rest/v1/profiles?id=eq.' + user.id + '&select=username&limit=1');
   if (!current.ok || !current.data?.length) throw new HttpError(404, 'Perfil não encontrado.');
   if (username === 'admin' && current.data[0].username !== 'admin') throw new HttpError(400, 'O nome admin é reservado.');
   const result = await api.request('/rest/v1/profiles?id=eq.' + user.id, { method: 'PATCH', body: { name: name.trim(), username } });
   if (!result.ok) throw new HttpError(result.status === 409 ? 409 : 400, result.status === 409 ? 'Esse nome de usuário já está em uso.' : 'Não foi possível salvar o perfil.');
   return res.status(200).json({ message: 'Nome e usuário atualizados.' });
  }
  if (req.body.action === 'password') {
   const { currentPassword, newPassword } = req.body;
   if (typeof currentPassword !== 'string' || !currentPassword.length || currentPassword.length > 128 || !passwordValid(newPassword)) throw new HttpError(400, 'Informe a senha atual e uma nova senha de 6 a 128 caracteres.');
   const verified = await signIn(api, user, currentPassword);
   const result = await api.request('/auth/v1/admin/users/' + user.id, { method: 'PUT', body: {
    password: encodePassword(newPassword),
    app_metadata: { ...user.app_metadata, password_format: 'sha256-v1' }
   } });
   // Encerra a sessão temporária usada somente para conferir a senha atual.
   await api.request('/auth/v1/logout?scope=local', { method: 'POST', token: verified.access_token }).catch(() => {});
   if (!result.ok) throw new HttpError(400, 'Não foi possível alterar a senha.');
   return res.status(200).json({ message: 'Senha alterada. Entre novamente com a nova senha.' });
  }
  throw new HttpError(400, 'Operação inválida.');
 } catch(error) { return handleError(res, error); }
}
