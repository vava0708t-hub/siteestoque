import {validateDraftItem} from './lists-domain.js';
export function emptyOfflineDraft(){return {requester_name:'',aisle:'',created_at:new Date().toISOString(),items:[]};}
export function offlineItem(product,values,catalogSavedAt){
 if(!product||!Number.isFinite(catalogSavedAt))throw new Error('Selecione um produto do catálogo salvo.');
 return {...validateDraftItem({product_code:product.codigo,product_name:product.nome,quantity:Number(values.quantity),unit:values.unit,aisle:values.aisle.trim(),notes:values.notes.trim(),priority:'normal'}),id:crypto.randomUUID(),barcode_snapshot:product.codigo_barras||'',stock_snapshot:product.estoque??'',stock_unit:product.unidade_original||product.unidade||'',catalog_saved_at:catalogSavedAt};
}
export function offlineListForPrint(draft){
 if(!draft.requester_name.trim()||!draft.items.length)throw new Error('Informe o solicitante e adicione pelo menos um item.');
 draft.items.forEach(validateDraftItem);
 return {...draft,number:'OFFLINE',offline:true,status:'Offline — não enviada ao estoque',priority:'normal',ready_at:null};
}
export function offlineStockLabel(item){return 'Estoque salvo: '+(item.stock_snapshot===''?'Não informado':item.stock_snapshot+' '+item.stock_unit)+' · Catálogo de '+new Date(item.catalog_saved_at).toLocaleString('pt-BR');}
