import test from 'node:test';import assert from 'node:assert/strict';
import {validEvidence} from '../../supabase/functions/account-link/evidence.ts';
const now=Date.now(),expected={subject:'user',code:'EXACT',linkId:'link'};
const valid={ok:true,certified:true,issuer:'afroloc.ao',audience:'yamilook',subject:'user',code:'EXACT',link_id:'link',evidence_id:'11111111-1111-4111-8111-111111111111',issued_at:new Date(now-1000).toISOString(),expires_at:new Date(now+100000).toISOString(),checked_at:new Date(now).toISOString()};
test('accepts only fresh evidence for the exact binding',()=>assert.equal(validEvidence(valid,expected,now),true));
test('rejects wrong issuer, audience, identity, code, link and string booleans',()=>{
 for(const [key,value] of Object.entries({issuer:'elsewhere',audience:'another',subject:'other',code:'OTHER',link_id:'other',certified:'true',ok:'true',evidence_id:'invalid'}))assert.equal(validEvidence({...valid,[key]:value},expected,now),false);
});
test('rejects expired, malformed, future-issued and stale observations',()=>{
 for(const patch of [{expires_at:new Date(now).toISOString()},{expires_at:null},{issued_at:new Date(now+1).toISOString()},{checked_at:new Date(now-31000).toISOString()},{checked_at:new Date(now+6000).toISOString()}])assert.equal(validEvidence({...valid,...patch},expected,now),false);
 for(const patch of [null,{},false,'true'])assert.equal(validEvidence(patch,expected,now),false);
});
