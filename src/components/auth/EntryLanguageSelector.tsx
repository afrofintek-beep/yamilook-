import { Check, MessageCircle, Sparkles } from 'lucide-react';
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
          <div className="grid grid-cols-2 gap-3">
            {[
              { code: 'pt', label: 'Português formal', description: 'Claro, cuidado e familiar.', example: 'Olá! É um prazer ter a sua companhia.', Icon: MessageCircle },
              { code: 'pt-banda', label: 'Yamilook da Banda', description: 'Linguagem popular angolana.', example: 'Kamba, bem-vindo à nossa banda!', Icon: Sparkles },
            ].map(tone => (
              <label key={tone.code} className={cn("relative flex flex-col gap-3 rounded-2xl border-2 p-4 cursor-pointer transition-colors motion-reduce:transition-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2", language === tone.code ? "border-primary bg-primary/5 shadow-sm" : "border-border bg-background hover:border-primary/40")}>
                <input type="radio" name={`${id}-tone`} value={tone.code}
                  className="sr-only" aria-label={tone.label} checked={language === tone.code} onChange={() => void choose(tone.code)} />
                <span className="flex items-center justify-between" aria-hidden="true">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><tone.Icon className="h-5 w-5" /></span>
                  {language === tone.code && <Check className="h-4 w-4 text-primary" />}
                </span>
                <span className="text-sm font-semibold leading-tight">{tone.label}</span>
                <span className="text-xs text-muted-foreground leading-relaxed">{tone.description}</span>
                <span className="text-xs leading-relaxed border-t border-border/60 pt-3">“{tone.example}”</span>
              </label>
            ))}
          </div>
        <p className="mt-3 text-xs text-muted-foreground text-center">A mesma comunidade, à sua maneira.</p>
        </fieldset>
      )}
      {failed && <p role="alert" className="mt-2 text-sm text-destructive">{t('entry.languageError')}</p>}
    </div>
  );
}
