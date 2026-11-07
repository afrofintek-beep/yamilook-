import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { appLanguages, normalizeAppLanguage } from '@/i18n/afroloc-languages';

export function AcademiaLanguageSelector() {
  const { t, i18n } = useTranslation();
  const [params, setParams] = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const language = normalizeAppLanguage(i18n.language || 'pt');
  async function choose(code: string) {
    setBusy(true);
    setFailed(false);
    try {
      const { changeAppLanguage } = await import('@/i18n');
      await changeAppLanguage(code);
      const next = new URLSearchParams(params);
      next.set('lang', code);
      setParams(next, { replace: true });
    } catch { setFailed(true); }
    finally { setBusy(false); }
  }
  return <div className="max-w-[42%] shrink-0" aria-busy={busy}>
    <select aria-label={t('academiaPublic.language')} value={language === 'pt-banda' ? 'pt' : language}
      disabled={busy} onChange={event => void choose(event.target.value)}
      className="w-full min-h-10 rounded-lg border bg-background px-2 text-sm">
      {appLanguages.map(item => <option key={item.code} value={item.code} lang={item.code}>{item.nativeName}</option>)}
    </select>
    {failed && <p role="alert" className="text-xs text-destructive">{t('academiaPublic.languageError')}</p>}
  </div>;
}
