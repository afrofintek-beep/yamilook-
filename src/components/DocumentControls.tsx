import { useEffect, useRef, useState } from 'react';
import i18n, { changeAppLanguage, languages } from '@/i18n';
import { uiText, useUiLocale } from '@/i18n/ui-copy';

/** Wait for the selected dictionary and fonts before opening the print dialog. */
export default function DocumentControls({ title, autoPrint = false }: { title: string; autoPrint?: boolean }) {
  const locale = useUiLocale();
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const printed = useRef(false);
  const request = useRef(0);

  async function selectLanguage(language: string, updateUrl = true) {
    const current = ++request.current;
    setReady(false);
    setFailed(false);
    try {
      await changeAppLanguage(language);
      if (current !== request.current) return;
      if (updateUrl) {
        const url = new URL(window.location.href);
        url.searchParams.set('lang', language);
        window.history.replaceState(window.history.state, '', url);
      }
      setReady(true);
    } catch {
      if (current === request.current) setFailed(true);
    }
  }

  useEffect(() => {
    const language = new URLSearchParams(window.location.search).get('lang') || i18n.language || 'pt';
    void selectLanguage(language, false);
    return () => { request.current++; };
  }, []);

  useEffect(() => { document.title = title; }, [title]);

  useEffect(() => {
    if (!ready || !autoPrint || printed.current) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      await document.fonts?.ready;
      if (!cancelled) { printed.current = true; window.print(); }
    }, 500);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [ready, autoPrint]);

  return (
    <div className="document-controls flex flex-wrap items-center justify-center gap-4 p-4 bg-[#111111] text-white print:hidden">
      <label className="flex items-center gap-2">
        {uiText('Idioma')}
        <select className="rounded border border-white/40 bg-[#111111] p-2" value={locale === 'pt-banda' ? 'pt' : locale}
          onChange={event => { void selectLanguage(event.target.value); }}>
          {languages.map(language => <option key={language.code} value={language.code}>{language.nativeName}</option>)}
        </select>
      </label>
      <button type="button" disabled={!ready} className="rounded border border-white/40 p-2 disabled:opacity-40"
        onClick={async () => {
          const current = request.current;
          await document.fonts?.ready;
          if (current === request.current) window.print();
        }}>
        {uiText('Imprimir / Guardar PDF')}
      </button>
      {failed && <p role="alert">{uiText('Não foi possível carregar este idioma. Volte a selecionar o idioma para tentar novamente.')}</p>}
    </div>
  );
}
