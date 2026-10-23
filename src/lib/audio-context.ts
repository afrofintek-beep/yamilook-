// Both applications share the call engine, without importing each other's routes.
let context: AudioContext | null = null;
export function getSharedAudioContext(): AudioContext {
  if (!context || context.state === 'closed') {
    context = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  }
  return context;
}
export function unlockCallAudio() {
  try {
    const audio = getSharedAudioContext();
    if (audio.state === 'suspended') void audio.resume().catch(() => {});
  } catch { /* The call screen reports unsupported audio when a call is started. */ }
}
