import {sortListItems,listStatuses} from './lists-domain.js';
const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const date=value=>value?new Date(value).toLocaleString('pt-BR'):'—';
export function printListMarkup(list,order,brands,stockFor=()=>'Estoque indisponível',barcodeFor=i=>i.barcode_snapshot||'Não informado'){

 const items=sortListItems(list.items,order,brands);
 const aisles=[...new Set(items.map(i=>i.aisle||'Não informado'))].join(', ');
 const missing=items.filter(i=>i.unavailable).length;
 return '<div class="print-heading"><img class="print-logo" src="assets/logo.png" alt="Logo da loja"><h1>Lista de reposição #'+escape(list.number)+'</h1></div>'+
 '<div class="print-meta"><p><strong>Status:</strong> '+escape(listStatuses[list.status]||list.status)+'</p><p><strong>Solicitante:</strong> '+escape(list.requester_name)+'</p><p><strong>Corredor(es):</strong> '+escape(aisles)+'</p><p><strong>'+(list.offline?'Preparada em:':'Solicitada em:')+'</strong> '+escape(date(list.created_at))+'</p><p><strong>Finalizada em:</strong> '+escape(date(list.ready_at))+'</p></div>'+
 (list.offline?'<p><strong>LISTA OFFLINE — NÃO ENVIADA AO ESTOQUE</strong></p><p>Preparada neste aparelho para impressão. O saldo salvo pode estar desatualizado.</p>':'')+
 (list.separating_name?'<p><strong>Responsável pela separação:</strong> '+escape(list.separating_name)+'</p>':'')+
 (list.priority==='urgente'?'<p><strong>URGENTE — Para cliente esperando</strong></p>':'')+
 '<p>'+items.length+' itens'+(list.offline?'':' · '+items.filter(i=>i.picked).length+' separados · '+missing+' em falta')+'</p>'+
 (missing?'<p><strong>Atenção: confira os itens em falta abaixo; eles não foram separados.</strong></p>':'')+
 '<table class="restock-print-table"><colgroup><col style="width:6%"><col style="width:35%"><col style="width:10%"><col style="width:15%"><col style="width:14%"><col style="width:20%"></colgroup><thead><tr><th class="print-ok-heading">OK</th><th>Produto / código de barras</th><th>Qtd. / emb.</th><th>Corredor</th><th>Situação</th><th>Observação</th></tr></thead><tbody>'+
 items.map(i=>'<tr><td class="print-ok"><span class="pen-box"></span></td><td><strong>'+escape(i.product_name)+'</strong><br><span>Código de barras: '+escape(barcodeFor(i))+'</span><p class="print-stock">'+escape(stockFor(i))+'</p>'+'</td><td>'+escape(i.quantity)+' '+escape(i.unit.toUpperCase())+'</td><td>'+escape(i.aisle||'Não informado')+'</td><td>'+ (i.fulfilled_quantity!=null?'Separado: '+escape(i.fulfilled_quantity)+'<br>Falta: '+escape(i.quantity-i.fulfilled_quantity)+(i.unavailable?'<br><strong>EM FALTA</strong>':''):i.unavailable?'<strong>EM FALTA</strong>':i.picked?'Separado':'Pendente')+'</td><td class="print-note">'+escape(i.notes||'')+'</td></tr>').join('')+
 '</tbody></table><p class="print-instruction">Saldo conforme a última leitura da planilha, sem reserva de estoque. Marque a caixa OK com caneta após conferir cada item.</p><div class="print-signatures">Conferido por: _________________________ &nbsp; Data: ____/____/________</div>';
}
export async function printRestockList(list,order,brands,stockFor,barcodeFor){
 document.getElementById('print-list')?.remove();
 const root=document.createElement('section');root.id='print-list';root.innerHTML=printListMarkup(list,order,brands,stockFor,barcodeFor);
 document.body.append(root);
 const title=document.title;document.title='Lista de reposição '+list.number;
 const cleanup=()=>{root.remove();document.title=title;window.removeEventListener('afterprint',cleanup);};
 window.addEventListener('afterprint',cleanup);
 try{const logo=root.querySelector('img');if(logo)await logo.decode();window.print();}catch(error){cleanup();throw error;}
}
