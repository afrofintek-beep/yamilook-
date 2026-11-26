const originList = () => (import.meta.env.VITE_MAGUELA_LOGIN_ORIGINS ?? '')
  .split(',').map((origin: string) => origin.trim()).filter((origin: string) => origin.startsWith('https://'));

export function maguelaLoginRequest(search: string) {
  if (import.meta.env.VITE_MAGUELA_LOGIN_ENABLED !== 'true') return null;
  const query = new URLSearchParams(search);
  const origin = query.get('origin');
  const state = query.get('state');
  const challenge = query.get('challenge');
  if (!origin || !originList().includes(origin) ||
      !state || !/^[a-f0-9-]{36}$/.test(state) ||
      !challenge || !/^[a-f0-9]{64}$/.test(challenge)) return null;
  return { origin, state, challenge };
}

export function maguelaLoginReturn(path: string) {
  const prefix = '/maguela-login?';
  return path.startsWith(prefix) && maguelaLoginRequest(path.slice(prefix.length)) ? path : null;
}
