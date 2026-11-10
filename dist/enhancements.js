import './ocr.js';
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));
const link=document.createElement('a');link.href='/offline.html';link.textContent='Montar lista offline e imprimir';link.className='muted small';(document.querySelector('footer')||document.querySelector('header')||document.body).append(link);
