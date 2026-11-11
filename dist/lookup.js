import {matchingProducts,searchProducts} from './domain.js';
import {isNegativeStock} from './stock.js';
export function promotionLabel(value){return value==='S'?'Em promoção':value==='N'?'Sem promoção':'Promoção não informada';}
export function lookupMatches(products,query){
 query=query.trim();if(!query)return [];
 const exact=matchingProducts(products,query);
 return exact.length?exact:searchProducts(products,query,30);
}
export function setupLookup(getProducts,onSelect=()=>{}){
 const $=id=>document.getElementById(id),el=(tag,text,css)=>{const n=document.createElement(tag);n.textContent=text;if(css)n.className=css;return n;};
 function reset(){ $('lookup-results').replaceChildren();$('lookup-detail').replaceChildren();$('lookup-code').value='';$('lookup-status').textContent=getProducts().length?'Dados da última atualização da planilha.':'Catálogo indisponível. Clique em Atualizar lista.'; }
 function select(p){
  $('lookup-results').replaceChildren();const detail=$('lookup-detail');detail.replaceChildren();
  detail.append(el('h3',p.nome),el('p','Código: '+p.codigo+' · Barras: '+(p.codigo_barras||'Não informado'),'muted small'));
  const grid=el('dl','','lookup-values');
  for(const [label,value,css] of [['Unidade',p.unidade_original||p.unidade||'Não informada',''],['Preço (planilha)',p.preco||'Não informado','lookup-price'],['Estoque',p.estoque===''||p.estoque==null?'Não informado':p.estoque,isNegativeStock(p)?'stock-negative':'']]){
   const wrap=el('div','');wrap.append(el('dt',label),el('dd',value,css));grid.append(wrap);
  }
  detail.append(grid,el('span',promotionLabel(p.promocao),'badge '+(p.promocao==='S'?'done':'')));
  $('lookup-status').textContent='Produto consultado. Valores conforme a última leitura da planilha.';
  onSelect(p,detail);
 }
 function results(matches){
  $('lookup-detail').replaceChildren();$('lookup-results').replaceChildren();
  $('lookup-status').textContent=matches.length?matches.length+' resultados. Selecione o produto; refine a busca se necessário.':'Nenhum produto encontrado.';
  matches.slice(0,30).forEach(p=>{const button=el('button',p.nome+' · '+p.codigo,'lookup-option');button.type='button';button.onclick=()=>select(p);$('lookup-results').append(button);});
 }
 $('lookup-form').onsubmit=event=>{event.preventDefault();const query=$('lookup-code').value.trim();if(!query){reset();return;}const matches=lookupMatches(getProducts(),query);if(matches.length===1){select(matches[0]);$('lookup-code').select();}else results(matches);};
 $('lookup-code').oninput=()=>{const query=$('lookup-code').value.trim();if(!query){reset();return;}results(lookupMatches(getProducts(),query));};
 return {reset};
}
