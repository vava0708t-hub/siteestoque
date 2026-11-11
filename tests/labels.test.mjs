import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promoPrice, roundPrice, discountedCents, effectiveDiscount, paymentText, priceParts, restoreLabels, emptyLabels } from '../dist/label-domain.js';
import { barcodeModules, validGtin, CODE128 } from '../dist/barcode.js';

test('desconto calcula o preço da oferta em centavos',()=>{
 assert.equal(discountedCents(1290,15),1097);
 assert.equal(promoPrice(1290,15,'none'),1097);
 for(const d of [0,100,-5,NaN])assert.throws(()=>discountedCents(1290,d));
 assert.throws(()=>discountedCents(0,10));
});
test('arredondamento escolhe o final mais próximo e nunca chega ao preço normal',()=>{
 assert.equal(promoPrice(1290,15,'99'),1099);
 assert.equal(promoPrice(1290,15,'90'),1090);
 assert.equal(promoPrice(1290,15,'00'),1100);
 assert.equal(promoPrice(1290,15,'50'),1100);
 assert.equal(promoPrice(1290,15,'10'),1100);
 assert.equal(promoPrice(1290,15,'05'),1095);
 assert.equal(roundPrice(1080,'99',1099),999,',99 acima do normal desce um degrau');
 assert.equal(promoPrice(105,5,'00'),100);
 assert.equal(roundPrice(40,'00',50),40,'sem opção válida mantém o valor calculado');
 assert.equal(effectiveDiscount(1290,1099),14.8);
});
test('condição de pagamento e partes do preço',()=>{
 assert.equal(paymentText({mode:'pix'},1099),'À vista no Pix ou dinheiro');
 assert.equal(paymentText({mode:'parcelado',installments:6},5999),'À vista','abaixo de R$ 60 não parcela');
 assert.match(paymentText({mode:'parcelado',installments:6},6000),/^Em até 2x de R\$\s30,00 sem juros no cartão$/);
 assert.match(paymentText({mode:'parcelado',installments:6},12990),/^Em até 4x de R\$\s32,48 sem juros/);
 assert.match(paymentText({mode:'parcelado',installments:6},99900),/^Em até 6x de R\$\s166,50/);
 assert.match(paymentText({mode:'parcelado',installments:12},99900),/^Em até 6x/,'nunca passa de 6x');
 assert.match(paymentText({mode:'parcelado',installments:3},99900),/^Em até 3x/);
 assert.equal(paymentText({mode:'custom',text:'  Só no boleto '},1099),'Só no boleto');
 assert.deepEqual(priceParts(123499),{whole:'1.234',cents:',99'});
});
test('etiquetas salvas são restauradas com limites',()=>{
 const s=restoreLabels({discount:20,rounding:'90',layout:'4',validUntil:'2026-12-01',payment:{mode:'parcelado',installments:40},items:[{id:'a',code:'1',name:'A',price:1000,promo:900,discount:10,rounding:'x',copies:99},{id:'b',code:'2',name:'B',price:1000,promo:1000}]});
 assert.equal(s.items.length,1);assert.equal(s.items[0].copies,50);assert.equal(s.items[0].rounding,'none');assert.equal(s.payment.installments,6);assert.equal(s.layout,'4');
 assert.deepEqual(restoreLabels(null),emptyLabels());
});
test('código de barras EAN-13, EAN-8, UPC-A e Code 128',()=>{
 assert.equal(validGtin('7891000315507'),true);assert.equal(validGtin('7891000315508'),false);
 const ean=barcodeModules('7891000315507');assert.equal(ean.type,'EAN-13');assert.equal(ean.bits.length,95);
 assert.equal(barcodeModules('96385074').type,'EAN-8');assert.equal(barcodeModules('96385074').bits.length,67);
 assert.equal(barcodeModules('036000291452').text,'0036000291452');
 const c=barcodeModules('ABC-123');assert.equal(c.type,'Code 128');assert.equal(c.bits.length,11*(1+7+1)+13);
 for(const p of CODE128)assert.equal([...p].reduce((a,b)=>a+Number(b),0),11);
 assert.equal(CODE128.length,106);assert.equal(barcodeModules(''),null);
});
import { labelThemes } from '../dist/label-domain.js';
test('modelo e porcentagem são salvos e valores inválidos voltam ao padrão',()=>{
 assert.ok(Object.keys(labelThemes).length>=7);
 const s=restoreLabels({theme:'black',showPercent:false});assert.equal(s.theme,'black');assert.equal(s.showPercent,false);
 const d=restoreLabels({theme:'inexistente',showPercent:'nao'});assert.equal(d.theme,'classico');assert.equal(d.showPercent,true);
});
test('etiqueta indica valor promocional manual só quando digitado à mão',async()=>{
 const {labelMarkup}=await import('../dist/labels-ui.js');
 const item={id:'1',code:'283',barcode:'',name:'Papel',unit:'UN',price:3270,promo:2470,manual:true,copies:1},state={payment:{mode:'pix'},theme:'classico',showPercent:true};
 assert.ok(labelMarkup(item,state).includes('Valor promocional manual'));
 assert.ok(!labelMarkup({...item,manual:false},state).includes('Valor promocional manual'));
});
