export type CallTermination = { status: string; end_reason?: string | null };
type CallUpdate = string | CallTermination;
const terminalCallStatuses = new Set(['ended', 'declined', 'missed', 'failed', 'cancelled']);

/** Release local devices before any network request (including a hung request). */
export async function finishCallLocallyFirst(
  release: () => void,
  notify: () => Promise<unknown>,
  persist: () => Promise<unknown>,
) {
  release();
  return Promise.allSettled([Promise.resolve().then(notify), Promise.resolve().then(persist)]);
}

/** Realtime is an optimization; polling/resume also reconcile the authoritative row. */
export function watchCallTermination({ read, subscribe, onEnded, intervalMs = 2000 }: {
  read: () => Promise<CallUpdate | null>;
  subscribe: (listener: (status: CallUpdate) => void) => () => void;
  onEnded: (outcome: CallTermination) => void;
  intervalMs?: number;
}) {
  let stopped = false;
  let busy = false;
  const accept = (update: CallUpdate | null) => {
    const outcome = typeof update === 'string' ? { status: update } : update;
    const status = outcome?.status;
    if (!stopped && status && terminalCallStatuses.has(status)) {
      stopped = true;
      onEnded(outcome!);
    }
  };
  const poll = async () => {
    if (stopped || busy) return;
    busy = true;
    try {
      accept(await read());
    } catch {
      // A network failure is not evidence that the peer hung up.
    } finally {
      busy = false;
    }
  };
  const unsubscribe = subscribe(accept);
  const timer = setInterval(() => void poll(), intervalMs);
  const resume = () => { if (document.visibilityState === 'visible') void poll(); };
  document.addEventListener('visibilitychange', resume);
  window.addEventListener('online', poll);
  void poll();
  return () => {
    stopped = true;
    clearInterval(timer);
    unsubscribe();
    document.removeEventListener('visibilitychange', resume);
    window.removeEventListener('online', poll);
  };
}
