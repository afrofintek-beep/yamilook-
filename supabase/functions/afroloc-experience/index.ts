import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.90.1';
const allowed=new Set(['https://www.yamilook.com','https://yamilook.com']);
const actions=new Set(['catalog','list','create','close','position','queue','review']);
Deno.serve(async(req:Request)=>{
 const origin=req.headers.get('origin')||'';
 const headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin',...(allowed.has(origin)?{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'}:{})};
 const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers});
 if(origin&&!allowed.has(origin))return json({error:'Origem não autorizada.'},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return json({error:'Método inválido.'},405);
 try{
  const authorization=req.headers.get('authorization');if(!authorization?.startsWith('Bearer '))return json({error:'Entre na Yamilook.'},401);
  const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data:auth,error:authError}=await db.auth.getUser(authorization.slice(7));if(authError||!auth.user||auth.user.is_anonymous)return json({error:'Volte a entrar na Yamilook.'},401);
  const {data:profile,error:profileError}=await db.from('profiles').select('country_code').eq('id',auth.user.id).single();
  if(profileError||profile?.country_code?.trim().toUpperCase()!=='AO')return json({error:'Seleccione Angola no seu perfil.'},403);
  const raw=await req.text();if(raw.length>7000)return json({error:'Pedido demasiado grande.'},413);
  const p=JSON.parse(raw);if(!actions.has(p.action)||!p.data||typeof p.data!=='object'||Array.isArray(p.data))return json({error:'Pedido inválido.'},400);
  const {data,error}=await db.rpc('afroloc_experience_action',{p_action:p.action,p_data:p.data});
  if(error)return json({error:error.code==='42501'?'Sessão ou autorização indisponível. Volte a entrar.':error.code==='P0001'?error.message:'Não foi possível concluir o pedido.'},error.code==='42501'?403:400);
  return json(data);
 }catch{return json({error:'Serviço indisponível. Tente novamente.'},503)}
});
