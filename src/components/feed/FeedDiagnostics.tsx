import { useEffect, useRef, useState } from 'react';

// Never export URLs, query strings, headers, user identifiers or page content.
export function resourceCategory(name: string, initiator: string) {
  try {
    const url = new URL(name);
    const path = url.pathname;
    if (path === '/rest/v1/posts' && url.searchParams.has('created_at')) return 'api:posts:pagination';
    if (path === '/rest/v1/posts' && url.searchParams.get('order') === 'likes_count.desc') return 'api:posts:discovery';
    const api = path.match(/^\/rest\/v1\/([a-z_]+)$/);
    if (api) {
      // Report only approved table names. Never export arbitrary paths.
      const known = new Set([
        'posts', 'contacts', 'post_likes', 'post_topics', 'saved_posts',
        'advertisements', 'discover_topics', 'post_archives', 'post_comments',
        'public_profiles', 'profiles', 'business_profiles', 'ad_impressions',
        'conversation_participants', 'conversations', 'notifications',
        'statuses', 'status_views', 'user_settings', 'live_streams',
        'calls', 'call_participants', 'call_signals', 'live_sessions',
        'messages', 'message_reactions', 'push_subscriptions',
      ]);
      return known.has(api[1]) ? 'api:' + api[1] : 'api:other-table';
    }
    if (path.startsWith('/rest/v1/rpc/')) return 'api:rpc';
    if (path.startsWith('/auth/v1/')) return 'api:auth';
    if (path.startsWith('/functions/v1/')) return 'api:function';
    if (path.startsWith('/realtime/v1/')) return 'api:realtime';
    if (path.startsWith('/storage/v1/render/image/public/')) return 'media:transformed-image';
    if (path.startsWith('/storage/v1/object/public/')) return 'media:public-object';
    if (path.startsWith('/storage/v1/')) return 'media:other';
    // Dynamic imports and modulepreload fetches are often initiated as "link"
    // on Safari. Classify by safe extension without recording the asset name.
    // This distinguishes the large, persistent "other" burst from API traffic.
    if (url.origin === window.location.origin && path.startsWith('/assets/')) {
      if (/\.(?:js|mjs)$/i.test(path)) return 'asset:script';
      if (/\.css$/i.test(path)) return 'asset:style';
      if (/\.(?:woff2?|ttf|otf)$/i.test(path)) return 'asset:font';
      if (/\.(?:png|jpe?g|webp|svg|avif)$/i.test(path)) return 'asset:image';
      return 'asset:other';
    }
    if (initiator === 'fetch' || initiator === 'xmlhttprequest') {
      return url.origin === window.location.origin ? 'fetch:same-origin' : 'fetch:external';
    }
  } catch { /* Invalid names are never copied to reports. */ }
  return ['img', 'script', 'css', 'fetch', 'xmlhttprequest', 'video'].includes(initiator) ? initiator : 'other';
}

/** Compare against physical pixels, not CSS pixels, to avoid flagging 160px
 * avatars displayed at 40px on a 3x Retina screen. */
export function imageExceedsPixelBudget(
  naturalWidth: number, naturalHeight: number,
  renderedWidth: number, renderedHeight: number, dpr: number,
): boolean {
  if (![naturalWidth, naturalHeight, renderedWidth, renderedHeight, dpr]
    .every(v => Number.isFinite(v) && v > 0)) return false;
  const requiredWidth = renderedWidth * dpr;
  const requiredHeight = renderedHeight * dpr;
  return naturalWidth > requiredWidth * 2 || naturalHeight > requiredHeight * 2;
}

export default function FeedDiagnostics() {
  const [report, setReport] = useState('');
  const capture = useRef<() => void>(() => {});
  useEffect(() => {
    const started = performance.now();
    let firstArticle: number | null = null;
    let firstImage: number | null = null;
    let stopped = false;
    let maxArticles = 0;
    let hiddenDuringCapture = document.visibilityState !== 'visible';
    const initialArticles = document.querySelectorAll('.feed-posts article').length;
    const collected: PerformanceResourceTiming[] = [];
    const observer = typeof PerformanceObserver !== 'undefined' ? new PerformanceObserver(list => {
      collected.push(...list.getEntries() as PerformanceResourceTiming[]);
    }) : null;
    try { observer?.observe({ type: 'resource', buffered: true }); } catch { /* Older browsers use the existing resource buffer. */ }
    const visibilityChanged = () => { if (document.visibilityState !== 'visible') hiddenDuringCapture = true; };
    document.addEventListener('visibilitychange', visibilityChanged);
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && r.top < innerHeight && r.bottom > 0;
    };
    const inspect = () => {
      maxArticles = Math.max(maxArticles, document.querySelectorAll('.feed-posts article').length);
      if (document.visibilityState !== 'visible') return;
      const article = document.querySelector('.feed-posts article');
      if (!article || !visible(article)) return;
      firstArticle ??= performance.now() - started;
      const img = Array.from(document.querySelectorAll<HTMLImageElement>('.feed-posts article img[loading]')).find(visible);
      if (img && visible(img) && img.complete && img.naturalWidth > 0) firstImage ??= performance.now() - started;
    };
    const timer = window.setInterval(inspect, 100);
    inspect();
    const stop = () => {
      if (stopped) return;
      inspect();
      stopped = true;
      clearInterval(timer);
      collected.push(...(observer?.takeRecords() ?? []) as PerformanceResourceTiming[]);
      observer?.disconnect();
      const resources = collected.length ? collected : performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
      const categorized = resources.slice(0, 1000).map(r => ({
        category: resourceCategory(r.name, r.initiatorType),
        startMs: Math.round(r.startTime), durationMs: Math.round(r.duration),
        transferBytes: r.transferSize, bodyBytes: r.encodedBodySize,
      }));
      const categories: Record<string, number> = {};
      for (const item of categorized) categories[item.category] = (categories[item.category] || 0) + 1;
      const byTime = [...categorized].sort((a, b) => a.startMs - b.startMs);
      let largestHundredMsBurst = 0;
      let peakLeft = 0;
      let peakRight = 0;
      for (let left = 0, right = 0; right < byTime.length; right++) {
        while (byTime[right].startMs - byTime[left].startMs > 100) left++;
        if (right - left + 1 > largestHundredMsBurst) {
          largestHundredMsBurst = right - left + 1;
          peakLeft = left;
          peakRight = right;
        }
      }
      // Retain only category counts, never filenames, paths or remote origins.
      const peakHundredMsCategories: Record<string, number> = {};
      for (const item of byTime.slice(peakLeft, peakRight + 1)) {
        peakHundredMsCategories[item.category] = (peakHundredMsCategories[item.category] || 0) + 1;
      }
      // Five-second resource starts show sustained polling separately from
      // the burst that naturally happens while the app mounts.
      const resourcesByFiveSeconds: Record<string, number> = {};
      for (const item of categorized) {
        const bucket = String(Math.floor(item.startMs / 5000) * 5);
        resourcesByFiveSeconds[bucket] = (resourcesByFiveSeconds[bucket] || 0) + 1;
      }
      const imageElements = Array.from(document.querySelectorAll<HTMLImageElement>('.feed-posts article img')).slice(0, 100);
      const pixelRatio = Math.max(1, window.devicePixelRatio || 1);
      const oversizedImageCount = imageElements.filter(img => {
        const box = img.getBoundingClientRect();
        return imageExceedsPixelBudget(img.naturalWidth, img.naturalHeight,
          box.width, box.height, pixelRatio);
      }).length;
      // Count the actual displayed mode; resource entries alone cannot tell a
      // legitimate public original from a fallback after a failed transform.
      const imageDeliveryModes = { variant: 0, fallback: 0, original: 0, unknown: 0 };
      let pendingImageCount = 0;
      for (const img of imageElements) {
        if (!img.complete || img.naturalWidth === 0) pendingImageCount++;
        const mode = img.getAttribute('data-image-delivery');
        if (mode === 'variant' || mode === 'fallback' || mode === 'original') {
          imageDeliveryModes[mode]++;
        } else {
          imageDeliveryModes.unknown++;
        }
      }
      const knownTransferBytes = categorized.reduce((n, item) => n + (item.transferBytes || 0), 0);
      const sizedResourceCount = categorized.filter(item => item.transferBytes > 0).length;
      setReport(JSON.stringify({
        version: 3,
        method: 'Visible DOM sampled every 100ms, not paint timing. Resource categories contain no URL, headers or personal data. Five-second buckets use navigation-relative resource starts. Caching uncontrolled; some resource entries may be missing. Zero sizes can mean unavailable cross-origin timing. Image delivery mode is counted from loaded DOM attributes and not from network entries.',
        observerStartedMsAfterNavigation: Math.round(started),
        captureDurationMs: Math.round(performance.now() - started),
        firstArticleObservedMsAfterObserver: firstArticle === null ? null : Math.round(firstArticle),
        firstPhotoObservedLoadedMsAfterObserver: firstImage === null ? null : Math.round(firstImage),
        viewport: { width: innerWidth, height: innerHeight },
        standalone: matchMedia('(display-mode: standalone)').matches,
        navigation: nav ? { ttfbMs: nav.responseStart, domContentLoadedMs: nav.domContentLoadedEventEnd } : null,
        hiddenDuringCapture,
        articles: { atObserverStart: initialArticles, maximumObserved: maxArticles, atEnd: document.querySelectorAll('.feed-posts article').length },
        images: imageElements.map(img => ({
          loaded: img.complete && img.naturalWidth > 0, loading: img.loading,
          naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight,
          renderedWidth: Math.round(img.getBoundingClientRect().width), renderedHeight: Math.round(img.getBoundingClientRect().height),
        })),
        resourceCountAvailable: resources.length,
        resourceLimit: 1000,
        resourceCategories: categories,
        resourcesByFiveSeconds,
        oversizedImageCount,
        oversizedImageDefinition: 'Either natural dimension is more than 2x the physical-pixel display requirement; excludes unloaded images.',
        pixelRatio,
        imageDeliveryModes,
        pendingImageCount,
        knownTransferBytes,
        sizedResourceCount,
        largestHundredMsBurst,
        peakHundredMsStart: byTime[peakLeft]?.startMs ?? null,
        peakHundredMsCategories,
        resources: categorized,
      }, null, 2));
    };
    capture.current = stop;
    const timeout = window.setTimeout(stop, 30000);
    return () => { clearInterval(timer); clearTimeout(timeout); observer?.disconnect(); document.removeEventListener('visibilitychange', visibilityChanged); };
  }, []);
  const download = () => {
    const url = URL.createObjectURL(new Blob([report], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'yamilook-diagnostico-v3.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  };
  return <aside aria-label="Diagnóstico do feed" className="fixed bottom-24 left-2 z-[100] max-w-[calc(100vw-1rem)] rounded-xl border bg-background p-3 text-foreground shadow-lg">
    <p className="text-sm font-semibold">Diagnóstico neste aparelho</p>
    <p className="max-w-xs text-xs">Deslize pelo feed durante 30 segundos. O relatório fica neste aparelho; partilhe-o depois nesta conversa.</p>
    {report ? <button className="mt-2 min-h-11 underline" onClick={download}>Guardar relatório</button>
      : <button className="mt-2 min-h-11 underline" onClick={() => capture.current()}>Terminar recolha</button>}
    <p className="max-w-xs text-xs">Para repetir, recarregue a página. Para sair, retire ?diagnostico=1 do endereço.</p>
  </aside>;
}
