import {test,expect} from '@playwright/test';
const me='11111111-1111-4111-8111-111111111111';
const avatar='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAIAAABvFaqvAAAAIklEQVR4nGPUSfBioAZgooopowaNGjRq0KhBowaNGkQRAABiOAEGuoPnkgAAAABJRU5ErkJggg==';
const code='AO-LDA-ING-000-DIG-G10-35Q1-N23WC';
test('mobile owner card shares a readable PNG QR, updates data and keeps contacts opt-in',async({page})=>{
 let currentCode=code;
 await page.route('**/127.0.0.1:54321/**',async route=>{
  const table=new URL(route.request().url()).pathname.split('/').pop();let data:unknown=[];
  if(table==='user')data={id:me,email:'test@example.invalid'};
  if(table==='profiles')data={id:me,display_name:'António — teste do cartão',username:'teste',onboarding_completed:true,app_tour_completed:true,avatar_url:avatar,country_code:'AO',city:'Luanda',neighborhood:'Centro',afroloc_code:currentCode,afroloc_certification_status:'pending',phone_number:'923123456',email:'private@example.invalid'};
  if(table==='my_residence_administrative')data=null;
  if(table==='afroloc-experience')data={addresses:[]};
  await route.fulfill({json:data});
 });
 await page.addInitScript(({me})=>{
  localStorage.setItem('i18nextLng','pt');
  const session=JSON.stringify({access_token:btoa('{}')+'.'+btoa(JSON.stringify({sub:me,exp:Math.floor(Date.now()/1000)+3600}))+'.signature',refresh_token:'test-only',expires_at:Math.floor(Date.now()/1000)+3600,token_type:'bearer',user:{id:me,email:'test@example.invalid'}});
  localStorage.setItem('undefined',session);localStorage.setItem('sb-127-auth-token',session);
  Object.defineProperty(navigator,'canShare',{value:()=>true,configurable:true});
  Object.defineProperty(navigator,'share',{value:async(data:ShareData)=>{(window as unknown as {shared:ShareData}).shared=data},configurable:true});
 },{me});
 await page.goto('/afroloc/cartao');
 const share=page.getByRole('button',{name:'Partilhar cartão'});await expect(share).toBeEnabled({timeout:30000});
 await expect(page.getByRole('img')).toHaveAttribute('aria-label',new RegExp(code));
 await expect(page.locator('svg[role=img] > image')).toHaveAttribute('href',/^data:image\/png/);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 const photoBox=await page.locator('[data-card-photo]').boundingBox();const codeBox=await page.locator('[data-card-code]').boundingBox();
 expect(codeBox!.y).toBeGreaterThanOrEqual(photoBox!.y+photoBox!.height);
 await expect(page.getByRole('img')).not.toContainText('Africa/Luanda');
 await expect(page.getByRole('img')).toContainText('Cartão gerado em');
 await share.click();
 const first=await page.evaluate(async()=>{
  const data=(window as unknown as {shared:ShareData}).shared;
  const modulePath='/src/lib/afroloc-card-import.ts';const {readAfrolocCard}=await import(/* @vite-ignore */ modulePath);
  return {text:data.text,code:await readAfrolocCard(data.files![0]),type:data.files![0].type};
 });
 expect(first.code).toBe(code);expect(first.type).toBe('image/png');expect(first.text).not.toContain('923123456');expect(first.text).not.toContain('private@example.invalid');
 await page.getByRole('checkbox',{name:'Telefone'}).check();await expect(share).toBeEnabled();await share.click();
 expect(await page.evaluate(()=>(window as unknown as {shared:ShareData}).shared.text)).toContain('923123456');
 currentCode='AO-ZU-G10-ABC-DEF';await page.getByRole('button',{name:'Actualizar cartão'}).click();await expect(share).toBeEnabled();
 await expect(page.getByRole('img')).toHaveAttribute('aria-label',new RegExp(currentCode));await share.click();
 const latest=await page.evaluate(async()=>{const path='/src/lib/afroloc-card-import.ts';const {readAfrolocCard}=await import(/* @vite-ignore */ path);return readAfrolocCard((window as unknown as {shared:ShareData}).shared.files![0]);});expect(latest).toBe(currentCode);
});
