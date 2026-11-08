import { useRef, useState } from 'react';
import { languages, loadAppLanguage } from '@/i18n';
import { uiText } from '@/i18n/ui-copy';

export function contentLanguage(locale: string) {
  return languages.some(({ code }) => code === locale) ? locale : 'pt';
}

export function ContentLanguageSelect({ value, onChange, disabled }: {
  value: string;
  onChange: (language: string) => void;
  disabled?: boolean;
}) {
  const [pending, setPending] = useState<string>();
  const [failed, setFailed] = useState(false);
  const request = useRef(0);

  async function select(language: string) {
    const current = ++request.current;
    setPending(language);
    setFailed(false);
    try {
      await loadAppLanguage(language);
      if (request.current === current) onChange(language);
    } catch {
      if (request.current === current) setFailed(true);
    } finally {
      if (request.current === current) setPending(undefined);
    }
  }

  return <label className="flex flex-wrap items-center gap-2 text-sm">
    {uiText('Idioma')}
    <select className="rounded-md border border-current/30 bg-inherit px-2 py-1 text-base"
      value={contentLanguage(value)} disabled={disabled || !!pending} aria-busy={!!pending}
      onChange={event => void select(event.target.value)}>
      {languages.map(({ code, nativeName }) => <option className="bg-background text-foreground" key={code} value={code} lang={code}>{nativeName}</option>)}
    </select>
    {pending && <span role="status">{uiText('A carregar…')}</span>}
    {failed && <span role="alert">{uiText('Não foi possível carregar este idioma. Volte a selecionar o idioma para tentar novamente.')}</span>}
  </label>;
}
