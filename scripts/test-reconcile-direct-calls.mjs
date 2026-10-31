// Execute the actual Edge handler with synthetic Auth, database and media APIs.
// No production credentials, calls, payment data or network requests are used.
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import assert from 'node:assert/strict';
const source=fs.readFileSync('supabase/functions/reconcile-direct-calls/index.ts','utf8');
const helperSource=fs.readFileSync('supabase/functions/reconcile-direct-calls/decision.ts','utf8');
const compile=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const helper={exports:{}};vm.runInNewContext(compile(helperSource),{exports:helper.exports,Date});
const actor='10000000-0000-4000-8000-000000000001',peer='10000000-0000-4000-8000-000000000002',outsider='10000000-0000-4000-8000-000000000003',id='10000000-0000-4000-8000-000000000010';
let count=0;
const check=(condition,label)=>{assert.ok(condition,label);count++;console.log('PASS',label);};
async function scenario(options={}){
  const writes=[],media=[],grants=[];let handler,clients=0;
  const call={id,caller_id:actor,callee_id:peer,status:'ongoing',created_at:new Date(Date.now()-600_000).toISOString(),updated_at:new Date(Date.now()-180_000).toISOString(),started_at:new Date(Date.now()-500_000).toISOString(),...options.call};
  const admin={from(table){let change=null,selection='';const q={
    select(s){selection=s;return q;},eq(){return q;},or(){return q;},lt(){return q;},in(){return q;},
    limit:async()=>({data:[call],error:null}),
    update(value){change=value;writes.push({table,action:'update',value});return q;},
    upsert(value){writes.push({table,action:'upsert',value});return q;},
    delete(){writes.push({table,action:'delete'});return q;},
    single:async()=>({data:{first_missing_at:options.observed??new Date(Date.now()-60_000).toISOString()},error:null}),
    maybeSingle:async()=>({data:options.lostRace?null:{id},error:null}),
    then(resolve,reject){return Promise.resolve({data:null,error:null}).then(resolve,reject);},
  };return q;}};
  class SignJWT {constructor(payload){grants.push(payload.video);}setProtectedHeader(){return this;}setIssuer(){return this;}setSubject(){return this;}setIssuedAt(){return this;}setNotBefore(){return this;}setExpirationTime(){return this;}async sign(){return 'synthetic-server-token';}}
  const createClient=()=>++clients===1?{auth:{getUser:async()=>({data:{user:options.invalidAuth?null:{id:options.actor??actor}},error:null})},rpc:async()=>({error:options.revoked?{message:'revoked'}:null})}:admin;
  const context={exports:{},Request,Response,Date,TextEncoder,AbortSignal,Map,console:{error(){}},Deno:{env:{get:key=>({SUPABASE_URL:'https://example.supabase.co',SUPABASE_ANON_KEY:'test',SUPABASE_SERVICE_ROLE_KEY:'synthetic-service-key',LIVEKIT_API_KEY:'test',LIVEKIT_API_SECRET:'synthetic-secret',LIVEKIT_URL:'wss://example.invalid'})[key]}},
    fetch:async url=>{const method=url.split('/').at(-1);media.push(method);return method==='ListParticipants'?new Response(JSON.stringify({participants:(options.identities??[actor,peer]).map(identity=>({identity}))}),{status:options.presenceError?503:200}):new Response('{}',{status:200});},
    require:name=>name.includes('/http/server')?{serve:fn=>{handler=fn;}}:name.includes('supabase-js')?{createClient}:name.includes('jose')?{SignJWT}:helper.exports};
  vm.runInNewContext(compile(source),context);
  const req=new Request('https://example.invalid',{method:'POST',headers:options.noHeader?{}:{Authorization:'Bearer synthetic-user-token'},body:JSON.stringify({callId:id})});
  const response=await handler(req);return {response,writes,media,grants};
}
let r=await scenario({noHeader:true});check(r.response.status===401&&!r.media.length&&!r.writes.length,'unauthenticated request has no database or media effects');
r=await scenario({revoked:true});check(r.response.status===401&&!r.media.length&&!r.writes.length,'revoked session cannot reach administrative room operations');
r=await scenario({actor:outsider});check(r.response.status===403&&!r.media.length&&!r.writes.length,'unrelated user cannot close a known call');
r=await scenario();check(r.response.status===200&&!r.writes.some(x=>x.value?.status)&&!r.media.includes('DeleteRoom'),'long call with both invited peers remains active');
r=await scenario({identities:[actor],observed:new Date(Date.now()-20_000).toISOString()});check(r.response.status===200&&!r.writes.some(x=>x.value?.status)&&!r.media.includes('DeleteRoom'),'brief loss retains the reconnection grace');
r=await scenario({identities:[]});check(r.response.status===200&&r.writes.some(x=>x.table==='calls'&&x.value?.status==='ended'),'confirmed abandoned ongoing call is ended');
check(r.writes.some(x=>x.table==='call_participants'&&x.value?.status==='left'),'abandoned participation is released');
check(r.media.includes('DeleteRoom')&&r.grants.some(g=>g.roomCreate===true),'server closes abandoned room with correct administrative grant');
r=await scenario({identities:[],lostRace:true});check(!r.media.includes('DeleteRoom'),'concurrent answer or recovery prevents room deletion');
r=await scenario({presenceError:true});check(r.response.status===503&&!r.writes.some(x=>x.value?.status)&&!r.media.includes('DeleteRoom'),'media API failure is never treated as peer absence');
r=await scenario({call:{status:'ended'}});check(r.response.status===200&&r.media.includes('DeleteRoom')&&!r.media.includes('ListParticipants'),'authorized ended call closes server media immediately');
console.log(`${count} direct-call Edge handler checks passed`);
