import { uiText, useUiLocale } from '@/i18n/ui-copy';
import KosololaLogo from '@/components/brand/KosololaLogo';
import BrandedPostExport from './BrandedPostExport';
import PostVideoShare from './PostVideoShare';
import { useEffect, useState } from 'react';
import { ResponsiveModal } from '@/components/ui/responsive-modal';
import { Button } from '@/components/ui/button';
import { shareDestinations } from '../../../shared/share-destinations.mjs';
import { sharePostLink } from '@/lib/post-sharing';
import LinkedInShareOptions from './LinkedInShareOptions';
import { isVideo } from '../../../shared/public-post.mjs';

export default function PostShareDialog({ id, mediaUrls = [], privacy = 'everyone', isOwner = false, open, onOpenChange, onShared }: { id: string; mediaUrls?: string[]; privacy?: string; isOwner?: boolean; open: boolean; onOpenChange: (open: boolean) => void; onShared?: () => void }) {
  useUiLocale();
  const [status, setStatus] = useState('');
  useEffect(() => { if (open) document.querySelectorAll('video').forEach(video => video.pause()); }, [open]);
  const isPublic = privacy === 'everyone';
  const hasFile = isOwner || (isPublic && mediaUrls.some(isVideo));
  const [mode, setMode] = useState<'file' | 'link'>(hasFile ? 'file' : 'link');
  const showFile = hasFile && (mode === 'file' || !isPublic);
  const audience = ({ everyone: 'Todos', contacts: 'Contactos', close_friends: 'Amigos próximos', only_me: 'Só eu' } as Record<string, string>)[privacy] || 'Restrita';
  const share = async (copyOnly: boolean) => {
    if (!isPublic) return;
    try {
      const result = await sharePostLink(id, { copyOnly });
      if (result === 'cancelled') return;
      setStatus(result === 'copied' ? 'Ligação copiada.' : 'Partilha preparada.');
      onShared?.();
    } catch { setStatus('Não foi possível partilhar. Copia a ligação abaixo.'); }
  };
  return <ResponsiveModal open={open} onOpenChange={onOpenChange} title={uiText("Partilhar publicação")} description={uiText("Escolhe como e onde queres partilhar.")} className="max-h-[90svh] overflow-y-auto">
    {isOwner && <p className="mb-4 text-sm">{uiText("Visibilidade na Yamilook: ")}<strong>{audience}</strong>{uiText(". Enviar um ficheiro mantém esta escolha.")}</p>}
    {hasFile && isPublic && <div role="group" aria-label={uiText("O que enviar")} className="mb-4 grid grid-cols-2 gap-2">
      <Button variant={showFile ? 'default' : 'outline'} aria-pressed={showFile} onClick={() => setMode('file')}>{isOwner ? uiText("Ficheiro com marca") : uiText("Vídeo")}</Button>
      <Button variant={!showFile ? 'default' : 'outline'} aria-pressed={!showFile} onClick={() => setMode('link')}>{uiText("Ligação")}</Button>
    </div>}
    {open && hasFile && <div hidden={!showFile} key={id}>{isOwner ? <BrandedPostExport id={id} mediaUrls={mediaUrls} onShared={onShared} /> : <PostVideoShare id={id} mediaUrls={mediaUrls} onShared={onShared} />}</div>}
    {isPublic && <div hidden={showFile}><h3 className="mb-2 font-semibold">{uiText("Partilhar ligação")}</h3>
    <p className="mb-3 text-sm text-muted-foreground">{uiText("Envia um endereço para abrir o conteúdo na Yamilook. Para mostrar o vídeo ou a fotografia na publicação de destino, escolhe o ficheiro.")}</p>
    <div className="grid gap-2">
      {shareDestinations(id).filter(destination => destination.url).map(destination => destination.id === 'linkedin' ? <LinkedInShareOptions key={destination.id} id={id} webUrl={destination.url} /> : <a key={destination.id} href={destination.url} target="_blank" rel="noopener noreferrer" className={`flex min-h-12 items-center justify-between rounded-xl border px-4 py-3 font-medium ${destination.id === 'kosolola' ? 'border-primary bg-primary/10' : ''}`}>
        <span className="flex items-center gap-2">{destination.id === 'kosolola' && <KosololaLogo className="h-6 w-6" />}{destination.label}</span>{destination.id === 'kosolola' && <span className="text-xs text-muted-foreground">{uiText("Contactos e grupos")}</span>}
      </a>)}
      <Button variant="outline" onClick={() => void share(false)}>{uiText("Outros")}</Button>
      <Button variant="outline" onClick={() => void share(true)}>{uiText("Copiar ligação")}</Button>
    </div>
    <p role="status" className="mt-3 text-sm">{status}</p>
    <input aria-label={uiText("Ligação pública")} className="mt-2 w-full rounded border bg-background p-3 text-xs" value={`https://www.yamilook.com/post/${id}`} readOnly onFocus={event => event.target.select()} />
    </div>}
    {!isPublic && <p className="text-sm text-muted-foreground">{uiText("A ligação pública não está disponível para esta publicação. ")}{isOwner ? uiText("Podes enviar o ficheiro acima sem mudar a visibilidade.") : uiText("Só o autor pode enviar uma cópia dos seus ficheiros.")}</p>}
  </ResponsiveModal>;
}
