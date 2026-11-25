import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useIntegrationAccess } from '@/features/integration-access/useIntegrationAccess';
import { accessDashboardCopy } from '@/features/access-dashboard/copy';
import { useUiLocale } from '@/i18n/ui-copy';
import { useAppSurface } from '@/lib/app-surface';
import { Button } from '@/components/ui/button';

export function useWalletAccess() {
  const access = useIntegrationAccess();
  const confirmed = !access.loading && !access.error;
  return { allowed: confirmed && access.wallet === true, admin: confirmed && access.admin === true,
    loading: access.loading, error: access.error, retry: access.retry };
}
export function WalletAccessGate({ children, silent = false }: { children: ReactNode; silent?: boolean }) {
  const access = useWalletAccess();
  const copy = accessDashboardCopy(useUiLocale());
  const surface = useAppSurface();
  if (access.allowed) return <>{children}</>;
  if (silent) return null;
  return <main className="min-h-screen bg-background p-6 safe-top space-y-4">
    <h1 className="text-xl font-semibold">{copy.walletTitle}</h1>
    <p>{access.loading ? copy.checkingAccess : access.error ? copy.accessUnavailable : copy.accessDenied}</p>
    {!!access.error && <Button onClick={() => void access.retry()}>{copy.retry}</Button>}
    <Button asChild variant="outline"><Link to={surface === 'papos' ? '/papos' : '/feed'}>{surface === 'papos' ? copy.backKosolola : copy.backYamilook}</Link></Button>
  </main>;
}
export function WalletAccessManager() {
  const access = useWalletAccess();
  const surface = useAppSurface();
  const copy = accessDashboardCopy(useUiLocale());
  if (!access.admin) return null;
  return <section className="rounded-xl border p-4 space-y-3">
    <h2 className="font-semibold">{copy.manage}</h2>
    <p className="text-sm text-muted-foreground">{copy.walletManagerHint}</p>
    <Button asChild variant="outline">{surface === 'papos'
      ? <a href="https://www.yamilook.com/admin/acessos">{copy.openDashboard}</a>
      : <Link to="/admin/acessos">{copy.openDashboard}</Link>}</Button>
  </section>;
}
