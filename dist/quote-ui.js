import {quoteItem,quoteAmounts,quoteSummary,quoteMarkup,money,emptyQuote,restoreQuote,priceCents,quoteFromSaved,quotePayload,quoteValidUntil} from './quote-domain.js';
import {lookupMatches} from './lookup.js';
import {confirmAction} from './confirm-dialog.js';

// Aba Orçamentos: busca própria de produtos, itens com desconto, desconto geral,
// dados do cliente, validade e observação. O rascunho fica salvo neste navegador.
export function setupQuote(getProducts=()=>[],getContext=()=>({})){
 const $=id=>document.getElementById(id);
 const el=(tag,text,css)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(css)n.className=css;return n;};
 let profile=null,owner=null,quote=emptyQuote(),changed=false,savedRows=[],savedLoaded=false;
 const key=()=>'repoe-quote-v2:'+owner;
 const say=text=>{$('quote-message').textContent=text;};
 function store(){try{localStorage.setItem(key(),JSON.stringify(quote));}catch{say('Não foi possível guardar o rascunho neste navegador. Imprima antes de fechar.');}}
 function save(){changed=true;store();savedInfo();}

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
  $('quote-print').disabled=$('quote-clear').disabled=$('quote-save').disabled=!quote.items.length||!profile?.active;
  savedInfo();
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
  quote=emptyQuote();changed=false;store();fillForm();render();resetSearch();say('Novo orçamento iniciado.');$('quote-search').focus();
 };
 $('quote-print').onclick=async()=>{
  if(!quote.items.length||!profile?.active)return;
  try{quoteSummary(quote);}catch(error){say(error.message);$('quote-discount-value').focus();return;}
  const button=$('quote-print');button.disabled=true;let root;const title=document.title;
  const cleanup=()=>{root?.remove();document.title=title;window.removeEventListener('afterprint',cleanup);button.disabled=!quote.items.length;};
  try{document.getElementById('print-list')?.remove();root=document.createElement('section');root.id='print-list';root.innerHTML=quoteMarkup(quote,profile.name);document.body.append(root);document.title='Orçamento'+(quote.customer?' - '+quote.customer:'');window.addEventListener('afterprint',cleanup);await root.querySelector('img').decode().catch(()=>{});window.print();button.disabled=false;}
  catch(error){cleanup();say(error.message||'Não foi possível imprimir.');}
 };


 // ---- Orçamentos salvos no banco (guardados até o fim da validade) ----
 const fmtDate=value=>value?new Date(value).toLocaleDateString('pt-BR'):'';
 function savedInfo(){
  const info=$('quote-saved-info');if(!info)return;
  if(!quote.savedId){info.textContent=quote.items.length?'Ainda não salvo. Salve para guardar até o fim da validade.':'';info.className='muted small';$('quote-save').textContent='Salvar orçamento';return;}
  info.textContent='Orçamento nº '+quote.savedNumber+(changed?' · alterações não salvas':' · salvo')+(quote.expiresAt?' · guardado até '+fmtDate(quote.expiresAt):'');
  info.className='small quote-saved-badge'+(changed?' pending':'');$('quote-save').textContent=changed?'Salvar alterações':'Salvo ✓';
 }
 const missingTable=error=>['42P01','PGRST205','PGRST202'].includes(error?.code);
 async function saveCloud(){
  const {client}=getContext();if(!client||!quote.items.length||!profile?.active)return;
  try{quoteSummary(quote);}catch(error){say(error.message);return;}
  const button=$('quote-save');button.disabled=true;
  try{
   const {data,error}=await client.rpc('save_quote',{payload:quotePayload(quote),quote_key:quote.savedId||null});
   if(error){if(missingTable(error))throw new Error('Para salvar orçamentos, execute a migração 017_saved_quotes.sql no Supabase.');throw new Error(error.message||'Não foi possível salvar o orçamento.');}
   const first=!quote.savedId;quote.savedId=data.id;quote.savedNumber=data.number;quote.createdAt=data.created_at;quote.expiresAt=data.expires_at;changed=false;store();savedInfo();
   say((first?'Orçamento nº '+data.number+' salvo.':'Orçamento nº '+data.number+' atualizado.')+' Fica guardado até '+fmtDate(data.expires_at)+'.');
   await loadSaved();
  }catch(error){say(error.message);}finally{button.disabled=!quote.items.length;}
 }
 async function loadSaved(){
  const {client}=getContext(),list=$('quote-saved-list');if(!client||!profile?.active){list.replaceChildren();return;}
  $('quote-saved-status').textContent='Carregando orçamentos salvos…';
  const {data,error}=await client.from('saved_quotes').select('id,number,created_by,created_name,customer,phone,document,notes,validity,discount,items,total,created_at,expires_at').order('created_at',{ascending:false}).limit(200);
  if(error){savedRows=[];list.replaceChildren();$('quote-saved-status').textContent=missingTable(error)?'Orçamentos salvos ainda não ativados: execute a migração 017_saved_quotes.sql no Supabase.':'Não foi possível carregar os orçamentos salvos.';return;}
  savedRows=data||[];savedLoaded=true;renderSaved();
 }
 function renderSaved(){
  const list=$('quote-saved-list'),term=$('quote-saved-search').value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');list.replaceChildren();
  const plain=v=>String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const rows=savedRows.filter(r=>!term||String(r.number).includes(term)||plain(r.customer).includes(term)||plain(r.phone).includes(term)||plain(r.document).includes(term)||plain(r.created_name).includes(term));
  $('quote-saved-status').textContent=savedRows.length?(rows.length===savedRows.length?savedRows.length+(savedRows.length===1?' orçamento salvo.':' orçamentos salvos.'):rows.length+' de '+savedRows.length+' orçamentos.'):'Nenhum orçamento salvo ainda.';
  for(const row of rows){
   const card=el('article','','quote-saved-row'+(row.id===quote.savedId?' current':'')),info=el('div','','quote-saved-text');
   info.append(el('strong','Nº '+row.number+' · '+(row.customer||'Cliente não informado')),el('span',(n=>n+(n===1?' item · ':' itens · '))(Array.isArray(row.items)?row.items.length:0)+money(Number(row.total)||0)+' · criado em '+fmtDate(row.created_at)+(row.created_name?' por '+row.created_name:''),'muted small'));
   const days=Math.ceil((Date.parse(row.expires_at)-Date.now())/86400000);
   info.append(el('span',(row.validity>0?'Válido até ':'Guardado até ')+fmtDate(row.expires_at)+(days<=2?' · vence em breve':''),'small quote-expiry'+(days<=2?' soon':'')));
   const actions=el('div','','quote-saved-actions');
   const open=el('button',row.id===quote.savedId?'Aberto':'Abrir','secondary');open.type='button';open.disabled=row.id===quote.savedId;
   open.onclick=async()=>{if(changed&&quote.items.length&&!await confirmAction({title:'Abrir outro orçamento?',text:'O orçamento atual tem alterações que não foram salvas e elas serão perdidas.',confirmLabel:'Abrir mesmo assim',danger:true}))return;
    try{quote=quoteFromSaved(row);changed=false;store();fillForm();render();renderSaved();say('Orçamento nº '+row.number+' aberto.');$('quote-screen').scrollIntoView({behavior:'smooth',block:'start'});}catch{say('Não foi possível abrir esse orçamento.');}};
   const copy=el('button','Duplicar','ghost');copy.type='button';copy.title='Abrir uma cópia como orçamento novo';
   copy.onclick=async()=>{if(changed&&quote.items.length&&!await confirmAction({title:'Duplicar orçamento?',text:'O orçamento atual tem alterações que não foram salvas e elas serão perdidas.',confirmLabel:'Duplicar mesmo assim',danger:true}))return;
    try{const next=quoteFromSaved(row);quote={...next,savedId:null,savedNumber:null,createdAt:null,expiresAt:null};changed=true;store();fillForm();render();renderSaved();say('Cópia do nº '+row.number+' aberta como orçamento novo. Salve para gerar outro número.');}catch{say('Não foi possível duplicar.');}};
   const remove=el('button','Excluir','ghost danger');remove.type='button';
   remove.onclick=async()=>{if(!await confirmAction({title:'Excluir o orçamento nº '+row.number+'?',text:'Ele será apagado para todos. Não é possível desfazer.',confirmLabel:'Excluir',danger:true}))return;
    const {error}=await getContext().client.rpc('delete_quote',{quote_key:row.id});if(error){say('Não foi possível excluir: '+(error.message||''));return;}
    if(quote.savedId===row.id){quote.savedId=null;quote.savedNumber=null;quote.createdAt=null;quote.expiresAt=null;changed=true;store();savedInfo();}
    say('Orçamento nº '+row.number+' excluído.');await loadSaved();};
   actions.append(open,copy,remove);card.append(info,actions);list.append(card);
  }
 }
 $('quote-save').onclick=saveCloud;
 $('quote-saved-search').oninput=renderSaved;
 $('quote-saved-refresh').onclick=()=>loadSaved();
 document.addEventListener('app:view-change',event=>{if(event.detail==='quotes'&&profile?.active)loadSaved();});

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
    changed=false;savedRows=[];savedLoaded=false;fillForm();resetSearch();
   }
   render();if(!profile)$('quote-saved-list').replaceChildren();
  }
 };
}
