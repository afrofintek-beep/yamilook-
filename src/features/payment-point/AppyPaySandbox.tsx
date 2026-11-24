import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { CheckCircle2, Clock3, Hash, Loader2, RefreshCw, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { money } from './api';
import { useAppyPayLabels } from './appypay-labels';
import {
  APPYPAY_TEST_PHONES, appyPayAction, appyPayCapabilities, appyPayIsTerminal,
  appyPayStorageKey, clearAppyPayRequest, readAppyPayRequest, saveAppyPayRequest,
  type AppyPayAttempt, type AppyPayCapabilities, type AppyPayMethod, type AppyPayRequest,
} from './appypay-api';

interface Props {
  userId: string;
  orderId?: string;
  amountMinor?: number;
  readOnly?: boolean;
  canCreate?: boolean;
  onConfirmed?: () => void | Promise<void>;
  onBlockedChange?: (blocked: boolean) => void;
  onAttempt?: (attempt: AppyPayAttempt | null) => void;
}

/** Isolated gateway sandbox; confirmation always comes from the server. */
export function AppyPaySandbox({ userId, orderId, amountMinor, readOnly = false, canCreate = true,
  onConfirmed, onBlockedChange, onAttempt }: Props) {
  const copy = useAppyPayLabels();
  const selectId = useId();
  const storageKey = appyPayStorageKey(userId, orderId);
  const [request, setRequest] = useState<AppyPayRequest | null>(() => {
    const saved = readAppyPayRequest(storageKey);
    return saved?.orderId === orderId ? saved : null;
  });
  const [attempt, setAttempt] = useState<AppyPayAttempt | null>(null);
  const [capabilities, setCapabilities] = useState<AppyPayCapabilities | null>(null);
  const [method, setMethod] = useState<AppyPayMethod>(request?.method || 'GPO');
  const [phone, setPhone] = useState<string>(request?.phone || APPYPAY_TEST_PHONES[0]);
  const [busy, setBusy] = useState<'create' | 'status' | null>(null);
  const [checked, setChecked] = useState(!orderId && !request);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<'queryError' | 'storageError' | 'invalidAmount' | null>(null);
  const lock = useRef(false);
  const mounted = useRef(true);
  const currentRequest = useRef(request);
  const currentAttempt = useRef(attempt);
  const notified = useRef<string>();
  const callbacks = useRef({ onConfirmed, onBlockedChange, onAttempt });
  callbacks.current = { onConfirmed, onBlockedChange, onAttempt };

  const acceptAttempt = useCallback((next: AppyPayAttempt | null) => {
    currentAttempt.current = next;
    setAttempt(next);
    callbacks.current.onAttempt?.(next);
    if (next?.state === 'confirmed' && notified.current !== next.id) {
      notified.current = next.id;
      // A refresh failure cannot turn a confirmed payment into a retryable charge.
      Promise.resolve(callbacks.current.onConfirmed?.()).catch(() => undefined);
    }
  }, []);

  const checkStatus = useCallback(async () => {
    if (lock.current) return;
    const saved = currentRequest.current;
    const active = currentAttempt.current;
    if (!orderId && !saved && !active) return;
    lock.current = true;
    setBusy('status');
    try {
      const response = await appyPayAction({ action: 'status', ...(orderId ? { orderId } : {}),
        ...(saved ? { requestId: saved.requestId } : {}), ...(active ? { attemptId: active.id } : {}) });
      if (!mounted.current) return;
      acceptAttempt(response.attempt);
      setNotFound(response.attempt === null && !!saved);
      setChecked(true);
      setError(null);
    } catch {
      if (mounted.current) setError('queryError');
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(null);
    }
  }, [orderId, acceptAttempt]);

  useEffect(() => {
    mounted.current = true;
    let active = true;
    void appyPayCapabilities().then(result => {
      if (!active) return;
      setCapabilities(result);
      if (result.enabled) {
        if (!result.methods.includes(currentRequest.current?.method || 'GPO')) setMethod(result.methods[0]);
        void checkStatus();
      }
    });
    return () => { active = false; mounted.current = false; callbacks.current.onBlockedChange?.(false); };
  }, [checkStatus]);

  useEffect(() => {
    if (!capabilities?.enabled) return;
    const refresh = () => {
      if (document.visibilityState !== 'hidden') void checkStatus();
    };
    const timer = window.setInterval(() => {
      const latest = currentAttempt.current;
      if (!latest || !appyPayIsTerminal(latest.state)) refresh();
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
    || (!!orderId && capabilities?.enabled === true && !checked);
  useEffect(() => { callbacks.current.onBlockedChange?.(blocked); }, [blocked]);

  async function createCharge() {
    if (lock.current || !capabilities?.enabled || readOnly || !canCreate || !checked || attempt) return;
    if (!orderId && (!Number.isSafeInteger(amountMinor) || amountMinor! <= 0 || amountMinor! > 100000000) && !currentRequest.current) {
      setError('invalidAmount'); return;
    }
    const next = currentRequest.current || {
      requestId: crypto.randomUUID(), method,
      ...(orderId ? { orderId } : { amountMinor }),
      ...(method === 'GPO' ? { phone } : {}),
    };
    try { saveAppyPayRequest(storageKey, next); }
    catch { setError('storageError'); return; }
    currentRequest.current = next;
    setRequest(next);
    setNotFound(false);
    setError(null);
    lock.current = true;
    setBusy('create');
    // Block local payment immediately, before a second click can take another path.
    callbacks.current.onBlockedChange?.(true);
    try {
      const response = await appyPayAction({ action: 'create', ...next });
      if (mounted.current) acceptAttempt(response.attempt);
    } catch {
      // Keep requestId and its original payload after an unknown transport outcome.
      // The next action is a status read, never an automatic second charge.
      if (mounted.current) setError('queryError');
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(null);
    }
  }

  function newTest() {
    if (lock.current || !attempt || !appyPayIsTerminal(attempt.state) || (orderId && attempt.state === 'confirmed')) return;
    try { clearAppyPayRequest(storageKey); }
    catch { setError('storageError'); return; }
    currentRequest.current = null;
    setRequest(null);
    acceptAttempt(null);
    setNotFound(false);
    setError(null);
    setChecked(true);
  }

  if (!capabilities?.enabled || (readOnly && !attempt && !request && !error)) return null;
  const status = busy === 'create' ? 'submitting' : attempt?.state || (request ? 'uncertain' : null);
  const locked = !!request || !!attempt || !!busy;
  const shownAmount = attempt?.amount_minor ?? request?.amountMinor ?? amountMinor;
  const providerDue = attempt?.provider_due_at && Number.isFinite(Date.parse(attempt.provider_due_at))
    ? new Date(attempt.provider_due_at).toLocaleString() : null;
  const terminal = attempt && appyPayIsTerminal(attempt.state);

  return <section className="rounded-2xl border border-primary/25 bg-primary/[0.04] p-4 space-y-4" aria-label={copy.title}>
    <header className="flex items-start gap-3">
      <span className="rounded-xl bg-primary/10 p-2 text-primary" aria-hidden="true"><Smartphone className="h-5 w-5" /></span>
      <div className="min-w-0"><h3 className="font-semibold text-foreground">{copy.title}</h3><p className="mt-1 text-sm text-muted-foreground">{copy.description}</p></div>
    </header>
    {Number.isSafeInteger(shownAmount) && shownAmount! > 0 && <p className="text-sm text-muted-foreground">{copy.amount} <strong className="ml-1 font-semibold text-foreground">{money(shownAmount!)}</strong></p>}
    {!readOnly && !attempt && <>
      <div role="radiogroup" aria-label={copy.method} className="grid grid-cols-2 gap-2">
        {capabilities.methods.map(option => <Button key={option} type="button" role="radio" aria-checked={method === option}
          variant={method === option ? 'default' : 'outline'} disabled={locked}
          className={`h-auto min-h-14 whitespace-normal px-2 py-3 text-xs sm:text-sm ${method === option ? 'text-primary-foreground' : 'text-foreground'}`}
          onClick={() => setMethod(option)}>
          {option === 'GPO' ? <Smartphone className="mr-2 h-4 w-4 shrink-0" /> : <Hash className="mr-2 h-4 w-4 shrink-0" />}
          {option === 'GPO' ? 'Multicaixa Express' : copy.referenceMethod}
        </Button>)}
      </div>
      {method === 'GPO' && <label htmlFor={selectId} className="block space-y-1.5 text-sm font-medium">{copy.scenario}
        <select id={selectId} value={phone} disabled={locked} onChange={event => setPhone(event.target.value)}
          className="flex min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 font-normal text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60">
          {APPYPAY_TEST_PHONES.map((number, index) => <option key={number} value={number}>{copy.scenarios[index]} · {number}</option>)}
        </select>
      </label>}
    </>}
    {status && <div role="status" aria-live="polite" className={`rounded-xl border p-3 ${status === 'confirmed' ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-border bg-background'}`}>
      <p className="flex items-start gap-2 font-medium text-foreground">
        {status === 'confirmed' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" /> : <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
        {copy.states[status]}
      </p>
      <p className="mt-1.5 text-sm text-muted-foreground">{status === 'confirmed' ? copy.confirmedBody : ['uncertain', 'review'].includes(status) ? copy.unknown : copy.waiting}</p>
    </div>}
    {attempt?.method === 'REF' && (attempt.entity || attempt.reference || providerDue) && <dl className="grid grid-cols-2 gap-3 rounded-xl border bg-background p-3 text-sm">
      {attempt.entity && <div><dt className="text-muted-foreground">{copy.entity}</dt><dd className="mt-1 break-all font-semibold tabular-nums" dir="ltr">{attempt.entity}</dd></div>}
      {attempt.reference && <div><dt className="text-muted-foreground">{copy.reference}</dt><dd className="mt-1 break-all font-semibold tabular-nums" dir="ltr">{attempt.reference}</dd></div>}
      {providerDue && <div className="col-span-2"><dt className="text-muted-foreground">{copy.due}</dt><dd className="mt-1 tabular-nums">{providerDue}</dd></div>}
    </dl>}
    {error && <p role="alert" className="text-sm text-destructive">{copy[error]}</p>}
    <div className="flex flex-wrap gap-2">
      {!readOnly && canCreate && !attempt && (!request || notFound) && <Button type="button" className="min-h-11 flex-1" disabled={!!busy || !checked} onClick={() => void createCharge()}>
        {busy === 'create' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {request ? copy.retry : orderId ? copy.start : copy.startTopup}
      </Button>}
      {(!!request || !!attempt || (!!orderId && !checked)) && <Button type="button" variant="outline" className="min-h-11" disabled={!!busy} onClick={() => void checkStatus()}>
        <RefreshCw className={`mr-2 h-4 w-4 ${busy === 'status' ? 'animate-spin' : ''}`} />{busy === 'status' ? copy.checking : copy.check}
      </Button>}
      {!readOnly && canCreate && terminal && (!orderId || attempt.state !== 'confirmed') && <Button type="button" variant="outline" className="min-h-11" disabled={!!busy} onClick={newTest}>{copy.newTest}</Button>}
    </div>
  </section>;
}
