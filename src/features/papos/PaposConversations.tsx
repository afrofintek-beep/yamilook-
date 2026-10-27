import { lazy, Suspense, useEffect, useState } from 'react';
import { Outlet, useMatch } from 'react-router-dom';
import PaposBrand from './PaposBrand';

const Home = lazy(() => import('@/pages/Home'));

export default function PaposConversations() {
  const [wide, setWide] = useState(() => window.matchMedia('(min-width: 1024px)').matches);
  const inChat = !!useMatch('/chat/:conversationId');
  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)');
    const update = () => setWide(media.matches);
    media.addEventListener('change', update);
    update();
    return () => media.removeEventListener('change', update);
  }, []);

  return <div className="kosolola-conversations">
    {(wide || !inChat) && <aside className="kosolola-list" aria-label="Conversas">
      <Suspense fallback={<div role="status">A carregar…</div>}><Home /></Suspense>
    </aside>}
    <section className="kosolola-conversation" hidden={!wide && !inChat} aria-label="Conversa">
      {inChat ? <Outlet /> : <div className="h-full flex items-center justify-center"><PaposBrand /></div>}
    </section>
  </div>;
}
