import { useEffect, useMemo, useState } from 'react';
import { readAvatar, rememberAvatar } from '@/lib/avatar-cache';

export function useCachedAvatar(src: string | undefined) {
  const [retry, setRetry] = useState(0);
  const scope = useMemo(() => ({ src, retry }), [src, retry]);
  const [cached, setCached] = useState<{ scope: typeof scope; url: string }>();
  useEffect(() => {
    let disposed = false;
    let objectUrl: string | undefined;
    if (src) void readAvatar(src).then(blob => {
      if (!blob || disposed) return;
      objectUrl = URL.createObjectURL(blob);
      setCached({ scope, url: objectUrl });
    });
    return () => { disposed = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [scope]);
  useEffect(() => {
    const online = () => setRetry(value => value + 1);
    window.addEventListener('online', online);
    return () => window.removeEventListener('online', online);
  }, []);
  return {
    src: cached?.scope === scope ? cached.url : src,
    retry,
    loaded: () => { if (src) void rememberAvatar(src); },
    failed: () => { if (cached?.scope === scope) setCached(undefined); },
  };
}
