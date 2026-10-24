import { useTranslation } from 'react-i18next';

const taglines: Record<string, string> = {
  pt: 'A conversa é nossa.', en: 'The conversation is ours.',
  fr: 'La conversation est à nous.', ln: 'Lisolo ezali ya biso.', sw: 'Mazungumzo ni yetu.',
};

export default function PaposBrand({ compact = false }: { compact?: boolean }) {
  const { i18n } = useTranslation();
  const language = (i18n.resolvedLanguage || i18n.language || 'pt').split('-')[0];
  return <div className="flex min-w-0 items-center gap-3">
    <img src="/papos-app/kosolola-icon-192.png" alt="" width={48} height={48}
      className={compact ? 'h-9 w-9 shrink-0 rounded-xl' : 'h-12 w-12 shrink-0 rounded-2xl'} />
    <div className="min-w-0"><span className={compact ? 'text-base font-bold tracking-wide' : 'text-2xl font-bold tracking-wide'}>KOSOLOLA</span>
      {!compact && <p className="text-xs text-muted-foreground">{taglines[language] || taglines.pt}</p>}
    </div>
  </div>;
}
