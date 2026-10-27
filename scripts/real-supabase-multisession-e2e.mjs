// Staging-only, disposable users, no user accounts or production credentials.
// CI does not print passwords, JWTs, refresh tokens or publishable keys.
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const url = process.env.TEST_SUPABASE_URL;
const key = process.env.TEST_SUPABASE_PUBLISHABLE_KEY;
if (!url?.startsWith('https://gknrgphlirztezkavrbd.supabase.co') || !key?.startsWith('sb_publishable_')) {
  throw new Error('Refusing to run outside the approved disposable staging project.');
}
const options = {auth: {persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const appA = createClient(url,key,options);
const appB = createClient(url,key,options);
const email = `ci-multi-${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT}@example.test`;
const password = randomBytes(36).toString('base64url') + '!Aa9';
const assert = (cond, name) => {if(!cond)throw new Error(name);console.log('PASS: ' + name);};
const rpc = async (client, name, args) => {
  const {data,error} = await client.rpc(name,args);
  if(error)throw new Error(`${name}: ${error.code||''} ${error.message}`);
  return data;
};
const sid = session => {
  const claims = JSON.parse(Buffer.from(session.access_token.split('.')[1],'base64url').toString('utf8'));
  return claims.session_id;
};
const sleep = ms => new Promise(resolve=>setTimeout(resolve,ms));
const run = async () => {
  const signup = await appA.auth.signUp({email,password});
  if(signup.error)throw new Error('Staging signup failed: '+signup.error.message);
  assert(!!signup.data.user,'GoTrue created test account');
  console.log('TEMPORARY_TEST_ACCOUNT_EMAIL:',email);
  console.log('The fixture requires email_confirmed_at set only on the staging database.');
  let signedA=null;
  for(let n=0;n<48;n++){
    const result = await appA.auth.signInWithPassword({email,password});
    if(!result.error && result.data?.session){signedA=result.data.session;break;}
    if(result.error && !/email not confirmed|invalid login credentials|email_not_confirmed/i.test(result.error.message)){
      throw new Error('Unexpected GoTrue login error: '+result.error.message);
    }
    await sleep(5000);
  }
  assert(!!signedA,'First real GoTrue sign-in after confirmation');
  const idA=sid(signedA);
  assert(!!idA,'First session carries signed session_id claim');
  await rpc(appA,'account_register_session',{p_label:'E2E iOS Safari',p_platform:'iOS',p_browser:'Safari',p_surface:'kosolola'});
  const {data:second,error:secondErr}=await appB.auth.signInWithPassword({email,password});
  if(secondErr)throw secondErr;
  assert(!!second.session && sid(second.session)!==idA,'Second independent real session issued');
  const idB=sid(second.session);
  await rpc(appB,'account_register_session',{p_label:'E2E Windows Chrome',p_platform:'Windows',p_browser:'Chrome',p_surface:'yamilook'});
  const listA=await rpc(appA,'account_list_sessions');
  assert(listA.length===2 && listA.find(s=>s.id===idA)?.is_current && !listA.find(s=>s.id===idB)?.is_current,'Both sessions listed with correct current marker');
  const notices=await rpc(appA,'account_list_login_alerts');
  assert(notices.some(a=>a.device_label==='E2E Windows Chrome' && a.unread===true),'Previously signed-in session sees new access alert');
  const forbidden=await appB.rpc('account_revoke_session',{p_session_id:idB});
  assert(!!forbidden.error,'Current session cannot revoke itself remotely');
  await rpc(appB,'account_revoke_session',{p_session_id:idA});
  const listB=await rpc(appB,'account_list_sessions');
  assert(listB.length===1 && listB[0].id===idB,'Selective revocation preserves second session');
  const revoked=await appA.rpc('account_current_session_id');
  assert(!!revoked.error && revoked.error.code==='28000','Revoked session cannot use sensitive database RPC');
  const relog=await appA.auth.signInWithPassword({email,password});
  if(relog.error)throw relog.error;
  assert(sid(relog.data.session)!==idA,'Previously revoked device can sign in again');
  await rpc(appA,'account_register_session',{p_label:'E2E iOS Safari',p_platform:'iOS',p_browser:'Safari',p_surface:'kosolola'});
  const listB2=await rpc(appB,'account_list_sessions');
  assert(listB2.length===2 && listB2.some(s=>s.id===idB),'Re-login does not terminate other authorized sessions');
  const signoutA=await appA.auth.signOut({scope:'local'});
  if(signoutA.error)throw signoutA.error;
  const remaining=await rpc(appB,'account_list_sessions');
  assert(remaining.length===1 && remaining[0].id===idB,'Local signout does not terminate other device');
  const signoutB=await appB.auth.signOut({scope:'local'});
  if(signoutB.error)throw signoutB.error;
  console.log('E2E_GO_TRUE_MULTIDEVICE_SUCCESS');
};
await run().catch(e=>{console.error('E2E FAILED:',e.message);process.exitCode=1});
