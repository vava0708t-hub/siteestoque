export function createCatalogSettings(context,onChange){
 let entries=[];const kinds=['brand','aisle','payment'],pages={brand:0,aisle:0,payment:0},queries={brand:'',aisle:'',payment:''},controls={};
 const searchLabels={brand:'Buscar marca',aisle:'Buscar corredor',payment:'Buscar forma de pagamento'},maxLength={brand:60,aisle:60,payment:80};
 const normalize=value=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').trim();
 const node=(tag,text)=>{const n=document.createElement(tag);n.textContent=text;return n;};
 async function load(){
  const {client,profile}=context();if(!profile?.active){entries=[];render();return;}
  const data=[];
  for(let offset=0;;offset+=500){
   const result=await client.from('catalog_settings').select('*').order('name').order('id').range(offset,offset+499);
   if(result.error)throw new Error('Não foi possível carregar marcas e corredores. Confira a migração 008.');
   data.push(...result.data);if(result.data.length<500)break;
  }
  entries=data;render();onChange();
 }
 function render(){
  for(const kind of kinds){
   const target=document.getElementById(kind+'-entries');target.replaceChildren();
   const matches=entries.filter(e=>e.kind===kind&&normalize(e.name).includes(normalize(queries[kind])));
   pages[kind]=Math.min(pages[kind],Math.max(0,Math.ceil(matches.length/8)-1));
   const start=pages[kind]*8;
   controls[kind].status.textContent=matches.length?(start+1)+'–'+Math.min(start+8,matches.length)+' de '+matches.length:'Nenhum resultado.';
   controls[kind].previous.disabled=pages[kind]===0;
   controls[kind].next.disabled=start+8>=matches.length;
   for(const entry of matches.slice(start,start+8)){
    const row=node('div','');row.className='setting-entry';
    const label=node('label','Nome');const input=document.createElement('input');input.value=entry.name;input.maxLength=maxLength[kind];label.append(input);
    const save=node('button','Salvar'),remove=node('button','Excluir');save.type=remove.type='button';save.className=remove.className='ghost';
    const act=async operation=>{save.disabled=remove.disabled=true;try{const {error}=await operation();if(error)throw error;await load();}catch(e){context().notify(e.message,'error');}finally{save.disabled=remove.disabled=false;}};
    save.onclick=()=>act(()=>context().client.from('catalog_settings').update({name:input.value.trim()}).eq('id',entry.id));
    remove.onclick=()=>{if(confirm('Excluir '+entry.name+' do cadastro? '+(kind==='payment'?'Etiquetas que já usam essa forma continuam com ela.':'O histórico das listas será preservado.')))act(()=>context().client.from('catalog_settings').delete().eq('id',entry.id));};
    row.append(label,save,remove);target.append(row);
   }
  }
  const aisle=document.getElementById('aisle'),previous=aisle.value;aisle.replaceChildren(new Option('Selecione o corredor',''));
  entries.filter(e=>e.kind==='aisle').forEach(e=>aisle.add(new Option(e.name,e.name)));
  if([...aisle.options].some(o=>o.value===previous))aisle.value=previous;
 }
 for(const kind of kinds){
  const form=document.getElementById(kind+'-form');
  const searchLabel=node('label',searchLabels[kind]);
  const search=document.createElement('input');search.type='search';search.placeholder='Digite o nome…';search.autocomplete='off';searchLabel.append(search);
  const pager=node('div','');pager.className='settings-pager';
  const previous=node('button','Anterior'),next=node('button','Próxima'),status=node('span','');
  previous.type=next.type='button';previous.className=next.className='ghost';status.className='muted small';status.setAttribute('role','status');
  controls[kind]={previous,next,status};pager.append(previous,status,next);
  const target=document.getElementById(kind+'-entries');target.before(searchLabel);target.after(pager);
  search.oninput=()=>{queries[kind]=search.value;pages[kind]=0;render();};
  previous.onclick=()=>{pages[kind]--;render();};next.onclick=()=>{pages[kind]++;render();};
  form.onsubmit=async event=>{event.preventDefault();const input=form.querySelector('input'),button=form.querySelector('button');button.disabled=true;
   try{const {error}=await context().client.from('catalog_settings').insert({kind,name:input.value.trim()});if(error)throw new Error(kind==='payment'&&/check|violates/i.test(error.message)?'Rode a migração 018_payment_conditions.sql no Supabase para cadastrar formas de pagamento.':error.message);input.value='';await load();context().notify('Cadastro adicionado.');}
   catch(e){context().notify(e.message,'error');}finally{button.disabled=false;}
  };
 }
 return {load,brands:()=>entries.filter(e=>e.kind==='brand').map(e=>e.name),aisles:()=>entries.filter(e=>e.kind==='aisle').map(e=>e.name),payments:()=>entries.filter(e=>e.kind==='payment').map(e=>e.name)};
}
