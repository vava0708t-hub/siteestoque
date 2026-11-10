import {playBeep} from './beep.js';
const button=document.getElementById('hero-scanner');
const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
let timer=null;
button.addEventListener('pointermove',event=>{
 if(reduced.matches||event.pointerType!=='mouse')return;
 const rect=button.getBoundingClientRect();
 button.style.setProperty('--tilt-x',((event.clientY-rect.top)/rect.height-.5)*-16+'deg');
 button.style.setProperty('--tilt-y',((event.clientX-rect.left)/rect.width-.5)*20+'deg');
});
button.addEventListener('pointerleave',()=>{button.style.setProperty('--tilt-x','0deg');button.style.setProperty('--tilt-y','0deg');});
button.addEventListener('click',async()=>{
 if(button.classList.contains('scanning'))return;
 button.classList.add('scanning');
 timer=setTimeout(()=>{button.classList.remove('scanning');timer=null;},1000);
 playBeep(.35);
});
window.addEventListener('pagehide',()=>{clearTimeout(timer);button.classList.remove('scanning');});
