import test from 'node:test';import assert from 'node:assert/strict';
import {priceCents,quoteItem,quoteAmounts,quoteTotals,quoteMarkup} from '../dist/quote-domain.js';
import {reportRange,aggregateDemand} from '../dist/reports-domain.js';
test('orçamento interpreta preço brasileiro sem transformar preço ausente em zero',()=>{assert.equal(priceCents('1.234,56'),123456);assert.equal(priceCents('R$ 12,90'),1290);assert.equal(priceCents('12.90'),1290);assert.equal(priceCents('0'),0);for(const v of ['',null,'-1','abc','12,345'])assert.equal(priceCents(v),null);assert.throws(()=>quoteItem({codigo:'1',nome:'Produto',preco:''},1));});
test('desconto é aplicado por item e arredondado em centavos',()=>{const item={price:1990,quantity:3,discount:10};assert.deepEqual(quoteAmounts(item),{subtotal:5970,discount:597,total:5373});assert.equal(quoteAmounts({price:1290,quantity:0.5,discount:0}).total,645);assert.equal(quoteTotals([item,{price:1000,quantity:1,discount:100}]).total,5373);for(const patch of [{quantity:0},{quantity:NaN},{discount:101},{discount:-1},{price:-1}])assert.throws(()=>quoteAmounts({...item,...patch}));});
test('impressão de orçamento escapa cliente e descrição e informa desconto',()=>{const item=quoteItem({codigo:'1',nome:'<script>Produto</script>',preco:'12,90',unidade_original:'UN'},2);item.discount=10;const markup=quoteMarkup({items:[item],customer:'<img>',notes:'Entrega <amanhã>'},'Equipe');assert.ok(markup.includes('&lt;script&gt;'));assert.ok(markup.includes('&lt;img&gt;'));assert.ok(markup.includes('10%'));assert.ok(markup.includes('23,22'));assert.ok(markup.includes('Não reserva'));});
test('relatório conta listas distintas e não mistura embalagens ou variantes',()=>{const rows=[{product_code:'1',product_name:'Caneta',unit:'cx',quantity:2,list_id:'a'},{product_code:'1',product_name:'Caneta',unit:'cx',quantity:3,list_id:'a'},{product_code:'1',product_name:'Caneta',unit:'cx',quantity:1,list_id:'b'},{product_code:'1',product_name:'Caneta',unit:'und',quantity:20,list_id:'a'},{product_code:'1',product_name:'Caneta outra',unit:'cx',quantity:1,list_id:'a'}];const result=aggregateDemand(rows);assert.equal(result.listCount,2);assert.equal(result.itemCount,5);assert.equal(result.products.length,3);assert.equal(result.products[0].lists,2);assert.equal(result.products[0].quantity,6);});
test('datas do relatório têm limite, validade e final exclusivo',()=>{const range=reportRange('2026-09-01','2026-09-01');assert.equal(new Date(range.until)-new Date(range.from),86400000);for(const [a,b] of [['2026-09-02','2026-09-01'],['2026-01-01','2026-12-31'],['2026-02-31','2026-03-01'],['','']])assert.throws(()=>reportRange(a,b));});
import {quoteSummary,generalDiscountCents,restoreQuote,emptyQuote} from '../dist/quote-domain.js';
test('desconto geral em % ou R$ é aplicado depois dos descontos por item',()=>{
 const items=[{price:1000,quantity:2,discount:10},{price:500,quantity:1,discount:0}];
 assert.deepEqual(quoteSummary({items,discount:{type:'percent',value:10}}),{subtotal:2500,itemDiscount:200,generalDiscount:230,discount:430,total:2070});
 assert.equal(quoteSummary({items,discount:{type:'value',value:300}}).total,2000);
 assert.equal(quoteSummary({items}).total,2300);
 for(const discount of [{type:'percent',value:101},{type:'percent',value:-1},{type:'value',value:2301},{type:'value',value:1.5}])assert.throws(()=>generalDiscountCents(2300,discount));
});
test('rascunho salvo é restaurado com limites e desconto inválido é descartado',()=>{
 const items=[{id:'1',code:'1',name:'A',unit:'UN',price:1000,quantity:1,discount:0}];
 const quote=restoreQuote({items,customer:'x'.repeat(200),phone:'119',document:'123',validity:200,discount:{type:'value',value:999999}});
 assert.equal(quote.customer.length,120);assert.equal(quote.phone,'119');assert.equal(quote.validity,7);assert.deepEqual(quote.discount,{type:'percent',value:0});
 assert.deepEqual(restoreQuote(null),emptyQuote());
});
test('impressão traz contato do cliente, desconto geral e validade',()=>{
 const items=[{id:'1',code:'1',name:'Caderno',unit:'UN',price:1000,quantity:2,discount:0}];
 const markup=quoteMarkup({...emptyQuote(),items,customer:'Maria',phone:'(11) 9999-0000',document:'123.456.789-00',validity:7,discount:{type:'percent',value:5},notes:'Pix'},'Equipe');
 for(const text of ['Maria','(11) 9999-0000','CPF/CNPJ: 123.456.789-00','Desconto geral (5%)','R$&nbsp;1,00','Válido até','19,00','Pix'])assert.ok(markup.includes(text)||markup.includes(text.replace('&nbsp;',' ')),text);
});
