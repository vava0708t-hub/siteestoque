// Limite por consulta (mesmo do banco, migração 019): cerca de 4 meses.
export const MAX_REPORT_DAYS=124;
export function reportRange(from,to){if(!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to))throw new Error('Informe as duas datas.');if([from,to].some(value=>{const parsed=new Date(value+'T00:00:00Z');return !Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==value;}))throw new Error('Informe datas válidas.');const start=new Date(from+'T00:00:00'),end=new Date(to+'T00:00:00');const days=(Date.parse(to+'T00:00:00Z')-Date.parse(from+'T00:00:00Z'))/86400000+1;if(!Number.isFinite(days)||days<1||days>MAX_REPORT_DAYS)throw new Error('Escolha um período de 1 a '+MAX_REPORT_DAYS+' dias.');end.setDate(end.getDate()+1);return {from:start.toISOString(),until:end.toISOString()};}
export function aggregateDemand(rows){const groups=new Map(),lists=new Set();for(const row of rows){lists.add(row.list_id);const key=JSON.stringify([row.product_code,row.product_name,row.unit]);if(!groups.has(key))groups.set(key,{code:row.product_code,name:row.product_name,unit:row.unit,quantity:0,occurrences:0,lists:new Map()});const group=groups.get(key);group.quantity+=Number(row.quantity);group.occurrences++;group.lists.set(row.list_id,{number:row.lists?.number,date:row.lists?.created_at});}const products=[...groups.values()].map(g=>({...g,lists:g.lists.size,archived:0,recent:[...g.lists.values()].filter(l=>l.number!=null).sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,30)})).sort((a,b)=>b.lists-a.lists||b.occurrences-a.occurrences||a.name.localeCompare(b.name,'pt-BR'));return {listCount:lists.size,itemCount:rows.length,products};}

// Produtos pedidos no período que estão com estoque negativo na planilha atual.
// rows: itens das listas (product_code, product_name, unit, quantity, list_id, lists:{number,requester_name}).
export function negativeDemand(rows,products,isNegative){
 const byCode=new Map();
 for(const p of products){const list=byCode.get(p.codigo)||[];list.push(p);byCode.set(p.codigo,list);}
 const catalogFor=(code,name)=>{const all=byCode.get(code)||[];if(all.length<=1)return all[0]||null;return all.find(p=>p.nome===name)||null;};
 const groups=new Map();
 for(const row of rows){
  const product=catalogFor(row.product_code,row.product_name);
  if(!product||!isNegative(product))continue;
  const key=JSON.stringify([row.product_code,row.unit]);
  if(!groups.has(key))groups.set(key,{code:row.product_code,name:product.nome||row.product_name,unit:row.unit,stock:String(product.estoque).trim(),stockUnit:product.unidade_original||product.unidade||'',quantity:0,lists:new Map()});
  const g=groups.get(key);g.quantity+=Number(row.quantity)||0;
  const list=row.lists||{};g.lists.set(row.list_id,{number:list.number,requester:list.requester_name||''});
 }
 const stockNumber=s=>Number(String(s).replace(/−/g,'-').replace(/\s/g,'').replace(/\.(?=\d{3}(\D|$))/g,'').replace(',','.'))||0;
 return [...groups.values()].map(g=>({...g,lists:[...g.lists.values()].sort((a,b)=>(a.number||0)-(b.number||0))}))
  .sort((a,b)=>b.lists.length-a.lists.length||stockNumber(a.stock)-stockNumber(b.stock)||a.name.localeCompare(b.name,'pt-BR'));
}

// Texto curto das listas de um produto: "#13 (12/11), #12 (15/08)".
export function listRefs(recent,limit=8){
 const day=value=>{const d=new Date(value);return Number.isFinite(d.getTime())?d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'2-digit'}):'';};
 const shown=(recent||[]).slice(0,limit).map(l=>'#'+l.number+(day(l.date)?' ('+day(l.date)+')':''));
 const more=(recent||[]).length-shown.length;
 return shown.join(', ')+(more>0?' e mais '+more:'');
}
