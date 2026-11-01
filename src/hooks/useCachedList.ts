import { useCallback, useEffect, useMemo, useRef, useState, type SetStateAction } from 'react';
import { listCacheEpoch, listCacheKey, readListCache, writeListCache } from '@/lib/list-cache';

/** Show a scoped snapshot synchronously; refresh callers continue using server reads. */
export function useCachedList<T>(userId: string | undefined, list: string) {
  const key = userId ? listCacheKey(userId, list) : '';
  const epoch = listCacheEpoch();
  const scope = useMemo(() => ({ key, epoch }), [key, epoch]);
  const current = useRef(scope);
  current.current = scope;
  const initial = useMemo(() => {
    const cached = key ? readListCache<T>(key) : undefined;
    return { scope, items: cached ?? [], loading: !!key && cached === undefined, dirty: false };
  }, [scope]);
  const [state, setState] = useState(initial);
  const visible = state.scope === scope ? state : initial;
  const setItems = useCallback((update: SetStateAction<T[]>) => {
    if (current.current !== scope || listCacheEpoch() !== scope.epoch) return;
    setState(previous => {
      if (current.current !== scope || listCacheEpoch() !== scope.epoch) return previous;
      const base = previous.scope === scope ? previous : initial;
      return { ...base, items: typeof update === 'function' ? (update as (items: T[]) => T[])(base.items) : update, dirty: true };
    });
  }, [scope, initial]);
  const setLoading = useCallback((loading: boolean) => {
    if (current.current !== scope || listCacheEpoch() !== scope.epoch) return;
    setState(previous => ({ ...(previous.scope === scope ? previous : initial), loading }));
  }, [scope, initial]);
  useEffect(() => {
    if (visible.dirty && key && current.current === scope && listCacheEpoch() === epoch) writeListCache(key, visible.items);
  }, [visible.items, visible.dirty, key, scope, epoch]);
  return { items: visible.items, setItems, loading: visible.loading, setLoading };
}
