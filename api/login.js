// Esta função roda na Vercel. A chave secreta nunca é enviada ao navegador.
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Método não permitido.' }); }
  const url = process.env.SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  const publicKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !secret || !publicKey) return res.status(503).json({ error: 'Login aguardando configuração do servidor.' });
  const { username, password } = req.body || {};
  if (typeof username !== 'string' || !/^[a-z0-9][a-z0-9._-]{2,29}$/.test(username) || typeof password !== 'string' || password.length > 1024) return res.status(400).json({ error: 'Usuário ou senha inválidos.' });
  const headers = { apikey: secret, Authorization: `Bearer ${secret}` };
  const get = path => fetch(`${url}${path}`, { headers, signal: AbortSignal.timeout(10000) });
  try {
    const result = await get(`/rest/v1/profiles?username=eq.${encodeURIComponent(username)}&select=id&limit=1`);
    if (!result.ok) throw new Error('profile');
    const [profile] = await result.json();
    let email = `missing-${crypto.randomUUID()}@invalid.example`;
    if (profile) {
      const user = await get(`/auth/v1/admin/users/${profile.id}`);
      if (!user.ok) throw new Error('user');
      email = (await user.json()).email;
    }
    const response = await fetch(`${url}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: publicKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }), signal: AbortSignal.timeout(10000) });
    const data = await response.json();
    if (!response.ok || !profile) return res.status(response.status === 429 ? 429 : 401).json({ error: response.status === 429 ? 'Muitas tentativas. Aguarde antes de tentar novamente.' : 'Usuário ou senha inválidos, ou e-mail ainda não confirmado.' });
    return res.status(200).json({ access_token: data.access_token, refresh_token: data.refresh_token });
  } catch { return res.status(503).json({ error: 'Não foi possível entrar agora. Tente novamente.' }); }
}
