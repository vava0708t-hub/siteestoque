import { randomUUID } from 'node:crypto';
import { prepare, handleError, HttpError, normalizeUsername, usernameValid, passwordValid, encodePassword } from '../lib/auth-server.js';
export default async function handler(req, res) {
 try {
  const api = prepare(req, res);
  const username = normalizeUsername(req.body.username), { password, name, role } = req.body;
  if (!usernameValid(username) || username === 'admin') throw new HttpError(400, 'Escolha outro usuário: 3 a 30 letras, números, ponto, hífen ou sublinhado.');
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 100 || !passwordValid(password) || !['vendedor','repositor','estoquista'].includes(role)) throw new HttpError(400, 'Informe nome, perfil e senha de 6 a 128 caracteres.');
  const result = await api.request('/auth/v1/admin/users', { method: 'POST', body: {
   email: randomUUID() + '@repoe.invalid', email_confirm: true, password: encodePassword(password),
   app_metadata: { password_format: 'sha256-v1' },
   user_metadata: { username, name: name.trim(), requested_role: role }
  } });
  if (!result.ok) throw new HttpError(result.status === 429 ? 429 : 400, result.status === 429 ? 'Muitas tentativas. Aguarde.' : 'Não foi possível cadastrar. O usuário pode já estar em uso; confira também a instalação do banco.');
  return res.status(201).json({ message: 'Conta criada. Você já pode entrar; as solicitações serão liberadas após aprovação do administrador.' });
 } catch(error) { return handleError(res, error); }
}
