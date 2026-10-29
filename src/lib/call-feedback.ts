import { getSharedAudioContext } from './audio-context';

export function callErrorCode(error: unknown): string | null {
  const message = error && typeof error === 'object' && 'message' in error ? String(error.message) : '';
  return ['callee_busy', 'caller_busy', 'call_unavailable'].find(code => message === code) ?? null;
}
export function callOutcomeMessage(status: string, reason?: string | null) {
  if (reason === 'no_answer' || status === 'missed') return 'Sem resposta.';
  if (reason === 'cancelled') return 'Chamada cancelada.';
  if (reason === 'declined' || status === 'declined') return 'Chamada recusada.';
  if (status === 'failed') return 'Não foi possível estabelecer a chamada.';
  return 'Chamada terminada.';
}

/** One tone owner per app: short busy/end patterns and cancellable ringback.
 * Never waits for an autoplay permission prompt; visual feedback remains available. */
let stopCurrent: (() => void) | null = null;
export function stopCallTone() { stopCurrent?.(); stopCurrent = null; }
export function playCallTone(kind: 'busy' | 'ringback' | 'ended' | 'declined'): () => void {
  stopCallTone();
  const nodes = new Set<OscillatorNode>();
  let timer: ReturnType<typeof setInterval> | undefined;
  let ending: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true; clearInterval(timer); clearTimeout(ending);
    for (const node of nodes) { try { node.stop(); } catch { /* Already ended. */ } node.disconnect(); }
    nodes.clear();
    if (stopCurrent === stop) stopCurrent = null;
  };
  stopCurrent = stop;
  try {
    const audio = getSharedAudioContext();
    const pulse = () => {
      if (stopped || audio.state !== 'running') return;
      const duration = (kind === 'busy' || kind === 'declined') ? 0.45 : kind === 'ringback' ? 1 : 0.18;
      const gain = audio.createGain(); gain.connect(audio.destination);
      gain.gain.setValueAtTime(0.07, audio.currentTime);
      gain.gain.setValueAtTime(0.07, audio.currentTime + duration - 0.03);
      gain.gain.linearRampToValueAtTime(0, audio.currentTime + duration);
      const node = audio.createOscillator(); node.frequency.value = kind === 'ended' ? 400 : 425;
      node.connect(gain); nodes.add(node);
      node.onended = () => { nodes.delete(node); node.disconnect(); gain.disconnect(); };
      node.start(); node.stop(audio.currentTime + duration);
    };
    const begin = () => {
      if (stopped || audio.state !== 'running') return;
      clearTimeout(ending);
      pulse();
      if (kind !== 'ended') timer = setInterval(pulse, kind === 'ringback' ? 4000 : 900);
      if (kind !== 'ringback') ending = setTimeout(stop, kind === 'ended' ? 300 : 2600);
    };
    // Start the audible duration after resume, not while iOS is restoring audio.
    // A pending resume expires and can never restart a cancelled/replaced tone.
    if (audio.state !== 'running') {
      ending = setTimeout(stop, 5000);
      void audio.resume().then(begin).catch(stop);
    } else begin();
  } catch { stop(); }
  return stop;
}
