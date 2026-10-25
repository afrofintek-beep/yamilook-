import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { afrolocLanguages, normalizeAppLanguage } from '@/i18n/afroloc-languages';
import { changeAppLanguage } from '@/i18n';

export default function PaposLanguageSelector() {
  const { t, i18n } = useTranslation();
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const current = normalizeAppLanguage(i18n.language || 'pt');
  const select = async (code: string) => {
    setBusy(true); setError(false);
    try { await changeAppLanguage(code); }
    catch { setError(true); }
    finally { setBusy(false); }
  };
  return <div className="space-y-2">
    <label htmlFor={id} className="text-sm font-medium">{t('settings.language', { defaultValue: 'Idioma / Language' })}</label>
    <select id={id} value={afrolocLanguages.some(l => l.code === current) ? current : 'pt'}
      disabled={busy} onChange={e => void select(e.target.value)}
      className="block min-h-12 w-full min-w-0 rounded-xl border border-input bg-background px-3 text-base text-foreground">
      {afrolocLanguages.map(language => <option key={language.code} value={language.code} lang={language.code}>{language.nativeName}</option>)}
    </select>
    {error && <p role="alert" lang="en" className="text-sm text-destructive">Could not load this language. Please try again.</p>}
    {!['pt', 'pt-banda'].includes(current) && <p lang="en" className="text-xs text-muted-foreground">Translations are being completed. Some text is shown in English or Portuguese.</p>}
  </div>;
}
