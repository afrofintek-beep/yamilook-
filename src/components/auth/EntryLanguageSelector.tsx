import { cn } from '@/lib/utils';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { changeAppLanguage } from '@/i18n';
import { appLanguages, normalizeAppLanguage } from '@/i18n/afroloc-languages';

export function EntryLanguageSelector() {
  const { t, i18n } = useTranslation();
  const id = useId();
  const language = normalizeAppLanguage(i18n.language || 'pt');
  const isPortuguese = language === 'pt' || language === 'pt-banda';
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  async function choose(code: string) {
    setBusy(true);
    setFailed(false);
    try {
      await changeAppLanguage(code);
      // Storage may be unavailable in private browsing; the current session still works.
      try { localStorage.setItem('i18nextLng', code); } catch { /* Session preference only. */ }
    }
    catch { setFailed(true); }
    finally { setBusy(false); }
  }
  return (
    <div className="w-full max-w-sm my-4 px-4" aria-busy={busy}>
      <label htmlFor={id} className="block text-sm font-medium mb-2">🌐 {t('entry.chooseLanguage')}</label>
      <select id={id} value={isPortuguese ? 'pt' : language}
        disabled={busy} onChange={event => void choose(event.target.value)}
        className="w-full min-h-12 rounded-xl border border-input bg-background px-3 text-base">
        {appLanguages.map(language => (
          <option key={language.code} value={language.code} lang={language.code} dir={language.code === 'ar' ? 'rtl' : 'ltr'}>
            {language.nativeName}
          </option>
        ))}
      </select>
      {isPortuguese && (
        <fieldset className="mt-4" disabled={busy}>
          <legend className="text-sm font-medium mb-2">Como prefere que a Yamilook fale consigo?</legend>
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-secondary/50 p-1">
            {[
              { code: 'pt', label: 'Formal', description: 'Claro, cuidado e familiar.' },
              { code: 'pt-banda', label: 'Urbano', description: 'Linguagem popular angolana.' },
            ].map(tone => (
              <label key={tone.code} className={cn("relative flex flex-col items-center gap-1 rounded-xl py-3 px-2 text-center cursor-pointer focus-within:ring-2 focus-within:ring-ring", language === tone.code ? "bg-background shadow-md" : "hover:bg-background/50")}>
                <input type="radio" name={`${id}-tone`} value={tone.code}
                  className="sr-only" aria-label={tone.label} checked={language === tone.code} onChange={() => void choose(tone.code)} />
                <span className="text-2xl" aria-hidden="true">🇦🇴</span>
                <span className="text-sm font-semibold leading-tight">{tone.label}</span>
                {language === tone.code && <span className="text-xs text-muted-foreground leading-relaxed">{tone.description}</span>}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {failed && <p role="alert" className="mt-2 text-sm text-destructive">{t('entry.languageError')}</p>}
    </div>
  );
}
