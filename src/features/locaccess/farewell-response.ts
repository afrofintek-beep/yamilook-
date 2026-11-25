export type Recipient={batch:string;id:string;username:string;message:string;date:string};
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
export function parseFarewellResponse(value:unknown,action:string):{batch:string|null;pending:Recipient[]}{
 const invalid=()=>new Error('Resposta inválida do serviço de recordações. Tenta novamente.');
 if(!value||typeof value!=='object'||Array.isArray(value))throw invalid();
 const {batch,pending}=value as Record<string,unknown>;
 if(!(batch===null||uuid(batch))||(action==='close'&&!uuid(batch))||!Array.isArray(pending))throw invalid();
 const rows:Recipient[]=pending.map(row=>{
  if(!row||typeof row!=='object'||!uuid(row.batch)||!uuid(row.id)||!uuid(row.message)||typeof row.username!=='string'||!row.username.trim()||typeof row.date!=='string'||!Number.isFinite(Date.parse(row.date)))throw invalid();
  return {batch:row.batch,id:row.id,username:row.username,message:row.message,date:row.date};
 });
 return {batch,pending:rows};
}
