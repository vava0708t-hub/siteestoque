import {test} from 'node:test';
import assert from 'node:assert/strict';
import {printListMarkup} from '../dist/print-list.js';
test('impressão inclui solicitante, corredores, faltas, caixas e ordenação segura',()=>{
 const list={number:12,status:'pronta',requester_name:'Maria <Silva>',priority:'urgente',items:[{id:'1',product_name:'Zebra',product_code:'001',quantity:2,unit:'cx',aisle:'3',picked:true,notes:'Conferir <caixa>'},{id:'2',product_name:'Água',product_code:'002',quantity:1,unit:'pct',aisle:'4',unavailable:true}]};
 const html=printListMarkup(list,'name-asc',[],item=>item.id==='1'?'Estoque (planilha): -60 UN':'Estoque (planilha): 0 PCT',()=> '0789123456789');
 assert.ok(html.includes('Estoque (planilha): -60 UN'));assert.ok(html.includes('Estoque (planilha): 0 PCT'));
 assert.equal((html.match(/class="print-note"/g)||[]).length,2);
 assert.ok(html.includes('Código de barras: 0789123456789'));assert.ok(html.includes('<th>Observação</th>'));assert.ok(!html.includes('Código: 001'));
 assert.ok(html.includes('Maria &lt;Silva&gt;'));assert.ok(html.includes('3'));assert.ok(html.includes('4'));
 assert.equal((html.match(/class="pen-box"/g)||[]).length,2);
 assert.ok(html.includes('EM FALTA'));assert.ok(html.includes('2 CX'));assert.ok(html.includes('Conferir &lt;caixa&gt;'));
 assert.ok(html.indexOf('Água')<html.indexOf('Zebra'));assert.ok(html.includes('Para cliente esperando'));
 for(const [status,label] of [['pendente','Pendente'],['em_separacao','Em separação'],['pronta','Pronta para retirada']]){
  const output=printListMarkup({...list,status,items:[{...list.items[0],picked:false}]},'original',[]);
  assert.ok(output.includes('<strong>Status:</strong> '+label));
  assert.ok(output.includes('<td>Pendente</td>'));
  assert.ok(!output.includes('<td>Separado</td>'));
  assert.ok(output.includes('class="pen-box"'));
 }
});
