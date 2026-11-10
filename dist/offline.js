import {itemBarcode} from './stock.js';
import {readCatalog,clearCatalog} from './catalog-cache.js';
import {setupLookup} from './lookup.js';
import {units} from './domain.js';
import {createOfflineStore} from './offline-store.js';
import {emptyOfflineDraft,offlineItem,offlineListForPrint,offlineStockLabel} from './offline-draft.js';
import {printRestockList} from './print-list.js';
const $=id=>document.getElementById(id),store=createOfflineStore();
let products=[],saved=null,selected=null,draft=emptyOfflineDraft(),writes=Promise.resolve(),version=0;
function message(text){$('offline-message').textContent=text;}
function persist(){const snapshot=structuredClone(draft),revision=++version;$('draft-save-status').textContent='Salvando neste aparelho…';writes=writes.catch(()=>{}).then(()=>store.save(snapshot));writes.then(()=>{if(revision===version)$('draft-save-status').textContent='Rascunho salvo neste aparelho.';},()=>{if(revision===version)$('draft-save-status').textContent='Não foi possível salvar. Mantenha esta página aberta e imprima a lista para não perder os itens.';});}
function deselect(){selected=null;$('offline-add-button').disabled=true;$('selected-product').textContent='Selecione um produto nos resultados.';}
const lookup=setupLookup(()=>products,p=>{selected=p;$('selected-product').textContent=p.nome;$('offline-add-button').disabled=false;$('offline-unit').value=units.includes(p.unidade)?p.unidade:'und';});
$('lookup-code').addEventListener('input',deselect);
function field(label,value,type,change){const wrap=document.createElement('label');wrap.textContent=label;const input=document.createElement(type==='unit'?'select':'input');if(type==='unit')for(const unit of units){const option=document.createElement('option');option.value=unit;option.textContent=unit.toUpperCase();input.append(option);}else{input.type=type;if(type==='number'){input.min=1;input.max=99999;input.step=1;}else input.maxLength=label==='Observação'?500:60;}input.value=value;input.onchange=()=>{if(!input.reportValidity())return;change(input.value);persist();};wrap.append(input);return wrap;}
function render(){const root=$('offline-items');root.replaceChildren();$('offline-count').textContent='('+draft.items.length+' itens)';$('offline-print').disabled=!draft.items.length;
 if(!draft.items.length){const p=document.createElement('p');p.textContent='Adicione produtos para montar a lista de impressão.';root.append(p);}
 for(const item of draft.items){
 const row=document.createElement('article');row.className='offline-item';
 const title=document.createElement('h3');title.textContent=item.product_name;
 const meta=document.createElement('p');meta.className='offline-item-meta muted small';
 const updateMeta=()=>{meta.textContent='Cód. '+item.product_code+' · '+item.aisle+(item.notes?' · Obs.: '+item.notes:'');};updateMeta();
 const quick=document.createElement('div');quick.className='offline-item-quick';
 quick.append(field('Qtd.',item.quantity,'number',v=>{item.quantity=Number(v);}),field('Emb.',item.unit,'unit',v=>{item.unit=v;}));
 const edit=document.createElement('button');edit.type='button';edit.className='secondary';edit.textContent='Editar';edit.setAttribute('aria-expanded','false');
 const extra=document.createElement('div');extra.className='offline-item-extra';extra.id='edit-'+item.id;extra.hidden=true;edit.setAttribute('aria-controls',extra.id);
 edit.onclick=()=>{extra.hidden=!extra.hidden;edit.textContent=extra.hidden?'Editar':'Fechar';edit.setAttribute('aria-expanded',String(!extra.hidden));};
 const fields=document.createElement('div');fields.className='offline-fields';fields.append(field('Corredor',item.aisle,'text',v=>{item.aisle=v.trim();updateMeta();}),field('Observação',item.notes,'text',v=>{item.notes=v.trim();updateMeta();}));
 const stock=document.createElement('p');stock.className='muted small';stock.textContent=offlineStockLabel(item);extra.append(fields,stock);
 const remove=document.createElement('button');remove.type='button';remove.className='secondary offline-item-remove';remove.textContent='Excluir';remove.setAttribute('aria-label','Excluir '+item.product_name);remove.onclick=()=>{draft.items=draft.items.filter(i=>i.id!==item.id);persist();render();};
 quick.append(edit,remove);row.append(title,meta,quick,extra);root.append(row);
 }
}
$('offline-add').onsubmit=event=>{event.preventDefault();try{const item=offlineItem(selected,{quantity:$('offline-quantity').value,unit:$('offline-unit').value,aisle:$('offline-aisle').value,notes:$('offline-notes').value},saved?.savedAt);draft.items.push(item);draft.aisle=item.aisle;persist();render();lookup.reset();deselect();$('offline-notes').value='';$('offline-quantity').value='1';$('lookup-code').focus();message('Item adicionado à lista offline.');}catch(error){message(error.message);}};
$('offline-requester').oninput=()=>{draft.requester_name=$('offline-requester').value;persist();};
$('offline-aisle').onchange=()=>{draft.aisle=$('offline-aisle').value;persist();};
$('offline-print').onclick=async()=>{try{await printRestockList(offlineListForPrint(draft),'original',[],offlineStockLabel,item=>itemBarcode(products,item));}catch(error){message(error.message||'Não foi possível abrir a impressão.');}};
$('offline-reset').onclick=()=>$('offline-confirm').showModal();$('cancel-reset').onclick=()=>$('offline-confirm').close();$('confirm-reset').onclick=()=>{draft=emptyOfflineDraft();$('offline-requester').value='';$('offline-aisle').value='';persist();render();message('Rascunho limpo.');$('offline-confirm').close();};
function catalogMessage(){ $('saved-time').textContent=saved?'Catálogo salvo em '+new Date(saved.savedAt).toLocaleString('pt-BR'):'Sem catálogo salvo. Abra o site com internet e atualize os produtos antes de montar uma nova lista offline.'; }
$('clear-catalog').onclick=async()=>{try{await clearCatalog();saved=null;products=[];lookup.reset();deselect();catalogMessage();}catch{message('Não foi possível apagar o catálogo.');}};
try{const previous=await store.read();if(previous){draft=previous;$('draft-save-status').textContent='Rascunho recuperado deste aparelho.';}}catch{$('draft-save-status').textContent='Armazenamento local indisponível. A lista poderá ser impressa, mas não será preservada ao fechar.';}
$('offline-requester').value=draft.requester_name;$('offline-aisle').value=draft.aisle||'';render();saved=await readCatalog();products=saved?.products||[];lookup.reset();catalogMessage();
if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});
