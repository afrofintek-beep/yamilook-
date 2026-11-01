import { supabase } from '@/integrations/supabase/client';
const OWNER = 'kosolola-push-owner';
export function callPushSupport() {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    window.matchMedia?.('(display-mode: standalone)').matches === true;
  if (ios && !standalone) return { supported: false, message: 'No iPhone ou iPad, usa Partilhar → Adicionar ao ecrã principal e abre a KOSOLOLA pelo ícone para ativar os alertas.' };
  if (!window.isSecureContext) return { supported: false, message: 'Abre a KOSOLOLA através de uma ligação HTTPS para ativar os alertas.' };
  if (!('serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window)) {
    return { supported: false, message: ios ? 'Atualiza o iPhone ou iPad para iOS 16.4 ou posterior e abre a KOSOLOLA pelo ícone no ecrã principal.' : 'Este navegador não suporta alertas de chamadas. Usa um navegador atualizado com suporte a notificações.' };
  }
  return { supported: true, message: null };
}
export function pushAvailable() {
  return callPushSupport().supported;
}
async function api(body: Record<string, unknown>, signal?: AbortSignal) {
  const { data, error } = await supabase.functions.invoke('call-push', { body, ...(signal ? { signal } : {}) });
  if (error || data?.error) throw new Error('Não foi possível contactar o serviço de alertas. Tenta novamente.');
  return data;
}
async function registration() {
  // Never wait indefinitely for navigator.serviceWorker.ready, or use Yamilook's worker.
  const reg = await navigator.serviceWorker.getRegistration('/papos-app/');
  if (!reg?.active || new URL(reg.scope).pathname !== '/papos-app/') throw new Error('Atualiza a KOSOLOLA e volta a tentar.');
  return reg;
}
export async function enableCallPush(userId: string, publicKey: string) {
  const support = callPushSupport();
  if (!support.supported) throw new Error(support.message!);
  // Permission must be requested directly from the user's tap, before network awaits.
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Autoriza as notificações nas definições do dispositivo para receber alertas.');
  const reg = await registration();
  let subscription = await reg.pushManager.getSubscription();
  if (subscription && localStorage.getItem(OWNER) !== userId) {
    await subscription.unsubscribe(); subscription = null;
  }
  const key = Uint8Array.from(atob(publicKey.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
  subscription ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  try {
    await api({ action: 'subscribe', subscription: subscription.toJSON() });
    localStorage.setItem(OWNER, userId);
  } catch (error) { await subscription.unsubscribe(); throw error; }
}
export async function disableCallPush() {
  if (!('serviceWorker' in navigator)) return;
  const reg = await navigator.serviceWorker.getRegistration('/papos-app/');
  if (!reg || new URL(reg.scope).pathname !== '/papos-app/') return;
  const subscription = await reg.pushManager.getSubscription();
  if (subscription) {
    // Local unsubscribe prevents delivery even if the network is unavailable.
    const removed = await subscription.unsubscribe();
    if (!removed && await reg.pushManager.getSubscription()) throw new Error('Não foi possível desativar os alertas neste dispositivo.');
    await api({ action: 'remove', endpoint: subscription.endpoint }).catch(() => {});
  }
  for (const notice of await reg.getNotifications()) notice.close();
  localStorage.removeItem(OWNER);
}
export async function callPushStatus(userId: string) {
  const support = callPushSupport();
  if (!support.supported) return { ...support, enabled: false, publicKey: null, permission: null };
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    // Bound both the config request (including auth) and Safari's worker lookup.
    // A stalled browser/API must not leave the activation button inert forever.
    return await Promise.race([
      (async () => {
        const config = await api({ action: 'config' }, controller.signal);
        const reg = await navigator.serviceWorker.getRegistration('/papos-app/');
        const subscription = reg && new URL(reg.scope).pathname === '/papos-app/' ? await reg.pushManager.getSubscription() : null;
        return { ...support, permission: Notification.permission, enabled: Notification.permission === 'granted' && !!subscription && localStorage.getItem(OWNER) === userId, publicKey: typeof config?.publicKey === 'string' && config.publicKey.trim() ? config.publicKey : null };
      })(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error('A verificação dos alertas demorou demasiado. Verifica a ligação e toca em Tentar novamente.'));
          controller.abort();
        }, 12000);
      }),
    ]);
  } finally { clearTimeout(timer); }
}
export async function refreshCallPush(userId: string) {
  if (!pushAvailable()) return;
  const reg = await navigator.serviceWorker.getRegistration('/papos-app/');
  if (!reg || new URL(reg.scope).pathname !== '/papos-app/') return;
  const subscription = await reg.pushManager.getSubscription();
  if (!subscription) return;
  if (localStorage.getItem(OWNER) !== userId) { await disableCallPush(); return; }
  await api({ action: 'subscribe', subscription: subscription.toJSON() });
}
export async function notifyIncomingCall(callId: string) {
  // Do not fail an otherwise working call if push delivery is unavailable.
  try { await api({ action: 'send', callId }); }
  catch { console.warn('Alerta push indisponível; a chamada continua na aplicação.'); }
}
