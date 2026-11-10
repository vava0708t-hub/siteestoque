const pending=new Map();
export function loadScript(src){if(!pending.has(src))pending.set(src,new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=()=>{s.remove();pending.delete(src);reject(new Error('Não foi possível carregar o leitor. Verifique a conexão.'));};document.head.append(s);}));return pending.get(src);}
