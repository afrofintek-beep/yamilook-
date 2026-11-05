import { test, expect } from '@playwright/test';
test('records both audio tracks and recovers the actual Blob after reload without exposing another account', async ({page}) => {
  await page.goto('/tests/call-recording/harness.html');
  test.skip(!await page.evaluate(() => typeof MediaRecorder !== 'undefined'), 'This Linux WebKit build has no MediaRecorder; physical Safari validation remains required.');
  await page.getByRole('button',{name:'Start',exact:true}).click();
  await expect(page.getByText('recording',{exact:true})).toBeVisible();
  await page.waitForTimeout(2200);
  await page.getByRole('button',{name:'Stop',exact:true}).click();
  await expect(page.getByText('saved',{exact:true})).toBeVisible();
  const result=await page.evaluate(()=>window.result);
  expect(result.type).toMatch(/^audio\//);expect(result.size).toBeGreaterThan(1000);
  expect(result.local).toBeGreaterThan(0.03);expect(result.remote).toBeGreaterThan(0.03);
  expect(result.noise).toBeLessThan(0.02);expect(result.running).toBe('running');expect(result.durable).toBe(true);
  await page.reload();await page.getByRole('button',{name:'Recover'}).click();
  await expect(page.getByText('recovered',{exact:true})).toBeVisible();
  const recovered=await page.evaluate(()=>window.recovery);
  expect(recovered).toEqual({count:1,size:result.size,other:0});
});

test('refuses capture without MediaRecorder rather than pretending to save',async({page})=>{
 await page.goto('/tests/call-recording/harness.html');
 await page.evaluate(()=>{Object.defineProperty(window,'MediaRecorder',{value:undefined,configurable:true});});
 await page.getByRole('button',{name:'Start',exact:true}).click();
 await expect(page.getByText('failed',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Stop',exact:true}).click();
 await expect(page.getByText('empty',{exact:true})).toBeVisible();
});

test('converts WebM video and audio into real H264 AAC MP4', async ({page}) => {
 await page.goto('/tests/call-recording/harness.html');
 test.skip(!await page.evaluate(()=>typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')), 'Requires WebM capture; Chromium covers conversion.');
 const result=await page.evaluate(async()=>{
  const {prepareMp4}=await import('/src/features/call-recording/mp4.ts');
  const {Input,ALL_FORMATS,BlobSource}=await import('/node_modules/mediabunny/dist/modules/src/index.js');
  const canvas=document.createElement('canvas');canvas.width=320;canvas.height=240;
  const ctx=canvas.getContext('2d');const stream=canvas.captureStream(15);
  const audio=new AudioContext();await audio.resume();const oscillator=audio.createOscillator();const dest=audio.createMediaStreamDestination();oscillator.connect(dest);oscillator.start();stream.addTrack(dest.stream.getAudioTracks()[0]);
  const timer=setInterval(()=>{ctx.fillStyle='green';ctx.fillRect(0,0,320,240);},60);
  const chunks=[];const recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8,opus'});
  const done=new Promise(resolve=>{recorder.ondataavailable=e=>chunks.push(e.data);recorder.onstop=resolve;});
  recorder.start();await new Promise(resolve=>setTimeout(resolve,1800));recorder.stop();await done;clearInterval(timer);stream.getTracks().forEach(t=>t.stop());oscillator.stop();await audio.close();
  const file=await prepareMp4(new File(chunks,'Kosolola_test.webm',{type:recorder.mimeType}),new AbortController().signal,()=>{});
  const input=new Input({formats:ALL_FORMATS,source:new BlobSource(file)});
  try {return {name:file.name,type:file.type,size:file.size,video:await (await input.getPrimaryVideoTrack()).getCodec(),audio:await (await input.getPrimaryAudioTrack()).getCodec(),duration:await input.computeDuration()};}finally{input.dispose();}
 });
 expect(result.name).toBe('Kosolola_test.mp4');expect(result.type).toBe('video/mp4');expect(result.size).toBeGreaterThan(1000);expect(result.video).toBe('avc');expect(result.audio).toBe('aac');expect(result.duration).toBeGreaterThan(1.5);
});
