// "Como usar": tour guiado pela Caixinha, com uma lição para cada funcionalidade.
export function setupHelp(navigate){
 const root=document.getElementById('help-screen');
 let role='',step=0,practice=0,typing=null,blinkTimer=null,seen=new Set();
 const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
 const stock=()=>['estoquista','admin'].includes(role),admin=()=>role==='admin';
 const el=(tag,text,css)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(css)n.className=css;return n;};
 const storeKey='repoe-help-seen';
 try{seen=new Set(JSON.parse(localStorage.getItem(storeKey)||'[]'));}catch{}
 const remember=id=>{seen.add(id);try{localStorage.setItem(storeKey,JSON.stringify([...seen]));}catch{}};

 function lessons(){
  const all=[
   {id:'oi',prop:'👋',mood:'wave',title:'Oi! Eu sou a Caixinha',text:'Vou te mostrar tudo o que dá para fazer aqui, um passo de cada vez. Use os botões ou as setas do teclado para navegar. Clique em mim quando quiser!',tips:['Os tópicos lá em cima levam direto a cada assunto.','O que você já viu ganha um ✓.','Nada aqui altera produtos ou listas de verdade.']},
   {id:'consulta',prop:'🔎',mood:'think',title:'Consulta produtos',text:'Digite a descrição, a marca ou o código, ou bipe o produto. Eu entendo pequenos erros de digitação! Você vê unidade, preço, estoque da planilha e se está em promoção.',tips:['Estoque negativo aparece em vermelho.','Do produto consultado dá para criar orçamento ou etiqueta.','Atualizar lista relê a planilha.'],action:'Abrir consulta',view:'products'},
   stock()?{id:'fila',prop:'📋',mood:'think',title:'Fila de reposição',text:'Em Reposição ficam as listas da equipe. Filtre por situação e corredor. Pedidos para cliente esperando aparecem destacados. Abra uma lista e inicie a separação para todos saberem quem está atendendo.',tips:['Organize os itens por marca ou nome.','Imprima a lista para separar no papel.','Listas urgentes sobem para o topo.'],action:'Abrir reposição',view:'restock'}
   :{id:'lista',prop:'📝',mood:'happy',title:'Monte sua lista',text:'Escolha o corredor, bipe ou busque o produto, informe quantidade e embalagem e adicione. Revise tudo e envie a lista inteira de uma vez para o estoque.',tips:['Marque "Para cliente esperando" só quando for urgente.','Eu aviso se o produto já foi pedido em outra lista.','O rascunho fica guardado até você enviar.'],action:'Abrir reposição',view:'restock'},
   stock()?{id:'separar',prop:'📦',mood:'happy',title:'Separe e confirme',text:'Separe os itens e, se faltar algum, informe a quantidade separada e salve. Depois toque em Confirmar lista pronta: o que não tiver quantidade conta como separado por completo e a lista vai para o histórico.',tips:['Falta parcial aparece para quem pediu.','Lista pronta não pode mais ser alterada.','Quem pediu vê na hora que está pronta.'],action:'Ver listas',view:'restock'}
   :{id:'acompanhar',prop:'⏱️',mood:'think',title:'Acompanhe o pedido',text:'Enquanto a lista estiver pendente, você pode editar ou excluir. Quando o estoque começa a separar, ela fica bloqueada. Quando ficar pronta, confira as faltas e vá buscar!',tips:['Duplicar lista cria um rascunho novo igual.','A tela se atualiza sozinha a cada 30 segundos.','Você recebe um aviso quando a lista fica pronta.'],action:'Ver listas',view:'restock'},
   {id:'historico',prop:'🗂️',mood:'think',title:'Histórico de listas',text:'Todas as listas finalizadas ficam no Histórico, com busca por data. Dá para abrir, conferir o que foi separado e imprimir de novo.',tips:['Listas prontas ficam guardadas por 60 dias.','Use as datas para achar uma lista antiga.'],action:'Abrir histórico',view:'history'},
   {id:'orcamento',prop:'🧾',mood:'happy',title:'Orçamentos',text:'Bipe os produtos, ajuste quantidade e desconto de cada item e aplique um desconto geral em % ou em reais. Preencha cliente, telefone, validade e observação, e imprima ou salve em PDF.',tips:['Salvar orçamento dá um número e guarda até o fim da validade.','Abra, duplique ou exclua nos Orçamentos salvos.','Orçamento não reserva produto nem mexe no estoque.'],action:'Criar orçamento',view:'quotes'},
   {id:'etiquetas',prop:'🏷️',mood:'happy',title:'Etiquetas de oferta',text:'Bipe o produto e eu puxo descrição, preço e código de barras. Escolha o desconto, o arredondamento, a forma de pagamento e o modelo: clássico, amarelo, Black Friday ou os sazonais de Natal, São João e Carnaval. Depois é só imprimir em folha A4!',tips:['Tamanhos: 8 (10×7 cm), 6 (10×9,5 cm) ou 4 (10×14 cm) por folha.','Parcelado vai até 6x, com parcela mínima de R$ 30.','Imprima em escala 100% com gráficos de fundo.'],action:'Criar etiquetas',view:'labels'},
   {id:'relatorios',prop:'📊',mood:'think',title:'Relatórios',text:'Veja os produtos mais pedidos no período ou descubra quais produtos com estoque negativo foram pedidos nas listas, e em quais listas eles aparecem.',tips:['Escolha até 93 dias por consulta.','O relatório de negativos pode ser impresso.',stock()?'Você vê as listas de toda a equipe.':'Você vê só as suas próprias listas.'],action:'Abrir relatórios',view:'reports'},
   admin()?{id:'usuarios',prop:'👥',mood:'wave',title:'Usuários',text:'Aprove cadastros novos com um clique, mude o perfil e o acesso de cada pessoa, edite nome, login e senha, e remova quem saiu da equipe.',tips:['Quem tem histórico é arquivado, e as listas antigas ficam.','Você não pode remover a própria conta.'],action:'Abrir usuários',view:'users'}:null,
   {id:'config',prop:'⚙️',mood:'think',title:'Configurações e offline',text:'Em Configurações você muda seu nome, usuário e senha. Sem internet? Salve o catálogo antes e use Lista offline e impressão. O rascunho offline nunca é enviado sozinho.',tips:[admin()?'Só você, administrador, gerencia marcas e corredores.':'Marcas e corredores são cuidados pelo administrador.','O catálogo fica guardado no aparelho.'],action:'Abrir configurações',view:'settings'},
   {id:'fim',prop:'🎉',mood:'party',title:'Você já sabe tudo!',text:'Viu como é fácil? Se esquecer de algo, volte aqui quando quiser. Agora é com você: bora deixar tudo no lugar!',tips:['Clique em mim para comemorar de novo.','Recomeçar volta para o início do tour.']}
  ];
  return all.filter(Boolean);
 }

 function mascotMarkup(){
  const m=el('button','','auth-mascot guide-mascot');m.type='button';m.setAttribute('aria-label','Caixinha: clique para ela reagir');
  m.innerHTML='<span class="guide-prop" aria-hidden="true"></span><span class="mascot-body"><span class="mascot-tape"></span><span class="mascot-eye left"><i></i></span><span class="mascot-eye right"><i></i></span><span class="mascot-blush left"></span><span class="mascot-blush right"></span><span class="mascot-mouth"></span><span class="mascot-hand left"></span><span class="mascot-hand right"></span></span><span class="mascot-shadow"></span>';
  return m;
 }

 function confetti(host){
  if(reduced.matches)return;
  const box=el('div','','guide-confetti');box.setAttribute('aria-hidden','true');
  const colors=['#55d6b0','#ffd400','#5aa8f5','#b18cf2','#ff6b6b','#f2b84b'];
  for(let i=0;i<40;i++){const p=el('i');p.style.cssText='--x:'+(Math.random()*100)+'%;--d:'+(1.2+Math.random()*1.4)+'s;--r:'+(Math.random()*720-360)+'deg;--c:'+colors[i%colors.length]+';--delay:'+(Math.random()*.4)+'s';box.append(p);}
  host.append(box);setTimeout(()=>box.remove(),3200);
 }

 function typeText(target,text){
  clearInterval(typing);
  if(reduced.matches){target.textContent=text;return;}
  let i=0;target.textContent='';target.classList.add('typing');
  typing=setInterval(()=>{i+=2;target.textContent=text.slice(0,i);if(i>=text.length){clearInterval(typing);target.classList.remove('typing');}},18);
  target.onclick=()=>{clearInterval(typing);target.textContent=text;target.classList.remove('typing');};
 }

 function render(){
  const all=lessons();step=Math.min(step,all.length-1);const lesson=all[step];remember(lesson.id);
  clearTimeout(blinkTimer);root.replaceChildren();

  // Tópicos
  const topics=el('nav','','guide-topics');topics.setAttribute('aria-label','Tópicos do guia');
  all.forEach((l,i)=>{const chip=el('button','','guide-chip'+(i===step?' active':'')+(seen.has(l.id)?' done':''));chip.type='button';chip.append(el('span',l.prop,'chip-icon'),el('span',l.title.replace('Oi! Eu sou a Caixinha','Início').replace('Você já sabe tudo!','Fim')));if(i===step)chip.setAttribute('aria-current','step');chip.onclick=()=>{step=i;render();};topics.append(chip);});

  const card=el('div','','guide-card guide-stage mood-'+lesson.mood);
  const left=el('div','','guide-left');
  const mascot=mascotMarkup();mascot.querySelector('.guide-prop').textContent=lesson.prop;
  mascot.classList.add('mood-'+lesson.mood);
  const reactions=['Bip! 📦','Uhul! 🎉','Tô aqui pra ajudar! 😄','Próximo passo? 👉','Cada caixa no seu lugar!'];
  mascot.onclick=()=>{mascot.classList.remove('jump');void mascot.offsetWidth;mascot.classList.add('jump');bubble.querySelector('.bubble-text').textContent=reactions[Math.floor(Math.random()*reactions.length)];if(lesson.id==='fim')confetti(card);setTimeout(()=>typeText(bubble.querySelector('.bubble-text'),lesson.text),1300);};
  left.append(mascot);

  const right=el('div','','guide-right');
  right.append(el('span','PASSO '+(step+1)+' DE '+all.length,'eyebrow'));
  const h=el('h2',lesson.title);right.append(h);
  const bubble=el('div','','guide-bubble');const bubbleText=el('p','','bubble-text');bubbleText.setAttribute('aria-hidden','true');bubbleText.title='Clique para mostrar tudo';
  const live=el('p',lesson.text,'sr-only');live.setAttribute('aria-live','polite');
  bubble.append(bubbleText,live);right.append(bubble);
  const tips=el('ul','','guide-tips');lesson.tips.forEach((t,i)=>{const li=el('li',t);li.style.setProperty('--i',i);tips.append(li);});right.append(tips);

  const dots=el('div','','guide-dots');dots.setAttribute('aria-hidden','true');all.forEach((_,i)=>dots.append(el('i','',i===step?'on':i<step?'past':'')));
  const actions=el('div','','guide-actions');
  const prev=el('button','← Anterior','secondary');prev.type='button';prev.disabled=step===0;prev.onclick=()=>{step--;render();};
  const next=el('button',step===all.length-1?'↺ Recomeçar':'Próximo →','primary');next.type='button';next.onclick=()=>{step=(step+1)%all.length;render();};
  actions.append(prev);
  if(lesson.view){const go=el('button',lesson.action,'secondary guide-go');go.type='button';go.onclick=()=>navigate(lesson.view);actions.append(go);}
  actions.append(next);
  right.append(dots,actions);
  card.append(left,right);
  root.append(topics,card);

  // Prática
  const demo=el('section','','card guide-demo');demo.append(el('h3','Experimente sem enviar nada'));
  const steps=['Uma caixa de canetas de exemplo. Clique para adicionar.','Item adicionado ao exemplo. Agora envie a lista de demonstração.','Lista de exemplo em separação. Marque como pronta.','Pronto para retirar! Você completou o fluxo. 🎉'];
  const track=el('div','','guide-practice');['Adicionar','Enviar','Separar','Pronto'].forEach((label,i)=>{const s=el('span','','practice-step'+(i<practice?' done':i===practice?' now':''));s.append(el('b',i<practice?'✓':String(i+1)),el('small',label));track.append(s);});
  const info=el('p',steps[practice]);
  const button=el('button',['+ Adicionar item de exemplo','Enviar demonstração','Confirmar exemplo pronto','Experimentar novamente'][practice],'primary');button.type='button';
  button.onclick=()=>{practice=(practice+1)%4;render();if(practice===3)confetti(root.querySelector('.guide-demo'));};
  demo.append(track,info,button,el('p','Simulação educativa: nenhum produto ou pedido real é alterado.','muted small'));root.append(demo);

  typeText(bubbleText,lesson.text);
  if(!reduced.matches){mascot.classList.add('enter');if(lesson.id==='fim')setTimeout(()=>confetti(card),400);}
  const pupils=[...mascot.querySelectorAll('.mascot-eye i')];
  card.onpointermove=e=>{const r=mascot.getBoundingClientRect();const dx=Math.max(-1,Math.min(1,(e.clientX-(r.left+r.width/2))/300)),dy=Math.max(-1,Math.min(1,(e.clientY-(r.top+r.height/2))/200));pupils.forEach(p=>p.style.transform='translate('+dx*5+'px,'+dy*4+'px)');};
  card.onpointerleave=()=>pupils.forEach(p=>p.style.transform='');
  (function blink(){blinkTimer=setTimeout(()=>{if(!root.isConnected||root.hidden)return;mascot.classList.add('blink');setTimeout(()=>mascot.classList.remove('blink'),160);blink();},2400+Math.random()*2600);})();
 }

 document.addEventListener('keydown',e=>{if(root.hidden||!root.querySelector('.guide-stage'))return;if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;const total=lessons().length;if(e.key==='ArrowRight'){step=(step+1)%total;render();}else if(e.key==='ArrowLeft'&&step>0){step--;render();}});
 document.addEventListener('app:view-change',e=>{if(e.detail==='help'&&role)render();else{clearInterval(typing);clearTimeout(blinkTimer);}});
 return {configure(profile){if(role!==(profile?.role||'')){role=profile?.role||'';step=0;practice=0;}render();}};
}
