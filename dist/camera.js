import {loadScript} from './vendor-loader.js';
import {prepareBeep} from './beep.js';
export function setupCamera(onCode,notify){
 const dialog=document.getElementById('camera-dialog'),video=document.getElementById('camera-video'),status=document.getElementById('camera-status');
 const zoom=document.getElementById('camera-zoom'),zoomLabel=document.getElementById('camera-zoom-label');
 let stream=null,controls=null,generation=0;
 function stop(){generation++;zoomLabel.hidden=true;zoom.onchange=null;controls?.stop();controls=null;stream?.getTracks().forEach(track=>track.stop());stream=null;video.srcObject=null;}
 function close(){stop();if(dialog.open)dialog.close();}
 dialog.addEventListener('close',()=>{if(!dialog.open)stop();});dialog.addEventListener('cancel',close);
 document.getElementById('camera-close').onclick=close;
 document.addEventListener('visibilitychange',()=>{if(document.hidden)close();});window.addEventListener('pagehide',close);
 document.getElementById('camera-open').onclick=async()=>{
  prepareBeep();
  if(!navigator.mediaDevices?.getUserMedia){notify('Câmera indisponível. Abra o site em HTTPS ou use o código digitado.','error');return;}
  close();video.muted=true;video.playsInline=true;dialog.showModal();status.textContent='Permita o acesso à câmera para ler o código.';const run=++generation;
  try{
   const acquired=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1080}}});
   if(run!==generation){acquired.getTracks().forEach(t=>t.stop());return;}stream=acquired;
   const track=stream.getVideoTracks()[0],capabilities=track.getCapabilities?.()||{};
   if(capabilities.focusMode?.includes('continuous')){
    try{await track.applyConstraints({advanced:[{focusMode:'continuous'}]});}catch{/* A câmera continua com seu foco padrão. */}
   }
   if(run!==generation)return;
   if(capabilities.zoom&&capabilities.zoom.max>capabilities.zoom.min){
    zoom.min=capabilities.zoom.min;zoom.max=Math.min(capabilities.zoom.max,Math.max(3,capabilities.zoom.min));zoom.step=capabilities.zoom.step||0.1;
    zoom.value=track.getSettings().zoom||capabilities.zoom.min;zoomLabel.hidden=false;
    zoom.onchange=async()=>{try{await track.applyConstraints({advanced:[{zoom:Number(zoom.value)}]});}catch{if(run===generation)status.textContent='Não foi possível ajustar o zoom. Afaste um pouco o produto.';}};
   }
   status.textContent='Preparando leitor…';
   await loadScript('/vendor/zxing-browser.min.js');
   const {BrowserMultiFormatOneDReader}=window.ZXingBrowser;
   if(run!==generation)return;
   const reader=new BrowserMultiFormatOneDReader();
   const active=await reader.decodeFromStream(stream,video,(result,error,control)=>{
    if(run!==generation){control.stop();return;}
    if(result){const code=result.getText();control.stop();close();onCode(code);}
   });
   if(run!==generation){active.stop();return;}controls=active;status.textContent='Posicione o código na horizontal dentro da guia. Afaste o produto até ficar nítido (cerca de 15–25 cm) e mantenha o celular firme.';
  }catch(error){if(run!==generation)return;stop();status.textContent=error.name==='NotAllowedError'?'Acesso negado. Libere a câmera nas permissões do navegador e tente novamente.':error.name==='NotFoundError'?'Nenhuma câmera encontrada neste dispositivo.':'Não foi possível iniciar o leitor. Feche e tente novamente, ou digite o código.';}
 };
 return {close};
}
