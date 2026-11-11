import { createHash, randomUUID } from 'node:crypto';
export const usernameValid = value => typeof value === 'string' && /^[a-z0-9][a-z0-9._-]{2,29}$/.test(value);
export const passwordValid = value => typeof value === 'string' && value.length >= 6 && value.length <= 128;
export const normalizeUsername = value => typeof value === 'string' ? value.trim().toLowerCase() : '';
// Prehash de transporte versionado; o Supabase ainda armazena o hash de senha.
// Permite a senha inicial "admin" sem mudar a política de tamanho do provedor.
export const encodePassword = value => 'R1!' + createHash('sha256').update(value, 'utf8').digest('hex');
export const authPassword = (user, value) => user?.app_metadata?.password_format === 'sha256-v1' ? encodePassword(value) : value;
export class HttpError extends Error {
 constructor(status, message) { super(message); this.status = status; }
}
export function prepare(req, res) {
 res.setHeader('Cache-Control', 'no-store');
 if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); throw new HttpError(405, 'Método não permitido.'); }
 if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) throw new HttpError(400, 'Dados inválidos.');
 const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
 const secret = process.env.SUPABASE_SECRET_KEY?.trim();
 const key = process.env.SUPABASE_PUBLISHABLE_KEY?.trim();
 if (!url || !secret || !key) throw new HttpError(503, 'Acesso aguardando configuração do servidor.');
 if (secret.startsWith('sb_publishable_')) throw new HttpError(503, 'SUPABASE_SECRET_KEY contém uma chave pública. Substitua o valor por uma chave sb_secret_ do mesmo projeto.');
 return {
  async request(path, { method = 'GET', body, token, publicOnly = false } = {}) {
   const headers = { apikey: publicOnly || token ? key : secret, 'Content-Type': 'application/json' };
   if (token) headers.Authorization = 'Bearer ' + token;
   else if (!publicOnly) headers.Authorization = 'Bearer ' + secret;
   const response = await fetch(url + path, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(10000) });
   const data = await response.json().catch(() => null);
   return { ok: response.ok, status: response.status, data };
  }
 };
}
export function handleError(res, error) {
 return res.status(error instanceof HttpError ? error.status : 503).json({ error: error instanceof HttpError ? error.message : 'Serviço indisponível. Tente novamente.' });
}
export async function findUser(api, username) {
 const result = await api.request('/rest/v1/profiles?username=eq.' + encodeURIComponent(username) + '&select=id&limit=1');
 if (!result.ok) {
  if (result.data?.code === '42501') throw new HttpError(503, 'O Supabase aceitou a chave, mas negou permissão na tabela profiles (42501).');
  if (result.status === 401) throw new HttpError(503, 'A chave secreta da Vercel foi recusada ou não tem acesso à tabela profiles. Confira SUPABASE_SECRET_KEY e o projeto Supabase.');
  if (result.status === 403 || result.data?.code === '42501') throw new HttpError(503, 'A chave configurada não tem permissão para consultar profiles. Use uma chave secreta do projeto.');
  if (['42703','42P01','PGRST204','PGRST205'].includes(result.data?.code)) throw new HttpError(503, 'A tabela profiles ou a coluna username está ausente. Confira as migrações neste projeto Supabase.');
  throw new HttpError(503, 'Falha ao consultar o banco Supabase (HTTP ' + result.status + ').');
 }
 if (!result.data?.length) return null;
 const auth = await api.request('/auth/v1/admin/users/' + result.data[0].id);
 if (!auth.ok) throw new HttpError(503, 'Não foi possível consultar a conta.');
 return auth.data?.user || auth.data;
}
export async function signIn(api, user, password) {
 const result = await api.request('/auth/v1/token?grant_type=password', { method: 'POST', publicOnly: true, body: { email: user?.email || 'missing-' + randomUUID() + '@repoe.invalid', password: authPassword(user, password) } });
 if (!result.ok && result.status !== 429 && result.data?.error_code !== 'invalid_credentials' && result.data?.code !== 'invalid_credentials' && result.data?.error_code !== 'user_banned') {
 const code=String(result.data?.error_code || result.data?.code || 'sem_codigo').replace(/[^a-zA-Z0-9_]/g,'').slice(0,50);
 throw new HttpError(503,'O serviço de autenticação recusou a conexão (HTTP '+result.status+', '+code+').');
 }
 if (!result.ok || !user) throw new HttpError(result.status === 429 ? 429 : 401, result.status === 429 ? 'Muitas tentativas. Aguarde antes de tentar novamente.' : 'Usuário ou senha inválidos.');
 return { access_token: result.data.access_token, refresh_token: result.data.refresh_token };
}
export async function authenticate(api, req) {
 const authorization = req.headers?.authorization;
 if (typeof authorization !== 'string' || !authorization.startsWith('Bearer ')) throw new HttpError(401, 'Entre novamente na sua conta.');
 const result = await api.request('/auth/v1/user', { token: authorization.slice(7) });
 if (!result.ok || !result.data?.id) throw new HttpError(401, 'Sua sessão expirou. Entre novamente.');
 return result.data;
}
