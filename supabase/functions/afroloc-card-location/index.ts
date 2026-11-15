import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1';
import { createHandler, type LocationRecord } from './handler.ts';
const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false }
});
Deno.serve(createHandler(async reference => {
  // Exact-code public lookup was approved for Yamilook cards. Keep profiles
  // protected by RLS: only this small location projection leaves the server.
  const {data:profile,error} = await db.from('profiles').select('latitude,longitude')
    .eq('afroloc_code',reference).eq('account_status','active').neq('afroloc_certification_status','rejected')
    .order('id').limit(1).maybeSingle();
  if (error) return null;
  if (profile) return profile as LocationRecord;
  const {data:address,error:addressError} = await db.from('afroloc_experience_addresses')
    .select('latitude,longitude,status,expires_at,owner_id').eq('code',reference)
    .in('status',['pending','approved']).gt('expires_at',new Date().toISOString()).order('id').limit(1).maybeSingle();
  if (addressError || !address) return null;
  const {data:owner,error:ownerError} = await db.from('profiles').select('id').eq('id',address.owner_id).eq('account_status','active').maybeSingle();
  return !ownerError && owner ? address as LocationRecord : null;
}));
