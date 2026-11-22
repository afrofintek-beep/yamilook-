/** Included in the existing scoped worker, never a competing registration. */
export const callPushWorker = `
self.addEventListener('push', event => {
 event.waitUntil((async () => {
  let payload; try { payload = event.data.json(); } catch { return; }
  if(payload.type === 'payment-request' && /^[0-9a-f-]{36}$/i.test(payload.conversationId) && /^[0-9a-f-]{36}$/i.test(payload.orderId)) {
   const path = '/papos-app/chat/' + payload.conversationId;
   const windows = await self.clients.matchAll({type:'window', includeUncontrolled:true});
   if(windows.some(client => client.focused && new URL(client.url).pathname === path)) return;
   await self.registration.showNotification('KOSOLOLA', {body:'Tem um pedido de pagamento na Kosolola.', tag:'massa-' + payload.orderId, data:{paymentChat:payload.conversationId}});
   return;
  }
  if(payload.type !== 'incoming-call' || typeof payload.callId !== 'string' || !/^[0-9a-f-]{36}$/i.test(payload.callId)) return;
  const stale = !Number.isFinite(payload.expiresAt) || payload.expiresAt <= Date.now();
  await self.registration.showNotification('KOSOLOLA', {
   body: stale ? 'Recebeste uma chamada. Abre a KOSOLOLA para consultar.' : 'Chamada recebida. Toca para abrir a KOSOLOLA.',
   icon: '/papos-app/kosolola-icon-192.png', tag: 'call-' + payload.callId,
   data: {callId: payload.callId, expiresAt: payload.expiresAt},
  });
 })());
});
self.addEventListener('notificationclick', event => {
 event.notification.close();
 event.waitUntil((async () => {
  const chat = event.notification.data?.paymentChat;
  if(typeof chat === 'string' && /^[0-9a-f-]{36}$/i.test(chat)) {
   await self.clients.openWindow('/papos-app/chat/' + chat);
   return;
  }
  // Never trust a payload URL, auto-answer, or request microphone access here.
  const url = new URL('/papos-app/papos', self.location.origin).href;
  const windows = await self.clients.matchAll({type:'window', includeUncontrolled:true});
  const app = windows.find(client => new URL(client.url).origin === self.location.origin && new URL(client.url).pathname.startsWith('/papos-app/'));
  if(app) { await app.focus(); app.postMessage({type:'kosolola:incoming-call'}); return; }
  await self.clients.openWindow(url);
 })());
});
`;
