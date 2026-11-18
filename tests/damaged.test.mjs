import test from 'node:test';
import assert from 'node:assert/strict';
import { damagedItem, damagedQuantity, damagedTotals, restoreDamaged, damagedMarkup, emptyDamaged } from '../dist/damaged-domain.js';

const product = { codigo: '45', codigo_barras: '7908229104826', nome: 'REFIL HP <70ML>', preco: '11,80', unidade_original: 'UN' };

test('avariados: item vem da planilha e quantidade é validada', () => {
 const item = damagedItem(product, 'vencido', '2');
 assert.equal(item.code, '45'); assert.equal(item.price, 1180); assert.equal(item.unit, 'UND'); assert.equal(item.quantity, 2); assert.equal(item.reason, 'vencido');
 assert.equal(damagedItem({ ...product, preco: '' }).price, null, 'sem preço não quebra');
 assert.equal(damagedItem(product, 'xyz').reason, 'avariado');
 assert.equal(damagedQuantity('1.5'), 1.5);
 for (const bad of [0, -1, 'a', 100000]) assert.throws(() => damagedQuantity(bad));
});

test('avariados: totais por unidade e valor ignoram itens sem preço', () => {
 const state = { ...emptyDamaged(), items: [damagedItem(product, 'avariado', 3), { ...damagedItem({ ...product, codigo: '9', preco: '' }), unit: 'CX', quantity: 2 }] };
 const t = damagedTotals(state);
 assert.equal(t.count, 2); assert.equal(t.value, 3540); assert.equal(t.missing, 1); assert.deepEqual(t.byUnit, [['UND', 3], ['CX', 2]]);
});

test('avariados: rascunho restaurado com limites', () => {
 const s = restoreDamaged({ reason: 'vencido', supplier: ' X '.repeat(80), items: [{ id: 'a', code: '1', name: 'A', unit: 'kg', price: 100, quantity: 2, reason: 'vencido', expiry: '2026-11-01' }, { id: 'b', code: '2', name: 'B', quantity: -5 }, { code: '', name: 'C', quantity: 1 }] });
 assert.equal(s.reason, 'vencido'); assert.equal(s.supplier.length, 100); assert.equal(s.items.length, 1);
 assert.equal(s.items[0].unit, 'KG'); assert.equal(s.items[0].expiry, '2026-11-01');
 assert.deepEqual(restoreDamaged(null), emptyDamaged());
});

test('avariados: impressão traz itens, totais e as duas assinaturas', () => {
 const item = { ...damagedItem(product, 'vencido', 2), expiry: '2026-10-30', notes: 'lacre <aberto>' };
 const html = damagedMarkup({ ...emptyDamaged(), items: [item], buyer: 'Carlos', supplier: 'HP' }, 'Ana', new Date(2026, 10, 17, 9, 0));
 assert.match(html, /Avariados e vencidos/); assert.match(html, /Responsável pela lista:<\/strong> Ana/); assert.match(html, /Fornecedor:<\/strong> HP/);
 assert.match(html, /REFIL HP &lt;70ML&gt;/, 'escapa HTML'); assert.match(html, /lacre &lt;aberto&gt;/);
 assert.match(html, /30\/10\/2026/); assert.match(html, /Vencido/);
 assert.match(html, /R\$\s23,60/);
 assert.match(html, /Assinatura do comprador<\/strong><span>Nome: Carlos/);
 assert.match(html, /Assinatura do fiscal<\/strong><span>Nome: _{5,}/, 'fiscal sem nome fica com linha para escrever');
});
