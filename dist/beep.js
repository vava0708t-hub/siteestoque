let audio;
export async function prepareBeep(){
 try{const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;audio??=new Audio();if(audio.state==='suspended')await audio.resume();}catch{}
}
export async function playBeep(delay=0){
 try{await prepareBeep();if(!audio||audio.state!=='running'||document.hidden)return;
 const oscillator=audio.createOscillator(),gain=audio.createGain(),start=audio.currentTime+delay;
 oscillator.frequency.value=1350;oscillator.type='sine';gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(.045,start+.01);gain.gain.exponentialRampToValueAtTime(.001,start+.12);
 oscillator.connect(gain);gain.connect(audio.destination);oscillator.start(start);oscillator.stop(start+.13);oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
 }catch{}
}
window.addEventListener('pagehide',()=>{audio?.close().catch(()=>{});audio=null;});
