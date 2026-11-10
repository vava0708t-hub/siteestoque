import {confirmDuplicate} from './confirm-dialog.js';
import { printRestockList } from './print-list.js';
import { toast } from './toast.js';
import { units, canRequest, canComplete } from './domain.js';
import { listStatuses,duplicateListItems,validateDraftItem,listMatches,canMarkReady,sortListItems,itemBrand } from './lists-domain.js';
const $=id=>document.getElementById(id);
const el=(tag,text,css)=>{const n=document.createElement(tag);n.textContent=text;if(css)n.className=css;return n;};
export function createListController(context){
 let owner=null,draft=[],pending=null,sending=false,loading=false,lists=[],initialized=false,editing=null,backup=[],waiting=false;
 let history={from:'',to:'',requester:''};
 let page=0,hasMore=false,queryVersion=0,reloadQueued=false;
 const key=()=> 'repoe-draft-v1:'+owner;
 function persist(){try{sessionStorage.setItem(key(),JSON.stringify({draft,pending,editing,backup,waiting}));}catch{toast('Não foi possível salvar o rascunho neste navegador. Mantenha esta aba aberta.','error');}}
 function activate(){
  const id=context().session?.user.id;
  if(id===owner)return;
  owner=id;page=0;queryVersion++;waiting=false;draft=[];pending=null;editing=null;backup=[];lists=[];initialized=false;
  if(id){try{const saved=JSON.parse(sessionStorage.getItem(key())||'null');if(saved){saved.draft.forEach(validateDraftItem);draft=saved.draft;waiting=saved.waiting??draft.some(i=>i.priority==='urgente');pending=saved.pending;editing=saved.editing||null;backup=saved.backup||[];}}catch{draft=[];pending=null;}}
  renderDraft();
 }
 function reset(){owner=null;page=0;queryVersion++;waiting=false;draft=[];pending=null;editing=null;backup=[];lists=[];initialized=false;renderDraft();}
 async function add(item){
  if(sending||pending)throw new Error('Confirme o envio anterior antes de alterar a lista.');
  validateDraftItem(item);if(draft.length>=200)throw new Error('Envie esta lista antes de adicionar mais itens (máximo de 200).');
  const actor=owner;
  const duplicateDraft=draft.some(i=>i.product_code===item.product_code&&i.aisle.toLowerCase()===item.aisle.toLowerCase());
  sending=true;renderDraft();
  try{
   const {data,error}=await context().client.rpc('find_restock_duplicates',{code:item.product_code,corridor:item.aisle,except_list:editing?.id||null});
   if(error)throw new Error('Não foi possível verificar duplicidades. Confira a migração 012 e tente novamente.');
   if(actor!==owner)return false;
   if((duplicateDraft||data.length)&&!await confirmDuplicate(item,duplicateDraft,data))return false;
   if(actor!==owner)return false;
  }finally{sending=false;renderDraft();}
  draft.push({...item,priority:waiting?'urgente':'normal'});persist();renderDraft();return true;
 }
 function renderDraft(){
  $('customer-waiting').checked=waiting;$('customer-waiting').disabled=sending||!!pending;
  $('draft-items').replaceChildren();$('draft-count').textContent=draft.length+' item(ns)';
  $('draft-empty').hidden=!!draft.length;
  $('draft-message').textContent=pending?'Envio ainda não confirmado. Tente novamente para consultar ou concluir o mesmo envio, sem duplicar.':editing?'Editando lista #'+editing.number+'. Seu rascunho anterior será restaurado ao terminar.':'Revise os itens antes de enviar ao estoque.';
  $('send-list').disabled=sending||!draft.length;
  $('send-list').textContent=sending?'Enviando…':pending?'Confirmar envio da lista':editing?'Salvar alterações da lista #'+editing.number:'Enviar lista para o estoque';
  cancelButton.hidden=!editing;cancelButton.disabled=sending||!!pending;
  if(editing&&initialized&&!pending){
   const current=lists.find(l=>l.id===editing.id);
   if(current&&(current.status!=='pendente'||current.revision!==editing.revision)){
    $('send-list').disabled=true;
    $('draft-message').textContent='Esta lista foi alterada, excluída ou entrou em separação. Cancele a edição e consulte a versão atual.';
   }
  }
  document.querySelectorAll('#request-form input,#request-form select,#request-form textarea,#request-form button,[form="request-form"]').forEach(n=>n.disabled=sending||!!pending);
  if(!sending&&!pending)$('request-submit').disabled=!context().hasProducts();
  draft.forEach((item,index)=>{
   const row=el('article','','draft-row');
   const top=el('div','','draft-top'),info=el('div','','draft-info');
   const description=el('p','','muted small');
   const updateSummary=()=>{description.textContent=item.quantity+' '+item.unit.toUpperCase()+' · Corredor '+item.aisle+' · Cód. '+item.product_code+(item.priority==='urgente'?' · Urgente':'')+(item.notes?' · '+item.notes:'');};
   updateSummary();info.append(el('strong',item.product_name),description);
   const toggle=el('button','Editar','ghost');toggle.type='button';toggle.setAttribute('aria-expanded','false');toggle.disabled=sending||!!pending;
   info.append(el('p',context().stockFor(item),'stock-info'+(context().stockNegative(item)?' stock-negative':'')));
   top.append(info,toggle);row.append(top);
   const fields=el('div','','draft-fields');fields.hidden=true;
   toggle.onclick=()=>{fields.hidden=!fields.hidden;toggle.textContent=fields.hidden?'Editar':'Concluir';toggle.setAttribute('aria-expanded',String(!fields.hidden));};
   for(const [field,label,type] of [['quantity','Quantidade','number'],['unit','Unidade','select'],['aisle','Corredor','select'],['notes','Observação','text']]){
    const wrap=el('label',label);const input=document.createElement(type==='select'?'select':'input');
    if(type==='select')(field==='unit'?units:[...new Set([item.aisle,...context().aisles()])]).forEach(u=>input.add(new Option(u,u)));
    else{input.type=type;if(type==='number'){input.min=1;input.max=99999;input.step=1;}else input.maxLength=field==='notes'?500:60;}
    input.value=item[field];input.disabled=sending||!!pending;
    input.onchange=()=>{const value=type==='number'?Number(input.value):input.value.trim();try{validateDraftItem({...item,[field]:value});item[field]=value;updateSummary();persist();}catch(error){input.value=item[field];toast(error.message,'error');}};
    wrap.append(input);fields.append(wrap);
   }
   row.append(fields);
   const remove=el('button','Excluir','ghost danger');remove.type='button';remove.disabled=sending||!!pending;
   remove.onclick=()=>{draft.splice(index,1);persist();renderDraft();};top.append(remove);$('draft-items').append(row);
  });
 }
 function duplicateList(list){
  const {profile}=context();
  if(!profile?.active||!canRequest(profile.role)||list.created_by!==owner)return;
  if(sending||pending||editing)return toast('Conclua ou cancele a edição/envio atual antes de duplicar.','error');
  if(draft.length)return toast('Você já tem um rascunho. Envie ou remova seus itens antes de duplicar outra lista.','error');
  try{draft=duplicateListItems(list);waiting=false;pending=null;editing=null;backup=[];persist();renderDraft();
   toast('Lista #'+list.number+' copiada para um novo rascunho. Confira os saldos e as quantidades antes de enviar.');
   $('draft-items').scrollIntoView({behavior:'smooth',block:'start'});
  }catch(error){toast(error.message,'error');}
 }
 function beginEdit(list){
  if(sending||pending||editing)return toast('Conclua ou cancele a edição/envio atual primeiro.','error');
  backup={items:draft.map(i=>({...i,priority:waiting?'urgente':'normal'})),waiting};waiting=list.priority==='urgente';
  editing={id:list.id,number:list.number,revision:list.revision};
  draft=list.items.map(i=>({...i,notes:i.notes||''}));persist();renderDraft();
  $('draft-items').scrollIntoView({behavior:'smooth',block:'start'});
 }
 function cancelEdit(){
  if(sending||pending)return;
  editing=null;draft=backup.items||backup;waiting=backup.waiting??draft.some(i=>i.priority==='urgente');backup=[];persist();renderDraft();
 }
 async function send(){
  const {client,profile,session}=context();
  if(sending||!draft.length)return;
  if(!profile?.active||!canRequest(profile.role))return toast('Seu perfil não pode enviar solicitações.','error');
  try{draft.forEach(validateDraftItem);}catch(error){return toast(error.message,'error');}
  const actor=owner;
  if(!pending){pending={id:crypto.randomUUID(),items:draft.map(i=>({...i,priority:waiting?'urgente':'normal'}))};persist();}
  sending=true;renderDraft();
  try{
   const {data:confirmedId,error}=editing
    ?await client.rpc('edit_restock_list',{list_key:editing.id,expected_revision:editing.revision,edit_key:pending.id,items:pending.items})
    :await client.rpc('submit_restock_list',{list_key:pending.id,items:pending.items});
   if(actor!==owner)return;
   if(error){if(typeof error.code==='string' && (/^[A-Z0-9]{5}$/.test(error.code)||/^PGRST[0-9]+$/.test(error.code))) {pending=null;persist();}throw error;}
   if(!editing&&confirmedId!==pending.id)throw new Error('O servidor não confirmou o envio. Seu rascunho foi mantido; tente confirmar novamente.');
   const wasEditing=!!editing;page=0;queryVersion++;history={from:'',to:'',requester:''};$('history-filters').reset();$('aisle-filter').value='';$('filter').value='active';draft=wasEditing?(backup.items||backup):[];waiting=wasEditing?(backup.waiting??draft.some(i=>i.priority==='urgente')):false;backup=[];editing=null;pending=null;persist();toast(wasEditing?'Lista atualizada.':'Lista enviada ao estoque.');
   await load();
  }catch(error){if(actor===owner)toast(error.message||'Não foi possível confirmar o envio. Tente novamente.','error');}
  finally{sending=false;if(actor===owner)renderDraft();}
 }
 async function load(){
  const {client,session,profile}=context();if(!session)return;if(loading){reloadQueued=true;return;} if(!profile?.active){lists=[];render();return;}
  const actor=owner,version=queryVersion;loading=true;
  try{
   const filter=document.body.dataset.view==='history'?'pronta':$('filter').value;
   let query=context().client.from('restock_lists').select('*,items:restock_requests(*)');
   if(filter==='active')query=query.neq('status','pronta');
   else if(filter!=='all')query=query.eq('status',filter);
   if(history.from)query=query.gte('created_at',new Date(history.from+'T00:00:00').toISOString());
   if(history.to){const end=new Date(history.to+'T00:00:00');end.setDate(end.getDate()+1);query=query.lt('created_at',end.toISOString());}
   if(history.requester)query=query.ilike('requester_name','%'+history.requester.replace(/[%_]/g,'')+'%');
   const {data,error}=await query.order('priority',{ascending:false}).order('number',{ascending:false}).range(page*20,page*20+20);
   if(error)throw error;
   if(owner!==actor||version!==queryVersion)return;
   hasMore=data.length>20;const fetched=data.slice(0,20);
   if(page>0&&!fetched.length){page--;reloadQueued=true;return;}
   lists=fetched;initialized=true;render();
   if(editing&&!pending){const current=lists.find(l=>l.id===editing.id);if(current&&(current.status!=='pendente'||current.revision!==editing.revision)){$('send-list').disabled=true;$('draft-message').textContent='A lista mudou ou entrou em separação. Cancele a edição e consulte a versão atual.';}}
  }catch(error){if(owner===actor){$('list-status').textContent='Não foi possível carregar as listas. Confira se a migração 005 foi executada e tente atualizar.';throw error;}}
  finally{loading=false;if(reloadQueued){reloadQueued=false;load().catch(()=>{});}}
 }
 async function action(button,fn){
  button.disabled=true;
  try{await fn();await load();}catch(error){toast(error.message||'Não foi possível salvar a separação.','error');render();}finally{button.disabled=false;}
 }
 function render(){
  const {profile}=context();
  $('pending-count').title='Listas exibidas nesta página';$('done-count').title='Listas exibidas nesta página';
  $('lists-page').textContent='Página '+(page+1);$('lists-prev').disabled=page===0;$('lists-next').disabled=!hasMore;
  $('pending-count').textContent=lists.filter(l=>l.status!=='pronta').length;
  $('done-count').textContent=lists.filter(l=>l.status==='pronta').length;
  const visible=lists.filter(l=>listMatches(l,$('filter').value,$('aisle-filter').value)).sort((a,b)=>Number(b.priority==='urgente'&&b.status!=='pronta')-Number(a.priority==='urgente'&&a.status!=='pronta'));
  $('list-status').textContent=visible.length?'':'Nenhuma lista encontrada.';
  const opened=new Set([...$('requests').querySelectorAll('details[open]')].map(n=>n.dataset.id));
  $('requests').replaceChildren();
  for(const list of visible){
   const card=el('details','','restock-list');if(list.priority==='urgente'&&list.status!=='pronta')card.classList.add('urgent-list');card.dataset.id=list.id;card.open=opened.has(list.id);
   const summary=el('summary','','list-summary');
   const status=el('span',listStatuses[list.status],'badge list-status-badge '+(list.status==='pronta'?'done':''));
   const tags=el('div','','list-tags');
   const aisles=[...new Set(list.items.map(i=>String(i.aisle||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR',{numeric:true}));
   for(const aisle of aisles){
    const tag=el('span','Corredor '+aisle,'aisle-tag');
    let hash=0;for(const char of aisle.toLocaleLowerCase('pt-BR'))hash=(Math.imul(hash,31)+char.charCodeAt(0))>>>0;
    const hue=(hash*137.508)%360;
    tag.style.setProperty('--aisle-hue',String(hue));tags.append(tag);
   }
   if(!aisles.length)tags.append(el('span','Corredor não informado','muted small'));
   if(list.priority==='urgente')tags.append(el('span','Para cliente esperando','waiting-badge'));
   const ownerInfo=el('span','','list-owner');ownerInfo.append(el('span',list.requester_name+' · '+list.items.length+' itens','muted small'));
   if(list.status==='pronta'){const completed=new Date(list.ready_at);ownerInfo.append(el('span',list.ready_at&&!Number.isNaN(completed.getTime())?'Pronta em '+completed.toLocaleString('pt-BR'):'Data de conclusão não informada','list-ready-date'));}
   summary.append(el('strong','Lista #'+list.number),status,tags,ownerInfo);
   card.append(summary,el('p',list.requester_name+' · '+new Date(list.created_at).toLocaleString('pt-BR'),'muted'));
   if(list.separating_name)card.append(el('p','Em separação por '+list.separating_name+' · '+new Date(list.separation_started_at).toLocaleString('pt-BR'),'muted small'));
   const count=list.items.filter(i=>i.picked||i.fulfilled_quantity>0).length, missing=list.items.filter(i=>i.unavailable).length;
   card.append(el('p',count+'/'+list.items.length+' itens separados · '+missing+' em falta'+(list.priority==='urgente'?' · Urgente':''),'list-progress'));
   const content=el('div','','list-content');
   const maySeparate=profile?.active&&canComplete(profile.role)&&(!list.separating_by||list.separating_by===owner||profile.role==='admin');
   if(maySeparate&&list.status!=='pronta'&&!list.separating_by){const start=el('button','Iniciar separação','primary');start.onclick=()=>action(start,async()=>{const {error}=await context().client.rpc('start_restock_separation',{list_key:list.id});if(error)throw error;});content.append(start);}
   let lastBrand=null;
   for(const item of sortListItems(list.items,$('item-sort').value,context().brands())){
    if($('item-sort').value==='brand'){
     const brand=itemBrand(item,context().brands())||'Sem marca identificada';
     if(brand!==lastBrand){content.append(el('h3',brand,'brand-heading'));lastBrand=brand;}
    }
    const row=el('article','','pick-row');
    const title=el('strong',item.product_name);
    row.append(title,el('p',item.quantity+' '+item.unit+' · Código '+item.product_code+' · Corredor '+(item.aisle||'não informado'),'muted'));
    row.append(el('p',context().stockFor(item),'stock-info'+(context().stockNegative(item)?' stock-negative':'')));
    if(item.notes)row.append(el('p',item.notes));
    if(item.priority==='urgente')row.append(el('span','Urgente','badge'));
    if(maySeparate&&list.status!=='pronta'){
     const label=el('label','Quantidade separada'),amount=document.createElement('input');amount.type='number';amount.min=0;amount.max=item.quantity;amount.step=1;amount.value=item.fulfilled_quantity??'';label.append(amount);
     const save=el('button','Salvar quantidade','ghost');save.type='button';save.onclick=()=>{const value=Number(amount.value);if(amount.value===''||!Number.isInteger(value)||value<0||value>item.quantity)return toast('Confira a quantidade separada.','error');action(save,async()=>{const {error}=await context().client.rpc('set_restock_quantity',{item_key:item.id,amount:value});if(error)throw error;});};
     row.append(label,save);
    }else row.append(el('p',item.unavailable?'Em falta':item.picked?'✓ Separado':'Aguardando separação',item.unavailable?'missing-notice':'muted small'));
    if(item.fulfilled_quantity!=null)row.append(el('p','Separado: '+item.fulfilled_quantity+' '+item.unit+' · Falta: '+(item.quantity-item.fulfilled_quantity)+' '+item.unit,'muted small'));
    if(item.unavailable){row.classList.add('unavailable-row');if(list.status!=='pronta')row.append(el('span','Em falta','badge missing-notice'));}
    content.append(row);
   }
   if(list.status==='pronta')content.append(el('p',(count===0?'Separação finalizada — todos os itens em falta':missing?'Pronta para retirada parcial — confira os itens em falta':'✓ Pronta para retirada no estoque')+(list.ready_at?' · '+new Date(list.ready_at).toLocaleString('pt-BR'):''),'ready-notice'));
   else if(maySeparate){
    const ready=el('button',missing?'Finalizar com faltas':'Confirmar lista pronta','primary');ready.disabled=!canMarkReady(list);
    ready.onclick=()=>action(ready,async()=>{const {error}=await context().client.rpc('mark_restock_list_ready',{list_key:list.id});if(error)throw error;toast(missing?'Separação finalizada com itens em falta.':'Lista pronta. O solicitante já pode retirar.');});
    content.append(ready);
   }
   if(profile?.active){
    const print=el('button','Imprimir lista','secondary');print.type='button';
    print.onclick=async()=>{try{await printRestockList(list,$('item-sort').value,context().brands(),context().stockFor,context().barcodeFor);}catch(error){toast(error.message,'error');}};
    content.append(print);
   }
   if(profile?.active&&canRequest(profile.role)&&list.created_by===owner){
    const duplicate=el('button','Duplicar lista','secondary');duplicate.type='button';duplicate.onclick=()=>duplicateList(list);content.append(duplicate);
   }
   const ownPending=profile?.active&&canRequest(profile.role)&&list.created_by===owner&&list.status==='pendente';
   if(ownPending){
    const edit=el('button','Editar lista','ghost');edit.type='button';edit.onclick=()=>beginEdit(list);
    content.append(edit);
   }
   if(profile?.active&&(profile.role==='admin'||ownPending)){
    const remove=el('button','Excluir lista','ghost danger');remove.type='button';
    remove.onclick=()=>{if(editing?.id===list.id&&(sending||pending))return toast('Confirme o salvamento antes de excluir.','error');if(!confirm('Excluir a lista #'+list.number+' e todos os seus itens? Esta ação não pode ser desfeita.'))return;
     action(remove,async()=>{const {error}=await context().client.rpc('delete_restock_list',{list_key:list.id,expected_revision:list.revision});if(error)throw error;
      if(editing?.id===list.id&&!sending&&!pending)cancelEdit();toast('Lista excluída.');});
    };
    content.append(remove);
   }
   card.append(content);$('requests').append(card);
  }
 }
 const cancelButton=el('button','Cancelar edição','ghost');cancelButton.type='button';cancelButton.hidden=true;cancelButton.onclick=cancelEdit;$('send-list').after(cancelButton);
 $('customer-waiting').onchange=()=>{waiting=$('customer-waiting').checked;draft.forEach(i=>i.priority=waiting?'urgente':'normal');persist();renderDraft();};
 $('history-filters').onsubmit=event=>{event.preventDefault();const from=$('history-from').value,to=$('history-to').value;if(from&&to&&from>to)return toast('A data inicial deve ser anterior à final.','error');history={from,to,requester:$('history-requester').value.trim()};filterChanged().catch(error=>toast(error.message,'error'));};
 $('item-sort').onchange=render;
 $('send-list').onclick=send;
 const changePage=delta=>{page=Math.max(0,page+delta);queryVersion++;load().catch(error=>toast(error.message,'error'));};
 $('lists-prev').onclick=()=>changePage(-1);$('lists-next').onclick=()=>changePage(1);
 function filterChanged(){page=0;queryVersion++;return load();}
 let previousView='';
 document.addEventListener('app:view-change',event=>{const view=event.detail;if(['history','overview','restock'].includes(view)&&view!==previousView){const crossed=(view==='history')!==(previousView==='history');if(crossed){history={from:'',to:'',requester:''};$('history-filters').reset();$('aisle-filter').value='';$('filter').value=view==='history'?'pronta':'active';} $('lists-title').textContent=view==='history'?'Listas finalizadas':'Listas de reposição';filterChanged().catch(error=>toast(error.message,'error'));}previousView=view;});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&['overview','restock'].includes(document.body.dataset.view))load().catch(()=>{});});
 setInterval(()=>{if(!document.hidden&&(!document.body.dataset.view||['overview','restock'].includes(document.body.dataset.view))&&context().session&&context().profile?.active&&!['all','pronta'].includes($('filter').value))load().catch(()=>{});},60000);
 return {activate,reset,add,load,render,renderDraft,filterChanged};
}
