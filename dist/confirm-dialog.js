export function confirmDuplicate(item,duplicateDraft,lists){
 return new Promise(resolve=>{
  const previous=document.activeElement,dialog=document.createElement('dialog');dialog.className='confirm-dialog';
  dialog.setAttribute('aria-labelledby','duplicate-title');dialog.setAttribute('aria-describedby','duplicate-description');
  const el=(tag,text,css)=>{const n=document.createElement(tag);n.textContent=text;if(css)n.className=css;return n;};
  const icon=el('span','!','confirm-icon');icon.setAttribute('aria-hidden','true');
  const title=el('h2','Produto já solicitado');title.id='duplicate-title';
  const description=el('p','Confira as solicitações abaixo para evitar uma reposição duplicada.','muted');description.id='duplicate-description';
  const product=el('div','','confirm-product');product.append(el('strong',item.product_name),el('p','Código '+item.product_code+' · Corredor '+item.aisle,'muted small'));
  const locations=el('ul','','confirm-locations');if(duplicateDraft)locations.append(el('li','Já está no rascunho desta lista.'));
  lists.forEach(list=>locations.append(el('li','Lista #'+list.number+' — '+list.requester_name)));
  const actions=el('div','','confirm-actions'),cancel=el('button','Voltar','ghost'),accept=el('button','Adicionar mesmo assim','primary');cancel.type=accept.type='button';cancel.autofocus=true;actions.append(cancel,accept);
  let accepted=false;
  cancel.onclick=()=>dialog.close();accept.onclick=()=>{accepted=true;dialog.close();};
  dialog.addEventListener('close',()=>{dialog.remove();if(previous?.isConnected)previous.focus();resolve(accepted);},{once:true});
  dialog.append(icon,title,description,product,locations,actions);document.body.append(dialog);dialog.showModal();cancel.focus();
 });
}
