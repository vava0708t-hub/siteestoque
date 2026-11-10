importScripts('/workbox-sw.js');
workbox.setConfig({modulePathPrefix:'/__WORKBOX_DIR__/'});
// Ative a atualização sem exigir que todas as abas sejam fechadas.
// Não recarregue páginas abertas: elas podem conter rascunhos não enviados.
self.skipWaiting();
workbox.core.clientsClaim();
// Online, módulos compartilhados precisam vir da mesma versão publicada.
// Offline, somente arquivos já preparados para a consulta local são usados.
workbox.routing.registerRoute(({url,request})=>request.method==='GET'&&url.origin===self.location.origin&&!url.pathname.startsWith('/api/')&&/\.(m?js|css)$/.test(url.pathname),async({request})=>{
 try{const response=await fetch(new Request(request,{cache:'no-cache'}));if(response.ok)return response;return response;}catch{return (await workbox.precaching.matchPrecache(request.url))||Response.error();}
});
workbox.precaching.precacheAndRoute(self.__WB_MANIFEST);
workbox.precaching.cleanupOutdatedCaches();
// Apenas navegação. APIs, login e escritas nunca entram no cache.
workbox.routing.registerRoute(({request,url})=>request.mode==='navigate'&&url.origin===self.location.origin&&!url.pathname.startsWith('/api/'),new workbox.strategies.NetworkOnly());
workbox.routing.setCatchHandler(async({request})=>request.mode==='navigate' ? (await workbox.precaching.matchPrecache('/offline.html')) : Response.error());
