import {reportRange,aggregateDemand,negativeDemand} from './reports-domain.js';
import {isNegativeStock} from './stock.js';
import {escapeHtml} from './quote-domain.js';
export function setupReports(context){const $=id=>document.getElementById(id);let owner=null,generation=0,cache=null,busy=false,lastNegative=null;
 const localDate=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');const today=new Date(),start=new Date();start.setDate(start.getDate()-6);$('reports-from').value=localDate(start);$('reports-to').value=localDate(today);
 const node=(tag,text,css)=>{const n=document.createElement(tag);n.textContent=text;if(css)n.className=css;return n;};
 const titles={top:'Produtos mais solicitados',negative:'Estoque negativo pedido nas listas'};
 const stat=(label,value,css)=>{const card=node('div','','report-stat'+(css?' '+css:''));card.append(node('strong',value),node('span',label));return card;};
 function render(result){$('reports-summary').replaceChildren();for(const [label,value] of [['Listas',result.listCount],['Itens solicitados',result.itemCount],['Produtos / embalagens',(result.productCount??result.products.length)]])$('reports-summary').append(stat(label,value));
 const root=$('reports-results');root.replaceChildren();if(!result.products.length){root.append(node('p','Nenhuma solicitação encontrada neste período.'));return;}root.append(node('p','Ranking por presença em listas distintas. Exibindo '+Math.min(50,result.products.length)+' de '+(result.productCount??result.products.length)+' produtos/embalagens.','muted small'));
 const table=document.createElement('table');table.className='report-table';const caption=node('caption','Produtos mais solicitados — frequência por lista');table.append(caption);const head=document.createElement('thead'),hr=document.createElement('tr');for(const text of ['Produto','Listas','Quantidade solicitada'])hr.append(node('th',text));head.append(hr);table.append(head);const body=document.createElement('tbody');result.products.slice(0,50).forEach((p,index)=>{const tr=document.createElement('tr'),description=document.createElement('td');description.append(node('strong',(index+1)+'. '+p.name),node('small','Código '+p.code,'muted'));tr.append(description,node('td',p.lists),node('td',p.quantity.toLocaleString('pt-BR')+' '+p.unit.toUpperCase()));body.append(tr);});table.append(body);const wrap=node('div','','report-table-wrap');wrap.append(table);root.append(wrap);}
 const listText=lists=>lists.map(l=>l.number?'#'+l.number+(l.requester?' ('+l.requester+')':''):(l.requester||'Lista')).join(', ');
 function renderNegative(result){
  lastNegative=result;$('reports-summary').replaceChildren();
  const listCount=new Set(result.products.flatMap(p=>p.lists.map(l=>l.number))).size;
  $('reports-summary').append(stat('Produtos negativos pedidos',result.products.length,result.products.length?'report-stat-alert':''),stat('Listas com produto negativo',listCount),stat('Itens analisados',result.itemCount));
  const root=$('reports-results');root.replaceChildren();
  if(!result.catalog){root.append(node('p','O catálogo da planilha ainda não carregou. Clique em Atualizar lista e gere o relatório de novo.','notice'));return;}
  if(!result.products.length){root.append(node('p','Nenhum produto pedido neste período está com estoque negativo na planilha atual. 🎉'));return;}
  const bar=node('div','','report-actions');bar.append(node('p','Estoque conforme a última leitura da planilha. Ordenado pelos produtos que aparecem em mais listas.','muted small'));
  const print=node('button','Imprimir relatório','secondary');print.type='button';print.onclick=()=>printNegative(result);bar.append(print);root.append(bar);
  const table=document.createElement('table');table.className='report-table report-negative';table.append(node('caption','Produtos com estoque negativo que foram pedidos nas listas'));
  const head=document.createElement('thead'),hr=document.createElement('tr');for(const text of ['Produto','Estoque (planilha)','Quantidade pedida','Listas'])hr.append(node('th',text));head.append(hr);table.append(head);
  const body=document.createElement('tbody');
  result.products.forEach((p,index)=>{const tr=document.createElement('tr'),description=document.createElement('td');description.append(node('strong',(index+1)+'. '+p.name),node('small','Código '+p.code,'muted'));
   const lists=document.createElement('td');lists.append(node('strong',p.lists.length+(p.lists.length===1?' lista':' listas')),node('small',listText(p.lists),'muted'));
   tr.append(description,node('td',p.stock+' '+p.stockUnit,'stock-negative'),node('td',p.quantity.toLocaleString('pt-BR')+' '+String(p.unit).toUpperCase()),lists);body.append(tr);});
  table.append(body);const wrap=node('div','','report-table-wrap');wrap.append(table);root.append(wrap);
 }
 async function printNegative(result){
  const {profile}=context(),e=escapeHtml,title=document.title;let root;
  const cleanup=()=>{root?.remove();document.title=title;window.removeEventListener('afterprint',cleanup);};
  try{document.getElementById('print-list')?.remove();root=document.createElement('section');root.id='print-list';
   root.innerHTML='<div class="print-heading"><img class="print-logo" src="assets/logo.png" alt="Logo da loja"><h1>Estoque negativo pedido nas listas</h1></div><p><strong>Período:</strong> '+e(result.period)+' · <strong>Gerado por:</strong> '+e(profile?.name||'')+' em '+e(new Date().toLocaleString('pt-BR'))+'</p><table><thead><tr><th>Produto / código</th><th>Estoque (planilha)</th><th>Qtd. pedida</th><th>Listas</th></tr></thead><tbody>'+result.products.map(p=>'<tr><td>'+e(p.name)+'<br>Cód. '+e(p.code)+'</td><td>'+e(p.stock+' '+p.stockUnit)+'</td><td>'+e(p.quantity.toLocaleString('pt-BR')+' '+String(p.unit).toUpperCase())+'</td><td>'+e(listText(p.lists))+'</td></tr>').join('')+'</tbody></table><p>Estoque conforme a última leitura da planilha.</p>';
   document.body.append(root);document.title='Estoque negativo pedido';window.addEventListener('afterprint',cleanup);await root.querySelector('img').decode().catch(()=>{});window.print();
  }catch(error){cleanup();$('reports-message').textContent=error.message||'Não foi possível imprimir.';}
 }
 // Busca os itens das listas do período direto da tabela (respeita as permissões do usuário).
 async function fetchRows(range,team,requester,status,run,session,client){
  const rows=[];
  for(let offset=0;offset<=5000;offset+=500){if(run!==generation)return null;let q=client.from('restock_requests').select('product_code,product_name,unit,quantity,list_id,lists:restock_lists!inner(number,created_at,created_by,requester_name,status)').gte('lists.created_at',range.from).lt('lists.created_at',range.until);if(!team)q=q.eq('lists.created_by',session.user.id);if(requester)q=q.ilike('lists.requester_name','%'+requester.replace(/[%_]/g,'')+'%');if(status!=='all')q=q.eq('lists.status',status);const response=await q.order('id',{ascending:true}).range(offset,Math.min(offset+499,5000));if(response.error)throw new Error('Não foi possível consultar o relatório.');rows.push(...response.data);if(rows.length>5000)throw new Error('Reduza o período: mais de 5.000 itens.');if(response.data.length<500)break;}
  return rows;
 }
 const applyType=()=>{const type=$('reports-type').value;$('reports-title').textContent=titles[type]||titles.top;$('reports-results').replaceChildren();$('reports-summary').replaceChildren();$('reports-message').textContent='Escolha o período e clique em Gerar relatório.';$('reports-type-hint').textContent=type==='negative'?'Mostra os produtos pedidos nas listas do período que estão com estoque negativo na planilha atual, com as listas em que aparecem. Considera as listas ainda guardadas no sistema (listas prontas ficam 60 dias).':'';};
 $('reports-type').onchange=applyType;
 $('reports-form').onsubmit=async event=>{event.preventDefault();const {client,session,profile,products=[]}=context();if(busy||!session||!profile?.active)return;const run=++generation;busy=true;$('reports-run').disabled=true;$('reports-results').replaceChildren();$('reports-summary').replaceChildren();
 try{const type=$('reports-type').value,range=reportRange($('reports-from').value,$('reports-to').value),requester=$('reports-requester').value.trim(),status=$('reports-status').value,team=['admin','estoquista'].includes(profile.role);
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
