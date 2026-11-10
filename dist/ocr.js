import {loadScript} from './vendor-loader.js';
const dialog=document.createElement('dialog');dialog.className='ocr-dialog';dialog.setAttribute('aria-labelledby','ocr-title');
dialog.innerHTML='<h2 id="ocr-title">Ler texto da etiqueta</h2><p>Fotografe apenas a descrição do produto, com boa iluminação. Confira o texto antes de buscar.</p><input id="ocr-photo" type="file" accept="image/*" capture="environment"><p id="ocr-progress" role="status"></p><label>Texto para buscar<input id="ocr-text" maxlength="160" autocomplete="off"></label><div class="ocr-actions"><button id="ocr-search" type="button" class="primary" disabled>Buscar texto</button><button id="ocr-close" type="button" class="secondary">Fechar</button></div><p class="muted small">A foto é processada neste aparelho. Na primeira leitura, é necessário baixar o modelo de português pela internet.</p>';
document.body.append(dialog);
const photo=dialog.querySelector('#ocr-photo'),progress=dialog.querySelector('#ocr-progress'),text=dialog.querySelector('#ocr-text'),search=dialog.querySelector('#ocr-search');
let worker=null,generation=0,target=null;
function stop(){generation++;const old=worker;worker=null;if(old)old.terminate().catch(()=>{});photo.disabled=false;}
dialog.addEventListener('close',stop);dialog.addEventListener('cancel',stop);dialog.querySelector('#ocr-close').onclick=()=>dialog.close();window.addEventListener('pagehide',stop);
for(const id of ['product-search','lookup-code']){const input=document.getElementById(id);if(!input)continue;const button=document.createElement('button');button.type='button';button.className='secondary ocr-open';button.textContent='Ler descrição pela câmera';input.closest('label')?.after(button);button.onclick=()=>{target=input;photo.value='';text.value='';search.disabled=true;progress.textContent='Escolha uma foto para começar.';dialog.showModal();};}
text.oninput=()=>{search.disabled=!text.value.trim();};
search.onclick=()=>{if(!target||!text.value.trim())return;target.value=text.value.trim();target.dispatchEvent(new Event('input',{bubbles:true}));dialog.close();target.focus();};
photo.onchange=async()=>{const file=photo.files[0];if(!file)return;stop();const run=generation;search.disabled=true;photo.disabled=true;let bitmap;
 try{if(file.size>15*1024*1024)throw new Error('Escolha uma foto menor que 15 MB.');
  progress.textContent='Preparando a foto…';bitmap=await createImageBitmap(file);if(run!==generation)return;
  const canvas=document.createElement('canvas'),scale=Math.min(1,1800/Math.max(bitmap.width,bitmap.height));canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();bitmap=null;
  await loadScript('/vendor/ocr/tesseract.min.js');if(run!==generation)return;
  progress.textContent='Carregando leitor de português…';
  const created=await window.Tesseract.createWorker('por',1,{workerPath:'/vendor/ocr/worker.min.js',corePath:'/vendor/ocr/core',logger:m=>{if(run===generation&&m.status==='recognizing text')progress.textContent='Lendo texto: '+Math.round(m.progress*100)+'%';}});
  if(run!==generation){await created.terminate();return;}worker=created;
  const result=await worker.recognize(canvas);if(run!==generation)return;
  text.value=result.data.text.replace(/\s+/g,' ').trim().slice(0,160);search.disabled=!text.value;progress.textContent=text.value?'Confira e ajuste a descrição antes de buscar.':'Nenhum texto legível. Tente outra foto.';text.focus();
 }catch(error){if(run===generation)progress.textContent=error.message||'Não foi possível ler a foto. Tente novamente.';}
 finally{bitmap?.close();if(run===generation){const old=worker;worker=null;await old?.terminate().catch(()=>{});photo.disabled=false;}}
};
