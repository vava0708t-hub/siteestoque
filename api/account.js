import { prepare, handleError, HttpError, authenticate, normalizeUsername, usernameValid, passwordValid, encodePassword, signIn } from '../lib/auth-server.js';
export default async function handler(req, res) {
 try {
  const api = prepare(req, res);
  const user = await authenticate(api, req);
  if (['admin-profile','admin-password','admin-remove'].includes(req.body.action)) {
   const actor=await api.request('/rest/v1/profiles?id=eq.'+user.id+'&select=role,active&limit=1');
   if(!actor.ok||actor.data?.[0]?.role!=='admin'||actor.data[0].active!==true)throw new HttpError(403,'Somente administradores ativos podem editar usuários.');
   const id=req.body.targetId;
   if(typeof id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))throw new HttpError(400,'Usuário inválido.');
   const target=await api.request('/rest/v1/profiles?id=eq.'+id+'&select=username,removed_at&limit=1');
   if(!target.ok||!target.data?.length)throw new HttpError(404,'Usuário não encontrado.');
   if(target.data[0].removed_at)throw new HttpError(404,'Usuário não encontrado.');
   if(req.body.action==='admin-remove'){
    if(id===user.id)throw new HttpError(400,'Você não pode remover a própria conta.');
    let used=false;
    for(const path of ['/rest/v1/restock_lists?or=(created_by.eq.'+id+',ready_by.eq.'+id+',separating_by.eq.'+id+')&select=id&limit=1','/rest/v1/restock_requests?or=(created_by.eq.'+id+',completed_by.eq.'+id+')&select=id&limit=1']){
     const refs=await api.request(path);
     if(!refs.ok)throw new HttpError(503,'Não foi possível verificar o histórico do usuário.');
     if(refs.data?.length)used=true;
    }
    if(!used){
     const removed=await api.request('/auth/v1/admin/users/'+id,{method:'DELETE'});
     if(removed.ok)return res.status(200).json({message:'Usuário removido.'});
    }
    // Com histórico: arquiva o perfil, libera o login e bloqueia a conta.
    const archived=await api.request('/rest/v1/profiles?id=eq.'+id,{method:'PATCH',body:{active:false,removed_at:new Date().toISOString(),username:'removido-'+id.replace(/-/g,'').slice(0,20)}});
    if(!archived.ok)throw new HttpError(archived.data?.code==='PGRST204'?503:400,archived.data?.code==='PGRST204'?'Execute a migração 016_remove_users.sql no Supabase para remover usuários com histórico.':'Não foi possível remover o usuário.');
    const banned=await api.request('/auth/v1/admin/users/'+id,{method:'PUT',body:{ban_duration:'876000h'}});
    if(!banned.ok)throw new HttpError(400,'O acesso foi retirado, mas não foi possível bloquear o login. Tente remover novamente.');
    return res.status(200).json({message:'Usuário removido. As listas dele continuam no histórico.'});
   }
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
