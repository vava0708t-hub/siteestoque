import { roundingModes, paymentModes, labelThemes, labelLayouts, perPageFor, clampInstallments, promoPrice, effectiveDiscount, paymentText, brl, priceParts, labelFromProduct, emptyLabels, restoreLabels } from './label-domain.js';
import { barcodeSvg } from './barcode.js';
import { priceCents, escapeHtml } from './quote-domain.js';
import { lookupMatches } from './lookup.js';
import { confirmAction } from './confirm-dialog.js';

const e = escapeHtml;
const fmtPct = n => String(Math.round(n * 10) / 10).replace('.', ',') + '%';
const validLabel = value => { if (!value) return ''; const [y, m, d] = value.split('-'); return 'Oferta válida até ' + d + '/' + m + '/' + y + ' ou enquanto durarem os estoques.'; };

// HTML de uma etiqueta (usado na pré-visualização e na impressão).
export function labelMarkup(item, state) {
 const parts = priceParts(item.promo), off = Math.round(effectiveDiscount(item.price, item.promo));
 const theme = state.theme in labelThemes ? state.theme : 'classico', title = labelThemes[theme].title, showOff = state.showPercent !== false && off > 0;
 return '<article class="promo-label theme-' + theme + (showOff ? '' : ' no-off') + '">'
  + '<div class="pl-top"><span class="pl-logo-wrap"><img class="pl-logo" src="assets/logo.png" alt=""></span><span class="pl-flag' + (title.length > 10 ? ' pl-flag-long' : '') + '">' + e(title) + '</span></div>'
  + (showOff ? '<span class="pl-off"><b>-' + off + '%</b><small>OFF</small></span>' : '')
  + '<div class="pl-name">' + e(item.name) + '</div>'
  + (showOff ? '<div class="pl-deal"><span class="pl-deal-pct"><b>-' + off + '%</b><small>OFF</small></span><span class="pl-deal-save">Economize<b>' + brl(item.price - item.promo) + '</b></span></div>' : '')
  + '<div class="pl-prices"><div class="pl-from"><span>De</span><s>' + brl(item.price) + '</s></div>'
  + '<div class="pl-to"><span class="pl-por">POR</span><span class="pl-cur">R$</span><span class="pl-int' + (parts.whole.length >= 5 ? ' pl-int-s' : parts.whole.length >= 3 ? ' pl-int-m' : '') + '">' + e(parts.whole) + '</span><span class="pl-cents">' + e(parts.cents) + '<small>' + e(item.unit) + '</small></span></div></div>'
  + '<div class="pl-pay">' + e(paymentText(state.payment, item.promo)) + '</div>'
  + '<div class="pl-foot">' + (barcodeSvg(item.barcode) ? '<div class="pl-code">' + barcodeSvg(item.barcode) + '<span>' + e(item.barcode) + '</span></div>' : '<span></span>')
  + '<span class="pl-meta">Cód. ' + e(item.code) + (item.manual ? '<br><b class="pl-manual">Manual</b>' : '') + (state.validUntil ? '<br>' + e(validLabel(state.validUntil)) : '') + '</span></div>'
  + '</article>';
}

// Diminui o título (OFERTA, APROVEITE…) até caber na faixa da etiqueta.
export function fitLabels(root) {
 for (const flag of root.querySelectorAll('.pl-flag')) {
  flag.style.fontSize = '';
  let size = parseFloat(getComputedStyle(flag).fontSize), min = size * .2;
  while (flag.scrollWidth > flag.clientWidth + 1 && size > min) { size *= .94; flag.style.fontSize = size + 'px'; }
 }
}

export function labelPages(state) {
 const perPage = perPageFor(state.layout), all = [];
 for (const item of state.items) for (let i = 0; i < item.copies; i++) all.push(item);
 const pages = [];
 for (let i = 0; i < all.length; i += perPage) pages.push(all.slice(i, i + perPage));
 return pages;
}

export function setupLabels(getProducts = () => []) {
 const $ = id => document.getElementById(id);
 const el = (tag, text, css) => { const n = document.createElement(tag); if (text != null) n.textContent = text; if (css) n.className = css; return n; };
 let profile = null, owner = null, state = emptyLabels();
 const key = () => 'repoe-labels-v1:' + owner;
 const say = text => { $('labels-message').textContent = text; };
 const save = () => { try { localStorage.setItem(key(), JSON.stringify(state)); } catch { say('Não foi possível guardar as etiquetas neste navegador.'); } };

 for (const [value, mode] of Object.entries(roundingModes)) $('labels-rounding').add(new Option(mode.label, value));
 for (const [value, label] of Object.entries(paymentModes)) $('labels-payment').add(new Option(label, value));
 $('labels-layout').replaceChildren(); for (const [value, layout] of Object.entries(labelLayouts)) $('labels-layout').add(new Option(layout.name, value));

 function add(product) {
  if (!profile?.active) return false;
  try {
   if (state.items.length >= 200) throw new Error('Limite de 200 etiquetas. Imprima e comece uma nova folha.');
   const existing = state.items.find(i => i.code === String(product.codigo) && i.price === priceCents(product.preco));
   if (existing) { existing.copies = Math.min(50, existing.copies + 1); say(product.nome + ': mais uma cópia (' + existing.copies + ').'); }
   else { state.items.push(labelFromProduct(product, priceCents, state)); say(product.nome + ' adicionado.'); }
   save(); render(); return true;
  } catch (error) { say(error.message); return false; }
 }

 function resetSearch() { $('labels-search').value = ''; $('labels-results').replaceChildren(); $('labels-search-status').textContent = ''; }
 function showResults(matches) {
  const root = $('labels-results'); root.replaceChildren();
  $('labels-search-status').textContent = $('labels-search').value.trim() ? (matches.length ? matches.length + (matches.length === 1 ? ' produto encontrado.' : ' produtos encontrados.') + ' Toque para criar a etiqueta.' : 'Nenhum produto encontrado.') : '';
  for (const product of matches.slice(0, 12)) {
   const price = priceCents(product.preco), button = el('button', '', 'quote-result'); button.type = 'button';
   const text = el('span', '', 'quote-result-text'); text.append(el('strong', product.nome), el('span', 'Cód. ' + product.codigo + (product.codigo_barras ? ' · Barras ' + product.codigo_barras : ''), 'muted small'));
   button.append(text, el('span', price === null ? 'Sem preço' : brl(price), 'quote-result-price'));
   button.disabled = price === null || price <= 0;
   button.onclick = () => { if (add(product)) { resetSearch(); $('labels-search').focus(); } };
   root.append(button);
  }
 }

 function recalc(item) { if (!item.manual) item.promo = promoPrice(item.price, item.discount, item.rounding); }

 function row(item) {
  const card = el('article', '', 'label-row'), head = el('div', '', 'label-row-head');
  const info = el('div'); info.append(el('strong', item.name), el('p', 'Cód. ' + item.code + (item.barcode ? ' · Barras ' + item.barcode : ' · sem código de barras') + ' · Normal ' + brl(item.price), 'muted small'));
  const result = el('div', '', 'label-row-price'); const promo = el('strong', brl(item.promo)), real = el('span', 'Desconto real ' + fmtPct(effectiveDiscount(item.price, item.promo)), 'muted small');
  result.append(promo, real); head.append(info, result);
  const fields = el('div', '', 'label-row-fields');
  const refresh = () => { promo.textContent = brl(item.promo); real.textContent = 'Desconto real ' + fmtPct(effectiveDiscount(item.price, item.promo)); priceInput.value = (item.promo / 100).toFixed(2); manualTag.hidden = !item.manual; save(); preview(); };
  const field = (label, input) => { const wrap = el('label', label); wrap.append(input); fields.append(wrap); return input; };
  const discount = field('Desconto (%)', Object.assign(document.createElement('input'), { type: 'number', min: 0.01, max: 99.99, step: 0.01, value: item.discount }));
  const rounding = field('Arredondar', document.createElement('select'));
  for (const [value, mode] of Object.entries(roundingModes)) rounding.add(new Option(mode.label, value)); rounding.value = item.rounding;
  const priceInput = field('Preço da oferta (R$)', Object.assign(document.createElement('input'), { type: 'number', min: 0.01, step: 0.01, value: (item.promo / 100).toFixed(2) }));
  const copies = field('Cópias', Object.assign(document.createElement('input'), { type: 'number', min: 1, max: 50, step: 1, value: item.copies }));
  const manualTag = el('span', 'Preço digitado à mão', 'label-manual'); manualTag.hidden = !item.manual;
  const update = (apply, input) => { try { apply(); refresh(); say(''); } catch (error) { say(error.message); input.value = input === priceInput ? (item.promo / 100).toFixed(2) : input === discount ? item.discount : input.value; } };
  discount.onchange = () => update(() => { const v = Number(discount.value); promoPrice(item.price, v, item.rounding); item.discount = v; item.manual = false; recalc(item); }, discount);
  rounding.onchange = () => update(() => { item.rounding = rounding.value; item.manual = false; recalc(item); }, rounding);
  priceInput.onchange = () => update(() => { const v = Math.round(Number(priceInput.value) * 100); if (!Number.isSafeInteger(v) || v <= 0 || v >= item.price) throw new Error('O preço da oferta precisa ficar entre R$ 0,01 e o preço normal.'); item.promo = v; item.manual = true; }, priceInput);
  copies.onchange = () => update(() => { const v = Math.trunc(Number(copies.value)); if (!(v >= 1 && v <= 50)) throw new Error('Cópias de 1 a 50.'); item.copies = v; }, copies);
  const remove = el('button', 'Remover', 'ghost danger'); remove.type = 'button'; remove.setAttribute('aria-label', 'Remover etiqueta de ' + item.name);
  remove.onclick = () => { state.items = state.items.filter(i => i.id !== item.id); save(); render(); };
  fields.append(remove); card.append(head, fields, manualTag);
  return card;
 }

 function preview() {
  const count = state.items.reduce((sum, i) => sum + i.copies, 0), perPage = perPageFor(state.layout);
  $('labels-preview').className = 'labels-preview layout-' + state.layout;
  $('labels-preview').innerHTML = state.items.map(item => labelMarkup(item, state)).join('');
  fitLabels($('labels-preview'));
  $('labels-total').textContent = count ? count + (count === 1 ? ' etiqueta' : ' etiquetas') + ' · ' + Math.ceil(count / perPage) + (Math.ceil(count / perPage) === 1 ? ' folha A4' : ' folhas A4') : '';
  $('labels-print').disabled = $('labels-clear').disabled = !count || !profile?.active;
  themes();
 }

 // Miniaturas dos modelos, usando a primeira etiqueta (ou um exemplo).
 function themes() {
  const sample = state.items[0] || { name: 'Produto de exemplo', code: '123', barcode: '7891000315507', unit: 'UN', price: 1290, promo: 1099 };
  const root = $('labels-themes'); root.replaceChildren();
  for (const [value, theme] of Object.entries(labelThemes)) {
   const button = el('button', '', 'theme-option' + (state.theme === value ? ' selected' : '')); button.type = 'button';
   button.setAttribute('role', 'radio'); button.setAttribute('aria-checked', String(state.theme === value)); button.setAttribute('aria-label', 'Modelo ' + theme.name);
   const thumb = el('span', '', 'theme-thumb'); thumb.innerHTML = labelMarkup(sample, { ...state, theme: value });
   button.append(thumb, el('span', theme.name, 'theme-name'));
   button.onclick = () => { state.theme = value; save(); preview(); };
   root.append(button);
  }
  fitLabels(root);
 }
 // Emojis dos títulos sazonais podem carregar depois: ajusta de novo quando as fontes chegam.
 const refit = () => { fitLabels($('labels-preview')); fitLabels($('labels-themes')); };
 document.fonts?.ready?.then(refit);
 document.fonts?.addEventListener?.('loadingdone', refit);

 function render() {
  const root = $('labels-items'); root.replaceChildren();
  if (!state.items.length) root.append(el('p', 'Nenhuma etiqueta ainda. Bipe ou busque um produto acima.', 'muted quote-empty'));
  state.items.forEach(item => root.append(row(item)));
  preview();
 }

 function fillSettings() {
  $('labels-discount').value = state.discount; $('labels-rounding').value = state.rounding;
  $('labels-payment').value = state.payment.mode; $('labels-installments').value = state.payment.installments; $('labels-payment-text').value = state.payment.text;
  $('labels-valid').value = state.validUntil; $('labels-layout').value = state.layout; $('labels-show-percent').checked = state.showPercent !== false;
  $('labels-installments-wrap').hidden = state.payment.mode !== 'parcelado'; $('labels-payment-text-wrap').hidden = state.payment.mode !== 'custom';
 }

 $('labels-search').oninput = () => { const q = $('labels-search').value.trim(); showResults(q ? lookupMatches(getProducts(), q) : []); };
 $('labels-search-form').onsubmit = event => {
  event.preventDefault(); const q = $('labels-search').value.trim(); if (!q) return;
  const matches = lookupMatches(getProducts(), q);
  if (matches.length === 1) { if (add(matches[0])) resetSearch(); } else showResults(matches);
  $('labels-search').focus();
 };
 $('labels-discount').onchange = () => { const v = Number($('labels-discount').value); if (!(v > 0 && v < 100)) { say('Desconto padrão entre 0,01% e 99,99%.'); $('labels-discount').value = state.discount; return; } state.discount = v; save(); };
 $('labels-rounding').onchange = () => { state.rounding = $('labels-rounding').value; save(); };
 $('labels-apply').onclick = () => {
  let skipped = 0;
  for (const item of state.items) { try { item.promo = promoPrice(item.price, state.discount, state.rounding); item.discount = state.discount; item.rounding = state.rounding; item.manual = false; } catch { skipped++; } }
  save(); render(); say(skipped ? skipped + ' etiqueta(s) não puderam usar esse desconto.' : 'Desconto e arredondamento aplicados a todas as etiquetas.');
 };
 $('labels-payment').onchange = () => { state.payment.mode = $('labels-payment').value; fillSettings(); save(); preview(); };
 $('labels-installments').onchange = () => { const v = Math.trunc(Number($('labels-installments').value)); state.payment.installments = clampInstallments(v); $('labels-installments').value = state.payment.installments; save(); preview(); };
 $('labels-payment-text').oninput = () => { state.payment.text = $('labels-payment-text').value.slice(0, 80); save(); preview(); };
 $('labels-valid').onchange = () => { state.validUntil = $('labels-valid').value; save(); preview(); };
 $('labels-layout').onchange = () => { state.layout = $('labels-layout').value in labelLayouts ? $('labels-layout').value : '8'; save(); preview(); };
 $('labels-show-percent').onchange = () => { state.showPercent = $('labels-show-percent').checked; save(); preview(); };
 $('labels-clear').onclick = async () => {
  if (!await confirmAction({ title: 'Apagar todas as etiquetas?', text: 'A lista de etiquetas será esvaziada. As configurações de desconto e pagamento continuam.', confirmLabel: 'Apagar etiquetas', danger: true })) return;
  state.items = []; save(); render(); say('Etiquetas apagadas.');
 };
 $('labels-print').onclick = async () => {
  if (!state.items.length || !profile?.active) return;
  const button = $('labels-print'); button.disabled = true; const title = document.title; let root, style;
  const cleanup = () => { root?.remove(); style?.remove(); document.title = title; window.removeEventListener('afterprint', cleanup); preview(); };
  try {
   document.getElementById('print-list')?.remove();
   style = document.createElement('style'); style.textContent = '@page{size:A4 portrait;margin:5mm}'; document.head.append(style);
   root = document.createElement('section'); root.id = 'print-list'; root.className = 'label-print layout-' + state.layout;
   root.innerHTML = labelPages(state).map(page => '<div class="label-page">' + page.map(item => labelMarkup(item, state)).join('') + '</div>').join('');
   document.body.append(root); document.title = 'Etiquetas de oferta';
   root.style.cssText = 'display:block;position:absolute;left:-10000px;top:0;width:210mm'; fitLabels(root); root.style.cssText = '';
   window.addEventListener('afterprint', cleanup);
   await Promise.all([...root.querySelectorAll('img')].map(img => img.decode().catch(() => {})));
   window.print(); button.disabled = false;
  } catch (error) { cleanup(); say(error.message || 'Não foi possível imprimir.'); }
 };

 return {
  add,
  configure(next, id) {
   profile = next;
   if (owner !== id) { owner = id; state = emptyLabels(); if (owner) try { state = restoreLabels(JSON.parse(localStorage.getItem(key()) || 'null')); } catch { say('Não foi possível recuperar as etiquetas anteriores.'); } fillSettings(); resetSearch(); }
   render();
  }
 };
}
