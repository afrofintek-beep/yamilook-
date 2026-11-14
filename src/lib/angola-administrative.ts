import snapshot from '@/data/angola-administrative.json';
export interface AdministrativeAddress { province: string; municipality: string; commune: string; complement?: string }
export const divisions = snapshot.divisions;
export const catalogVersion = snapshot.version;
export const emptyAdministrativeAddress: AdministrativeAddress = {province:'',municipality:'',commune:''};
export const childrenOf = (parent: string, level: number) => divisions.filter(d=>d.level===level && (level===1 || d.parent_code===parent));
export function validAdministrativeAddress(a?: AdministrativeAddress) {
 if(!a)return false;
 const p=divisions.find(d=>d.code===a.province&&d.level===1);
 const m=divisions.find(d=>d.code===a.municipality&&d.level===2&&d.parent_code===p?.code);
 if(!p||!m)return false;
 const communes=childrenOf(m.code,3);
 return communes.length ? communes.some(d=>d.code===a.commune) : !a.commune;
}
/** Old three-character segments are not unique: resolve only a single full hierarchy. */
export function administrativeFromCode(code: string): AdministrativeAddress | null {
 const parts=code.trim().toUpperCase().split('-');
 if(parts.length!==8||parts[0]!=='AO'||!/^G(10|25|50|100)$/.test(parts[5]))return null;
 const segment=(s:string)=>s.split('-').at(-1)!.slice(0,3);
 const matches:AdministrativeAddress[]=[];
 for(const p of childrenOf('',1).filter(p=>segment(p.code)===parts[1]))
 for(const m of childrenOf(p.code,2).filter(m=>segment(m.code)===parts[2])){
  const cs=childrenOf(m.code,3);
  if(!cs.length&&parts[3]==='000')matches.push({province:p.code,municipality:m.code,commune:''});
  for(const c of cs.filter(c=>segment(c.code)===parts[3]))matches.push({province:p.code,municipality:m.code,commune:c.code});
 }
 return matches.length===1?matches[0]:null;
}
export function administrativeCodeMismatch(code:string,a?:AdministrativeAddress){
 if(!a||!validAdministrativeAddress(a)||!/^AO-(?:[A-Z0-9]+-){4}G\d+-[A-Z0-9]+-[A-Z0-9]+$/.test(code))return false;
 const segment=(s:string)=>s.split('-').at(-1)!.slice(0,3);
 return !code.startsWith(`AO-${segment(a.province)}-${segment(a.municipality)}-${a.commune?segment(a.commune):'000'}-`);
}
