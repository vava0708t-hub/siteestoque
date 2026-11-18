// Lista de avariados e vencidos: regras e impressão (valores em centavos).
import { priceCents, escapeHtml } from './quote-domain.js';

export const damageReasons = { avariado: 'Avariado / danificado', vencido: 'Vencido', outro: 'Outro motivo' };
export const damageUnits = ['UND', 'CX', 'PCT', 'FARDO', 'KG', 'LT'];
export const MAX_DAMAGED_ITEMS = 200;

export const emptyDamaged = () => ({ items: [], reason: 'avariado', supplier: '', buyer: '', inspector: '', notes: '' });

const text = (value, max) => String(value ?? '').trim().slice(0, max);
const unitOf = value => { const u = text(value, 10).toUpperCase(); return damageUnits.includes(u) ? u : u === 'UN' ? 'UND' : 'UND'; };
const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? value : '';

export function damagedQuantity(value) {
 const n = Number(value);
 if (!Number.isFinite(n) || n <= 0 || n > 99999) throw new Error('Quantidade entre 0,001 e 99.999.');
 return Math.round(n * 1000) / 1000;
}

export function damagedItem(product, reason = 'avariado', quantity = 1) {
 const price = priceCents(product.preco);
 return {
  id: crypto.randomUUID(), code: String(product.codigo), barcode: String(product.codigo_barras || ''), name: String(product.nome),
  unit: unitOf(product.unidade_original || product.unidade), price: price > 0 ? price : null,
  quantity: damagedQuantity(quantity), reason: reason in damageReasons ? reason : 'avariado', expiry: '', notes: ''
 };
}

export const itemValue = item => item.price == null ? null : Math.round(item.price * item.quantity);

export function damagedTotals(state) {
 const byUnit = new Map(); let value = 0, missing = 0;
 for (const item of state.items) {
  byUnit.set(item.unit, Math.round(((byUnit.get(item.unit) || 0) + item.quantity) * 1000) / 1000);
  const v = itemValue(item); if (v == null) missing++; else value += v;
 }
 return { count: state.items.length, byUnit: [...byUnit], value, missing };
}

export function restoreDamaged(saved) {
 const state = emptyDamaged();
 if (!saved || typeof saved !== 'object') return state;
 if (saved.reason in damageReasons) state.reason = saved.reason;
 for (const [key, max] of [['supplier', 100], ['buyer', 100], ['inspector', 100], ['notes', 500]]) state[key] = text(saved[key], max);
 if (Array.isArray(saved.items)) state.items = saved.items.slice(0, MAX_DAMAGED_ITEMS).filter(i => i && i.code && i.name).flatMap(i => {
  try {
   return [{ id: text(i.id, 60) || crypto.randomUUID(), code: text(i.code, 40), barcode: text(i.barcode, 40), name: text(i.name, 200), unit: unitOf(i.unit),
    price: Number.isSafeInteger(i.price) && i.price > 0 ? i.price : null, quantity: damagedQuantity(i.quantity),
    reason: i.reason in damageReasons ? i.reason : 'avariado', expiry: validDate(i.expiry), notes: text(i.notes, 120) }];
  } catch { return []; }
 });
 return state;
}

const brl = cents => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
const qty = n => n.toLocaleString('pt-BR', { maximumFractionDigits: 3 });
const day = value => value ? value.split('-').reverse().join('/') : '';

// Folha impressa, com campos de assinatura do comprador e do fiscal.
export function damagedMarkup(state, preparedBy, now = new Date()) {
 const e = escapeHtml, totals = damagedTotals(state);
 const info = [['Data', now.toLocaleString('pt-BR')], ['Responsável pela lista', preparedBy], ['Fornecedor', state.supplier]].filter(([, v]) => v);
 const sign = (title, name) => '<div class="damaged-sign"><div class="damaged-sign-line"></div><strong>' + e(title) + '</strong><span>Nome: ' + (name ? e(name) : '_______________________________') + '</span><span>Data: ____/____/________</span></div>';
 return '<div class="print-heading"><img class="print-logo" src="assets/logo.png" alt="Logo da loja"><h1>Avariados e vencidos</h1></div>'
  + '<p>' + info.map(([k, v]) => '<strong>' + e(k) + ':</strong> ' + e(v)).join(' · ') + '</p>'
  + '<table class="damaged-table"><thead><tr><th>Nº</th><th>Código</th><th>Descrição</th><th>Un.</th><th>Qtd.</th><th>Motivo</th><th>Validade</th><th>Valor unit.</th><th>Total</th></tr></thead><tbody>'
  + state.items.map((item, i) => '<tr><td>' + (i + 1) + '</td><td>' + e(item.code) + (item.barcode && item.barcode !== item.code ? '<br><small>' + e(item.barcode) + '</small>' : '') + '</td><td>' + e(item.name) + (item.notes ? '<br><small>Obs.: ' + e(item.notes) + '</small>' : '') + '</td><td>' + e(item.unit) + '</td><td>' + e(qty(item.quantity)) + '</td><td>' + e(damageReasons[item.reason]) + '</td><td>' + e(day(item.expiry)) + '</td><td>' + (item.price == null ? '—' : e(brl(item.price))) + '</td><td>' + (itemValue(item) == null ? '—' : e(brl(itemValue(item)))) + '</td></tr>').join('')
  + '</tbody><tfoot><tr><td colspan="4"><strong>' + totals.count + (totals.count === 1 ? ' item' : ' itens') + '</strong></td><td colspan="4">' + e(totals.byUnit.map(([u, q]) => qty(q) + ' ' + u).join(' + ')) + '</td><td><strong>' + e(brl(totals.value)) + '</strong></td></tr></tfoot></table>'
  + (totals.missing ? '<p><small>' + totals.missing + ' item(ns) sem preço na planilha não entram no valor total.</small></p>' : '')
  + '<p><small>Valores pelo preço de venda da planilha.</small></p>'
  + (state.notes ? '<p><strong>Observação:</strong> ' + e(state.notes) + '</p>' : '')
  + '<div class="damaged-signatures">' + sign('Assinatura do comprador', state.buyer) + sign('Assinatura do fiscal', state.inspector) + '</div>';
}
