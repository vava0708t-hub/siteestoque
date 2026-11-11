// Efeitos da tela de login: mascote que acompanha o mouse e o que é digitado,
// tampa os olhos na senha e reage a erro e sucesso; botão para mostrar a senha.
import {playBeep} from './beep.js';
const $=id=>document.getElementById(id);
const mascot=$('auth-mascot'),bubble=$('mascot-bubble'),username=$('username'),password=$('password'),toggle=$('password-toggle'),card=document.querySelector('.auth-card');
const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
const pupils=mascot?[...mascot.querySelectorAll('.mascot-eye i')]:[];
let bubbleTimer=null,moodTimer=null;

function say(text,ms=3200){if(!bubble)return;bubble.textContent=text;bubble.classList.remove('pop');void bubble.offsetWidth;bubble.classList.add('pop');clearTimeout(bubbleTimer);bubbleTimer=setTimeout(()=>bubble.classList.remove('pop'),ms);}
function mood(name,ms=1400){if(!mascot)return;mascot.classList.remove('happy','sad','jump');void mascot.offsetWidth;mascot.classList.add(name);clearTimeout(moodTimer);moodTimer=setTimeout(()=>mascot.classList.remove(name),ms);}
function look(dx,dy){for(const p of pupils)p.style.transform='translate('+Math.max(-1,Math.min(1,dx))*5+'px,'+Math.max(-1,Math.min(1,dy))*4+'px)';}
function lookAtPoint(x,y){if(!mascot)return;const r=mascot.getBoundingClientRect();look((x-(r.left+r.width/2))/260,(y-(r.top+r.height/2))/220);}
function lookAtTyping(){const len=username.value.length;look(-0.9+Math.min(len,24)/24*1.8,1);}

if(mascot){
 window.addEventListener('pointermove',e=>{if(document.activeElement===username||mascot.classList.contains('covering'))return;lookAtPoint(e.clientX,e.clientY);},{passive:true});
 username.addEventListener('focus',lookAtTyping);
 username.addEventListener('input',()=>{lookAtTyping();const name=username.value.trim();if(name.length===3)say('Oi, '+name+'! 👋',2200);});
 username.addEventListener('blur',()=>look(0,0));
 password.addEventListener('focus',()=>{mascot.classList.add('covering');if(password.type==='text')mascot.classList.add('peeking');say('Pode digitar, não estou olhando! 🙈',2400);});
 password.addEventListener('blur',()=>{mascot.classList.remove('covering','peeking');});
 mascot.addEventListener('click',()=>{mood('jump',900);const lines=['Bip! 📦','Cada caixa no seu lugar!','Bora repor? 💪','Estoque em dia é estoque feliz!','Eu sou a Caixinha! 😄'];say(lines[Math.floor(Math.random()*lines.length)]);try{playBeep(.25);}catch{}});
 document.addEventListener('auth:mode',e=>{mood('jump',900);say(e.detail?'Que legal! Bem-vindo(a) à equipe! 🎉':'Que bom te ver de novo! 😊');});
 document.addEventListener('auth:error',()=>{mood('sad',2200);say('Hmm… confere o usuário e a senha? 🤔',3600);if(card&&!reduced.matches){card.classList.remove('shake');void card.offsetWidth;card.classList.add('shake');}});
 document.addEventListener('auth:success',()=>{mascot.classList.remove('covering','peeking');mood('happy',2000);say('Uhul! Vamos lá! 🚀');});
 setTimeout(()=>say('Oi! Bora organizar o estoque? 📦',3600),600);
 // Pisca de vez em quando.
 (function blink(){setTimeout(()=>{if(!reduced.matches){mascot.classList.add('blink');setTimeout(()=>mascot.classList.remove('blink'),160);}blink();},2600+Math.random()*3200);})();
}
if(toggle){
 toggle.addEventListener('click',()=>{
  const show=password.type==='password';password.type=show?'text':'password';
  toggle.setAttribute('aria-pressed',String(show));toggle.setAttribute('aria-label',show?'Esconder senha':'Mostrar senha');toggle.textContent=show?'🙈':'👁️';
  mascot?.classList.toggle('peeking',show);if(show)say('Só uma espiadinha… 👀',1800);
  password.focus();
 });
}
