import KosololaLogo from '@/components/brand/KosololaLogo';
import { useTranslation } from 'react-i18next';

export default function PaposBrand({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  return <div className="flex min-w-0 items-center gap-3">
    <KosololaLogo width={48} height={48}
      className={compact ? 'h-9 w-9 shrink-0 rounded-xl' : 'h-12 w-12 shrink-0 rounded-2xl'} />
    <div className="min-w-0"><span className={compact ? 'block truncate text-base font-bold tracking-wide' : 'text-2xl font-bold tracking-wide'}>KOSOLOLA</span>
      {!compact && <p className="text-xs text-muted-foreground">{t('kosolola.tagline')}</p>}
    </div>
  </div>;
}
