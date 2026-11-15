import {addressLink} from '../../shared/afroloc-card/protocol';
import { administrativeFromCode, divisions, validAdministrativeAddress, type AdministrativeAddress } from '@/lib/angola-administrative';
export interface CardProfile { id:string; display_name:string; username:string; avatar_url:string|null; phone_number:string|null; email:string|null; country_code:string|null; city:string|null; neighborhood:string|null; afroloc_code:string|null; afroloc_certification_status:string }
export interface SavedAddress {id:string;label:string;code:string;neighborhood:string;status:string;created_at:string;expires_at:string}
export interface CardAddress {id:string;label:string;code:string;country:string;city?:string;neighborhood?:string;administrative:AdministrativeAddress|null;status:string;expiresAt?:string;temporary:boolean}
export function cardAddresses(profile:CardProfile, administrative:AdministrativeAddress|null, saved:SavedAddress[], now=Date.now()):CardAddress[]{
 const addresses:CardAddress[]=[];
 if(profile.afroloc_code)addresses.push({id:'residence',label:'',code:profile.afroloc_code,country:profile.country_code||'',city:profile.city||'',neighborhood:profile.neighborhood||'',administrative:administrative&&validAdministrativeAddress(administrative)?administrative:administrativeFromCode(profile.afroloc_code),status:profile.afroloc_certification_status,temporary:false});
 for(const a of [...saved].sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at))){
  if(!a.code||!['pending','approved'].includes(a.status)||!(Date.parse(a.expires_at)>now))continue;
  addresses.push({id:a.id,label:a.label,code:a.code,country:'AO',neighborhood:a.neighborhood,administrative:administrativeFromCode(a.code),status:a.status,expiresAt:a.expires_at,temporary:true});
 }
 return addresses;
}
export const divisionName=(code?:string)=>divisions.find(d=>d.code===code)?.name||'';
export type CardLine={label:string;value:string;group?:'identity'|'location'|'status'|'footer'};
export function cardText(name:string,code:string,lines:CardLine[],notice:string){return ['AFROLOC · Yamilook',name,code,...lines.map(l=>`${l.label}: ${l.value}`),notice].filter(Boolean).join('\n');}
/** Public address link only: no identity fields, session or location grant. */
export function cardQrValue(address:Pick<CardAddress,'code'>){return addressLink(address.code);}
