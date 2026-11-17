import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
const compile=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const {friendRequestEmail}=await import('data:text/javascript;base64,'+Buffer.from(compile(read('supabase/functions/friend-request-mail/copy.ts'))).toString('base64'));
const source=compile(read('supabase/functions/friend-request-mail/index.ts').replace(/^import .*;\n/gm,''));
const id='00000000-0000-4000-8000-000000000100';
await test('all ten locales escape names and only offer a safe review link',()=>{
 for(const language of ['pt','en','fr','ar','am','sw','ln','yo','sn','zu']){
  const mail=friendRequestEmail(id,'<script>alert(1)</script>',language);
  assert.ok(mail.html.includes(`lang="${language}"`));assert.ok(!mail.html.includes('<script>'));
  assert.ok(mail.html.includes('https://www.yamilook.com/notifications?request='+id));
  assert.ok(!mail.html.includes('accept=true'));assert.ok(!mail.text.includes('{{'));
 }
 assert.ok(friendRequestEmail(id,'Person','pt-AO').html.includes('lang="pt"'));
 assert.ok(friendRequestEmail(id,'Person','unknown').html.includes('lang="pt"'));
});
async function harness({authorized=true,configured=true,status=200,throws=false,finishError=false}={}){
 let handler;const actions=[],emails=[];
 const rpc=async(name,args)=>{
  actions.push({name,args});
  if(name==='friend_mail_authorized')return {data:authorized};
  if(name==='claim_friend_mail')return {data:[{request_id:id,attempts:1,payload:{name:'Person',email:'test@example.test',language:'pt'}}]};
  return {error:finishError?{}:null};
 };
 new Function('createClient','friendRequestEmail','Deno','fetch',source)(()=>({rpc}),friendRequestEmail,{serve:fn=>{handler=fn;},env:{get:key=>configured?'configured-'+key:undefined}},async(url,options)=>{
  emails.push({url,options});if(throws)throw new Error('offline');return new Response(JSON.stringify(status===200?{id:'synthetic-provider-id'}:{message:'error'}),{status});
 });
 return {handler,actions,emails};
}
const req=(token='test-token',body={})=>new Request('https://example.test/worker',{method:'POST',headers:token?{'x-friend-mail-token':token}:{},body:JSON.stringify(body)});
await test('rejects unauthenticated or invalid scheduler calls without sending',async()=>{
 const m=await harness({authorized:false});assert.equal((await m.handler(req())).status,401);assert.equal(m.emails.length,0);
 const noToken=await harness();assert.equal((await noToken.handler(req(''))).status,401);assert.equal(noToken.actions.length,0);
});
await test('configuration probes never claim requests or send mail',async()=>{
 const m=await harness();assert.equal((await m.handler(req('test',{check:true}))).status,200);assert.equal(m.actions.length,1);assert.equal(m.emails.length,0);
 const missing=await harness({configured:false});assert.equal((await missing.handler(req())).status,503);assert.equal(missing.emails.length,0);
});
await test('successful send uses provider idempotency and persists its acknowledgement',async()=>{
 const m=await harness();assert.equal((await m.handler(req())).status,200);
 assert.equal(m.emails[0].options.headers['Idempotency-Key'],'yamilook-friend-'+id);
 assert.deepEqual(JSON.parse(m.emails[0].options.body).to,['test@example.test']);
 assert.equal(m.actions.at(-1).args.p_state,'sent');assert.equal(m.actions.at(-1).args.p_provider_id,'synthetic-provider-id');
});
await test('temporary failure retries; permanent provider rejection stops',async()=>{
 for(const status of [429,500,422]){
  const m=await harness({status});await m.handler(req());assert.equal(m.actions.at(-1).args.p_state,status===422?'failed':'pending');
 }
 const offline=await harness({throws:true});await offline.handler(req());assert.equal(offline.actions.at(-1).args.p_state,'pending');
});
