import { damageReasons, damageUnits, MAX_DAMAGED_ITEMS, emptyDamaged, damagedItem, damagedQuantity, damagedTotals, restoreDamaged, damagedMarkup, itemValue } from './damaged-domain.js';
import { lookupMatches } from './lookup.js';
import { confirmAction } from './confirm-dialog.js';

const brl = cents => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
const qty = n => n.toLocaleString('pt-BR', { maximumFractionDigits: 3 });

// Aba Avariados: bipa produtos danificados ou vencidos, informa motivo e validade e imprime
// com assinatura do comprador e do fiscal. O rascunho fica salvo neste navegador.
export function setupDamaged(getProducts = () => []) {
 const $ = id => document.getElementById(id);
 const el = (tag, text, css) => { const n = document.createElement(tag); if (text != null) n.textContent = text; if (css) n.className = css; return n; };
 let profile = null, owner = null, state = emptyDamaged();
 const key = () => 'repoe-damaged-v1:' + owner;
 const say = text => { $('damaged-message').textContent = text; };
 const save = () => { try { localStorage.setItem(key(), JSON.stringify(state)); } catch { say('Não foi possível guardar a lista neste navegador. Imprima antes de fechar.'); } };

 for (const [value, label] of Object.entries(damageReasons)) $('damaged-reason').add(new Option(label, value));

 function add(product) {
  if (!profile?.active) return false;
  try {
   const amount = damagedQuantity($('damaged-quantity').value);
   const same = state.items.find(i => i.code === String(product.codigo) && i.reason === state.reason && !i.expiry && !i.notes);
   if (same) { same.quantity = damagedQuantity(same.quantity + amount); say(product.nome + ': quantidade somada (' + qty(same.quantity) + ').'); }
   else { if (state.items.length >= MAX_DAMAGED_ITEMS) throw new Error('Limite de ' + MAX_DAMAGED_ITEMS + ' itens. Imprima e comece uma nova lista.'); state.items.unshift(damagedItem(product, state.reason, amount)); say(product.nome + ' adicionado como ' + damageReasons[state.reason].toLowerCase() + '.'); }
   save(); render(); return true;
  } catch (error) { say(error.message); return false; }
 }

 function resetSearch() { $('damaged-search').value = ''; $('damaged-quantity').value = '1'; $('damaged-results').replaceChildren(); $('damaged-search-status').textContent = ''; }
 function showResults(matches) {
  const root = $('damaged-results'); root.replaceChildren();
  $('damaged-search-status').textContent = $('damaged-search').value.trim() ? (matches.length ? matches.length + (matches.length === 1 ? ' produto encontrado.' : ' produtos encontrados.') + ' Toque para adicionar.' : 'Nenhum produto encontrado.') : '';
  for (const product of matches.slice(0, 12)) {
   const button = el('button', '', 'quote-result'); button.type = 'button';
   const info = el('span', '', 'quote-result-text'); info.append(el('strong', product.nome), el('span', 'Cód. ' + product.codigo + (product.codigo_barras ? ' · Barras ' + product.codigo_barras : '') + ' · ' + (product.unidade_original || product.unidade || 'UN'), 'muted small'));
   button.append(info); button.onclick = () => { if (add(product)) { resetSearch(); $('damaged-search').focus(); } };
   root.append(button);
  }
 }

 function row(item, index) {
  const card = el('article', '', 'label-row damaged-row' + (item.reason === 'vencido' ? ' is-expired' : ''));
  const head = el('div', '', 'label-row-head'), info = el('div');
  info.append(el('strong', (state.items.length - index) + '. ' + item.name), el('p', 'Cód. ' + item.code + (item.barcode ? ' · Barras ' + item.barcode : '') + ' · ' + (item.price == null ? 'sem preço' : brl(item.price) + ' / ' + item.unit), 'muted small'));
  const value = el('div', '', 'label-row-price'), total = el('strong', ''), badge = el('span', '', 'damaged-badge');
  value.append(total, badge); head.append(info, value);
  const paint = () => { const v = itemValue(item); total.textContent = v == null ? '—' : brl(v); badge.textContent = damageReasons[item.reason]; card.classList.toggle('is-expired', item.reason === 'vencido'); expiryWrap.hidden = item.reason !== 'vencido' && !item.expiry; };
  const fields = el('div', '', 'damaged-row-fields');
  const field = (label, input, css) => { const wrap = el('label', label, css); wrap.append(input); fields.append(wrap); return input; };
  const amount = field('Quantidade', Object.assign(document.createElement('input'), { type: 'number', min: 0.001, max: 99999, step: 'any', value: item.quantity, inputMode: 'decimal' }));
  const unit = field('Unidade', document.createElement('select')); for (const u of damageUnits) unit.add(new Option(u, u)); unit.value = item.unit;
  const reason = field('Motivo', document.createElement('select')); for (const [v, l] of Object.entries(damageReasons)) reason.add(new Option(l, v)); reason.value = item.reason;
  const expiry = field('Validade', Object.assign(document.createElement('input'), { type: 'date', value: item.expiry })); const expiryWrap = expiry.parentElement;
  const notes = field('Observação', Object.assign(document.createElement('input'), { maxLength: 120, value: item.notes, placeholder: 'Ex.: embalagem rasgada' }), 'damaged-notes');
  const remove = el('button', 'Remover', 'ghost danger'); remove.type = 'button'; remove.setAttribute('aria-label', 'Remover ' + item.name); fields.append(remove);
  amount.onchange = () => { try { item.quantity = damagedQuantity(amount.value); say(''); } catch (error) { say(error.message); amount.value = item.quantity; } save(); paint(); summary(); };
  unit.onchange = () => { item.unit = unit.value; save(); summary(); };
  reason.onchange = () => { item.reason = reason.value; save(); paint(); summary(); if (item.reason === 'vencido' && !item.expiry) expiry.focus(); };
  expiry.onchange = () => { item.expiry = expiry.value; save(); };
  notes.oninput = () => { item.notes = notes.value.slice(0, 120); save(); };
  remove.onclick = () => { state.items = state.items.filter(i => i.id !== item.id); save(); render(); };
  paint(); card.append(head, fields); return card;
 }

 function summary() {
  const t = damagedTotals(state), box = $('damaged-summary'); box.replaceChildren();
  const vencidos = state.items.filter(i => i.reason === 'vencido').length;
  for (const [label, value] of [['Itens', String(t.count)], ['Vencidos', String(vencidos)], ['Quantidade', t.byUnit.map(([u, q]) => qty(q) + ' ' + u).join(' + ') || '0']]) { const w = el('div'); w.append(el('dt', label), el('dd', value)); box.append(w); }
  const total = el('div', '', 'quote-summary-total'); total.append(el('dt', 'Valor (preço de venda)'), el('dd', brl(t.value))); box.append(total);
  $('damaged-count').textContent = t.count ? t.count + (t.count === 1 ? ' item' : ' itens') : '';
  const missingExpiry = state.items.filter(i => i.reason === 'vencido' && !i.expiry).length;
  $('damaged-warning').textContent = (t.missing ? t.missing + ' item(ns) sem preço na planilha não entram no valor. ' : '') + (missingExpiry ? missingExpiry + ' vencido(s) sem data de validade.' : '');
  $('damaged-print').disabled = $('damaged-clear').disabled = !t.count || !profile?.active;
 }

 function render() {
  const root = $('damaged-items'); root.replaceChildren();
  if (!state.items.length) root.append(el('p', 'Nenhum produto na lista. Bipe ou busque acima o produto avariado ou vencido.', 'muted quote-empty'));
  state.items.forEach((item, i) => root.append(row(item, i)));
  summary();
 }

 function fill() {
  $('damaged-reason').value = state.reason;
  for (const k of ['supplier', 'buyer', 'inspector', 'notes']) $('damaged-' + k).value = state[k];
  $('damaged-owner').textContent = profile?.name || '';
 }

 $('damaged-search').oninput = () => { const q = $('damaged-search').value.trim(); showResults(q ? lookupMatches(getProducts(), q) : []); };
 $('damaged-search-form').onsubmit = event => {
  event.preventDefault(); const q = $('damaged-search').value.trim(); if (!q) return;
  if (!getProducts().length) { say('O catálogo da planilha ainda não carregou. Aguarde ou clique em Atualizar lista.'); return; }
  const matches = lookupMatches(getProducts(), q);
  if (matches.length === 1) { if (add(matches[0])) resetSearch(); } else showResults(matches);
  $('damaged-search').focus();
 };
 $('damaged-reason').onchange = () => { state.reason = $('damaged-reason').value; save(); };
 for (const k of ['supplier', 'buyer', 'inspector', 'notes']) $('damaged-' + k).oninput = () => { state[k] = $('damaged-' + k).value.slice(0, k === 'notes' ? 500 : 100); save(); };
 $('damaged-clear').onclick = async () => {
  if (!await confirmAction({ title: 'Começar uma nova lista?', text: 'Os itens e os dados desta lista serão apagados deste navegador. Imprima antes se ainda precisar.', confirmLabel: 'Apagar e começar nova', danger: true })) return;
  state = { ...emptyDamaged(), reason: state.reason }; save(); fill(); render(); say('Nova lista iniciada.');
 };
 $('damaged-print').onclick = async () => {
  if (!state.items.length || !profile?.active) return;
  const button = $('damaged-print'); button.disabled = true; const title = document.title; let root;
  const cleanup = () => { root?.remove(); document.title = title; window.removeEventListener('afterprint', cleanup); summary(); };
  try {
   document.getElementById('print-list')?.remove();
   root = document.createElement('section'); root.id = 'print-list'; root.className = 'damaged-print'; root.innerHTML = damagedMarkup(state, profile.name || '');
   document.body.append(root); document.title = 'Avariados e vencidos ' + new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
   window.addEventListener('afterprint', cleanup); await root.querySelector('img').decode().catch(() => {}); window.print(); button.disabled = false;
  } catch (error) { cleanup(); say(error.message || 'Não foi possível imprimir.'); }
 };

 return {
  add,
  configure(next, id) {
   profile = next;
   if (owner !== id) { owner = id; state = emptyDamaged(); if (owner) try { state = restoreDamaged(JSON.parse(localStorage.getItem(key()) || 'null')); } catch { say('Não foi possível recuperar a lista anterior.'); } resetSearch(); }
   fill(); render();
  }
 };
}
