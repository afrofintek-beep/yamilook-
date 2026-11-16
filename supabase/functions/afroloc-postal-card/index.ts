import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.90.1';
import {postalHandler,type PostalContext} from './handler.ts';
const yUrl='https://rfayqekonkovfbkwjjum.supabase.co';
const yKey="sb_publishable_hUIq9uImYdWOBcjEAawOMQ_h50Fxw6k"; // Public publishable key. Never a service-role key.
const yClient=(token:string)=>createClient(yUrl,yKey,{global:{headers:{Authorization:'Bearer '+token}},auth:{persistSession:false,autoRefreshToken:false}});
const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
function checked<T>(result:{data:T;error:unknown}):T{if(result.error)throw new Error('lookup');return result.data}
Deno.serve(postalHandler({
 async authenticate(token){const {data,error}=await yClient(token).auth.getUser(token);return !error&&data.user&&!data.user.is_anonymous?data.user.id:null},
 async context(token,source,code){return checked(await yClient(token).rpc('my_postal_card_context',{p_source:source,p_code:code}))},
 async linkedBox(context:PostalContext){
  const now=new Date().toISOString();
  const links=checked(await db.from('partner_account_links').select('subject,certificate_id').eq('partner','yamilook').eq('partner_subject',context.owner).eq('code',context.code).is('revoked_at',null).not('consent_at','is',null).not('consumed_at','is',null).gt('expires_at',now).limit(2));
  if(links?.length!==1)return null;
  const link=links[0];
  const cert=checked(await db.from('partner_certificates').select('record_id,record_updated_at').eq('id',link.certificate_id).eq('subject',link.subject).eq('code',context.code).is('revoked_at',null).gt('expires_at',now).maybeSingle());
  if(!cert)return null;
  const record=checked(await db.from('afroloc_records').select('id').eq('id',cert.record_id).eq('user_id',link.subject).eq('code',context.code).eq('updated_at',cert.record_updated_at).maybeSingle());
  if(!record)return null;
  const boxes=checked(await db.from('postal_boxes').select('station,box_number').eq('owner_id',link.subject).eq('entity_id',record.id).limit(2));
  if(boxes?.length!==1)return null;
  const station=checked(await db.from('postal_stations').select('station').eq('station',boxes[0].station).eq('status','active').maybeSingle());
  return station?boxes[0]:null;
 },
 async station(context){
  if(!context.province||!context.municipality)return null;
  const rows=checked(await db.from('postal_stations').select('station').eq('province_code',context.province).eq('municipio_code',context.municipality).eq('status','active').limit(2));
  return rows?.length===1?rows[0].station:null;
 }
}));

