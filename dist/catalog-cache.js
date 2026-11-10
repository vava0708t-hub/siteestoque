const CACHE='repoe-public-catalog-v1',KEY='/__saved-public-catalog';
export async function saveCatalog(products){try{const cache=await caches.open(CACHE);await cache.put(KEY,new Response(JSON.stringify({savedAt:Date.now(),products}),{headers:{'Content-Type':'application/json'}}));}catch{/* Consulta online continua se não houver espaço. */}}
export async function readCatalog(){try{const response=await (await caches.open(CACHE)).match(KEY);return response?await response.json():null;}catch{return null;}}
export async function clearCatalog(){await caches.delete(CACHE);}
