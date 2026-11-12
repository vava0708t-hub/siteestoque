// Cálculos das etiquetas de oferta (valores em centavos).
export const roundingModes = {
 none: { label: 'Não arredondar' },
 '99': { label: 'Terminar em ,99', step: 100, offset: 99 },
 '90': { label: 'Terminar em ,90', step: 100, offset: 90 },
 '00': { label: 'Valor inteiro (,00)', step: 100, offset: 0 },
 '50': { label: 'Terminar em ,50 ou ,00', step: 50, offset: 0 },
 '10': { label: 'Múltiplo de 0,10', step: 10, offset: 0 },
 '05': { label: 'Múltiplo de 0,05', step: 5, offset: 0 }
};

// Preço com desconto, sem arredondar.
export function discountedCents(price, discount) {
 if (!Number.isSafeInteger(price) || price <= 0) throw new Error('Produto sem preço válido.');
 if (!Number.isFinite(discount) || discount <= 0 || discount >= 100) throw new Error('Informe um desconto entre 0,01% e 99,99%.');
 return Math.round(price * (100 - discount) / 100);
}

// Arredonda para o final escolhido mais próximo, sempre abaixo do preço normal.
export function roundPrice(raw, mode, normal) {
 const rule = roundingModes[mode];
 if (!rule || !rule.step) return raw;
 const { step, offset } = rule;
 let value = Math.round((raw - offset) / step) * step + offset;
 if (value <= 0) value += step;
 while (value >= normal && value - step > 0) value -= step;
 return value > 0 && value < normal ? value : raw;
}

export function promoPrice(price, discount, mode = 'none') {
 const raw = discountedCents(price, discount);
 const value = roundPrice(raw, mode, price);
 if (value <= 0 || value >= price) throw new Error('O preço da oferta precisa ficar abaixo do preço normal.');
 return value;
}

// Desconto que de fato aparece na etiqueta, depois do arredondamento.
export const effectiveDiscount = (price, promo) => Math.round((price - promo) / price * 1000) / 10;

export const paymentModes = {
 avista: 'À vista',
 pix: 'À vista no Pix ou dinheiro',
 debito: 'No dinheiro, Pix ou débito',
 parcelado: 'Parcelado sem juros no cartão (até 6x)',
 custom: 'Outra condição'
};

// Regras da loja para parcelar: até 6x e parcela mínima de R$ 30,00.
export const MAX_INSTALLMENTS = 6;
export const MIN_INSTALLMENT = 3000;
export const clampInstallments = value => Math.min(MAX_INSTALLMENTS, Math.max(2, Math.trunc(Number(value) || MAX_INSTALLMENTS)));

// Quantas parcelas cabem neste preço respeitando o limite escolhido e a parcela mínima.
export function installmentsFor(promo, chosen) {
 return Math.min(clampInstallments(chosen), Math.floor(promo / MIN_INSTALLMENT));
}

export function paymentText(payment, promo) {
 const mode = payment?.mode in paymentModes ? payment.mode : 'pix';
 if (mode === 'custom') return String(payment.text || '').trim().slice(0, 80) || 'Consulte as condições';
 if (mode === 'parcelado') {
  const n = installmentsFor(promo, payment.installments);
  if (n < 2) return 'À vista';
  return 'Em até ' + n + 'x de ' + brl(Math.ceil(promo / n)) + ' sem juros no cartão';
 }
 return paymentModes[mode];
}

export const brl = cents => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);

// Divide o preço para o destaque: R$ | 10 | ,99
export function priceParts(cents) {
 const [whole, part] = (cents / 100).toFixed(2).split('.');
 return { whole: Number(whole).toLocaleString('pt-BR'), cents: ',' + part };
}

// Monta uma etiqueta a partir do produto da planilha.
export function labelFromProduct(product, priceCentsFn, defaults) {
 const price = priceCentsFn(product.preco);
 if (price === null || price <= 0) throw new Error(product.nome + ': produto sem preço válido na planilha.');
 const discount = Number(defaults.discount) || 10, rounding = 'none';
 return { id: crypto.randomUUID(), code: String(product.codigo), barcode: String(product.codigo_barras || ''), name: String(product.nome), unit: String(product.unidade_original || product.unidade || 'UN'), price, discount, rounding, promo: promoPrice(price, discount, rounding), manual: false, copies: 1 };
}

export const labelThemes = {
 classico: { name: 'Clássico vermelho', title: 'PROMOÇÃO' },
 amarelo: { name: 'Amarelo destaque (papel amarelo)', title: 'PROMOÇÃO' },
 black: { name: 'Black Friday', title: 'BLACK FRIDAY' },
 natal: { name: 'Natal', title: 'OFERTA DE NATAL' },
 saojoao: { name: 'São João', title: 'ARRAIÁ DE OFERTAS' },
 carnaval: { name: 'Carnaval', title: 'CARNAVAL DE OFERTAS' }
};

// Tamanhos na folha A4 (área útil de 200 × 287 mm).
export const labelLayouts = {
 '8': { perPage: 8, name: '10 × 7 cm — 8 por folha' },
 '6': { perPage: 6, name: '10 × 9,5 cm — 6 por folha' },
 '4': { perPage: 4, name: '10 × 14 cm — 4 por folha' }
};
export const perPageFor = layout => (labelLayouts[layout] || labelLayouts['8']).perPage;

export const emptyLabels = () => ({ items: [], discount: 10, rounding: 'none', payment: { mode: 'pix', installments: 6, text: '' }, validUntil: '', layout: '8', theme: 'classico', showPercent: true });

// Etiquetas antigas arredondadas voltam ao valor exato do desconto (preço manual é mantido).
function unrounded(i) {
 if (i.manual || !i.rounding || i.rounding === 'none') return i.promo;
 try { return promoPrice(i.price, Number(i.discount)); } catch { return i.promo; }
}

export function restoreLabels(saved) {
 const state = emptyLabels();
 if (!saved || typeof saved !== 'object') return state;
 if (Number(saved.discount) > 0 && Number(saved.discount) < 100) state.discount = Number(saved.discount);
 if (saved.payment && saved.payment.mode in paymentModes) state.payment = { mode: saved.payment.mode, installments: clampInstallments(saved.payment.installments), text: String(saved.payment.text || '').slice(0, 80) };
 if (/^\d{4}-\d{2}-\d{2}$/.test(saved.validUntil || '')) state.validUntil = saved.validUntil;
 if (saved.layout in labelLayouts) state.layout = saved.layout;
 if (saved.theme in labelThemes) state.theme = saved.theme;
 if (saved.showPercent === false) state.showPercent = false;
 if (Array.isArray(saved.items)) state.items = saved.items.slice(0, 200).filter(i => i && Number.isSafeInteger(i.price) && Number.isSafeInteger(i.promo) && i.promo > 0 && i.promo < i.price).map(i => ({ id: String(i.id), code: String(i.code), barcode: String(i.barcode || ''), name: String(i.name), unit: String(i.unit || 'UN'), price: i.price, discount: Number(i.discount) || 0, rounding: 'none', promo: unrounded(i), manual: !!i.manual, copies: Math.min(50, Math.max(1, Math.trunc(Number(i.copies) || 1))) }));
 return state;
}
