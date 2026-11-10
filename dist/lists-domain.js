import { units } from './domain.js';
export const listStatuses={pendente:'Pendente',em_separacao:'Em separação',pronta:'Pronta para retirada'};
export function validateDraftItem(item){
 if(!item || !item.product_code?.trim() || !item.product_name?.trim() || !item.aisle?.trim()
 || item.product_code.length>100 || item.product_name.length>300 || item.aisle.length>60
 || !Number.isInteger(item.quantity) || item.quantity<1 || item.quantity>99999
 || !units.includes(item.unit) || !['normal','urgente'].includes(item.priority)
 || typeof item.notes!=='string' || item.notes.length>500) throw new Error('Confira produto, corredor, unidade e quantidade.');
 return item;
}
export function listMatches(list,status,aisle){
 return (status==='all'||(status==='active'&&list.status!=='pronta')||list.status===status) && (!aisle.trim() || (list.items||[]).some(i=>(i.aisle||'').toLowerCase().includes(aisle.trim().toLowerCase())));
}
export function canMarkReady(list){return list.status!=='pronta' && list.items.length>0;}

export function sortListItems(items,order='original',brands){
 const byName=(a,b)=>a.product_name.localeCompare(b.product_name,'pt-BR',{sensitivity:'base',numeric:true})||String(a.id).localeCompare(String(b.id));
 return [...items].sort((a,b)=>{
  if(order==='brand'){
   const first=itemBrand(a,brands),second=itemBrand(b,brands);
   if(!first&&second)return 1;if(first&&!second)return -1;
   return first.localeCompare(second,'pt-BR')||byName(a,b);
  }
  if(order==='name-asc')return byName(a,b);
  if(order==='name-desc')return byName(b,a);
  if(order==='quantity-asc')return Number(a.quantity)-Number(b.quantity)||byName(a,b);
  if(order==='quantity-desc')return Number(b.quantity)-Number(a.quantity)||byName(a,b);
  return String(a.created_at).localeCompare(String(b.created_at))||String(a.id).localeCompare(String(b.id));
 });
}

export function itemBrand(item,brands=['Master Print','VMP','Futuro','Mercur']){
 const normalize=value=>String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();
 const name=normalize(item.product_name||'');
 return [...brands].sort((a,b)=>b.length-a.length).find(brand=>{
  const words=normalize(brand).split(' ').filter(Boolean);
  return words.length&&new RegExp('(?:^| )'+words.join(' *')+'(?: |$)').test(name);
 })||'';
}

export function duplicateListItems(list){
 if(!Array.isArray(list?.items)||!list.items.length||list.items.length>200)throw new Error('A lista deve ter entre 1 e 200 itens para ser duplicada.');
 return list.items.map(item=>validateDraftItem({product_code:item.product_code,product_name:item.product_name,quantity:item.quantity,unit:item.unit,aisle:item.aisle,notes:item.notes||'',priority:'normal'}));
}
