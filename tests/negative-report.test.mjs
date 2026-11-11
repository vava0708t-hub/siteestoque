import { test } from 'node:test';
import assert from 'node:assert/strict';
import { negativeDemand } from '../dist/reports-domain.js';
import { isNegativeStock } from '../dist/stock.js';
const products=[
 {codigo:'1',nome:'Caneta azul',estoque:'-5',unidade_original:'UN'},
 {codigo:'2',nome:'Caderno',estoque:'10',unidade_original:'UN'},
 {codigo:'3',nome:'Papel A4',estoque:'-1.200',unidade_original:'RSM'},
 {codigo:'4',nome:'Cola branca',estoque:'-2',unidade_original:'UN'},
 {codigo:'4',nome:'Cola colorida',estoque:'8',unidade_original:'UN'}
];
const row=(code,name,list,number,quantity=1,unit='und')=>({product_code:code,product_name:name,unit,quantity,list_id:list,lists:{number,requester_name:'Ana'}});
test('lista só produtos negativos pedidos, com listas e quantidades somadas',()=>{
 const rows=[row('1','Caneta azul','a',10,2),row('1','Caneta azul','b',11,3),row('2','Caderno','a',10),row('3','Papel A4','b',11,5,'cx'),row('9','Fora do catálogo','a',10)];
 const result=negativeDemand(rows,products,isNegativeStock);
 assert.deepEqual(result.map(p=>p.code),['1','3']);
 assert.equal(result[0].quantity,5);assert.deepEqual(result[0].lists.map(l=>l.number),[10,11]);assert.equal(result[0].stock,'-5');
 assert.equal(result[1].stockUnit,'RSM');
});
test('código repetido na planilha usa o nome para achar o produto certo',()=>{
 assert.deepEqual(negativeDemand([row('4','Cola branca','a',1)],products,isNegativeStock).map(p=>p.name),['Cola branca']);
 assert.equal(negativeDemand([row('4','Cola colorida','a',1)],products,isNegativeStock).length,0);
 assert.equal(negativeDemand([row('4','Cola sem nome igual','a',1)],products,isNegativeStock).length,0);
});
test('mesma lista conta uma vez e empate ordena pelo estoque mais negativo',()=>{
 const result=negativeDemand([row('1','Caneta azul','a',10),row('1','Caneta azul','a',10),row('3','Papel A4','b',11)],products,isNegativeStock);
 assert.equal(result.find(p=>p.code==='1').lists.length,1);
 assert.deepEqual(result.map(p=>p.code),['3','1']);
 assert.deepEqual(negativeDemand([],products,isNegativeStock),[]);
});
