import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { publicPostUrl, sharePostLink } from '@/lib/post-sharing';

export default function LinkedInShareOptions({ id, webUrl, onPrepareMedia, branded = false }: {
  id: string;
  webUrl: string;
  onPrepareMedia?: () => void;
  branded?: boolean;
}) {
  useUiLocale();
  const regionId = useId();
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const handoff = async (copyOnly: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      // Keep this call in the tap handler so iOS retains user activation.
      const result = await sharePostLink(id, { copyOnly });
      setStatus(result === 'cancelled' ? uiText("Partilha cancelada. Podes tentar novamente.")
        : result === 'copied' ? uiText("Ligação copiada. Abre a aplicação LinkedIn, toca em Publicar e cola a ligação.")
        : uiText("Conclui a publicação no LinkedIn. A Yamilook não recebe confirmação de publicação."));
    } catch {
      setStatus(uiText("Não foi possível copiar automaticamente. Seleciona a ligação abaixo e copia-a."));
    } finally { setBusy(false); }
  };

  return <div className="rounded-xl border">
    <Button variant="ghost" className="min-h-12 w-full justify-start px-4" aria-expanded={expanded} aria-controls={regionId} onClick={() => setExpanded(value => !value)}>LinkedIn</Button>
    {expanded && <div id={regionId} className="space-y-3 px-4 pb-4" aria-label={uiText("Opções do LinkedIn")}>
      <p className="text-sm text-muted-foreground">{uiText("Para o vídeo ou a fotografia aparecer na publicação, envia o ficheiro. Uma ligação abre o conteúdo na Yamilook.")}</p>
      {onPrepareMedia && <Button className="min-h-11 w-full whitespace-normal" onClick={onPrepareMedia}>{branded ? uiText("Preparar cópia com marca para LinkedIn") : uiText("Preparar vídeo para LinkedIn")}</Button>}
      <p className="text-sm">{uiText("Se o formulário web apresentar um erro, abre a aplicação LinkedIn no telemóvel e cria a publicação lá.")}</p>
      {typeof navigator.share === 'function' && <Button className="min-h-11 w-full whitespace-normal" variant="outline" disabled={busy} onClick={() => void handoff(false)}>{uiText("Partilhar ligação pelas opções do telemóvel")}</Button>}
      <Button className="min-h-11 w-full" variant="outline" disabled={busy} onClick={() => void handoff(true)}>{uiText("Copiar ligação para LinkedIn")}</Button>
      <input aria-label={uiText("Ligação para LinkedIn")} className="w-full rounded border bg-background p-2 text-xs" value={publicPostUrl(id)} readOnly onFocus={event => event.target.select()} />
      <p role="status" aria-live="polite" className="text-sm">{status}</p>
      <a href="https://www.linkedin.com/feed/" target="_blank" rel="noopener noreferrer" className="block py-2 text-sm underline">{uiText("Abrir LinkedIn")}</a>
      <a href={webUrl} target="_blank" rel="noopener noreferrer" className="block py-2 text-sm underline">{uiText("Usar formulário web do LinkedIn")}</a>
    </div>}
  </div>;
}
