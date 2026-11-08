import { execFileSync } from 'node:child_process';
if (!process.env.VERCEL_URL) throw new Error('VERCEL_URL is required for an isolated callback');
const env = {...process.env, VITE_SUPABASE_URL:'https://pufcziszxmymoaodslii.supabase.co',VITE_SUPABASE_PUBLISHABLE_KEY:"sb_publishable_ODrRkSR9sIoRcoz8uDEpXw_flQImKJR",VITE_YAMILOOK_PUBLIC_ORIGIN:'https://'+process.env.VERCEL_URL};
execFileSync('npm',['ci','--ignore-scripts','--no-audit','--no-fund'],{cwd:'..',env,stdio:'inherit'});
execFileSync('npm',['run','build','--','--outDir','staging-invitations/dist'],{cwd:'..',env,stdio:'inherit'});
