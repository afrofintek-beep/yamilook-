import { useRef, useState } from 'react';
import { Grid3X3, List, ChevronLeft, ChevronRight } from 'lucide-react';
import type { PostWithUser } from '@/hooks/usePosts';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { uiText, useUiLocale } from '@/i18n/ui-copy';

export function ProfilePostPhotos({ posts, onOpenPost }: {
  posts: PostWithUser[];
  onOpenPost: (post: PostWithUser) => void;
}) {
  useUiLocale();
  const [layout, setLayout] = useState<'grid' | 'list'>(() => {
    try { return localStorage.getItem('profile-photo-layout') === 'list' ? 'list' : 'grid'; }
    catch { return 'grid'; }
  });
  const [selected, setSelected] = useState<string | null>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  // Derive exclusively from the profile's authorized posts, never from storage listings.
  const photos = posts.flatMap(post => post.type === 'photo'
    ? (post.media_urls || []).filter(url => !/\.(mp4|webm|mov|m4v)(?:[?#]|$)/i.test(url))
      .map((url, index) => ({ key: `${post.id}:${index}`, url, post })) : []);
  const index = photos.findIndex(photo => photo.key === selected);
  const photo = photos[index];
  const move = (offset: number) => {
    if (photos.length) setSelected(photos[(index + offset + photos.length) % photos.length].key);
  };
  const changeLayout = (value: 'grid' | 'list') => {
    setLayout(value);
    try { localStorage.setItem('profile-photo-layout', value); } catch { /* Storage may be disabled. */ }
  };
  return <div className="px-4">
    <div className="flex justify-end gap-2 mb-3">
      <Button variant="outline" size="icon" aria-label={uiText('Grelha')} aria-pressed={layout === 'grid'} onClick={() => changeLayout('grid')}><Grid3X3 className="h-4 w-4" /></Button>
      <Button variant="outline" size="icon" aria-label={uiText('Lista')} aria-pressed={layout === 'list'} onClick={() => changeLayout('list')}><List className="h-4 w-4" /></Button>
    </div>
    {!photos.length && <p className="text-sm text-muted-foreground">{uiText('Sem fotografias disponíveis para ti neste perfil.')}</p>}
    <div className={layout === 'grid' ? 'grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-1' : 'flex flex-col gap-3'}>
      {photos.map((item, i) => <button key={item.key} type="button" onClick={() => setSelected(item.key)} aria-label={`${uiText('Abrir fotografia')} ${i + 1}`} className="overflow-hidden rounded-md bg-muted focus-visible:ring-2 focus-visible:ring-primary">
        <img src={item.url} alt="" loading="lazy" decoding="async" className={layout === 'grid' ? 'aspect-square w-full object-cover' : 'max-h-96 w-full object-contain'} />
      </button>)}
    </div>
    <Dialog open={!!photo} onOpenChange={open => { if (!open) setSelected(null); }}>
      <DialogContent className="max-w-4xl" aria-describedby={undefined} onKeyDown={event => {
        if (event.key === 'ArrowLeft') { event.preventDefault(); move(-1); }
        if (event.key === 'ArrowRight') { event.preventDefault(); move(1); }
      }}>
        <DialogTitle>{uiText('Fotos')} · {index + 1} / {photos.length}</DialogTitle>
        {photo && <>
          <div className="relative" onTouchStart={event => {
            touch.current = { x: event.touches[0].clientX, y: event.touches[0].clientY };
          }} onTouchEnd={event => {
            const start = touch.current;
            touch.current = null;
            if (!start) return;
            const dx = event.changedTouches[0].clientX - start.x;
            const dy = event.changedTouches[0].clientY - start.y;
            if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) move(dx < 0 ? 1 : -1);
          }}>
            <img src={photo.url} alt={photo.post.content || uiText('Fotografia')} className="w-full max-h-[60dvh] object-contain" />
            {photos.length > 1 && <div className="flex justify-between mt-2">
              <Button variant="outline" aria-label={uiText('Fotografia anterior')} onClick={() => move(-1)}><ChevronLeft /></Button>
              <Button variant="outline" aria-label={uiText('Fotografia seguinte')} onClick={() => move(1)}><ChevronRight /></Button>
            </div>}
          </div>
          {photo.post.content && <p className="text-sm whitespace-pre-wrap break-words">{photo.post.content}</p>}
          <Button onClick={() => { setSelected(null); onOpenPost(photo.post); }}>{uiText('Ver publicação')}</Button>
        </>}
      </DialogContent>
    </Dialog>
  </div>;
}
