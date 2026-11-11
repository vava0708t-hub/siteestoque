import { roles } from './domain.js';
import { confirmAction } from './confirm-dialog.js';

export const roleLabels = { admin: 'Administrador', estoquista: 'Estoquista', repositor: 'Repositor', vendedor: 'Vendedor' };
const $ = id => document.getElementById(id);
const el = (tag, text, css) => { const n = document.createElement(tag); if (text) n.textContent = text; if (css) n.className = css; return n; };
const plain = value => String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Ordena: sem acesso primeiro (precisam de atenção), depois por nome.
export function visibleUsers(users, { search = '', status = 'all', role = 'all' } = {}) {
 const term = plain(search).trim();
 return users
  .filter(u => !u.removed_at)
  .filter(u => status === 'all' || (status === 'active' ? u.active : !u.active))
  .filter(u => role === 'all' || u.role === role)
  .filter(u => !term || plain(u.name).includes(term) || plain(u.username).includes(term))
  .sort((a, b) => Number(a.active) - Number(b.active) || a.name.localeCompare(b.name, 'pt-BR'));
}

export function createUsersAdmin(context) {
 let users = [];
 const filters = () => ({ search: $('user-search').value, status: $('user-status').value, role: $('user-role').value });
 let wired = false;
 function wire() {
  if (wired) return; wired = true;
  const roleFilter = $('user-role');
  roles.forEach(role => roleFilter.add(new Option(roleLabels[role], role)));
  for (const id of ['user-search', 'user-status', 'user-role']) $(id).addEventListener('input', render);
 }

 async function load() {
  const { client, profile } = context();
  wire();
  if (!profile?.active || profile.role !== 'admin') { users = []; render(); return; }
  const { data, error } = await client.from('profiles').select('*').order('name');
  if (error) throw error;
  users = data; render();
 }

 function summary() {
  const current = users.filter(u => !u.removed_at), box = $('users-summary');
  const stats = [['all', 'Total', current.length], ['active', 'Com acesso', current.filter(u => u.active).length], ['inactive', 'Aguardando / bloqueados', current.filter(u => !u.active).length]];
  box.replaceChildren(...stats.map(([status, label, count]) => {
   const card = el('button', '', 'users-stat' + (status === 'inactive' && count ? ' attention' : '') + ($('user-status').value === status ? ' selected' : ''));
   card.type = 'button'; card.append(el('strong', String(count)), el('span', label));
   card.onclick = () => { $('user-status').value = status; render(); };
   return card;
  }));
 }

 function render() {
  const list = $('admin-users');
  summary();
  const shown = visibleUsers(users, filters());
  if (!shown.length) { list.replaceChildren(el('p', users.length ? 'Nenhum usuário encontrado com esses filtros.' : 'Nenhum usuário cadastrado.', 'muted users-empty')); return; }
  list.replaceChildren(...shown.map(card));
 }

 async function run(button, task) {
  button.disabled = true;
  try { await task(); } catch (error) { context().fail(error); } finally { button.disabled = false; }
 }

 function card(user) {
  const { client, session, toast, accountRequest, onSelfUpdated } = context();
  const self = user.id === session.user.id;
  const row = el('article', '', 'user-card' + (user.active ? '' : ' inactive'));

  const head = el('div', '', 'user-head'), who = el('div', '', 'user-who');
  const avatar = el('span', user.name.split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase(), 'user-avatar'); avatar.setAttribute('aria-hidden', 'true');
  const name = el('strong', user.name); if (self) name.append(el('span', 'Você', 'user-tag'));
  who.append(name, el('span', '@' + user.username, 'muted small'));
  const badges = el('div', '', 'user-badges');
  badges.append(el('span', roleLabels[user.role] || user.role, 'user-badge role-' + user.role), el('span', user.active ? 'Com acesso' : 'Sem acesso', 'user-badge ' + (user.active ? 'status-on' : 'status-off')));
  head.append(avatar, who, badges); row.append(head);

  if (!user.active && !self) {
   const pending = el('div', '', 'user-pending');
   pending.append(el('p', 'Pediu acesso como ' + (roleLabels[user.requested_role] || user.requested_role) + '.', 'small'));
   const approve = el('button', 'Aprovar como ' + (roleLabels[user.requested_role] || user.requested_role), 'primary'); approve.type = 'button';
   approve.onclick = () => run(approve, async () => { const { error } = await client.rpc('admin_set_access', { target_id: user.id, new_role: user.requested_role, new_active: true }); if (error) throw error; toast(user.name + ' aprovado.'); await load(); });
   pending.append(approve); row.append(pending);
  }

  if (self) row.append(el('p', 'Sua própria função e seu acesso só podem ser alterados por outro administrador.', 'muted small'));
  else {
   const access = el('div', '', 'user-access');
   const roleLabel = el('label', 'Perfil'), roleSelect = document.createElement('select');
   roles.forEach(role => roleSelect.add(new Option(roleLabels[role], role))); roleSelect.value = user.role; roleLabel.append(roleSelect);
   const activeLabel = el('label', 'Acesso'), activeSelect = document.createElement('select');
   activeSelect.add(new Option('Liberado', 'true')); activeSelect.add(new Option('Bloqueado', 'false')); activeSelect.value = String(user.active); activeLabel.append(activeSelect);
   const save = el('button', 'Salvar acesso', 'secondary'); save.type = 'button'; save.disabled = true;
   const dirty = () => { save.disabled = roleSelect.value === user.role && activeSelect.value === String(user.active); };
   roleSelect.onchange = activeSelect.onchange = dirty;
   save.onclick = () => run(save, async () => { const { error } = await client.rpc('admin_set_access', { target_id: user.id, new_role: roleSelect.value, new_active: activeSelect.value === 'true' }); if (error) throw error; toast('Acesso de ' + user.name + ' atualizado.'); await load(); });
   access.append(roleLabel, activeLabel, save); row.append(access);
  }

  const editor = el('details', '', 'admin-user-editor'); editor.append(el('summary', 'Editar nome, login e senha'));
  const form = document.createElement('form'), nameLabel = el('label', 'Nome'), nameInput = document.createElement('input'), loginLabel = el('label', 'Login'), loginInput = document.createElement('input');
  nameInput.value = user.name; nameInput.required = true; nameInput.maxLength = 100; nameLabel.append(nameInput);
  loginInput.value = user.username; loginInput.required = true; loginInput.minLength = 3; loginInput.maxLength = 30; loginInput.autocapitalize = 'none'; loginLabel.append(loginInput);
  const profileSave = el('button', 'Salvar cadastro', 'primary'); profileSave.type = 'submit'; form.append(nameLabel, loginLabel, profileSave);
  form.onsubmit = event => { event.preventDefault(); run(profileSave, async () => {
   const result = await accountRequest({ action: 'admin-profile', targetId: user.id, name: nameInput.value.trim(), username: loginInput.value.trim() });
   toast(result.message); if (self) onSelfUpdated(nameInput.value.trim(), loginInput.value.trim().toLowerCase()); await load();
  }); };
  const passwordForm = document.createElement('form'), pwLabel = el('label', 'Nova senha'), pw = document.createElement('input'), confirmLabel = el('label', 'Confirmar nova senha'), confirmation = document.createElement('input');
  for (const input of [pw, confirmation]) { input.type = 'password'; input.autocomplete = 'new-password'; input.minLength = 6; input.maxLength = 128; input.required = true; }
  pwLabel.append(pw); confirmLabel.append(confirmation);
  const reset = el('button', 'Redefinir senha', 'secondary'); reset.type = 'submit'; passwordForm.append(pwLabel, confirmLabel, reset);
  passwordForm.onsubmit = event => { event.preventDefault(); if (pw.value !== confirmation.value) return toast('As senhas não conferem.', 'error');
   run(reset, async () => { const result = await accountRequest({ action: 'admin-password', targetId: user.id, newPassword: pw.value }); passwordForm.reset(); toast(result.message); }); };
  editor.append(form, passwordForm); row.append(editor);

  if (!self) {
   const footer = el('div', '', 'user-footer');
   const remove = el('button', user.active ? 'Remover usuário' : 'Recusar e remover', 'ghost danger'); remove.type = 'button';
   remove.onclick = async () => {
    const ok = await confirmAction({ title: 'Remover ' + user.name + '?', text: 'A pessoa perde o acesso e o login @' + user.username + ' fica livre para outro cadastro. Listas e pedidos já feitos continuam no histórico. Não é possível desfazer.', confirmLabel: 'Remover usuário', danger: true });
    if (!ok) return;
    run(remove, async () => { const result = await accountRequest({ action: 'admin-remove', targetId: user.id }); toast(result.message); await load(); });
   };
   footer.append(remove); row.append(footer);
  }
  return row;
 }

 return { load, render };
}
