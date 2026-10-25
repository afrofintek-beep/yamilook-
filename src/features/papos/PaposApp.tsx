import { refreshCallPush } from '@/lib/call-push';
import { Component, lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes, Outlet, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { AppSurfaceContext } from '@/lib/app-surface';
import { unlockCallAudio } from '@/lib/audio-context';
import { recoverApplicationAssets } from '@/lib/app-assets';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { Button } from '@/components/ui/button';
import { OnlineStatusTracker } from '@/components/OnlineStatusTracker';
import { GlobalMessageNotifier } from '@/components/GlobalMessageNotifier';
import ThemeSync from '@/components/ThemeSync';
import BottomNav from '@/components/BottomNav';
import PaposLogin from './PaposLogin';
import PaposInstall from './PaposInstall';
const Home = lazy(() => import('@/pages/Home'));
const Chat = lazy(() => import('@/pages/Chat'));
const Contacts = lazy(() => import('@/pages/Contacts'));
const Calls = lazy(() => import('@/pages/Calls'));
const ScheduledCallRoom = lazy(() => import('@/features/scheduled-calls/ScheduledCallRoom'));
const Call = lazy(() => import('@/pages/Call'));
const Status = lazy(() => import('@/pages/Status'));
const JoinGroup = lazy(() => import('@/pages/JoinGroup'));
const PaposSettings = lazy(() => import('./PaposSettings'));
const PaposProfile = lazy(() => import('./PaposProfile'));
const ActiveCallProvider = lazy(() => import('@/components/calls/ActiveCallProvider').then(module => ({ default: module.ActiveCallProvider })));
const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, retry: 1, refetchOnWindowFocus: false } } });
export function PaposGate({ children }: { children: ReactNode }) {
  const { user, profile, loading, refreshProfile } = useAuth(); const location = useLocation();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />;
  if (!profile) return <main className="min-h-screen-safe safe-top p-6 space-y-4"><p>Não foi possível carregar o perfil.</p><Button onClick={() => void refreshProfile()}>Tentar novamente</Button></main>;
  if (!profile.onboarding_completed) return <main className="min-h-screen-safe safe-top p-6 space-y-4"><h1 className="text-2xl font-bold">Conclui a tua conta</h1><p>A tua conta é partilhada com a Yamilook. Conclui os dados pendentes e volta à KOSOLOLA.</p><Button asChild><a href="https://www.yamilook.com/onboarding">Continuar a inscrição</a></Button></main>;
  return <>{children}</>;
}
function Loading() { return <div role="status" className="h-screen-safe flex items-center justify-center">A carregar a KOSOLOLA…</div>; }
class PaposBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <main className="min-h-screen-safe safe-top p-6 space-y-4"><h1 className="text-xl font-bold">Não foi possível abrir esta página</h1><p>Verifica a ligação e tenta novamente. A tua conta mantém-se guardada.</p><Button onClick={() => { void recoverApplicationAssets('/papos-app/').finally(() => window.location.reload()); }}>Recarregar KOSOLOLA</Button></main> : this.props.children;
  }
}
function PaposRuntime() {
  const [updateReady, setUpdateReady] = useState(false);
  const { user } = useAuth();
  useEffect(() => {
    if (!user) return;
    const refresh = () => { if (document.visibilityState === 'visible') void refreshCallPush(user.id).catch(() => {}); };
    refresh(); document.addEventListener('visibilitychange', refresh);
    return () => document.removeEventListener('visibilitychange', refresh);
  }, [user?.id]);
  useEffect(() => {
    const unlock = () => { unlockCallAudio(); document.removeEventListener('click', unlock, true); document.removeEventListener('touchstart', unlock, true); document.removeEventListener('keydown', unlock, true); };
    document.addEventListener('click', unlock, true); document.addEventListener('touchstart', unlock, true); document.addEventListener('keydown', unlock, true);
    const update = () => setUpdateReady(true); window.addEventListener('papos:update-ready', update);
    return () => { document.removeEventListener('click', unlock, true); document.removeEventListener('touchstart', unlock, true); document.removeEventListener('keydown', unlock, true); window.removeEventListener('papos:update-ready', update); };
  }, []);
  return <><OnlineStatusTracker /><GlobalMessageNotifier /><ThemeSync />
    {updateReady && <aside className="fixed top-0 safe-top inset-x-0 z-[200] p-3 bg-primary text-primary-foreground flex items-center justify-between gap-3"><span className="text-sm">Nova versão da KOSOLOLA disponível.</span><Button variant="outline" onClick={() => window.location.reload()}>Atualizar</Button></aside>}
    <PaposBoundary><Suspense fallback={<Loading />}><Routes>
      <Route path="/login" element={<PaposLogin />} /><Route path="/welcome" element={<Navigate to="/login" replace />} />
      <Route path="/install" element={<PaposInstall />} />
      <Route element={<PaposGate><ActiveCallProvider><Outlet /></ActiveCallProvider></PaposGate>}>
      <Route path="/" element={<Navigate to="/papos" replace />} />
      <Route path="/papos" element={<Home />} />
      <Route path="/chat/:conversationId" element={<Chat />} />
      <Route path="/contacts" element={<Contacts />} />
      <Route path="/calls" element={<div className="h-screen-safe overflow-y-auto pb-[calc(5rem+env(safe-area-inset-bottom,0px))]"><Calls /><BottomNav /></div>} />
      <Route path="/scheduled-call/:sessionId" element={<ScheduledCallRoom />} />
      <Route path="/call/:callId" element={<Call />} />
      <Route path="/status" element={<Status />} />
      <Route path="/settings" element={<PaposSettings />} />
      <Route path="/profile" element={<PaposProfile />} />
      <Route path="/perfil" element={<Navigate to="/profile" replace />} />
      <Route path="/profile/:userId" element={<PaposProfile />} />
      <Route path="/join/:code" element={<JoinGroup />} />
      </Route>
      <Route path="*" element={<main className="min-h-screen-safe safe-top p-6 space-y-4"><h1 className="text-xl font-bold">Esta página não está na KOSOLOLA</h1><Button asChild><Link to="/papos">Voltar às conversas</Link></Button><Button asChild variant="outline"><a href="https://www.yamilook.com/muxi">Abrir Yamilook</a></Button></main>} />
    </Routes></Suspense></PaposBoundary></>;
}
export default function PaposApp() {
  return <AppSurfaceContext.Provider value="papos"><QueryClientProvider client={queryClient}><AuthProvider><TooltipProvider><Toaster /><Sonner /><BrowserRouter basename="/papos-app"><PaposRuntime /></BrowserRouter></TooltipProvider></AuthProvider></QueryClientProvider></AppSurfaceContext.Provider>;
}
