import React from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import i18n from './i18n';
import './index.css';
import './features/papos/kosolola.css';
import { captureAppInstallPrompt } from '@/lib/app-install';
import { clearLegacyPrivateCache } from '@/lib/private-cache';
import PaposApp from './features/papos/PaposApp';
import { trackAssetLoadErrors } from '@/lib/asset-load-error';
trackAssetLoadErrors();
captureAppInstallPrompt();
void clearLegacyPrivateCache();

if ('serviceWorker' in navigator && import.meta.env.PROD && window.self === window.top) {
  const alreadyPapos = navigator.serviceWorker.controller?.scriptURL.includes('/papos-app/sw.js');
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (alreadyPapos) window.dispatchEvent(new Event('papos:update-ready')); });
  void navigator.serviceWorker.register('/papos-app/sw.js', { scope: '/papos-app/' }).then(registration => {
    const update = () => { void registration.update().catch(() => {}); };
    setInterval(update, 60 * 60 * 1000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') update(); });
  }).catch(error => console.warn('KOSOLOLA: atualização indisponível', error));
}
createRoot(document.getElementById('root')!).render(
  <React.StrictMode><I18nextProvider i18n={i18n}>
    <PaposApp />
  </I18nextProvider></React.StrictMode>
);
