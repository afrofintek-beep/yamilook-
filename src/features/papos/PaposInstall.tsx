import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { captureAppInstallPrompt, clearAppInstallPrompt, getAppInstallPrompt, isAppMode, subscribeAppInstall } from '@/lib/app-install';
import PaposBrand from './PaposBrand';
export default function PaposInstall() {
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
      setStatus(choice.outcome === 'accepted' ? 'Pedido aceite. Conclui a instalação e abre o ícone KOSOLOLA.' : 'Instalação cancelada. Podes tentar novamente pelo menu do navegador.');
    } catch { setStatus('Usa o menu do navegador para adicionar a KOSOLOLA ao ecrã principal.'); }
    finally { clearAppInstallPrompt(); setBusy(false); }
  };
  return <main className="min-h-screen-safe safe-top safe-bottom flex flex-col items-center justify-center p-6 bg-background">
    <div className="w-full max-w-sm space-y-6"><PaposBrand /><h1 className="text-2xl font-bold">{standalone ? 'KOSOLOLA em modo aplicação' : 'Instalar a KOSOLOLA'}</h1>
      <p className="text-muted-foreground">Um ícone próprio para as tuas conversas, contactos e chamadas. Usa a mesma conta Yamilook.</p>
      {!standalone && <>{prompt && <Button className="w-full" disabled={busy} onClick={install}>Instalar KOSOLOLA</Button>}
        <div className="rounded-2xl border p-4 space-y-3 text-sm"><p><strong>No iPhone:</strong> abre esta página no Safari, toca em Partilhar e escolhe Adicionar ao ecrã principal. Mantém Abrir como aplicação web activo.</p>
        <p><strong>No Android:</strong> no menu do Chrome, escolhe Instalar aplicação ou Adicionar ao ecrã principal.</p><p>Confirma o nome <strong>KOSOLOLA</strong> e abre o novo ícone.</p></div></>}
      <p role="status" className="text-sm text-muted-foreground">{status}</p>
      <Button asChild variant="outline" className="w-full"><Link to="/papos">{standalone ? 'Abrir conversas' : 'Continuar no navegador'}</Link></Button>
      <p className="text-xs text-muted-foreground">Uma instalação nova pode pedir que entres novamente. A conta e o histórico são os mesmos.</p>
    </div></main>;
}
