import { renderDiagnostic, readRenderDiagnostic } from '@/lib/render-diagnostic';
import { Component, type ReactNode, type ErrorInfo } from 'react';
import { Button } from '@/components/ui/button';
import { recoverApplicationAssets } from '@/lib/app-assets';
import { logger } from '@/lib/logger';

const recoveryKey = 'papos-chunk-recovery-at';
export function isPaposAssetError(error: Error) {
  return /loading chunk|dynamically imported module|importing a module script failed|failed to fetch dynamically/i.test(error.message);
}
export class PaposBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    renderDiagnostic(error, info.componentStack);
    logger.error('Page rendering failed', 'PaposBoundary', { name: error.name, message: error.message, componentStack: info.componentStack });
    if (!isPaposAssetError(error)) return;
    // Recover only stale assets, at most once per 30 seconds. Never clear auth.
    try {
      const last = Number(sessionStorage.getItem(recoveryKey) || 0);
      if (Date.now() - last < 30_000) return;
      sessionStorage.setItem(recoveryKey, String(Date.now()));
      void this.reload();
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
      <p>{assets ? 'Não foi possível carregar os ficheiros da aplicação. Tenta recarregar.' : 'A interface encontrou um erro. Tenta abrir a página novamente.'} A tua conta mantém-se guardada.</p>
      <details><summary>Diagnóstico técnico</summary><pre className="whitespace-pre-wrap break-all text-xs">{readRenderDiagnostic()}</pre></details>
      <Button onClick={() => this.setState({ error: null })}>Tentar novamente</Button>
      <Button variant="outline" onClick={() => void this.reload()}>Recarregar KOSOLOLA</Button>
    </main>;
  }
}
