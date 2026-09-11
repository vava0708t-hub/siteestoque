import { config } from './config.js';
import { loadCatalog } from './catalog.js';
import { toast } from './toast.js';
import { roles, units, canRequest, canComplete, validUsername, findProduct } from './domain.js';
const $ = id => document.getElementById(id);
let client, session, profile, products = [], requests = [], signup = false;
const busy = value => $('loading').classList.toggle('finished', !value);
const fail = error => toast(error.message || 'Não foi possível concluir.', 'error');
function mode(value) {
 signup = value; $('signup-fields').hidden = !value; $('name').required = $('email').required = value;
 for (const [id, active] of [['login-tab', !value], ['signup-tab', value]]) { $(id).classList.toggle('active', active); $(id).setAttribute('aria-pressed', String(active)); }
 $('auth-title').textContent = value ? 'Faça parte da equipe.' : 'Bom ter você por aqui.';
 $('auth-submit').textContent = value ? 'Criar minha conta →' : 'Entrar na minha conta →';
 $('password').autocomplete = value ? 'new-password' : 'current-password';
}
$('login-tab').onclick = () => mode(false); $('signup-tab').onclick = () => mode(true);
function clearSession() { session = profile = null; requests = []; products = []; $('requests').replaceChildren(); $('admin-users').replaceChildren(); $('workspace').hidden = true; $('auth').hidden = false; $('logout').hidden = true; }
async function showSession(next) {
 if (!next) { clearSession(); return; } session = next;
 const { data, error } = await client.from('profiles').select('*').eq('id', next.user.id).single();
 if (error) throw new Error('Não foi possível carregar seu perfil. Confira a instalação do banco.');
 profile = data; $('auth').hidden = true; $('workspace').hidden = false; $('logout').hidden = false;
 $('identity').textContent = profile.name + ' / ' + profile.role.toUpperCase();
 $('pending-role').hidden = !!profile.active;
 $('request-panel').hidden = !profile.active || !canRequest(profile.role);
 $('work-grid').classList.toggle('single-column', $('request-panel').hidden);
 $('admin-panel').hidden = !profile.active || profile.role !== 'admin';
 await refresh();
}
async function refresh() {
 $('refresh').disabled = true;
 try { await Promise.all([fetchRequests(), fetchProducts(), fetchUsers()]); } finally { $('refresh').disabled = false; }
}
async function fetchProducts() {
 $('request-submit').disabled = true;
 try {
 products = await loadCatalog(config.googleSheetsCsvUrl);
 $('product').replaceChildren(new Option('Selecione um produto', ''));
 products.forEach(p => $('product').add(new Option(p.codigo + ' · ' + p.nome, p.codigo)));
 $('product-count').textContent = products.length;
 $('catalog-status').textContent = products.length ? 'Bipe o código ou selecione um produto da planilha.' : 'A planilha ainda não tem produtos.';
 } catch(error) { products = []; $('product').replaceChildren(new Option('Catálogo indisponível', '')); $('product-count').textContent = '—'; $('catalog-status').textContent = error.message; }
 $('request-submit').disabled = !products.length;
}
async function fetchRequests() {
 $('list-status').textContent = 'Carregando pedidos…';
 const { data, error } = await client.from('restock_requests').select('*').order('created_at', { ascending: false }).limit(500);
 if (error) { $('list-status').textContent = 'Falha ao carregar. Tente atualizar a lista.'; throw error; }
 requests = data; renderRequests();
}
function el(tag, text, css) { const node = document.createElement(tag); node.textContent = text; if (css) node.className = css; return node; }
function renderRequests() {
 $('pending-count').textContent = requests.filter(r => r.status === 'pendente').length;
 $('done-count').textContent = requests.filter(r => r.status === 'concluido').length;
 const visible = requests.filter(r => ($('filter').value === 'all' || r.status === $('filter').value) && (! $('aisle-filter').value.trim() || (r.aisle || '').toLowerCase().includes($('aisle-filter').value.trim().toLowerCase())));
 $('list-status').textContent = visible.length ? (requests.length === 500 ? 'Exibindo até 500 pedidos recentes.' : '') : 'Nenhuma solicitação encontrada.';
 $('requests').replaceChildren();
 visible.forEach(r => {
 const item = el('article', '', 'request-item'), top = el('div', '', 'request-top');
 top.append(el('h3', r.product_name), el('span', r.status === 'concluido' ? 'Concluído' : r.priority === 'urgente' ? 'Urgente · pendente' : 'Pendente', 'badge ' + (r.status === 'concluido' ? 'done' : '')));
 item.append(top, el('p', r.quantity + ' ' + r.unit + ' · Código ' + r.product_code, 'muted'), el('p', 'Corredor: ' + (r.aisle || 'Não informado') + ' · ' + (r.requester_name || 'Equipe'), 'muted'), el('p', new Date(r.created_at).toLocaleString('pt-BR'), 'muted'));
 if (r.notes) item.append(el('p', r.notes));
 if (profile.active && canComplete(profile.role) && r.status === 'pendente') {
 const button = el('button', '✓ Marcar como reposto', 'secondary');
 button.onclick = async () => { button.disabled = true; try { const { error } = await client.rpc('complete_restock', { request_id: r.id }); if (error) throw error; toast('Reposição concluída.'); await fetchRequests(); } catch(error) { fail(error); } finally { button.disabled = false; } };
 item.append(button);
 }
 $('requests').append(item);
 });
}
$('filter').onchange = renderRequests; $('aisle-filter').oninput = renderRequests;
$('refresh').onclick = () => showSession(session).catch(fail);
$('auth-form').onsubmit = async event => {
 event.preventDefault(); if (!client) { toast('Conexão indisponível. Atualize a página.', 'error'); return; }
 $('auth-submit').disabled = true; busy(true);
 try {
 const username = $('username').value.trim().toLowerCase();
 if (!validUsername(username)) throw new Error('Usuário deve ter de 3 a 30 caracteres: letras, números, ponto, hífen ou sublinhado.');
 let result;
 if (signup) result = await client.auth.signUp({ email: $('email').value.trim(), password: $('password').value, options: { data: { name: $('name').value.trim(), username, requested_role: $('role').value } } });
 else {
 const response = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password: $('password').value }), signal: AbortSignal.timeout(30000) });
 const body = await response.json().catch(() => ({}));
 if (!response.ok) throw new Error(body.error || 'Serviço de login indisponível.');
 result = await client.auth.setSession(body);
 }
 if (result.error) throw result.error;
 $('password').value = '';
 if (result.data.session) { await showSession(result.data.session); toast('Você entrou.'); }
 else { toast('Confirme seu e-mail e aguarde a aprovação do administrador.'); mode(false); }
 } catch(error) { fail(error); } finally { $('auth-submit').disabled = false; busy(false); }
};
$('logout').onclick = async () => { $('logout').disabled = true; try { const { error } = await client.auth.signOut(); if (error) throw error; clearSession(); } catch(error) { fail(error); } finally { $('logout').disabled = false; } };
$('request-form').onsubmit = async event => {
 event.preventDefault(); const product = products.find(p => p.codigo === $('product').value), quantity = Number($('quantity').value);
 if (!session || !profile.active || !canRequest(profile.role) || !product || !Number.isInteger(quantity) || quantity < 1 || quantity > 99999 || !$('aisle').value.trim() || !units.includes($('unit').value)) { toast('Confira produto, corredor, unidade e quantidade.', 'error'); return; }
 $('request-submit').disabled = true;
 try {
 const { error } = await client.from('restock_requests').insert({ created_by: session.user.id, product_code: product.codigo, product_name: product.nome, unit: $('unit').value, aisle: $('aisle').value.trim(), quantity, priority: $('priority').value, notes: $('notes').value.trim() });
 if (error) throw error;
 const aisle = $('aisle').value; $('request-form').reset(); $('aisle').value = aisle; $('barcode').focus(); toast('Solicitação enviada ao estoque.'); await fetchRequests();
 } catch(error) { fail(error); } finally { $('request-submit').disabled = !products.length; }
};
function selectUnit(product) { const unit = product?.unidade?.toLowerCase(); $('unit').value = units.includes(unit) ? unit : 'und'; }
function scan() {
 const product = findProduct(products, $('barcode').value);
 if (!product) { $('product').value = ''; toast(products.length ? 'Código não encontrado.' : 'A planilha ainda não está disponível.', 'error'); $('barcode').select(); return; }
 $('product').value = product.codigo; selectUnit(product); $('quantity').focus(); $('quantity').select(); toast('Produto encontrado: ' + product.nome);
}
$('barcode').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); scan(); } });
$('barcode').oninput = () => { $('product').value = ''; };
$('scan').onclick = scan;
$('product').onchange = () => { const p = products.find(p => p.codigo === $('product').value); $('barcode').value = p?.codigo_barras || p?.codigo || ''; selectUnit(p); };
async function fetchUsers() {
 $('admin-users').replaceChildren();
 if (!profile?.active || profile.role !== 'admin') return;
 const { data, error } = await client.from('profiles').select('*').order('name'); if (error) throw error;
 data.forEach(user => {
 const row = el('article', '', 'user-row'), info = el('div', '');
 info.append(el('strong', user.name), el('p', '@' + user.username + ' · Solicitou: ' + user.requested_role, 'muted'));
 const label = el('label', 'Perfil'), select = document.createElement('select'); roles.forEach(role => select.add(new Option(role, role))); select.value = user.role; label.append(select);
 const access = el('label', 'Acesso'), active = document.createElement('select'); active.add(new Option('Aprovado', 'true')); active.add(new Option('Pendente / bloqueado', 'false')); active.value = String(user.active); access.append(active);
 const save = el('button', 'Salvar acesso', 'secondary');
 select.disabled = active.disabled = save.disabled = user.id === session.user.id;
 save.onclick = async () => { save.disabled = true; try { const { error } = await client.rpc('admin_set_access', { target_id: user.id, new_role: select.value, new_active: active.value === 'true' }); if (error) throw error; toast('Acesso atualizado.'); await fetchUsers(); } catch(error) { fail(error); } finally { save.disabled = false; } };
 row.append(info, label, access, save); $('admin-users').append(row);
 });
}
async function init() {
 try {
 if (!config.supabaseUrl) { $('config-notice').hidden = false; return; }
 const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
 client = createClient(config.supabaseUrl, config.supabasePublishableKey);
 client.auth.onAuthStateChange((event, next) => { if (event === 'SIGNED_OUT') clearSession(); if (event === 'TOKEN_REFRESHED') session = next; });
 const { data, error } = await client.auth.getSession(); if (error) throw error; await showSession(data.session);
 } catch(error) { fail(error); } finally { busy(false); }
}
init();
