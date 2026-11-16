import { describe, expect, it } from 'vitest';
import { parseExperienceRequest } from './protocol';
describe('AFROLOC request boundary', () => {
 it('accepts only the address operations', () => {
  expect(parseExperienceRequest({type:'yamilook-afroloc-request',id:'one',action:'list',data:{}})?.action).toBe('list');
  for(const action of ['signInWithPassword','getSession','certify','execute_sql']) expect(parseExperienceRequest({type:'yamilook-afroloc-request',id:'one',action,data:{}})).toBeNull();
 });
 it('rejects malformed and oversized messages', () => {
  for(const v of [null,{}, {type:'yamilook-afroloc-request',id:'one',action:'list',data:[]}, {type:'yamilook-afroloc-request',id:'one',action:'create',data:{label:'x'.repeat(6001)}}]) expect(parseExperienceRequest(v)).toBeNull();
 });
});
it('accepts bounded card navigation without accepting URLs as destinations',()=>{
 expect(parseExperienceRequest({type:'yamilook-afroloc-request',id:'one',action:'open-card',data:{id:'saved-address'}})?.action).toBe('open-card');
 for(const id of [undefined,{},'https://other.example','x'.repeat(65)])expect(parseExperienceRequest({type:'yamilook-afroloc-request',id:'one',action:'open-card',data:{id}})).toBeNull();
});
