import {describe,it,expect} from 'vitest';
import {parseFarewellResponse} from './farewell-response';
const id='11111111-1111-4111-8111-111111111111';
const recipient={batch:id,id,username:'teste',message:id,date:'2026-11-25T08:00:00Z'};
describe('farewell response boundary',()=>{
 it('accepts explicit empty list',()=>expect(parseFarewellResponse({batch:null,pending:[]},'list')).toEqual({batch:null,pending:[]}));
 it.each([null,[],{}, {batch:null,pending:null},{batch:null,pending:[{}]},{batch:null,pending:[{...recipient,id:'bad'}]}])('rejects malformed payload %j',value=>expect(()=>parseFarewellResponse(value,'list')).toThrow('Resposta inválida'));
 it('requires batch on close',()=>expect(()=>parseFarewellResponse({batch:null,pending:[]},'close')).toThrow());
 it('retains validated recipients',()=>expect(parseFarewellResponse({batch:id,pending:[recipient]},'close').pending).toEqual([recipient]));
});
