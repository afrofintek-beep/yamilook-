import { supabase } from '@/integrations/supabase/client';
const OWNER = 'kosolola-push-owner';
export function pushAvailable() {
  return window.isSecureContext && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}
async function api(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('call-push', { body });
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
  if (!pushAvailable()) throw new Error('No iPhone, adiciona a KOSOLOLA ao ecrã principal e abre-a pelo ícone.');
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
  if (!pushAvailable()) return { supported: false, enabled: false, publicKey: null };
  const config = await api({ action: 'config' });
  const reg = await navigator.serviceWorker.getRegistration('/papos-app/');
  const subscription = reg && new URL(reg.scope).pathname === '/papos-app/' ? await reg.pushManager.getSubscription() : null;
  return { supported: true, enabled: Notification.permission === 'granted' && !!subscription && localStorage.getItem(OWNER) === userId, publicKey: config.publicKey as string | null };
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
