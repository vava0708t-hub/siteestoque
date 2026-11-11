import {quoteItem,quoteAmounts,quoteSummary,quoteMarkup,money,emptyQuote,restoreQuote,priceCents} from './quote-domain.js';
import {lookupMatches} from './lookup.js';
import {confirmAction} from './confirm-dialog.js';

// Aba Orçamentos: busca própria de produtos, itens com desconto, desconto geral,
// dados do cliente, validade e observação. O rascunho fica salvo neste navegador.
export function setupQuote(getProducts=()=>[]){
 const $=id=>document.getElementById(id);
 const el=(tag,text,css)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(css)n.className=css;return n;};
 let profile=null,owner=null,quote=emptyQuote();
 const key=()=>'repoe-quote-v2:'+owner;
 const say=text=>{$('quote-message').textContent=text;};
 function save(){try{localStorage.setItem(key(),JSON.stringify(quote));}catch{say('Não foi possível guardar o rascunho neste navegador. Imprima antes de fechar.');}}

 function add(product,quantity){
  if(!profile?.active)return false;
  try{
   const amount=Number(quantity);
   const existing=quote.items.find(item=>item.code===product.codigo&&item.price===priceCents(product.preco));
   if(existing){const next={...existing,quantity:Math.round((existing.quantity+amount)*1000)/1000};quoteAmounts(next);existing.quantity=next.quantity;say(product.nome+': quantidade somada ao item já existente.');}
   else{if(quote.items.length>=100)throw new Error('Limite de 100 itens por orçamento.');quote.items.push(quoteItem(product,amount));say(product.nome+' adicionado.');}
   save();render();return true;
  }catch(error){say(error.message);return false;}
 }

 function resetSearch(){$('quote-search').value='';$('quote-quantity').value='1';$('quote-results').replaceChildren();$('quote-search-status').textContent='';}
 function showResults(matches){
  const root=$('quote-results');root.replaceChildren();
  $('quote-search-status').textContent=$('quote-search').value.trim()?(matches.length?matches.length+(matches.length===1?' produto encontrado.':' produtos encontrados.')+' Toque para adicionar.':'Nenhum produto encontrado.'):'';
  for(const product of matches.slice(0,12)){
   const price=priceCents(product.preco),button=el('button','','quote-result');button.type='button';
   const text=el('span','','quote-result-text');text.append(el('strong',product.nome),el('span','Cód. '+product.codigo+' · '+(product.unidade_original||product.unidade||'UN')+' · Estoque: '+(product.estoque===''||product.estoque==null?'não informado':product.estoque),'muted small'));
   button.append(text,el('span',price===null?'Sem preço':money(price),'quote-result-price'));
   button.disabled=price===null;
   button.onclick=()=>{if(add(product,$('quote-quantity').value)){resetSearch();$('quote-search').focus();}};
   root.append(button);
  }
 }

 function summary(){
  const box=$('quote-summary');box.replaceChildren();let sums;
  try{sums=quoteSummary(quote);$('quote-discount-value').setCustomValidity('');}
  catch(error){$('quote-discount-value').setCustomValidity(error.message);say(error.message);sums=quoteSummary({...quote,discount:{type:'percent',value:0}});}
  const rows=[['Itens',String(quote.items.length)],['Subtotal',money(sums.subtotal)]];
  if(sums.itemDiscount)rows.push(['Descontos nos itens','− '+money(sums.itemDiscount)]);
  if(sums.generalDiscount)rows.push(['Desconto geral','− '+money(sums.generalDiscount)]);
  for(const [label,value] of rows){const wrap=el('div');wrap.append(el('dt',label),el('dd',value));box.append(wrap);}
  const total=el('div','','quote-summary-total');total.append(el('dt','Total'),el('dd',money(sums.total)));box.append(total);
 }

 function render(){
  const root=$('quote-items');root.replaceChildren();
  if(!quote.items.length)root.append(el('p','Nenhum produto no orçamento. Busque acima para adicionar.','muted quote-empty'));
  for(const item of quote.items){
   const row=el('article','','quote-item'),head=el('div','','quote-item-head');
   const info=el('div');info.append(el('strong',item.name),el('p','Cód. '+item.code+' · '+money(item.price)+' / '+item.unit,'muted small'));
   const line=el('strong',money(quoteAmounts(item).total),'quote-line-total');head.append(info,line);
   const fields=el('div','','quote-item-fields');
   for(const [field,label,min,max,step] of [['quantity','Quantidade',0.001,99999,0.001],['discount','Desconto (%)',0,100,0.01]]){
    const wrap=el('label',label),input=document.createElement('input');input.type='number';input.min=min;input.max=max;input.step=step;input.required=true;input.value=item[field];
    input.onchange=()=>{const next={...item,[field]:Number(input.value)};try{if(!input.reportValidity())throw new Error('Confira o valor informado.');quoteAmounts(next);item[field]=next[field];line.textContent=money(quoteAmounts(item).total);save();summary();say('');}catch(error){input.value=item[field];say(error.message);}};
    wrap.append(input);fields.append(wrap);
   }
   const remove=el('button','Remover','ghost danger');remove.type='button';remove.setAttribute('aria-label','Remover '+item.name+' do orçamento');
   remove.onclick=()=>{quote.items=quote.items.filter(i=>i.id!==item.id);save();render();};
   fields.append(remove);row.append(head,fields);root.append(row);
  }
  $('quote-print').disabled=$('quote-clear').disabled=!quote.items.length||!profile?.active;
  $('quote-count').textContent=quote.items.length?quote.items.length+(quote.items.length===1?' item':' itens'):'';
  summary();
 }

 function fillForm(){
  for(const field of ['customer','phone','document','notes'])$('quote-'+field).value=quote[field];
  $('quote-validity').value=String(quote.validity);
  $('quote-discount-type').value=quote.discount.type;
  $('quote-discount-value').value=quote.discount.type==='value'?String(quote.discount.value/100):String(quote.discount.value);
  $('quote-discount-value').max=quote.discount.type==='percent'?'100':'';
 }

 function readDiscount(){
  const type=$('quote-discount-type').value==='value'?'value':'percent',raw=Number($('quote-discount-value').value||0);
  quote.discount={type,value:type==='value'?Math.round(raw*100):raw};
  $('quote-discount-value').max=type==='percent'?'100':'';
  save();summary();
 }

 $('quote-search').oninput=()=>{const query=$('quote-search').value.trim();showResults(query?lookupMatches(getProducts(),query):[]);};
 $('quote-search-form').onsubmit=event=>{
  event.preventDefault();const query=$('quote-search').value.trim();if(!query)return;
  if(!$('quote-quantity').reportValidity())return;
  const matches=lookupMatches(getProducts(),query);
  if(matches.length===1){if(add(matches[0],$('quote-quantity').value))resetSearch();}
  else showResults(matches);
  $('quote-search').focus();
 };
 for(const field of ['customer','phone','document','notes'])$('quote-'+field).oninput=()=>{quote[field]=$('quote-'+field).value;save();};
 $('quote-validity').onchange=()=>{quote.validity=Number($('quote-validity').value);save();};
 $('quote-discount-type').onchange=()=>{$('quote-discount-value').value='0';readDiscount();};
 $('quote-discount-value').oninput=readDiscount;
 $('quote-clear').onclick=async()=>{
  if(!await confirmAction({title:'Começar novo orçamento?',text:'Os produtos, o cliente, o desconto e a observação deste orçamento serão apagados. Imprima antes se precisar guardar.',confirmLabel:'Apagar e começar',danger:true}))return;
  quote=emptyQuote();save();fillForm();render();resetSearch();say('Novo orçamento iniciado.');$('quote-search').focus();
 };
 $('quote-print').onclick=async()=>{
  if(!quote.items.length||!profile?.active)return;
  try{quoteSummary(quote);}catch(error){say(error.message);$('quote-discount-value').focus();return;}
  const button=$('quote-print');button.disabled=true;let root;const title=document.title;
  const cleanup=()=>{root?.remove();document.title=title;window.removeEventListener('afterprint',cleanup);button.disabled=!quote.items.length;};
  try{document.getElementById('print-list')?.remove();root=document.createElement('section');root.id='print-list';root.innerHTML=quoteMarkup(quote,profile.name);document.body.append(root);document.title='Orçamento'+(quote.customer?' - '+quote.customer:'');window.addEventListener('afterprint',cleanup);await root.querySelector('img').decode().catch(()=>{});window.print();button.disabled=false;}
  catch(error){cleanup();say(error.message||'Não foi possível imprimir.');}
 };

 return {
  add(product){if(add(product,1))return true;return false;},
  refresh(){const query=$('quote-search').value.trim();showResults(query?lookupMatches(getProducts(),query):[]);},
  configure(next,id){
   profile=next;
   if(owner!==id){
    owner=id;quote=emptyQuote();
    if(owner)try{
     let saved=JSON.parse(localStorage.getItem(key())||'null');
     if(!saved)saved=JSON.parse(sessionStorage.getItem('repoe-quote-v1:'+owner)||'null');
     quote=restoreQuote(saved);
    }catch{say('Não foi possível recuperar o orçamento anterior.');}
    fillForm();resetSearch();
   }
   render();
  }
 };
}
