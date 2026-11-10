import Fuse from './vendor/fuse.mjs';
export const roles = ['vendedor', 'repositor', 'estoquista', 'admin'];
export const units = ['und', 'cx', 'pct', 'fardo', 'kg', 'lt'];
export const canRequest = role => ['vendedor', 'repositor'].includes(role);
export const canComplete = role => ['estoquista', 'admin'].includes(role);
export const validUsername = value => /^[a-z0-9][a-z0-9._-]{2,29}$/.test(value);
export function matchingProducts(products, code) {
 code = code.trim();
 if (!code) return [];
 return products.filter(p => p.codigo === code || p.codigo_barras === code);
}
export function findProduct(products, code) {
 const matches = matchingProducts(products, code);
 return matches.length === 1 ? matches[0] : undefined;
}
export const productKey = product => product.catalogId || product.codigo;
const searchIndexes=new WeakMap();
const normalizeSearch=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function indexFor(products){
 let cached=searchIndexes.get(products);
 if(!cached){const rows=products.map(product=>({product,text:normalizeSearch(product.codigo+' '+(product.codigo_barras||'')+' '+product.nome),description:normalizeSearch(product.nome+' '+(product.marca||''))}));cached={rows,fuse:null};searchIndexes.set(products,cached);}
 return cached;
}
export function searchProducts(products,query,limit=80){
 limit=Math.max(0,Math.floor(limit));if(!limit)return [];
 const normalized=normalizeSearch(query.trim());if(!normalized)return products.slice(0,limit);
 const exact=matchingProducts(products,query);if(exact.length)return exact.slice(0,limit);
 const terms=normalized.split(/\s+/).filter(Boolean),index=indexFor(products);
 const literal=[];
 for(const row of index.rows){if(terms.every(term=>row.text.includes(term)))literal.push(row.product);if(literal.length>=limit)break;}
 // Preserve buscas precisas; aproximação só quando a descrição não encontrou nada.
 if(literal.length||!/[a-z]/.test(normalized))return literal;
 const fuzzyTerms=terms.filter(term=>term.length>=3&&/[a-z]/.test(term));
 if(!fuzzyTerms.length)return [];
 const strictTerms=terms.filter(term=>!fuzzyTerms.includes(term));
 index.fuse??=new Fuse(index.rows,{keys:['description'],threshold:0.3,ignoreLocation:true,ignoreFieldNorm:true,includeScore:true});
 return index.fuse.search({$and:fuzzyTerms.map(term=>({description:term}))})
  .filter(result=>strictTerms.every(term=>result.item.text.includes(term)))
  .slice(0,limit).map(result=>result.item.product);
}
