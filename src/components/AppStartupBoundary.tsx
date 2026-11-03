import { Component, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { recoverApplicationAssets } from '@/lib/app-assets';
import { deferCallUpdate } from '@/lib/call-update-guard';

// This fallback must not depend on authentication, translations or lazy modules.
export function AppLoadingScreen({ failed = false }: { failed?: boolean }) {
  const [slow, setSlow] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const requested = useRef(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), 15000);
    return () => window.clearTimeout(timer);
  }, []);

  const recover = () => {
    if (requested.current) return;
    requested.current = true;
    setRecovering(true);
    // Never interrupt an active call or clear sessions, drafts or messages.
    deferCallUpdate(() => {
      void Promise.race([
        recoverApplicationAssets('/').catch(() => undefined),
        new Promise<void>(resolve => window.setTimeout(resolve, 4000)),
      ]).then(() => {
        const url = new URL(window.location.href);
        url.searchParams.set('app-recovery', String(Date.now()));
        deferCallUpdate(() => window.location.replace(url.href));
      });
    });
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground px-6 py-10 gap-4 text-center">
      <h1 className="text-2xl font-semibold">YAMILOOK</h1>
      <p role={failed ? 'alert' : 'status'}>
        {recovering ? 'A recuperar a Yamilook…' : failed ? 'Não foi possível abrir a Yamilook.' : 'A abrir a Yamilook…'}
      </p>
      {(slow || failed) && (
        <>
          <p className="text-sm text-muted-foreground max-w-sm">Verifica a ligação à internet e tenta novamente. A tua conta e as conversas não serão apagadas.</p>
          <button type="button" onClick={recover} disabled={recovering} className="min-h-12 rounded-xl bg-primary text-primary-foreground px-6 py-3 disabled:opacity-60">
            {recovering ? 'A recuperar…' : 'Recarregar Yamilook'}
          </button>
        </>
      )}
    </main>
  );
}

// Above every provider: lazy call services previously suspended the entire root
// before the route-level Suspense/error boundary could mount.
export class AppStartupBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) return <AppLoadingScreen failed />;
    return <Suspense fallback={<AppLoadingScreen />}>{this.props.children}</Suspense>;
  }
}
