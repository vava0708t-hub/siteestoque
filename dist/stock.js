export function stockLabel(product){
 const value=String(product?.estoque??'').trim();
 return value?'Estoque (planilha): '+value+' '+(product.unidade_original||product.unidade||''):'Estoque não informado na planilha';
}
export function itemStockLabel(products,item){
 const matches=products.filter(p=>p.codigo===item.product_code&&p.nome===item.product_name);
 if(!matches.length)return 'Estoque indisponível no catálogo atual';
 const labels=[...new Set(matches.map(stockLabel))];
 return labels.length===1?labels[0]:'Estoque divergente na planilha — confira o produto';
}

export function isNegativeStock(product){
 const value=String(product?.estoque??'').trim().replace(/−/g,'-');
 return /^-\s*\d[\d.,\s]*$/.test(value)&&/[1-9]/.test(value);
}
export function itemStockNegative(products,item){
 const matches=products.filter(p=>p.codigo===item.product_code&&p.nome===item.product_name);
 return matches.length>0&&new Set(matches.map(stockLabel)).size===1&&isNegativeStock(matches[0]);
}

export function itemBarcode(products,item){
 if(item.barcode_snapshot)return String(item.barcode_snapshot);
 const matches=products.filter(p=>p.codigo===item.product_code&&p.nome===item.product_name);
 const codes=[...new Set(matches.map(p=>String(p.codigo_barras??'').trim()).filter(Boolean))];
 return codes.length===1?codes[0]:codes.length?'Divergente na planilha':'Não informado';
}
