import {test} from 'node:test';import assert from 'node:assert/strict';
import {stockProductsFromCSV} from '../dist/catalog.js';import {promotionLabel,lookupMatches} from '../dist/lookup.js';
test('consulta lê C D E F G e diferencia promoções e dados ausentes',()=>{
 const p=stockProductsFromCSV('1,001,Produto,CX,"12,90",-3,S\n2,002,Outro,UN,0,0,N\n3,003,Terceiro,PCT,,,');
 assert.equal(p[0].nome,'Produto');assert.equal(p[0].unidade_original,'CX');assert.equal(p[0].preco,'12,90');assert.equal(p[0].estoque,'-3');assert.equal(promotionLabel(p[0].promocao),'Em promoção');
 assert.equal(p[1].preco,'0');assert.equal(promotionLabel(p[1].promocao),'Sem promoção');assert.equal(promotionLabel(p[2].promocao),'Promoção não informada');
 assert.equal(stockProductsFromCSV('1,001,Produto,UN,10,2,S\n1,001,Produto,UN,20,2,N').length,2);
});

test('campo unificado prioriza código exato e aceita descrição e marca',()=>{
 const p=[{codigo:'001',codigo_barras:'000123',nome:'Lápis Mercur'},{codigo:'2',nome:'Lápis azul 001',codigo_barras:'22'}];
 assert.deepEqual(lookupMatches(p,' 000123 '),[p[0]]);
 assert.deepEqual(lookupMatches(p,'001'),[p[0]]);
 assert.deepEqual(lookupMatches(p,'lapis mercur'),[p[0]]);
 assert.equal(lookupMatches(p,'lapis').length,2);
 assert.equal(lookupMatches(p,'').length,0);
 assert.equal(lookupMatches([...p,{...p[0]}],'001').length,2);
});
