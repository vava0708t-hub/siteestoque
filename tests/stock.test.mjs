import {test} from 'node:test';
import assert from 'node:assert/strict';
import {stockProductsFromCSV} from '../dist/catalog.js';
import {stockLabel,itemStockLabel,isNegativeStock,itemStockNegative} from '../dist/stock.js';
test('saldo vem da coluna F, preserva zero e formato decimal',()=>{
 const products=stockProductsFromCSV('1,001,Caneta,UN,999,0\n2,002,Papel,KG,999,"1.234,50"\n3,003,Caixa,CX,999,');
 assert.equal(products[0].estoque,'0');assert.ok(stockLabel(products[0]).includes('0 UN'));
 assert.equal(products[1].estoque,'1.234,50');assert.ok(stockLabel(products[2]).includes('não informado'));
 assert.ok(itemStockLabel(products,{product_code:'1',product_name:'Caneta'}).includes('0 UN'));
 assert.ok(itemStockLabel(products,{product_code:'1',product_name:'Outro'}).includes('indisponível'));
});
test('saldos divergentes não são escolhidos arbitrariamente',()=>{
 const products=stockProductsFromCSV('1,001,Caneta,UN,,10\n1,001,Caneta,UN,,20');
 assert.equal(products.length,2);
 assert.ok(itemStockLabel(products,{product_code:'1',product_name:'Caneta'}).includes('divergente'));
});

test('negativos ficam destacados sem confundir saldo zero, vazio ou divergente',()=>{
 for(const estoque of ['-60','-1.234,50','-0,5','−2'])assert.equal(isNegativeStock({estoque}),true);
 for(const estoque of ['0','-0,00','60','','indisponível'])assert.equal(isNegativeStock({estoque}),false);
 const p={codigo:'1',nome:'Caneta',estoque:'-60',unidade:'und'};
 assert.equal(itemStockNegative([p],{product_code:'1',product_name:'Caneta'}),true);
 assert.equal(itemStockNegative([p,{...p,estoque:'20'}],{product_code:'1',product_name:'Caneta'}),false);
});
