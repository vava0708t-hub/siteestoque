import { config } from './config.js';
import { loadCatalog } from './catalog.js';
import { toast } from './toast.js';
const $ = id => document.getElementById(id);
let client, session, profile, products = [], requests = [], signup = false;
const busy = value => $('loading').classList.toggle('finished', !value);
const fail = error => toast(error.message || 'Não foi possível concluir. Tente novamente.', 'error');
function mode(value) {
  signup = value; $('signup-fields').hidden = !value; $('name').required = value;
  $('login-tab').classList.toggle('active', !value); $('signup-tab').classList.toggle('active', value);
  $('login-tab').setAttribute('aria-pressed', String(!value)); $('signup-tab').setAttribute('aria-pressed', String(value));
  $('auth-title').textContent = value ? 'Faça parte da equipe.' : 'Bom ter você por aqui.';
  $('auth-submit').textContent = value ? 'Criar minha conta →' : 'Entrar na minha conta →';
  $('password').autocomplete = value ? 'new-password' : 'current-password';
}
$('login-tab').onclick = () => mode(false); $('signup-tab').onclick = () => mode(true);
function clearSession() { session = null; profile = null; requests = []; products = []; $('requests').replaceChildren(); $('workspace').hidden = true; $('auth').hidden = false; $('logout').hidden = true; }
async function showSession(next) {
  session = next;
  if (!next) { clearSession(); return; }
  const { data, error } = await client.from('profiles').select('*').eq('id', next.user.id).single();
  if (error) throw new Error('Não foi possível carregar seu perfil. Confira se o SQL de instalação foi executado.');
  profile = data; $('auth').hidden = true; $('workspace').hidden = false; $('logout').hidden = false;
  $('identity').textContent = `${profile.name} / ${profile.role === 'estoquista' ? 'ESTOQUISTA' : 'VENDEDOR'}`;
  $('pending-role').hidden = !(profile.requested_role === 'estoquista' && profile.role !== 'estoquista');
  await refresh();
}
async function refresh() {
  $('refresh').disabled = true;
  try { await Promise.all([fetchRequests(), fetchProducts()]); } finally { $('refresh').disabled = false; }
}
async function fetchProducts() {
  $('request-submit').disabled = true;
  try {
    products = await loadCatalog(config.googleSheetsCsvUrl);
    $('product').replaceChildren(new Option('Selecione um produto', ''));
    products.forEach(p => $('product').add(new Option(`${p.codigo} · ${p.nome}${p.unidade ? ` (${p.unidade})` : ''}`, p.codigo)));
    $('product-count').textContent = products.length;
    $('catalog-status').textContent = products.length ? 'Produtos vinculados ao Google Sheets.' : 'A planilha ainda não tem produtos.';
    $('request-submit').disabled = !products.length;
  } catch (error) { products = []; $('product').replaceChildren(new Option('Catálogo indisponível', '')); $('product-count').textContent = '—'; $('catalog-status').textContent = error.message; }
}
async function fetchRequests() {
  $('list-status').textContent = 'Carregando pedidos…';
  const { data, error } = await client.from('restock_requests').select('*').order('created_at', { ascending: false }).limit(500);
  if (error) { $('list-status').textContent = 'Falha ao carregar pedidos. Use Atualizar lista para tentar novamente.'; throw error; }
  requests = data; renderRequests();
}
function element(tag, text, className) { const node = document.createElement(tag); node.textContent = text; if (className) node.className = className; return node; }
function renderRequests() {
  $('pending-count').textContent = requests.filter(r => r.status === 'pendente').length;
  $('done-count').textContent = requests.filter(r => r.status === 'concluido').length;
  const visible = requests.filter(r => $('filter').value === 'all' || r.status === $('filter').value);
  $('list-status').textContent = visible.length ? (requests.length === 500 ? 'Exibindo os 500 pedidos mais recentes.' : '') : 'Nenhum pedido por aqui. As solicitações aparecerão nesta lista.';
  $('requests').replaceChildren();
  visible.forEach(r => {
    const item = element('article', '', 'request-item'), top = element('div', '', 'request-top');
    top.append(element('h3', r.product_name), element('span', r.status === 'concluido' ? 'Concluído' : r.priority === 'urgente' ? 'Urgente · pendente' : 'Pendente', `badge ${r.status === 'concluido' ? 'done' : ''}`));
    item.append(top, element('p', `${r.quantity} ${r.unit || 'un.'} · Código ${r.product_code}`, 'muted'), element('p', new Date(r.created_at).toLocaleString('pt-BR'), 'muted'));
    if (r.notes) item.append(element('p', r.notes));
    if (profile.role === 'estoquista' && r.status === 'pendente') {
      const button = element('button', '✓ Marcar como reposto', 'secondary');
      button.onclick = async () => { button.disabled = true; try { const { error } = await client.rpc('complete_restock', { request_id: r.id }); if (error) throw error; toast('Reposição concluída.'); await fetchRequests(); } catch (error) { fail(error); } finally { button.disabled = false; } };
      item.append(button);
    }
    $('requests').append(item);
  });
}
$('filter').onchange = renderRequests;
$('refresh').onclick = () => refresh().catch(fail);
$('auth-form').onsubmit = async event => {
  event.preventDefault(); if (!client) { toast('Configure a URL do Supabase antes de entrar.', 'error'); return; }
  $('auth-submit').disabled = true; busy(true);
  try {
    const credentials = { email: $('email').value.trim(), password: $('password').value };
    const { data, error } = signup ? await client.auth.signUp({ ...credentials, options: { data: { name: $('name').value.trim(), requested_role: $('role').value } } }) : await client.auth.signInWithPassword(credentials);
    if (error) throw error;
    $('password').value = '';
    if (data.session) { await showSession(data.session); toast('Você entrou. Bom trabalho!'); }
    else { toast('Cadastro recebido. Verifique seu e-mail para confirmar a conta.'); mode(false); }
  } catch (error) { fail(error); } finally { $('auth-submit').disabled = false; busy(false); }
};
$('logout').onclick = async () => { $('logout').disabled = true; try { const { error } = await client.auth.signOut(); if (error) throw error; clearSession(); toast('Você saiu da conta.'); } catch (error) { fail(error); } finally { $('logout').disabled = false; } };
$('request-form').onsubmit = async event => {
  event.preventDefault(); const product = products.find(p => p.codigo === $('product').value), quantity = Number($('quantity').value);
  if (!session || !product || !Number.isInteger(quantity) || quantity < 1 || quantity > 99999) { toast('Selecione um produto e uma quantidade válida.', 'error'); return; }
  $('request-submit').disabled = true;
  try {
    const { error } = await client.from('restock_requests').insert({ created_by: session.user.id, product_code: product.codigo, product_name: product.nome, unit: product.unidade || 'un.', quantity, priority: $('priority').value, notes: $('notes').value.trim() });
    if (error) throw error; $('request-form').reset(); toast('Solicitação enviada ao estoque.'); await fetchRequests();
  } catch (error) { fail(error); } finally { $('request-submit').disabled = !products.length; }
};
async function init() {
  try {
    if (!config.supabaseUrl) { $('config-notice').hidden = false; return; }
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    client = createClient(config.supabaseUrl, config.supabasePublishableKey);
    client.auth.onAuthStateChange((event, next) => { if (event === 'SIGNED_OUT') clearSession(); if (event === 'TOKEN_REFRESHED') session = next; });
    const { data, error } = await client.auth.getSession(); if (error) throw error;
    await showSession(data.session);
  } catch (error) { fail(error); } finally { busy(false); }
}
init();
