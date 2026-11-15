/** AFROLOC card transport v1. Does not certify or decode a location. */
export const CARD_VERSION = 1 as const;
export type CardLine={label:string;value:string;group?:'identity'|'location'|'status'|'footer'};
export function addressLink(code:string):string {
 const value=code.trim();
 if(!value || value.length>160 || /[\p{Cc}\p{Cf}]/u.test(value))return '';
 return 'https://www.njilamaps.com/?to='+encodeURIComponent(value);
}
export type CardReference={kind:'address';code:string}|{kind:'access';url:string};
/** Legacy code and approved links only; a private access is never converted into a public code. */
export function readCardReference(raw:string):CardReference|null {
 if(raw.length>2048 || /[\p{Cc}\p{Cf}]/u.test(raw))return null;
 let value=raw.trim().replace(/[–—−]/g,'-');
 if(/^https:\/\//i.test(value)){
  try{
   const u=new URL(value);
   if(u.port||u.username||u.password)return null;
   const afro=['app.afroloc.ao','afroloc.ao','www.afroloc.ao'].includes(u.hostname);
   const njila=['www.njilamaps.com','njilamaps.com'].includes(u.hostname);
   if(!afro&&!njila)return null;
   if(u.pathname==='/experiencia/'&&u.hostname==='app.afroloc.ao'&&!u.search){
    const hash=new URLSearchParams(u.hash.slice(1));
    if([...hash.keys()].join(',')==='acesso'&&/^[a-f0-9]{64}$/.test(hash.get('acesso')||''))return {kind:'access',url:u.href};
   }
   if(u.hash){
    if(!afro||!u.hash.startsWith('#/publicLookup?')||u.search)return null;
    const p=new URLSearchParams(u.hash.split('?')[1]);
    if([...p.keys()].join(',')!=='code')return null;
    value=p.get('code')||'';
   }else if(afro&&/^\/a\/[^/]+\/?$/.test(u.pathname)&&!u.search){
    value=decodeURIComponent(u.pathname.split('/')[2]);
   }else{
    const keys=[...u.searchParams.keys()];
    if(keys.length!==1||!['code','afroloc',...(njila?['to']:[])].includes(keys[0]))return null;
    if(njila&&u.pathname!=='/')return null;
    value=u.searchParams.get(keys[0])||'';
   }
  }catch{return null;}
 }
 value=value.replace(/^AFROLOC\s*:\s*/i,'').trim().toUpperCase();
 return value.length<=160&&/^[A-Z]{2}(?:-[A-Z0-9]+){2,}$/.test(value)?{kind:'address',code:value}:null;
}
export function cardQrValue(address:{code:string}){return addressLink(address.code);}
