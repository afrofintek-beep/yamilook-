/** Persist only a bounded setup stage and error class, never tokens or device identifiers. */
export function callSetupFailure(stage: string, error: unknown) {
  const name = error && typeof error === 'object' && 'name' in error ? String(error.name) : 'Error';
  const safeName = /^[A-Za-z]{1,40}$/.test(name) ? name : 'Error';
  const safeStage = ['microphone', 'create', 'claim', 'token', 'sdk', 'room_connect', 'microphone_publish', 'camera', 'accept'].includes(stage) ? stage : 'unknown';
  let message = error instanceof Error ? error.message : 'Não foi possível estabelecer a chamada.';
  if (['NotAllowedError', 'SecurityError'].includes(name)) message = 'O microfone não foi autorizado. Permite o acesso ao microfone nas definições deste site e tenta novamente.';
  else if (name === 'NotFoundError') message = 'Não foi encontrado um microfone neste dispositivo.';
  else if (['NotReadableError', 'AbortError'].includes(name)) message = 'Não foi possível abrir o microfone. Fecha outras aplicações que o estejam a utilizar e tenta novamente.';
  else if (stage === 'room_connect') message = 'Não foi possível ligar ao serviço de chamadas. Verifica a ligação à Internet e tenta novamente.';
  return { message, reason: `transport_failed:${safeStage}:${safeName}` };
}
