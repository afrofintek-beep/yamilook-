import {describe,it,expect} from 'vitest';
import {addressLink,readCardReference} from './protocol';
import {addressCardLines} from './AddressCard';
const code='AO-LUA-TAL-TAL-GEN-G10-X6AI6-Y4A2H-0001';
describe('cross-application card contract',()=>{
 it('preserves the approved full code and sequence through a navigable QR',()=>{
  expect(readCardReference(addressLink(code))).toEqual({kind:'address',code});
 });
 it.each([code,'AFROLOC: '+code,'https://afroloc.ao/a/'+code,'https://app.afroloc.ao/#/publicLookup?code='+code,'https://afroloc.ao/?afroloc='+code])('reads legacy card %s',value=>expect(readCardReference(value)).toEqual({kind:'address',code}));
 it('keeps LOCACCESS as an access capability, not an address',()=>{
  const url='https://app.afroloc.ao/experiencia/#acesso='+'a'.repeat(64);
  expect(readCardReference(url)).toEqual({kind:'access',url});
 });
 it.each(['https://evil.invalid/?code='+code,'https://www.njilamaps.com/?to='+code+'&grant=secret','https://app.afroloc.ao/?code='+code+'#acesso=secret','https://www.njilamaps.com/?to=A&to=B'])('rejects mixed or untrusted cards',value=>expect(readCardReference(value)).toBeNull());
 it('does not manufacture details or equate generation with issuance',()=>{
  const lines=addressCardLines({code,status:'Revisão local pendente'});
  expect(lines.find(l=>l.label==='Província')?.value).toBe('Não indicado');
  expect(lines.find(l=>l.label==='Emissão do endereço')?.value).toBe('Por confirmar');
  expect(lines.find(l=>l.label==='Estado do registo')?.value).toBe('Revisão local pendente');
 });
});
