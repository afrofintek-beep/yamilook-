import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { captureAppInstallPrompt, clearAppInstallPrompt, getAppInstallPrompt, isAppMode, subscribeAppInstall } from '@/lib/app-install';
import PaposBrand from './PaposBrand';
export default function PaposInstall() {
  const { t } = useTranslation();
  const [prompt, setPrompt] = useState(getAppInstallPrompt);
  const [standalone, setStandalone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  useEffect(() => {
    captureAppInstallPrompt(); setStandalone(isAppMode());
    return subscribeAppInstall(() => setPrompt(getAppInstallPrompt()));
  }, []);
  const install = async () => {
    if (!prompt || busy) return;
    setBusy(true);
    try {
      await prompt.prompt(); const choice = await prompt.userChoice;
      setStatus(choice.outcome === 'accepted' ? 'kosolola.installAccepted' : 'kosolola.installCancelled');
    } catch { setStatus('kosolola.installMenu'); }
    finally { clearAppInstallPrompt(); setBusy(false); }
  };
  return <main className="min-h-screen-safe safe-top safe-bottom flex flex-col items-center justify-center p-6 bg-background">
    <div className="w-full max-w-sm space-y-6"><PaposBrand /><h1 className="text-2xl font-bold">{standalone ? t('kosolola.installAppMode') : t('kosolola.installTitle')}</h1>
      <p className="text-muted-foreground">{t('kosolola.installDescription')}</p>
      {!standalone && <>{prompt && <Button className="w-full h-auto min-h-11 whitespace-normal" disabled={busy} onClick={install}>{t('kosolola.installAction')}</Button>}
        <div className="rounded-2xl border p-4 space-y-3 text-sm"><p>{t('kosolola.installIos')}</p><p>{t('kosolola.installAndroid')}</p><p>{t('kosolola.installConfirmName')}</p></div></>}
      <p role="status" className="text-sm text-muted-foreground">{status && t(status)}</p>
      <Button asChild variant="outline" className="w-full h-auto min-h-11 whitespace-normal"><Link to="/papos">{standalone ? t('kosolola.installOpenChats') : t('kosolola.installContinue')}</Link></Button>
      <p className="text-xs text-muted-foreground">{t('kosolola.installAccountNotice')}</p>
    </div></main>;
}
