import { createClient } from "npm:@supabase/supabase-js@2.90.1";
export const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
export const json = (body: unknown, status=200) => new Response(JSON.stringify(body), {status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info,x-account-link-key'}});
export const preflight = (req: Request) => req.method==='OPTIONS' ? json({}) : req.method!=='POST' ? json({ok:false,reason:'method_not_allowed'},405) : null;
export async function body(req: Request) {
 const raw=await req.text(); if(raw.length>8192) throw new Error('invalid_request');
 const value=JSON.parse(raw); if(!value || typeof value!=='object' || Array.isArray(value)) throw new Error('invalid_request'); return value;
}
export function admin() {return createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});}
export async function actor(req: Request) {
 const auth=req.headers.get('Authorization'); if(!auth?.startsWith('Bearer ')) throw new Error('unauthorized');
 const client=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data,error}=await client.auth.getUser(auth.slice(7)); if(error || !data.user || data.user.is_anonymous) throw new Error('unauthorized'); return data.user.id;
}
export async function hash(value:string) {return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(x=>x.toString(16).padStart(2,'0')).join('');}
export async function secretMatches(given:string|null,expected:string|undefined) {return !!given && !!expected && expected.length>=32 && await hash(given)===await hash(expected);}
export async function rpc(client: ReturnType<typeof admin>,name:string,args:Record<string,unknown>) {const {data,error}=await client.rpc(name,args);if(error) throw new Error('unavailable');return data;}
export function failure(error:unknown) {return json({ok:false,reason:error instanceof Error && error.message==='unauthorized'?'unauthorized':'unavailable'},error instanceof Error && error.message==='unauthorized'?401:503);}
