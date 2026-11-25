import test from 'node:test';import assert from 'node:assert/strict';
import {createBridge} from '../../supabase/functions/maguela-identity-bridge/handler.ts';
const uid='00000000-0000-4000-8000-000000000001',challenge='a'.repeat(64);
const valid={action:'confirm',consent:true,challenge};
const req=(data)=>new Request('https://example.invalid',{method:'POST',body:JSON.stringify(data)});
function fixture(patch={}){const calls=[];const handler=createBridge({enabled:()=>true,authenticate:async()=>uid,eligible:async()=>true,redeem:async(...args)=>{calls.push(args);return true},...patch});return {handler,calls}}
test('disabled by default blocks redemption',async()=>{const {handler,calls}=fixture({enabled:()=>false});assert.equal((await handler(req(valid))).status,503);assert.equal(calls.length,0)});
test('consent and valid challenge required; supplied subject rejected',async()=>{const {handler,calls}=fixture();for(const data of [{...valid,consent:false},{...valid,challenge:'invalid'},{...valid,subject:uid},{...valid,consent:'true'}])assert.equal((await handler(req(data))).status,400);assert.equal(calls.length,0)});
test('requires authenticated and eligible account',async()=>{for(const patch of [{authenticate:async()=>{throw Error()}},{eligible:async()=>false}]){const {handler,calls}=fixture(patch);assert.equal((await handler(req(valid))).status,403);assert.equal(calls.length,0)}});
test('only server-derived subject is forwarded',async()=>{const {handler,calls}=fixture();const res=await handler(req(valid));assert.deepEqual(await res.json(),{ok:true,linked:true});assert.deepEqual(calls,[[challenge,uid]]);assert.equal(res.headers.get('cache-control'),'no-store')});
test('rejects partner denial and oversized request',async()=>{const {handler}=fixture({redeem:async()=>false});assert.equal((await handler(req(valid))).status,409);assert.equal((await handler(req({...valid,challenge:'a'.repeat(2000)}))).status,400)});
