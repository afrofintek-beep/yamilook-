export type BridgeDeps={
 enabled:()=>boolean;
 authenticate:(req:Request)=>Promise<string>;
 eligible:(req:Request,subject:string)=>Promise<boolean>;
 redeem:(challenge:string,subject:string)=>Promise<boolean>;
};
const reply=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{"content-type":"application/json","cache-control":"no-store","access-control-allow-origin":"https://www.yamilook.com","access-control-allow-headers":"authorization,apikey,content-type,x-client-info","access-control-allow-methods":"POST, OPTIONS","vary":"Origin"}});
export function createBridge(deps:BridgeDeps){
 return async(req:Request)=>{
  if(req.method==="OPTIONS")return reply({});
  if(req.method!=="POST")return reply({ok:false},405);
  if(!deps.enabled())return reply({ok:false,reason:"integration_pending"},503);
  try{
   const subject=await deps.authenticate(req);
   if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(subject))return reply({ok:false},401);
   const reader=req.body?.getReader();if(!reader)return reply({ok:false},400);
   let size=0;const chunks:Uint8Array[]=[];
   while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>1024){await reader.cancel();return reply({ok:false},400)}chunks.push(value)}
   const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}
   const input=JSON.parse(new TextDecoder().decode(bytes));
   if(input?.action!=="confirm"||input.consent!==true||typeof input.challenge!=="string"||! /^[a-f0-9]{64}$/.test(input.challenge)||Object.keys(input).some(k=>!["action","consent","challenge"].includes(k)))return reply({ok:false,reason:"invalid_request"},400);
   if(!await deps.eligible(req,subject))return reply({ok:false,reason:"verification_required"},403);
   const linked=await deps.redeem(input.challenge,subject);
   return linked?reply({ok:true,linked:true}):reply({ok:false,reason:"association_unavailable"},409);
  }catch{return reply({ok:false,reason:"association_unavailable"},403)}
 };
}
