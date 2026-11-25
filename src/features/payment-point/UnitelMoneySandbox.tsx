import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { CheckCircle2, Clock3, Loader2, RefreshCw, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { money } from './api';
import { useUnitelLabels } from './unitel-labels';
import {
  clearUnitelRequest, matchesUnitelAttempt, readUnitelRequest, saveUnitelRequest,
  unitelAction, unitelCapabilities, unitelIsTerminal, unitelStorageKey,
  type UnitelAttempt, type UnitelCapabilities, type UnitelRequest,
} from './unitel-api';

interface Props {
  userId: string;
  orderId: string;
  amountMinor: number;
  readOnly?: boolean;
  canCreate?: boolean;
  onConfirmed?: () => void | Promise<void>;
  onBlockedChange?: (blocked: boolean) => void;
  onAttempt?: (attempt: UnitelAttempt | null) => void;
}

/** Order payments only. An uncertain submission retains its original recovery reference. */
export function UnitelMoneySandbox({ userId, orderId, amountMinor, readOnly = false, canCreate = true,
  onConfirmed, onBlockedChange, onAttempt }: Props) {
  const copy = useUnitelLabels();
  const selectId = useId();
  const storageKey = unitelStorageKey(userId, orderId);
  const [request, setRequest] = useState<UnitelRequest | null>(() => {
    const saved = readUnitelRequest(storageKey);
    return saved?.orderId === orderId ? saved : null;
  });
  const [attempt, setAttempt] = useState<UnitelAttempt | null>(null);
  const [capabilities, setCapabilities] = useState<UnitelCapabilities | null>(null);
  const [phone, setPhone] = useState(request?.phone || '');
  const [busy, setBusy] = useState<'create' | 'status' | null>(null);
  const [checked, setChecked] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<'queryError' | 'storageError' | 'recoveryError' | 'invalidResponse' | null>(null);
  const lock = useRef(false);
  const mounted = useRef(true);
  const currentRequest = useRef(request);
  const currentAttempt = useRef(attempt);
  const notified = useRef<string>();
  const callbacks = useRef({ onConfirmed, onBlockedChange, onAttempt });
  callbacks.current = { onConfirmed, onBlockedChange, onAttempt };

  const acceptAttempt = useCallback((next: UnitelAttempt | null) => {
    const previous = currentAttempt.current;
    if ((next && !matchesUnitelAttempt(next, {
      orderId, amountMinor, requestId: currentRequest.current?.requestId || previous?.request_id, attemptId: previous?.id,
    })) || (!next && previous) || (previous?.state === 'confirmed' && next?.state !== 'confirmed')) {
      throw new Error('unitel_invalid_response');
    }
    currentAttempt.current = next;
    setAttempt(next);
    callbacks.current.onAttempt?.(next);
    if (next?.state === 'confirmed' && notified.current !== next.id) {
      notified.current = next.id;
      // Refreshing a receipt never initiates another payment, even when the refresh fails.
      Promise.resolve().then(() => callbacks.current.onConfirmed?.()).catch(() => undefined);
    }
  }, [orderId, amountMinor]);

  function reportError(cause: unknown) {
    setError(cause instanceof Error && cause.message === 'unitel_invalid_response' ? 'invalidResponse' : 'queryError');
  }

  const checkStatus = useCallback(async () => {
    if (lock.current) return;
    const saved = currentRequest.current;
    const active = currentAttempt.current;
    lock.current = true;
    setBusy('status');
    try {
      const response = await unitelAction(active ? { action: 'status', attemptId: active.id }
        : saved ? { action: 'status', requestId: saved.requestId } : { action: 'status', orderId });
      if (!mounted.current) return;
      acceptAttempt(response.attempt);
      setNotFound(response.attempt === null && !!saved);
      setChecked(true);
      setError(null);
    } catch (cause) {
      if (mounted.current) reportError(cause);
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(null);
    }
  }, [orderId, acceptAttempt]);

  useEffect(() => {
    mounted.current = true;
    let active = true;
    void unitelCapabilities().then(result => {
      if (!active) return;
      setCapabilities(result);
      if (result.enabled) {
        if (!currentRequest.current) setPhone(result.testPhones?.[0] || '');
        void checkStatus();
      }
    }).catch(() => {
      if (active) setCapabilities({ enabled: false, environment: 'sandbox', methods: [] });
    });
    return () => {
      active = false;
      mounted.current = false;
      callbacks.current.onBlockedChange?.(false);
      callbacks.current.onAttempt?.(null);
    };
  }, [checkStatus]);

  useEffect(() => {
    if (!capabilities?.enabled) return;
    const refresh = () => { if (document.visibilityState !== 'hidden') void checkStatus(); };
    const timer = window.setInterval(() => {
      const latest = currentAttempt.current;
      if (!latest || !unitelIsTerminal(latest.state)) refresh();
    }, 10000);
    window.addEventListener('online', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('online', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [capabilities?.enabled, checkStatus]);

  const blocked = busy === 'create' || (!!(request || attempt) && (!attempt || !['failed', 'expired'].includes(attempt.state)))
    || (capabilities?.enabled === true && !checked);
  useEffect(() => { callbacks.current.onBlockedChange?.(blocked); }, [blocked]);

  const approvedPhones = capabilities?.testPhones || [];
  const approvedPhone = approvedPhones.includes(currentRequest.current?.phone || phone);

  async function createCharge() {
    if (lock.current || !capabilities?.enabled || readOnly || !canCreate || !checked || currentAttempt.current
      || !approvedPhone || (currentRequest.current && !notFound)) return;
    const next = currentRequest.current || { requestId: crypto.randomUUID(), orderId, phone };
    try { saveUnitelRequest(storageKey, next); }
    catch { setError('storageError'); return; }
    currentRequest.current = next;
    setRequest(next);
    setNotFound(false);
    setError(null);
    lock.current = true;
    setBusy('create');
    callbacks.current.onBlockedChange?.(true);
    try {
      const response = await unitelAction({ action: 'create', ...next });
      if (!response.attempt) throw new Error('unitel_invalid_response');
      if (mounted.current) acceptAttempt(response.attempt);
    } catch (cause) {
      // A transport error cannot prove rejection. Keep the request and consult its status.
      if (mounted.current) reportError(cause);
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(null);
    }
  }

  function newTest() {
    if (lock.current || readOnly || !canCreate || !attempt || !['failed', 'expired'].includes(attempt.state)) return;
    try { clearUnitelRequest(storageKey); }
    catch { setError('recoveryError'); return; }
    currentRequest.current = null;
    currentAttempt.current = null;
    setRequest(null);
    setAttempt(null);
    callbacks.current.onAttempt?.(null);
    setPhone(approvedPhones[0] || '');
    setNotFound(false);
    setError(null);
  }

  if (!capabilities?.enabled || (readOnly && !attempt && !request && !error)) return null;
  const status = busy === 'create' ? 'submitting' : attempt?.state || (request ? 'uncertain' : null);
  const locked = !!request || !!attempt || !!busy;

  return <section className="rounded-2xl border border-primary/25 bg-primary/[0.04] p-4 space-y-4" aria-label={copy.title}>
    <header className="flex items-start gap-3">
      <span className="rounded-xl bg-primary/10 p-2 text-primary" aria-hidden="true"><Smartphone className="h-5 w-5" /></span>
      <div className="min-w-0"><h3 className="font-semibold text-foreground">{copy.title}</h3><p className="mt-1 text-sm text-muted-foreground">{copy.description}</p></div>
    </header>
    <p className="text-sm text-muted-foreground">{copy.amount} <strong className="ml-1 font-semibold text-foreground">{money(amountMinor)}</strong></p>
    {!readOnly && !attempt && (approvedPhones.length > 0 ? <label htmlFor={selectId} className="block space-y-1.5 text-sm font-medium">{copy.phone}
      <select id={selectId} value={phone} disabled={locked || !canCreate} onChange={event => setPhone(event.target.value)}
        className="flex min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 font-normal text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60" dir="ltr">
        {approvedPhones.map(number => <option key={number} value={number}>{number}</option>)}
      </select>
    </label> : <p className="text-sm text-muted-foreground">{copy.noPhones}</p>)}
    {status && <div role="status" aria-live="polite" className={`rounded-xl border p-3 ${status === 'confirmed' ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-border bg-background'}`}>
      <p className="flex items-start gap-2 font-medium text-foreground">
        {status === 'confirmed' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" /> : <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
        {copy.states[status]}
      </p>
      <p className="mt-1.5 text-sm text-muted-foreground">{status === 'confirmed' ? copy.confirmedBody
        : ['uncertain', 'review'].includes(status) ? copy.unknown : ['failed', 'expired'].includes(status) ? copy.failedBody : copy.waiting}</p>
    </div>}
    {error && <p role="alert" className="text-sm text-destructive">{copy[error]}</p>}
    <div className="flex flex-wrap gap-2">
      {!readOnly && canCreate && approvedPhone && !attempt && (!request || notFound) && <Button type="button" className="min-h-11 flex-1" disabled={!!busy || !checked} onClick={() => void createCharge()}>
        {busy === 'create' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{request ? copy.retry : copy.start}
      </Button>}
      {(!!request || !!attempt || !checked) && <Button type="button" variant="outline" className="min-h-11" disabled={!!busy} onClick={() => void checkStatus()}>
        <RefreshCw className={`mr-2 h-4 w-4 ${busy === 'status' ? 'animate-spin' : ''}`} />{busy === 'status' ? copy.checking : copy.check}
      </Button>}
      {!readOnly && canCreate && attempt && ['failed', 'expired'].includes(attempt.state) && <Button type="button" variant="outline" className="min-h-11" disabled={!!busy} onClick={newTest}>{copy.newTest}</Button>}
    </div>
  </section>;
}
