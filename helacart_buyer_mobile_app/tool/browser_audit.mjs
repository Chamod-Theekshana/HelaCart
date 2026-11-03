import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

const url=process.argv[2]??'http://localhost:4317';
const executable=process.env.CHROMIUM_PATH??'C:/Users/Chamod/AppData/Local/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe';
const output=path.resolve('.artifacts/browser');await fs.mkdir(output,{recursive:true});
const child=spawn(executable,['--headless=new','--remote-debugging-port=9238','--no-first-run','--no-default-browser-check',`--user-data-dir=${path.join(output,'profile')}`,'about:blank'],{windowsHide:true,stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let ws;const errors=[];
try{
  let target;for(let i=0;i<100;i++){try{target=await(await fetch('http://127.0.0.1:9238/json/new?about:blank',{method:'PUT'})).json();break;}catch{await sleep(200);}}
  if(!target)throw Error('Chromium did not start. Set CHROMIUM_PATH to your executable.');
  ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
  let sequence=0;const pending=new Map();
  ws.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description??m.params.exceptionDetails.text);if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}});
  const cdp=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;const timer=setTimeout(()=>reject(Error(method+' timed out')),45000);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const r=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
  await cdp('Page.enable');await cdp('Runtime.enable');
  const results=[];
  for(const [name,route,width] of [['home','/',390],['catalog','/products',360],['product','/products/preview-shirt',390],['shop','/shops/ceylon-threads',390],['account','/account',360],['sign-in','/auth',390]]){
    await cdp('Page.navigate',{url:'about:blank'});
    await sleep(150);
    // This audit checks responsive widths. Native Android is checked separately;
    // CDP's mobile viewport transitions can produce Flutter engine inset assertions.
    await cdp('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:false});
    await cdp('Page.navigate',{url:url+'/#'+route});
    for(let i=0;i<100;i++){if(await evaluate("document.querySelector('flutter-view') !== null"))break;await sleep(150);}
    await sleep(1600);
    await evaluate("document.querySelector('flt-semantics-placeholder')?.click()");
    await sleep(300);
    const image=await cdp('Page.captureScreenshot',{format:'png'});await fs.writeFile(path.join(output,name+'.png'),Buffer.from(image.data,'base64'));
    results.push({name,width,flutterView:await evaluate("document.querySelector('flutter-view') !== null"),documentOverflow:await evaluate('document.documentElement.scrollWidth > innerWidth')});
  }
  const result={results,errors};await fs.writeFile(path.join(output,'results.json'),JSON.stringify(result,null,2));process.stdout.write(JSON.stringify(result,null,2)+'\n');
  if(errors.length||results.some(r=>!r.flutterView||r.documentOverflow))process.exitCode=1;
  await cdp('Browser.close').catch(()=>{});
}finally{ws?.close();child.kill();}
