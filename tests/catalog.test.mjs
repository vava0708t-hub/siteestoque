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
