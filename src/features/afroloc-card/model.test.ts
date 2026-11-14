import {describe,it,expect} from 'vitest';
import {cardAddresses,cardQrValue,cardText,type CardProfile,type SavedAddress} from './model';
import {addressFromCard} from '@/lib/afroloc-card-import';
const profile:CardProfile={id:'me',display_name:'Titular',username:'titular',avatar_url:null,phone_number:'999',email:'private@example.invalid',country_code:'AO',city:'Luanda',neighborhood:'Centro',afroloc_code:'AO-LDA-ING-000-DIG-G10-35Q1-N23WC',afroloc_certification_status:'certified'};
const now=Date.parse('2026-11-14T20:00:00Z');
const saved:SavedAddress={id:'one',code:'AO-ZU-G10-ABC-DEF',label:'Outro local',neighborhood:'Bairro',status:'pending',created_at:'2026-11-14',expires_at:'2026-12-14'};
describe('current AFROLOC card',()=>{
 it('prefers the associated residence over temporary addresses',()=>{const cards=cardAddresses(profile,null,[saved],now);expect(cards[0].id).toBe('residence');expect(cards[0].code).toBe(profile.afroloc_code);expect(cards[1].id).toBe('one')});
 it('uses the newest active saved address when residence has no code',()=>{expect(cardAddresses({...profile,afroloc_code:null},null,[saved,{...saved,id:'new',created_at:'2026-11-14T18:00:00Z'}],now).map(a=>a.id)).toEqual(['new','one'])});
 it('never presents closed, rejected, expired or invalid-expiry cards as current',()=>{for(const change of [{status:'closed'},{status:'rejected'},{expires_at:'2026-11-13'},{expires_at:'invalid'}])expect(cardAddresses({...profile,afroloc_code:null},null,[{...saved,...change}],now)).toEqual([])});
 it('QR round-trips only the address and exports only selected lines',()=>{const card=cardAddresses(profile,null,[],now)[0];expect(addressFromCard(cardQrValue(card))).toBe(profile.afroloc_code);expect(cardQrValue(card)).not.toContain(profile.email!);const text=cardText(profile.display_name,card.code,[{label:'País',value:'Angola'}],'Cópia');expect(text).toContain('Angola');expect(text).not.toContain(profile.phone_number!);expect(text).not.toContain(profile.email!)});
});
