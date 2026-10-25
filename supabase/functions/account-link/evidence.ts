export function validEvidence(value:unknown, expected:{subject:string;code:string;linkId:string},now:number):boolean {
 if(!value || typeof value!=='object')return false;
 const e=value as Record<string,unknown>;
 const time=(v:unknown)=>typeof v==='string'?Date.parse(v):NaN;
 return e.ok===true&&e.certified===true&&e.issuer==='afroloc.ao'&&e.audience==='yamilook'&&e.subject===expected.subject&&e.code===expected.code&&e.link_id===expected.linkId
 &&typeof e.evidence_id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(e.evidence_id)
 &&time(e.issued_at)<=now&&time(e.expires_at)>now&&time(e.checked_at)<=now+5000&&time(e.checked_at)>=now-30000;
}
