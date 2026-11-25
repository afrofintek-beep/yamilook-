import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useIntegrationAccess } from '@/features/integration-access/useIntegrationAccess';
import { useUiLocale } from '@/i18n/ui-copy';
import { accessDashboardCopy } from './copy';

export function AccessDashboardLink({ external = false }: { external?: boolean }) {
  const locale = useUiLocale();
  const copy = accessDashboardCopy(locale);
  const access = useIntegrationAccess();
  if (!access.admin) return null;
  const content = <><ShieldCheck aria-hidden className="mr-2 h-5 w-5 shrink-0" /><span>{copy.manage}</span></>;
  return <Button asChild variant="outline" className="h-auto min-h-11 w-full whitespace-normal py-3">
    {external ? <a href={`https://www.yamilook.com/admin/acessos?lang=${encodeURIComponent(locale)}`}>{content}</a> : <Link to="/admin/acessos">{content}</Link>}
  </Button>;
}
