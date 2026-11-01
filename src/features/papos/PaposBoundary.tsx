import { renderDiagnostic } from '@/lib/render-diagnostic';
import { Component, type ReactNode, type ErrorInfo } from 'react';
import { Button } from '@/components/ui/button';
import { recoverApplicationAssets } from '@/lib/app-assets';
import { logger } from '@/lib/logger';
import { isApplicationAssetError } from '@/lib/asset-load-error';
import { deferCallUpdate } from '@/lib/call-update-guard';

const recoveryKey = 'papos-chunk-recovery-at';
export function isPaposAssetError(error: Error) {
  return isApplicationAssetError(error);
}
export class PaposBoundary extends Component<{ children: ReactNode }, { error: Error | null; diagnostic: string }> {
  state: { error: Error | null; diagnostic: string } = { error: null, diagnostic: '' };
  static getDerivedStateFromError(error: Error) { return { error, diagnostic: '' }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ diagnostic: JSON.stringify(renderDiagnostic(error, info.componentStack)) });
    logger.error('Page rendering failed', 'PaposBoundary', { name: error.name, message: error.message, componentStack: info.componentStack });
    if (!isPaposAssetError(error)) return;
    // Recover only stale assets, at most once per 30 seconds. Never clear auth.
    try {
      const last = Number(sessionStorage.getItem(recoveryKey) || 0);
      if (Date.now() - last < 30_000) return;
      deferCallUpdate(() => {
        // Recheck after a call: multiple boundaries can observe the same failure.
        try {
          if (Date.now() - Number(sessionStorage.getItem(recoveryKey) || 0) < 30_000) return;
          sessionStorage.setItem(recoveryKey, String(Date.now()));
          void this.reload();
        } catch { /* Manual recovery remains available when storage is blocked. */ }
      });
    } catch { /* Storage restrictions must not cause another render failure. */ }
  }
  reload = async () => {
    try { await recoverApplicationAssets('/papos-app/'); }
    catch { /* Still allow a normal reload when SW/cache APIs are unavailable. */ }
    window.location.reload();
  };
  render() {
    const error = this.state.error;
    if (!error) return this.props.children;
    const assets = isPaposAssetError(error);
    return <main className="min-h-screen-safe safe-top p-6 space-y-4">
      <h1 className="text-xl font-bold">Não foi possível abrir esta página</h1>
      <p>{assets ? 'Não foi possível carregar os ficheiros da aplicação. Se houver uma chamada em curso, a recuperação aguarda o seu fim.' : 'A interface encontrou um erro. Tenta abrir a página novamente.'} A tua conta mantém-se guardada.</p>
      <details><summary>Diagnóstico técnico</summary><pre className="whitespace-pre-wrap break-all text-xs">{this.state.diagnostic}</pre></details>
      <Button onClick={() => this.setState({ error: null, diagnostic: '' })}>Tentar novamente</Button>
      <Button variant="outline" onClick={() => deferCallUpdate(() => void this.reload())}>Recarregar KOSOLOLA</Button>
    </main>;
  }
}
