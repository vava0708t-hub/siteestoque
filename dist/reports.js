import {reportRange,aggregateDemand,negativeDemand,listRefs} from './reports-domain.js';
import {isNegativeStock} from './stock.js';
import {escapeHtml} from './quote-domain.js';
export function setupReports(context){const $=id=>document.getElementById(id);let owner=null,generation=0,cache=null,busy=false,lastNegative=null;
 const localDate=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');const today=new Date(),start=new Date();start.setDate(start.getDate()-6);$('reports-from').value=localDate(start);$('reports-to').value=localDate(today);
 const node=(tag,text,css)=>{const n=document.createElement(tag);n.textContent=text;if(css)n.className=css;return n;};
 const titles={top:'Produtos mais solicitados',item:'Consultar pedidos de um item',negative:'Estoque negativo pedido nas listas'};
 const statusNames={pendente:'Pendente',em_separacao:'Em separação',pronta:'Pronta'};
 const dateTime=v=>new Date(v).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
 const dayText=v=>String(v).slice(0,10).split('-').reverse().join('/');
 const stat=(label,value,css)=>{const card=node('div','','report-stat'+(css?' '+css:''));card.append(node('strong',value),node('span',label));return card;};
 function render(result){$('reports-summary').replaceChildren();for(const [label,value] of [['Listas',result.listCount],['Itens solicitados',result.itemCount],['Produtos / embalagens',(result.productCount??result.products.length)]])$('reports-summary').append(stat(label,value));
 const root=$('reports-results');root.replaceChildren();if(!result.products.length){root.append(node('p','Nenhuma solicitação encontrada neste período.'));return;}root.append(actions('Ranking por presença em listas distintas. Exibindo '+Math.min(50,result.products.length)+' de '+(result.productCount??result.products.length)+' produtos/embalagens.',()=>printTop(result)));
 const table=document.createElement('table');table.className='report-table';const caption=node('caption','Produtos mais solicitados — frequência por lista');table.append(caption);const head=document.createElement('thead'),hr=document.createElement('tr');for(const text of ['Produto','Listas','Quantidade solicitada','Listas pedidas (nº e data)'])hr.append(node('th',text));head.append(hr);table.append(head);const body=document.createElement('tbody');result.products.slice(0,50).forEach((p,index)=>{const tr=document.createElement('tr'),description=document.createElement('td');description.append(node('strong',(index+1)+'. '+p.name),node('small','Código '+p.code,'muted'));const refs=node('td','','report-list-refs');if(Array.isArray(p.recent)){refs.textContent=listRefs(p.recent)||'—';if(Number(p.archived)>0)refs.append(node('small',Number(p.archived)+(Number(p.archived)===1?' lista antiga só no resumo (sem número)':' listas antigas só no resumo (sem número)'),'muted'));}else refs.textContent='Rode a migração 019 para ver';tr.append(description,node('td',p.lists),node('td',p.quantity.toLocaleString('pt-BR')+' '+p.unit.toUpperCase()),refs);body.append(tr);});table.append(body);const wrap=node('div','','report-table-wrap');wrap.append(table);root.append(wrap);}
 const listText=lists=>lists.map(l=>l.number?'#'+l.number+(l.requester?' ('+l.requester+')':''):(l.requester||'Lista')).join(', ');
 function renderNegative(result){
  lastNegative=result;$('reports-summary').replaceChildren();
  const listCount=new Set(result.products.flatMap(p=>p.lists.map(l=>l.number))).size;
  $('reports-summary').append(stat('Produtos negativos pedidos',result.products.length,result.products.length?'report-stat-alert':''),stat('Listas com produto negativo',listCount),stat('Itens analisados',result.itemCount));
  const root=$('reports-results');root.replaceChildren();
  if(!result.catalog){root.append(node('p','O catálogo da planilha ainda não carregou. Clique em Atualizar lista e gere o relatório de novo.','notice'));return;}
  if(!result.products.length){root.append(node('p','Nenhum produto pedido neste período está com estoque negativo na planilha atual. 🎉'));return;}
  root.append(actions('Estoque conforme a última leitura da planilha. Ordenado pelos produtos que aparecem em mais listas.',()=>printNegative(result)));
  const table=document.createElement('table');table.className='report-table report-negative';table.append(node('caption','Produtos com estoque negativo que foram pedidos nas listas'));
  const head=document.createElement('thead'),hr=document.createElement('tr');for(const text of ['Produto','Estoque (planilha)','Quantidade pedida','Listas'])hr.append(node('th',text));head.append(hr);table.append(head);
  const body=document.createElement('tbody');
  result.products.forEach((p,index)=>{const tr=document.createElement('tr'),description=document.createElement('td');description.append(node('strong',(index+1)+'. '+p.name),node('small','Código '+p.code,'muted'));
   const lists=document.createElement('td');lists.append(node('strong',p.lists.length+(p.lists.length===1?' lista':' listas')),node('small',listText(p.lists),'muted'));
   tr.append(description,node('td',p.stock+' '+p.stockUnit,'stock-negative'),node('td',p.quantity.toLocaleString('pt-BR')+' '+String(p.unit).toUpperCase()),lists);body.append(tr);});
  table.append(body);const wrap=node('div','','report-table-wrap');wrap.append(table);root.append(wrap);
 }
 function renderItem(result,query){
  $('reports-summary').replaceChildren();
  const archivedLists=result.archived.reduce((n,a)=>n+Number(a.list_count||0),0);
  const lists=new Set(result.items.map(i=>i.number)).size+archivedLists;
  const totals=new Map();for(const i of [...result.items,...result.archived]){const u=String(i.unit||'').toUpperCase();totals.set(u,(totals.get(u)||0)+Number(i.quantity||0));}
  $('reports-summary').append(stat('Vezes que foi pedido',result.total+archivedLists),stat('Listas',lists),stat('Quantidade pedida',[...totals].map(([u,q])=>q.toLocaleString('pt-BR')+' '+u).join(' + ')||'0'));
  const root=$('reports-results');root.replaceChildren();
  if(!result.items.length&&!result.archived.length){root.append(node('p','Nenhum pedido de "'+query+'" neste período.'));return;}
  root.append(actions('Pedidos de "'+query+'", do mais recente para o mais antigo.',()=>printItem(result,query)));
  if(result.items.length){
   if(result.total>result.items.length)root.append(node('p','Mostrando os '+result.items.length+' pedidos mais recentes de '+result.total+'. Diminua o período para ver os demais.','notice'));
   const table=document.createElement('table');table.className='report-table report-item';table.append(node('caption','Listas em que o item foi pedido'));
   const head=document.createElement('thead'),hr=document.createElement('tr');for(const text of ['Lista','Data do pedido','Solicitante','Produto','Quantidade','Situação'])hr.append(node('th',text));head.append(hr);table.append(head);
   const body=document.createElement('tbody');
   for(const i of result.items){const tr=document.createElement('tr'),product=document.createElement('td');product.append(node('strong',i.product_name),node('small','Código '+i.product_code,'muted'));
    tr.append(node('td','#'+i.number,'report-list-number'),node('td',dateTime(i.created_at)),node('td',i.requester_name),product,node('td',Number(i.quantity).toLocaleString('pt-BR')+' '+String(i.unit).toUpperCase()),node('td',statusNames[i.status]||i.status));body.append(tr);}
   table.append(body);const wrap=node('div','','report-table-wrap');wrap.append(table);root.append(wrap);
  }
  if(result.archived.length){
   root.append(node('h3','Pedidos antigos (só resumo por dia)','report-subtitle'),node('p','Listas finalizadas há mais de 120 dias saem do sistema e ficam só como total por dia, sem o número da lista.','muted small'));
   const table=document.createElement('table');table.className='report-table report-item';
   const head=document.createElement('thead'),hr=document.createElement('tr');for(const text of ['Dia','Solicitante','Produto','Quantidade','Listas'])hr.append(node('th',text));head.append(hr);table.append(head);
   const body=document.createElement('tbody');
   for(const a of result.archived){const tr=document.createElement('tr'),product=document.createElement('td');product.append(node('strong',a.product_name),node('small','Código '+a.product_code,'muted'));
    tr.append(node('td',dayText(a.day)),node('td',a.requester_name),product,node('td',Number(a.quantity).toLocaleString('pt-BR')+' '+String(a.unit).toUpperCase()),node('td',String(a.list_count)));body.append(tr);}
   table.append(body);const wrap=node('div','','report-table-wrap');wrap.append(table);root.append(wrap);
  }
 }
 const fmtDay=v=>String(v).split('-').reverse().join('/');
 const period=()=>fmtDay($('reports-from').value)+' a '+fmtDay($('reports-to').value);
 // Filtros que valem para o relatório impresso.
 function filtersText(type){
  const parts=['<strong>Período:</strong> '+escapeHtml(period())];
  if(type!=='item'){const r=$('reports-requester').value.trim(),st=$('reports-status');if(r)parts.push('<strong>Solicitante:</strong> '+escapeHtml(r));if(st.value!=='all')parts.push('<strong>Situação:</strong> '+escapeHtml(st.options[st.selectedIndex].text));}
  return parts.join(' · ');
 }
 // sections: [{title, headers, rows:[[célula,...]]}]; célula = texto ou [linha principal, linha menor].
 async function printReport(title,info,sections,note){
  const {profile}=context(),e=escapeHtml,old=document.title;let root;
  const cleanup=()=>{root?.remove();document.title=old;window.removeEventListener('afterprint',cleanup);};
  const cell=c=>Array.isArray(c)?e(c[0])+(c[1]?'<br><small>'+e(c[1])+'</small>':''):e(c);
  try{document.getElementById('print-list')?.remove();root=document.createElement('section');root.id='print-list';root.className='report-print';
   root.innerHTML='<div class="print-heading"><img class="print-logo" src="assets/logo.png" alt="Logo da loja"><h1>'+e(title)+'</h1></div><p>'+info+'</p><p><strong>Gerado por:</strong> '+e(profile?.name||'')+' em '+e(new Date().toLocaleString('pt-BR'))+'</p>'
    +sections.map(sec=>(sec.title?'<h2>'+e(sec.title)+'</h2>':'')+'<table><thead><tr>'+sec.headers.map(h=>'<th>'+e(h)+'</th>').join('')+'</tr></thead><tbody>'+sec.rows.map(r=>'<tr>'+r.map(c=>'<td>'+cell(c)+'</td>').join('')+'</tr>').join('')+'</tbody></table>').join('')
    +(note?'<p>'+e(note)+'</p>':'');
   document.body.append(root);document.title=title;window.addEventListener('afterprint',cleanup);await root.querySelector('img').decode().catch(()=>{});window.print();
  }catch(error){cleanup();$('reports-message').textContent=error.message||'Não foi possível imprimir.';}
 }
 // Barra acima da tabela: texto explicativo + botão Imprimir.
 function actions(text,onPrint){const bar=node('div','','report-actions');bar.append(node('p',text,'muted small'));const print=node('button','🖨️ Imprimir relatório','secondary');print.type='button';print.onclick=onPrint;bar.append(print);return bar;}
 const qty=(q,u)=>Number(q).toLocaleString('pt-BR')+' '+String(u).toUpperCase();
 function printTop(result){
  const shown=result.products.slice(0,50);
  printReport('Produtos mais solicitados',filtersText('top')+'<br><strong>Listas:</strong> '+result.listCount+' · <strong>Itens solicitados:</strong> '+result.itemCount+' · <strong>Produtos/embalagens:</strong> '+(result.productCount??result.products.length),
   [{headers:['Produto / código','Listas','Qtd. solicitada','Listas pedidas (nº e data)'],rows:shown.map((p,i)=>[[(i+1)+'. '+p.name,'Cód. '+p.code],String(p.lists),qty(p.quantity,p.unit),[Array.isArray(p.recent)?listRefs(p.recent,30)||'—':'—',Number(p.archived)>0?p.archived+' lista(s) antiga(s) só no resumo':'']])}],
   'Ranking por presença em listas distintas. Quantidades solicitadas, não saldo disponível.');
 }
 function printItem(result,query){
  const sections=[];
  if(result.items.length)sections.push({title:'Listas em que o item foi pedido',headers:['Lista','Data do pedido','Solicitante','Produto / código','Quantidade','Situação'],rows:result.items.map(i=>['#'+i.number,dateTime(i.created_at),i.requester_name,[i.product_name,'Cód. '+i.product_code],qty(i.quantity,i.unit),statusNames[i.status]||i.status])});
  if(result.archived.length)sections.push({title:'Pedidos antigos (só resumo por dia)',headers:['Dia','Solicitante','Produto / código','Quantidade','Listas'],rows:result.archived.map(a=>[dayText(a.day),a.requester_name,[a.product_name,'Cód. '+a.product_code],qty(a.quantity,a.unit),String(a.list_count)])});
  printReport('Pedidos do item: '+query,filtersText('item'),sections,result.total>result.items.length?'Mostrando os '+result.items.length+' pedidos mais recentes de '+result.total+'.':'');
 }
 function printNegative(result){
  printReport('Estoque negativo pedido nas listas',filtersText('negative'),[{headers:['Produto / código','Estoque (planilha)','Qtd. pedida','Listas'],rows:result.products.map(p=>[[p.name,'Cód. '+p.code],p.stock+' '+p.stockUnit,qty(p.quantity,p.unit),listText(p.lists)])}],'Estoque conforme a última leitura da planilha.');
 }
 // Busca os itens das listas do período direto da tabela (respeita as permissões do usuário).
 async function fetchRows(range,team,requester,status,run,session,client){
  const rows=[];
  for(let offset=0;offset<=5000;offset+=500){if(run!==generation)return null;let q=client.from('restock_requests').select('product_code,product_name,unit,quantity,list_id,lists:restock_lists!inner(number,created_at,created_by,requester_name,status)').gte('lists.created_at',range.from).lt('lists.created_at',range.until);if(!team)q=q.eq('lists.created_by',session.user.id);if(requester)q=q.ilike('lists.requester_name','%'+requester.replace(/[%_]/g,'')+'%');if(status!=='all')q=q.eq('lists.status',status);const response=await q.order('id',{ascending:true}).range(offset,Math.min(offset+499,5000));if(response.error)throw new Error('Não foi possível consultar o relatório.');rows.push(...response.data);if(rows.length>5000)throw new Error('Reduza o período: mais de 5.000 itens.');if(response.data.length<500)break;}
  return rows;
 }
 const applyType=()=>{const type=$('reports-type').value;const item=type==='item';$('reports-item-wrap').hidden=!item;$('reports-item').required=item;$('reports-requester').closest('label').hidden=item;$('reports-status').closest('label').hidden=item;if(item){const from=new Date();from.setDate(from.getDate()-123);$('reports-from').value=localDate(from);$('reports-to').value=localDate(new Date());}$('reports-title').textContent=titles[type]||titles.top;$('reports-results').replaceChildren();$('reports-summary').replaceChildren();$('reports-message').textContent='Escolha o período e clique em Gerar relatório.';$('reports-type-hint').textContent=type==='negative'?'Mostra os produtos pedidos nas listas do período que estão com estoque negativo na planilha atual, com as listas em que aparecem. Considera as listas ainda guardadas no sistema (listas prontas ficam 120 dias).':item?'Bipe ou digite o código, o código de barras ou palavras do nome. Mostra em quais listas, em que data e por quem o item foi pedido.':'';};
 $('reports-type').onchange=applyType;
 $('reports-form').onsubmit=async event=>{event.preventDefault();const {client,session,profile,products=[]}=context();if(busy||!session||!profile?.active)return;const run=++generation;busy=true;$('reports-run').disabled=true;$('reports-results').replaceChildren();$('reports-summary').replaceChildren();
 try{const type=$('reports-type').value,range=reportRange($('reports-from').value,$('reports-to').value),requester=$('reports-requester').value.trim(),status=$('reports-status').value,team=['admin','estoquista'].includes(profile.role);
 if(type==='item'){
  const query=$('reports-item').value.trim();if(!query)throw new Error('Digite o código, o código de barras ou o nome do item.');
  const codes=[...new Set(products.filter(p=>String(p.codigo_barras||'')===query||String(p.codigo)===query).map(p=>String(p.codigo)))].slice(0,20);
  $('reports-message').textContent='Procurando "'+query+'" nas listas…';
  const {data,error}=await client.rpc('restock_item_history',{date_from:$('reports-from').value,date_to:$('reports-to').value,search:query,codes});
  if(run!==generation)return;
  if(error)throw new Error(error.code==='PGRST202'?'Consulta de item ainda não ativada: execute a migração 019 no Supabase.':(error.message||'Não foi possível consultar o item.'));
  renderItem(data,query);$('reports-message').textContent='Consulta feita em '+new Date().toLocaleString('pt-BR')+'.';return;
 }
 if(type==='negative'){
  $('reports-message').textContent='Buscando os itens das listas e cruzando com o estoque da planilha…';
  const rows=await fetchRows(range,team,requester,status,run,session,client);if(rows===null||run!==generation)return;
  const fmt=v=>v.split('-').reverse().join('/');
  renderNegative({products:negativeDemand(rows,products,isNegativeStock),itemCount:rows.length,catalog:products.length>0,period:fmt($('reports-from').value)+' a '+fmt($('reports-to').value)});
  $('reports-message').textContent='Relatório gerado em '+new Date().toLocaleString('pt-BR')+'.';return;
 }
 const key=JSON.stringify([session.user.id,team,range,requester,status]);if(cache?.key===key&&Date.now()-cache.time<300000){render(cache.result);$('reports-message').textContent='Resultado já consultado nesta sessão · '+new Date(cache.time).toLocaleTimeString('pt-BR');return;}
 $('reports-message').textContent='Consultando solicitações do período…';let {data:result,error}=await client.rpc('restock_report',{date_from:$('reports-from').value,date_to:$('reports-to').value,requester,state:status});
 if(run!==generation)return;
 let legacy=false;
 if(error?.code==='PGRST202'){legacy=true;const rows=await fetchRows(range,team,requester,status,run,session,client);if(rows===null)return;result=aggregateDemand(rows);error=null;}
 if(error)throw new Error('Não foi possível consultar o relatório. Tente novamente.');
 if(run!==generation)return;
 cache=legacy?null:{key,result,time:Date.now()};render(result);$('reports-message').textContent='Relatório gerado em '+new Date().toLocaleString('pt-BR')+'. Quantidades solicitadas, não saldo disponível.'+(legacy?' Resumos históricos ainda não ativados: execute a migração 014 no Supabase.':' Inclui resumos históricos preservados.');
 }catch(error){if(run===generation)$('reports-message').textContent=error.message;}finally{if(run===generation){busy=false;$('reports-run').disabled=false;}}};
 return {configure(profile,id){const next=id+':'+profile?.role+':'+profile?.active;if(next!==owner){owner=next;generation++;busy=false;cache=null;lastNegative=null;$('reports-run').disabled=false;$('reports-results').replaceChildren();$('reports-summary').replaceChildren();$('reports-message').textContent='Escolha o período e clique em Gerar relatório.';}$('reports-scope').textContent=['admin','estoquista'].includes(profile?.role)?'Visão da equipe: todas as solicitações acessíveis ao seu perfil.':'Seu histórico: apenas as listas enviadas por você.';}};
}
