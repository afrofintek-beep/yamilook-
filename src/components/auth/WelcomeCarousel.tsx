import { useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { normalizeAppLanguage } from '@/i18n/afroloc-languages';
import collections from './welcome-collections.json';

type CollectionLanguage = keyof typeof collections;
const controls: Record<CollectionLanguage, [string, string]> = {
  pt: ['Pausar carrossel', 'Reproduzir carrossel'],
  en: ['Pause slideshow', 'Play slideshow'],
  fr: ['Mettre le diaporama en pause', 'Lire le diaporama'],
  ar: ['إيقاف العرض مؤقتًا', 'تشغيل العرض'],
  am: ['የምስል ማሳያውን ለአፍታ አቁም', 'የምስል ማሳያውን አጫውት'],
  sw: ['Sitisha picha', 'Endeleza picha'],
  ln: ['Telemisá bililingi', 'Lakisa bililingi'],
  yo: ['Dá àfihàn dúró', 'Bẹ̀rẹ̀ àfihàn'],
  sn: ['Misa mifananidzo', 'Ratidza mifananidzo'],
  zu: ['Misa izithombe', 'Dlala izithombe'],
};

export function WelcomeCarousel() {
  const { i18n } = useTranslation();
  const normalized = normalizeAppLanguage(i18n.language || 'pt');
  const language = (normalized in collections ? normalized : 'pt') as CollectionLanguage;
  // Remount for a new collection, but not when switching Portuguese tone.
  return <CollectionCarousel key={language} language={language} />;
}

function CollectionCarousel({ language }: { language: CollectionLanguage }) {
  const { t } = useTranslation();
  const collection = collections[language] as {
    src: string; order: number[]; overrides?: Record<string, string>;
  };
  const [index, setIndex] = useState(() => Math.floor(Math.random() * collection.order.length));
  const [paused, setPaused] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [visible, setVisible] = useState(() => !document.hidden);
  const [failed, setFailed] = useState(false);
  const startX = useRef<number | null>(null);
  const sourceIndex = collection.order[index];
  const override = collection.overrides?.[sourceIndex];
  const src = override || collection.src;

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onMotion = () => { if (motion.matches) setPaused(true); };
    const onVisibility = () => setVisible(!document.hidden);
    motion.addEventListener('change', onMotion);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      motion.removeEventListener('change', onMotion);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  useEffect(() => {
    if (paused || !visible) return;
    const timer = window.setInterval(() => setIndex(value => (value + 1) % collection.order.length), 3000);
    return () => window.clearInterval(timer);
  }, [paused, visible, collection.order.length]);

  useEffect(() => { setFailed(false); }, [src]);

  // The only separate photograph is Morocco; preload it only for Arabic.
  useEffect(() => {
    const nextPhoto = collection.overrides?.[2];
    if (nextPhoto) { const image = new Image(); image.src = nextPhoto; }
  }, [collection]);

  function select(next: number) {
    setPaused(true);
    setIndex((next + collection.order.length) % collection.order.length);
  }

  return (
    <section className="w-full max-w-sm" aria-label={t('entry.title')} aria-roledescription="carousel">
      <div className="relative aspect-[3/2] overflow-hidden rounded-2xl bg-secondary touch-pan-y"
        onPointerDown={event => { startX.current = event.clientX; }}
        onPointerUp={event => {
          if (startX.current !== null && Math.abs(event.clientX - startX.current) > 35) {
            const direction = event.clientX < startX.current ? 1 : -1;
            select(index + (language === 'ar' ? -direction : direction));
          }
          startX.current = null;
        }}
        onPointerCancel={() => { startX.current = null; }}>
        {/* Decorative cultural imagery. A square 2×3 sheet contains five 3:2 frames.
            Source coordinates stay LTR even when the surrounding UI is Arabic. */}
        {!failed && <img key={src} src={src} alt="" draggable={false} decoding="async"
          width={override ? 1500 : 1000} height={1000} onError={() => setFailed(true)}
          className="absolute max-w-none select-none"
          style={override ? { width: '100%', height: '100%', left: 0, top: 0, objectFit: 'contain' } : {
            width: '200%', height: '300%', left: `${-(sourceIndex % 2) * 100}%`,
            top: `${-Math.floor(sourceIndex / 2) * 100}%`,
          }} />}
      </div>
      <div className="flex items-center justify-center" dir="ltr">
        {collection.order.map((_, i) => (
          <button key={i} type="button" aria-label={`${i + 1} / ${collection.order.length}`}
            aria-pressed={i === index} onClick={() => select(i)} onFocus={() => setPaused(true)}
            className="flex h-11 w-11 items-center justify-center rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
            <span aria-hidden="true" className={`h-2 rounded-full ${i === index ? 'w-5 bg-primary' : 'w-2 bg-muted-foreground/60'}`} />
          </button>
        ))}
        <button type="button" aria-label={controls[language][paused ? 1 : 0]}
          onClick={() => setPaused(value => !value)}
          className="flex h-11 w-11 items-center justify-center rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
          {paused ? <Play className="h-4 w-4" aria-hidden="true" /> : <Pause className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>
    </section>
  );
}
