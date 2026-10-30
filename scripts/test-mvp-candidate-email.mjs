import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import ts from 'typescript';
const source=(await readFile(new URL('../supabase/functions/send-mvp-candidate-invitation/index.ts',import.meta.url),'utf8')).replace(/^import .*\n/,'');
test('candidate email authorization, server recipient, configuration and delivery',async()=>{
 let handler,admin=true,configured=true,candidate=true,providerOk=true,sent=[],updates=[];
 const row={id:'00000000-0000-0000-0000-000000000001',full_name:'Pessoa',email:'approved@example.test',access_code:'ABCD-1234'};
 const client={auth:{getUser:async()=>({data:{user:{id:'admin'}},error:null})},rpc:async()=>({data:admin,error:null}),from:()=>{
  const q={};for(const m of ['select','eq'])q[m]=()=>q;
  q.single=async()=>({data:candidate?row:null,error:null});
  q.update=data=>{updates.push(data);return q};q.then=resolve=>Promise.resolve({error:null}).then(resolve);return q;
 }};
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText,{
  Response,Date,JSON,createClient:()=>client,Deno:{serve:f=>handler=f,env:{get:key=>key==='RESEND_API_KEY'&&!configured?null:'configured'}},fetch:async(url,opts)=>{sent.push(JSON.parse(opts.body));return {ok:providerOk}}});
 const request=()=>new Request('https://example.test',{method:'POST',headers:{Authorization:'Bearer token'},body:JSON.stringify({candidateId:row.id,email:'attacker@example.test'})});
 assert.equal((await handler(new Request('https://example.test',{method:'POST'}))).status,401);
 admin=false;assert.equal((await handler(request())).status,403);assert.equal(sent.length,0);
 admin=true;candidate=false;assert.equal((await handler(request())).status,404);assert.equal(sent.length,0);
 candidate=true;configured=false;assert.equal((await handler(request())).status,503);assert.equal(sent.length,0);
 configured=true;providerOk=false;assert.equal((await handler(request())).status,502);assert.equal(updates.length,0);
 providerOk=true;assert.equal((await (await handler(request())).json()).accepted,true);
 assert.deepEqual(sent.at(-1).to,['approved@example.test']);assert.match(sent.at(-1).text,/https:\/\/www.yamilook.com\/register/);assert.equal(updates.length,1);
});
