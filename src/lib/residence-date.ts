/** PostgreSQL OF may emit +00; Safari requires +00:00 for ISO timestamps. */
export function residenceChangeDate(value:string|undefined,locale:string):string|null {
 if(!value)return null;
 const date=new Date(value.replace(/([+-]\d{2})$/,'$1:00'));
 if(!Number.isFinite(date.getTime()))return null;
 return date.toLocaleDateString(locale==='pt-banda'?'pt':locale,{timeZone:'Africa/Luanda',day:'2-digit',month:'long',year:'numeric'});
}
