import { test } from 'node:test';
import assert from 'node:assert/strict';
import { productsFromCSV, parseCSV } from '../dist/catalog.js';
test('CSV com BOM, CRLF, vírgulas, aspas escapadas e linhas internas', () => {
  assert.deepEqual(parseCSV('\uFEFFcodigo,nome\r\n001,"Arroz, tipo ""A"""\r\n002,"Duas\nlinhas"'), [['codigo','nome'],['001','Arroz, tipo "A"'],['002','Duas\nlinhas']]);
});
test('preserva zeros no código e ignora linhas vazias', () => {
  assert.equal(productsFromCSV('codigo,nome\n001,Arroz\n\n')[0].codigo, '001');
});
test('rejeita catálogo inválido', () => {
  for (const csv of ['<html>Login</html>', 'codigo,nome\n1,A\n1,B', 'codigo,nome\n1,', 'codigo,nome\n1,"A']) assert.throws(() => productsFromCSV(csv));
});

import { stockProductsFromCSV } from '../dist/catalog.js';
import { findProduct, matchingProducts, searchProducts, productKey } from '../dist/domain.js';
test('layout real sem cabeçalho preserva primeira linha e zeros do código de barras', () => {
 const p=stockProductsFromCSV('14231,"""0000003885482""",CARTAO MICRO SD,UN,83\n2,2,CAIXA,CX,0');
 assert.equal(p.length,2); assert.equal(p[0].codigo_barras,'0000003885482'); assert.equal(p[0].unidade,'und'); assert.equal(p[1].unidade,'cx');
});
test('remove somente repetições equivalentes e conserva produtos conflitantes', () => {
 const p=stockProductsFromCSV('1,0001,Caneta,UN\n1,0001,Caneta,UN\n1,0001,Lapis,UN');
 assert.equal(p.length,2); assert.notEqual(productKey(p[0]),productKey(p[1]));
 assert.equal(findProduct(p,'0001'),undefined); assert.equal(matchingProducts(p,'0001').length,2);
});
test('sem GTIN não é um código de barras e unidade desconhecida é preservada', () => {
 const [p]=stockProductsFromCSV('1,SEM GTIN,Produto,RL');
 assert.equal(p.codigo_barras,''); assert.equal(p.unidade,'rl'); assert.equal(findProduct([p],''),undefined);
});
test('busca ignora acentos, combina palavras e limita a lista', () => {
 const p=Array.from({length:100},(_,i)=>({codigo:String(i),nome:'Lápis azul',codigo_barras:''}));
 assert.equal(searchProducts(p,'azul lapis').length,80); assert.equal(searchProducts(p,'vermelho').length,0);
});
