export const money=cents=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(cents/100);
export const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export function priceCents(value){let text=String(value??'').trim().replace(/^R\$\s*/i,'').replace(/\s/g,'');if(!text)return null;if(/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(text))text=text.replace(/\./g,'');if(!/^\d+([.,]\d{1,2})?$/.test(text))return null;const result=Math.round(Number(text.replace(',','.'))*100);return Number.isSafeInteger(result)?result:null;}
export function quoteAmounts(item){if(!Number.isFinite(item.quantity)||item.quantity<0.001||item.quantity>99999||!Number.isFinite(item.discount)||item.discount<0||item.discount>100||!Number.isSafeInteger(item.price)||item.price<0)throw new Error('Confira quantidade, preço e desconto de cada item.');const subtotal=Math.round(item.quantity*item.price),discount=Math.round(subtotal*item.discount/100),total=subtotal-discount;if(!Number.isSafeInteger(subtotal))throw new Error('Valor do item excede o limite.');return {subtotal,discount,total};}
export function quoteTotals(items){return items.reduce((totals,item)=>{const row=quoteAmounts(item);for(const key of ['subtotal','discount','total']){totals[key]+=row[key];if(!Number.isSafeInteger(totals[key]))throw new Error('Valor do orçamento excede o limite.');}return totals;},{subtotal:0,discount:0,total:0});}
export function quoteItem(product,quantity){const price=priceCents(product.preco);if(price===null)throw new Error('Este produto não tem um preço válido na planilha.');const item={id:crypto.randomUUID(),code:product.codigo,name:product.nome,unit:product.unidade_original||product.unidade||'UN',price,quantity:Number(quantity),discount:0,consultedAt:new Date().toISOString()};quoteAmounts(item);return item;}
// Desconto geral sobre o total já com os descontos por item.
// discount = {type:'percent'|'value', value} — value em % (0–100) ou em centavos.
export function generalDiscountCents(base,discount){
 const type=discount?.type==='value'?'value':'percent',value=Number(discount?.value||0);
 if(!Number.isFinite(value)||value<0)throw new Error('Confira o desconto geral.');
 if(type==='percent'){if(value>100)throw new Error('O desconto geral vai até 100%.');return Math.round(base*value/100);}
 if(!Number.isSafeInteger(value))throw new Error('Confira o desconto geral.');
 if(value>base)throw new Error('O desconto geral não pode passar do total.');
 return value;
}
export function quoteSummary(quote){
 const items=quoteTotals(quote.items),general=generalDiscountCents(items.total,quote.discount);
 return {subtotal:items.subtotal,itemDiscount:items.discount,generalDiscount:general,discount:items.discount+general,total:items.total-general};
}
export const emptyQuote=()=>({items:[],customer:'',phone:'',document:'',notes:'',validity:7,discount:{type:'percent',value:0}});
export function restoreQuote(saved){
 const quote=emptyQuote();if(!saved||!Array.isArray(saved.items)||saved.items.length>100)return quote;
 quoteTotals(saved.items);quote.items=saved.items;
 for(const [field,max] of [['customer',120],['phone',30],['document',30],['notes',500]])quote[field]=String(saved[field]||'').slice(0,max);
 const validity=Number(saved.validity);quote.validity=Number.isInteger(validity)&&validity>=0&&validity<=90?validity:7;
 if(saved.discount){const discount={type:saved.discount.type==='value'?'value':'percent',value:Number(saved.discount.value)||0};try{generalDiscountCents(quoteTotals(quote.items).total,discount);quote.discount=discount;}catch{}}
 return quote;
}
export function quoteMarkup(quote,preparedBy){const sums=quoteSummary(quote),e=escapeHtml,issued=new Date();
 const customer=[quote.customer||'Não informado',quote.phone&&'Tel.: '+quote.phone,quote.document&&'CPF/CNPJ: '+quote.document].filter(Boolean).map(e).join(' · ');
 const validUntil=quote.validity>0?new Date(issued.getTime()+quote.validity*86400000).toLocaleDateString('pt-BR'):null;
 const generalLabel=quote.discount?.type==='percent'?' ('+e(String(quote.discount.value).replace('.',','))+'%)':'';
 return '<div class="print-heading"><img class="print-logo" src="assets/logo.png" alt="Logo da loja"><h1>Orçamento</h1></div><p><strong>Cliente:</strong> '+customer+'</p><p><strong>Preparado por:</strong> '+e(preparedBy)+'</p><p><strong>Emitido em:</strong> '+e(issued.toLocaleString('pt-BR'))+(validUntil?' · <strong>Válido até:</strong> '+e(validUntil):'')+'</p><table><thead><tr><th>Produto / código</th><th>Qtd. / un.</th><th>Preço unit.</th><th>Desconto</th><th>Total</th></tr></thead><tbody>'+quote.items.map(item=>'<tr><td>'+e(item.name)+'<br>Cód. '+e(item.code)+'</td><td>'+e(item.quantity.toLocaleString('pt-BR'))+' '+e(item.unit)+'</td><td>'+money(item.price)+'</td><td>'+e(item.discount)+'%</td><td>'+money(quoteAmounts(item).total)+'</td></tr>').join('')+'</tbody></table><p>Subtotal: '+money(sums.subtotal)+(sums.itemDiscount?' · Descontos nos itens: '+money(sums.itemDiscount):'')+(sums.generalDiscount?' · Desconto geral'+generalLabel+': '+money(sums.generalDiscount):'')+'</p><h2>Total: '+money(sums.total)+'</h2>'+(quote.notes?'<p><strong>Observação:</strong> '+e(quote.notes)+'</p>':'')+'<p>Preços da planilha na consulta de cada produto. Orçamento sujeito à confirmação de valores e disponibilidade na loja. Não reserva nem movimenta estoque.</p>';}
