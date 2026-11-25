import {test,expect} from '@playwright/test';
const me='11111111-1111-4111-8111-111111111111';
const avatar='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAIAAABvFaqvAAAAIklEQVR4nGPUSfBioAZgooopowaNGjRq0KhBowaNGkQRAABiOAEGuoPnkgAAAABJRU5ErkJggg==';
const code='AO-LDA-ING-000-DIG-G10-35Q1-N23WC';
test('mobile owner card shares a protected PNG QR, updates data and keeps contacts opt-in',async({page})=>{
 let currentCode=code;
 const firstHandle='11111111-1111-4111-8111-111111111112',nextHandle='11111111-1111-4111-8111-111111111113';
 const protectedUrl=(handle:string)=>'https://www.yamilook.com/afroloc/acesso/'+handle+'?lang=pt';
 let denyAccess=false;
 await page.route('https://ljcxqwjvjgobhisqkujr.supabase.co/functions/v1/afroloc-postal-card',route=>route.fulfill({json:{status:'unavailable'},headers:{'access-control-allow-origin':'*','access-control-allow-headers':'authorization,content-type'}}));
 await page.route('**/127.0.0.1:54321/**',async route=>{
  const table=new URL(route.request().url()).pathname.split('/').pop();let data:unknown=[];
  if(table==='user')data={id:me,email:'test@example.invalid'};
  if(table==='profiles')data={id:me,display_name:'António — teste do cartão',username:'teste',onboarding_completed:true,app_tour_completed:true,avatar_url:avatar,country_code:'AO',city:'Luanda',neighborhood:'Centro',afroloc_code:currentCode,afroloc_certification_status:'pending',phone_number:'923123456',email:'private@example.invalid'};
  if(table==='my_residence_administrative')data=null;
  if(table==='locaccess_action'){
   if(denyAccess){await route.fulfill({status:403,json:{code:'42501',message:'denied'}});return;}
   const body=route.request().postDataJSON();
   if(body.p_action==='owner'&&body.p_data?.id==='residence'&&body.p_data?.code===currentCode)data={handle:currentCode===code?firstHandle:nextHandle,enabled:false,grants:[]};
  }
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
 await expect(page.locator('svg[role=img] > image[data-card-photo]')).toHaveAttribute('href',/^data:image\/png/);
 await expect(page.locator('section[aria-label="Cartão AFROLOC"] svg[role=img] a')).toHaveAttribute('href',protectedUrl(firstHandle));
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 const photoBox=await page.locator('[data-card-photo]').boundingBox();const codeBox=await page.locator('[data-card-code]').boundingBox();
 expect(codeBox!.y).toBeGreaterThanOrEqual(photoBox!.y+photoBox!.height);
 await expect(page.getByRole('img')).not.toContainText('Africa/Luanda');
 await expect(page.getByRole('img')).toContainText('Cartão gerado em');
 await share.click();
 // Decode the exported pixels, not the owner's on-screen code.
 const readShared=()=>page.evaluate(async()=>{
  const data=(window as unknown as {shared:ShareData}).shared;
  const file=data.files![0],url=URL.createObjectURL(file);
  try{
   const image=new Image();await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=reject;image.src=url;});
   const scale=Math.min(1,2400/Math.max(image.naturalWidth,image.naturalHeight));
   const canvas=document.createElement('canvas');canvas.width=Math.round(image.naturalWidth*scale);canvas.height=Math.round(image.naturalHeight*scale);
   const ctx=canvas.getContext('2d')!;ctx.drawImage(image,0,0,canvas.width,canvas.height);
   const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);
   const modulePathQR='/src/lib/afroloc-card-import.ts';
   const {readAfrolocCard}=await import(/* @vite-ignore */ modulePathQR);
   // The legacy importer must reject protected cards rather than reveal an address.
   let publicCode:string|null=null;try{publicCode=await readAfrolocCard(file);}catch{/* expected for protected access */}
   const {default:jsQR}=await import('jsqr');
   const modulePath='/src/shared/afroloc-card/protocol.ts';const {readCardReference}=await import(/* @vite-ignore */ modulePath);
   const qr=jsQR(pixels.data,pixels.width,pixels.height,{inversionAttempts:'attemptBoth'});
   return {text:data.text,reference:qr?readCardReference(qr.data):null,type:file.type,publicCode};
  }finally{URL.revokeObjectURL(url);}
 });
 const first=await readShared();
 expect(first.reference).toEqual({kind:'access',url:protectedUrl(firstHandle)});expect(first.type).toBe('image/png');expect(first.publicCode).toBeNull();
 expect(first.text).not.toContain(code);expect(first.text).not.toContain('923123456');expect(first.text).not.toContain('private@example.invalid');
 await page.getByText('Dados a incluir na partilha',{exact:true}).click();
 await page.getByRole('checkbox',{name:'Telefone',exact:true}).check();await expect(share).toBeEnabled();await share.click();
 expect((await readShared()).text).toContain('923123456');
 currentCode='AO-ZU-G10-ABC-DEF';await page.getByRole('button',{name:'Opções do cartão'}).click();await page.getByRole('menuitem',{name:'Actualizar cartão'}).click();
 await expect(page.getByRole('img')).toHaveAttribute('aria-label',new RegExp(currentCode));await expect(share).toBeEnabled();await share.click();
 const latest=await readShared();expect(latest.reference).toEqual({kind:'access',url:protectedUrl(nextHandle)});expect(latest.text).not.toContain(currentCode);
 // A different address whose protected access is denied must never be shareable.
 denyAccess=true;currentCode='AO-ZU-G10-NEW-DENIED';
 await page.getByRole('button',{name:'Opções do cartão'}).click();await page.getByRole('menuitem',{name:'Actualizar cartão'}).click();
 await expect(page.getByRole('img')).toHaveAttribute('aria-label',new RegExp(currentCode));
 await expect(page.getByRole('alert').filter({hasText:'Volta a entrar na Yamilook.'})).toBeVisible();
 await expect(share).toBeDisabled();
});
