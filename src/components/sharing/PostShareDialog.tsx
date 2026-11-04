import BrandedPostExport from './BrandedPostExport';
import PostVideoShare from './PostVideoShare';
import OwnedPostMediaShare from './OwnedPostMediaShare';
import { useRef, useState } from 'react';
import { ResponsiveModal } from '@/components/ui/responsive-modal';
import { Button } from '@/components/ui/button';
import { shareDestinations } from '../../../shared/share-destinations.mjs';
import { sharePostLink } from '@/lib/post-sharing';
import LinkedInShareOptions from './LinkedInShareOptions';
import { isVideo } from '../../../shared/public-post.mjs';

export default function PostShareDialog({ id, mediaUrls = [], privacy = 'everyone', isOwner = false, open, onOpenChange, onShared }: { id: string; mediaUrls?: string[]; privacy?: string; isOwner?: boolean; open: boolean; onOpenChange: (open: boolean) => void; onShared?: () => void }) {
  const [status, setStatus] = useState('');
  const brandedSection = useRef<HTMLDivElement>(null);
  const videoSection = useRef<HTMLDivElement>(null);
  const focusMedia = () => {
    const section = isOwner ? brandedSection.current : videoSection.current;
    section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    section?.querySelector('button')?.focus({ preventScroll: true });
  };
  const isPublic = privacy === 'everyone';
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
  return <ResponsiveModal open={open} onOpenChange={onOpenChange} title="Partilhar publicação" description="Escolhe como e onde queres partilhar." className="max-h-[90svh] overflow-y-auto">
    {isOwner && <p className="mb-4 text-sm">Visibilidade na Yamilook: <strong>{audience}</strong>. Enviar um ficheiro mantém esta escolha.</p>}
    {open && isOwner && <div ref={brandedSection}><BrandedPostExport id={id} mediaUrls={mediaUrls} onShared={onShared} /></div>}
    {open && <div ref={videoSection}>{isOwner ? <OwnedPostMediaShare id={id} mediaUrls={mediaUrls} onShared={onShared} /> : isPublic ? <PostVideoShare id={id} mediaUrls={mediaUrls} onShared={onShared} /> : null}</div>}
    {isPublic ? <><h3 className="mb-2 font-semibold">Partilhar ligação</h3>
    <div className="grid gap-2">
      {shareDestinations(id).map(destination => destination.id === 'linkedin' ? <LinkedInShareOptions key={destination.id} id={id} webUrl={destination.url} branded={isOwner} onPrepareMedia={isOwner || mediaUrls.some(isVideo) ? focusMedia : undefined} /> : destination.url ? <a key={destination.id} href={destination.url} target="_blank" rel="noopener noreferrer" className={`flex min-h-12 items-center justify-between rounded-xl border px-4 py-3 font-medium ${destination.id === 'kosolola' ? 'border-primary bg-primary/10' : ''}`}>
        <span>{destination.label}</span>{destination.id === 'kosolola' && <span className="text-xs text-muted-foreground">Contactos e grupos</span>}
      </a> : <Button key={destination.id} variant="outline" className="min-h-12 justify-start" onClick={() => setStatus(`Para publicar no ${destination.label}, prepara ou guarda o ficheiro acima e anexa-o nessa aplicação.`)}>{destination.label}</Button>)}
      <Button variant="outline" onClick={() => void share(false)}>Outros</Button>
      <Button variant="outline" onClick={() => void share(true)}>Copiar ligação</Button>
    </div>
    <p role="status" className="mt-3 text-sm">{status}</p>
    <input aria-label="Ligação pública" className="mt-2 w-full rounded border bg-background p-3 text-xs" value={`https://www.yamilook.com/post/${id}`} readOnly onFocus={event => event.target.select()} />
    </> : <p className="text-sm text-muted-foreground">A ligação pública não está disponível para esta publicação. {isOwner ? 'Podes enviar o ficheiro acima sem mudar a visibilidade.' : 'Só o autor pode enviar uma cópia dos seus ficheiros.'}</p>}
  </ResponsiveModal>;
}
