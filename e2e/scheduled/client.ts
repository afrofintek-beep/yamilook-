let items:unknown[]=[];
export const supabase={rpc:async(_name:string,args:{p_action:string;p_payload:Record<string,unknown>})=>{
 if(args.p_action==='list')return {data:items,error:null};
 if(args.p_action==='create'){
  if(args.p_payload.title==='Falhar')return {data:null,error:{message:'contact_required'}};
  const call={...args.p_payload,id:'fixture-call',organizer_id:'test-organizer',revision:1,status:'scheduled'};items.push(call);return {data:{id:'fixture-call'},error:null};
 }
 return {data:[],error:null};
}};
