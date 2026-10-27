import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { runDueAutomaticBackup } from '@/lib/account-backup';

/** Run only in foreground after app settles. iOS PWAs cannot guarantee background cron. */
export function AutomaticAccountBackup() {
  const {user}=useAuth();
  useEffect(()=>{
    if(!user?.id) return;
    const uid=user.id;
    const start=window.setTimeout(()=>{if(!document.hidden)void runDueAutomaticBackup(uid);},60000);
    const interval=window.setInterval(()=>{if(!document.hidden)void runDueAutomaticBackup(uid);},60*60*1000);
    const onVisible=()=>{if(!document.hidden)void runDueAutomaticBackup(uid);};
    document.addEventListener('visibilitychange',onVisible);
    return ()=>{window.clearTimeout(start);window.clearInterval(interval);document.removeEventListener('visibilitychange',onVisible);};
  },[user?.id]);
  return null;
}
