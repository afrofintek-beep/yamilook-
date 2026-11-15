import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHandler,publicPoint,unavailable} from '../../supabase/functions/afroloc-card-location/handler.ts';
const reference='AO-LUA-TAL-TAL-GEN-G10-X6AI6-Y4A2H';
const request=body=>new Request('https://example.test',{method:'POST',body:JSON.stringify(body)});
test('anonymous QR returns location only, never profile identity or contacts',async()=>{
 const handle=createHandler(async code=>{assert.equal(code,reference);return {latitude:-8.9,longitude:13.2,name:'private',email:'private@example.test',phone:'private'};});
 const res=await handle(request({reference}));
 assert.equal(res.status,200);assert.equal(res.headers.get('cache-control'),'no-store');
 assert.deepEqual(await res.json(),{status:'found',place:{reference,name:'AFROLOC',category:'administration',approximatePoint:{lat:-8.9,lon:13.2},locality:'',verification:'pending'}});
});
test('rejects wildcard, batch, grant-bearing, oversized and malformed requests',async()=>{
 let calls=0;const handle=createHandler(async()=>{calls++;return null;});
 for(const body of [{reference:'%'},{reference:[reference]},{reference,grant:'secret'},{reference:'A'.repeat(600)},null,{reference:'AO-LUA-\nTAL'}])assert.deepEqual(await (await handle(request(body))).json(),unavailable);
 assert.equal(calls,0);
});
test('no location for missing or unavailable service',async()=>{
 for(const lookup of [async()=>null,async()=>{throw Error('private database detail')}])assert.deepEqual(await (await createHandler(lookup)(request({reference}))).json(),unavailable);
});
test('temporary locations stop at expiry, closure or rejection',()=>{
 const now=Date.now(),base={latitude:-8.9,longitude:13.2,status:'approved'};
 assert.deepEqual(publicPoint({...base,expires_at:new Date(now+1000).toISOString()},now),{lat:-8.9,lon:13.2});
 for(const record of [{...base,expires_at:new Date(now).toISOString()},{...base,expires_at:'invalid'},{...base,status:'closed'},{...base,status:'rejected'},{...base,latitude:null},{...base,longitude:Infinity}])assert.equal(publicPoint(record,now),null);
});
test('no writes or directory methods',async()=>{const h=createHandler(async()=>{throw Error('must not query')});assert.equal((await h(new Request('https://example.test'))).status,405);assert.equal((await h(new Request('https://example.test',{method:'OPTIONS'}))).status,204);});
