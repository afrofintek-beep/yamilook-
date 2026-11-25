import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useUiLocale } from '@/i18n/ui-copy';
import { useAuth } from '@/hooks/useAuth';
import { AccessDashboardLink } from '@/features/access-dashboard/AccessDashboardLink';
import { accessDashboardCopy } from '@/features/access-dashboard/copy';
import { adminAreaKeys, adminAreaPaths, type AdminArea } from './catalog';
import { useAdminAreas } from './useAdminAreas';

export function AdminAreaGuard({ area, children }: { area: AdminArea; children: ReactNode }) {
  const access = useAdminAreas();
  const { user } = useAuth();
  const copy = accessDashboardCopy(useUiLocale());
  if (access.allowed[area]) return <div key={`${user?.id}:${user?.last_sign_in_at}`}>{children}</div>;
  return <main className="mx-auto max-w-xl space-y-4 p-4 py-8 safe-top">
    <h1 className="text-xl font-semibold">{copy.adminAreas.labels[area]}</h1>
    <p role={access.error ? 'alert' : 'status'}>{access.loading ? copy.checking : access.error ? copy.accessUnavailable : copy.accessDenied}</p>
    {access.error && <Button onClick={() => void access.retry()}>{copy.retry}</Button>}
    <Button asChild variant="outline"><Link to="/admin/areas">{copy.adminAreas.title}</Link></Button>
  </main>;
}

export function AdminAreaLinks() {
  const access = useAdminAreas();
  const copy = accessDashboardCopy(useUiLocale());
  return <section className="space-y-3">
    <h2 className="text-xl font-semibold">{copy.adminAreas.title}</h2>
    {access.loading && <p role="status">{copy.checking}</p>}
    {access.error && <p role="alert">{copy.accessUnavailable} <Button variant="outline" onClick={() => void access.retry()}>{copy.retry}</Button></p>}
    {!access.loading && !access.error && !access.any && <p>{copy.accessDenied}</p>}
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {adminAreaKeys.filter(key => access.allowed[key]).map(key => <Link key={key} to={adminAreaPaths[key]} className="flex min-h-16 items-center rounded-xl border bg-card p-4 font-medium hover:bg-muted">{copy.adminAreas.labels[key]}</Link>)}
    </div>
  </section>;
}

export function AdminAreasLink({ external = false }: { external?: boolean }) {
  const access = useAdminAreas();
  const locale = useUiLocale();
  const copy = accessDashboardCopy(locale);
  if (!access.any) return null;
  return <Button asChild variant="outline" className="h-auto min-h-11 w-full whitespace-normal py-3">
    {external ? <a href={`https://www.yamilook.com/admin/areas?lang=${encodeURIComponent(locale)}`}>{copy.adminAreas.title}</a> : <Link to="/admin/areas">{copy.adminAreas.title}</Link>}
  </Button>;
}

export function AdminAreaPage({ area, children }: { area: AdminArea; children: ReactNode }) {
  const copy = accessDashboardCopy(useUiLocale());
  return <AdminAreaGuard area={area}><main className="mx-auto min-h-screen max-w-5xl space-y-6 p-4 py-6 safe-top">
    <Button asChild variant="outline"><Link to="/admin/areas">{copy.adminAreas.title}</Link></Button>
    {children}
  </main></AdminAreaGuard>;
}

export default function AdminAreas() {
  const copy = accessDashboardCopy(useUiLocale());
  return <main className="mx-auto min-h-screen max-w-5xl space-y-6 p-4 py-6 safe-top">
    <Button asChild variant="outline"><Link to="/feed">{copy.backYamilook}</Link></Button>
    <AccessDashboardLink />
    <AdminAreaLinks />
  </main>;
}
