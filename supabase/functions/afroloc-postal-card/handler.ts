export type PostalContext={owner:string;code:string;province:string|null;municipality:string|null};
export type PostalBox={station:string;box_number:string};
export type PostalResult={status:'ready';kind:'linked'|'example';reference:string}|{status:'unavailable'};
export interface PostalDeps {
 authenticate(token:string):Promise<string|null>;
 context(token:string,source:string,code:string):Promise<PostalContext|null>;
 linkedBox(context:PostalContext):Promise<PostalBox|null>;
 station(context:PostalContext):Promise<string|null>;
}
const origins=new Set(['https://www.yamilook.com','https://yamilook.com','https://afroloc.ao','https://www.afroloc.ao']);
export function postalHandler(deps:PostalDeps){return async(req:Request)=>{
 const origin=req.headers.get('origin')||'';
 const headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin',...(origins.has(origin)?{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'}:{})};
 const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
 if(origin&&!origins.has(origin))return reply({error:'origin'},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return reply({error:'method'},405);
 const bearer=req.headers.get('authorization');if(!bearer?.startsWith('Bearer '))return reply({error:'session'},401);
 try{
  const token=bearer.slice(7),uid=await deps.authenticate(token);if(!uid)return reply({error:'session'},401);
  const raw=await req.text();if(raw.length>1024)return reply({error:'size'},413);
  let input;try{input=JSON.parse(raw)}catch{return reply({error:'input'},400)}
  if(typeof input?.source!=='string'||input.source.length>64||typeof input?.code!=='string'||input.code.length>160)return reply({error:'input'},400);
  const context=await deps.context(token,input.source,input.code);
  if(!context||context.owner!==uid||context.code!==input.code)return reply({error:'address'},403);
  const linked=await deps.linkedBox(context);
  if(linked&&/^\d{7}$/.test(linked.station)&&/^\d{5}$/.test(linked.box_number))return reply({status:'ready',kind:'linked',reference:`${linked.station}-${linked.box_number}`} satisfies PostalResult);
  const station=await deps.station(context);
  if(!station||!/^\d{7}$/.test(station))return reply({status:'unavailable'} satisfies PostalResult);
  // Existing AFROLOC standard range starts at 10000. This is a fixed example,
  // not a reservation, allocation, counter increment or unique mailbox identifier.
  return reply({status:'ready',kind:'example',reference:`${station}-10000`} satisfies PostalResult);
 }catch{return reply({error:'unavailable'},503)}
};}
