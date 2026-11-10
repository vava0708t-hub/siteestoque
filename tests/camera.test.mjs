import test from 'node:test';
import assert from 'node:assert/strict';
test('câmera usa leitor local, entrega código uma vez e libera a câmera',async()=>{
 const originals=Object.fromEntries(['window','document','navigator'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 const listeners=new Map();const nodes=new Map();let callback,stopped=0,received=[],loaded=[];
 const node=()=>({hidden:false,open:false,addEventListener(name,fn){listeners.set(name,fn);},showModal(){this.open=true;},close(){this.open=false;},getSettings(){return {};}});
 for(const id of ['camera-dialog','camera-video','camera-status','camera-zoom','camera-zoom-label','camera-close','camera-open'])nodes.set(id,node());
 const control={stop(){}};const stream={getTracks:()=>[{stop(){stopped++;}}],getVideoTracks:()=>[{getCapabilities:()=>({}),getSettings:()=>({})}]};
 const window={addEventListener(){},ZXingBrowser:{BrowserMultiFormatOneDReader:class{async decodeFromStream(actual,video,fn){assert.equal(actual,stream);callback=fn;return control;}}}};
 const document={getElementById:id=>nodes.get(id),addEventListener(){},createElement:()=>({remove(){}}),head:{append(script){loaded.push(script.src);queueMicrotask(()=>script.onload());}}};
 Object.defineProperty(globalThis,'window',{configurable:true,value:window});Object.defineProperty(globalThis,'document',{configurable:true,value:document});Object.defineProperty(globalThis,'navigator',{configurable:true,value:{mediaDevices:{getUserMedia:async()=>stream}}});
 try{const {setupCamera}=await import('../dist/camera.js');const camera=setupCamera(code=>received.push(code),()=>{});await nodes.get('camera-open').onclick();assert.deepEqual(loaded,['/vendor/zxing-browser.min.js']);callback({getText:()=> '7891234567890'},null,control);callback({getText:()=> '7891234567890'},null,control);assert.deepEqual(received,['7891234567890']);assert.equal(stopped,1);assert.equal(nodes.get('camera-dialog').open,false);camera.close();assert.equal(nodes.get('camera-video').srcObject,null);
 }finally{for(const [key,descriptor] of Object.entries(originals)){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}
});
