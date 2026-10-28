import { recoverApplicationAssets } from '@/lib/app-assets';
import { getSharedAudioContext } from '@/lib/audio-context';
import { useState, useEffect, Suspense, lazy, Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation, Outlet } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { OnlineStatusTracker } from "@/components/OnlineStatusTracker";
import { LiveStreamProvider } from "@/components/live/LiveStreamProvider";
import { GlobalMessageNotifier } from "@/components/GlobalMessageNotifier";
import { GlobalLiveInviteNotifier } from "@/components/GlobalLiveInviteNotifier";
import { KumbuEarnNotifier } from "@/components/KumbuEarnNotifier";
import ThemeSync from "@/components/ThemeSync";
import { AutomaticAccountBackup } from "@/components/AutomaticAccountBackup";


// Lazy load the ActiveCallProvider since it imports heavy WebRTC hooks
const ActiveCallProvider = lazy(() => import("@/components/calls/ActiveCallProvider").then(m => ({ default: m.ActiveCallProvider })));

// Lazy load all pages for faster initial load (Instagram/TikTok style)
const Home = lazy(() => import("./pages/Home"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Profile = lazy(() => import("./pages/Profile"));
const PublicProfile = lazy(() => import("./pages/PublicProfile"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Contacts = lazy(() => import("./pages/Contacts"));
const Chat = lazy(() => import("./pages/Chat"));
const Settings = lazy(() => import("./pages/Settings"));
const Calls = lazy(() => import("./pages/Calls"));
const ScheduledCallRoom = lazy(() => import('@/features/scheduled-calls/ScheduledCallRoom'));
const Call = lazy(() => import("./pages/Call"));
const Status = lazy(() => import("./pages/Status"));
const Feed = lazy(() => import("./pages/Feed"));
const Discover = lazy(() => import("./pages/Discover"));
const DevTools = lazy(() => import("./pages/DevTools"));
const Admin = lazy(() => import("./pages/Admin"));
const Moderation = lazy(() => import("./pages/Moderation"));
const Advertising = lazy(() => import("./pages/Advertising"));
const Notifications = lazy(() => import("./pages/Notifications"));
const BrandBook = lazy(() => import("./pages/BrandBook"));
const JoinGroup = lazy(() => import("./pages/JoinGroup"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const HelpCenter = lazy(() => import("./pages/HelpCenter"));
const LiveHub = lazy(() => import("./pages/LiveHub"));
const BandaHub = lazy(() => import("./pages/BandaHub"));
const Live = lazy(() => import("./pages/Live"));
const Ritmos = lazy(() => import("./pages/Ritmos"));
const Palco = lazy(() => import("./pages/Palco"));
const PalcoDetail = lazy(() => import("./pages/PalcoDetail"));
const CreatePalco = lazy(() => import("./pages/CreatePalco"));
const RodaView = lazy(() => import("./pages/RodaView"));
const VoicePool = lazy(() => import("./pages/VoicePool"));
const VoiceDetail = lazy(() => import("./pages/VoiceDetail"));
const CheckoutVoice = lazy(() => import("./pages/CheckoutVoice"));
const PurchaseSuccess = lazy(() => import("./pages/PurchaseSuccess"));
const GuideDashboard = lazy(() => import("./pages/GuideDashboard"));
const PalcoManage = lazy(() => import("./pages/PalcoManage"));
const Welcome = lazy(() => import("./pages/Welcome"));
const PromoVideos = lazy(() => import("./pages/PromoVideos"));
const Apply = lazy(() => import("./pages/Apply"));
const Install = lazy(() => import("./pages/Install"));
const Presentation = lazy(() => import("./pages/Presentation"));
const PresentationPrint = lazy(() => import("./pages/PresentationPrint"));
const UserAccountsManualPrint = lazy(() => import("./pages/UserAccountsManualPrint"));
const MokubHome = lazy(() => import("./features/mokubico/routes/MokubHome"));
const MokubicoSpace = lazy(() => import("./features/mokubico/routes/MokubicoSpace"));
const MokubicoConversa = lazy(() => import("./features/mokubico/routes/MokubicoConversa"));

// Academia da Banda
const AcademiaHome = lazy(() => import("./features/academia/routes/AcademiaHome"));
const AcademiaCreateSession = lazy(() => import("./features/academia/routes/AcademiaCreateSession"));
const AcademiaSession = lazy(() => import("./features/academia/routes/AcademiaSession"));
const MentorProfileScreen = lazy(() => import("./features/academia/routes/MentorProfileScreen"));
const AcademiaLiveRoom = lazy(() => import("./features/academia/routes/AcademiaLiveRoom"));

// Kumbu (monetização)
const KumbuWallet = lazy(() => import("./features/kumbu/routes/KumbuWallet"));
const KumbuHistory = lazy(() => import("./features/kumbu/routes/KumbuHistory"));
const RankingPage = lazy(() => import("./features/kumbu/routes/Ranking"));
const CreatorApply = lazy(() => import("./features/kumbu/routes/CreatorApply"));
const KumbuPayouts = lazy(() => import("./features/kumbu/routes/Payouts"));
const AdminMonetization = lazy(() => import("./features/kumbu/routes/AdminMonetization"));
const AdminApplications = lazy(() => import("./features/kumbu/routes/AdminApplications"));
const AdminAfrolocCertifications = lazy(() => import("./features/kumbu/routes/AdminAfrolocCertifications"));
const AdminPayoutsPage = lazy(() => import("./features/kumbu/routes/AdminPayouts"));
const AdminBilling = lazy(() => import("./pages/AdminBilling"));

// Minimal loading fallback (ultra fast perception)
function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-2 h-2 rounded-full bg-primary animate-pulse"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  );
}

// Detects the "stale service worker" state: a returning user's cached app shell
// references chunk filenames that no longer exist after a new deploy, so the
// dynamic import() rejects with a network/loading error.
function isChunkLoadError(error: unknown): boolean {
  const msg = String((error as Error)?.message || error || "");
  return /loading chunk|dynamically imported module|importing a module script failed|failed to fetch dynamically/i.test(
    msg
  );
}

// Self-heal: unregister the (stale) service worker, drop its caches, then reload
// so the browser fetches the current deploy fresh. Guarded against reload loops.
async function clearCachesAndReload() {
  try {
    await recoverApplicationAssets('/');
  } catch (e) {
    console.error("[clearCachesAndReload]", e);
  } finally {
    window.location.reload();
  }
}

// Error boundary to catch lazy-load (chunk) failures and prevent blank screen

const CHUNK_RECOVERY_KEY = "sw-chunk-recovery-at";

class LazyLoadErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[LazyLoadErrorBoundary]", error, info);
    // A chunk-load failure on a returning user is almost always a stale service
    // worker pointing at deleted chunks. Auto-recover once (avoid reload loops).
    if (isChunkLoadError(error)) {
      const last = Number(sessionStorage.getItem(CHUNK_RECOVERY_KEY) || 0);
      if (Date.now() - last > 20000) {
        sessionStorage.setItem(CHUNK_RECOVERY_KEY, String(Date.now()));
        clearCachesAndReload();
      }
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false });
  };

  handleReload = () => {
    // Thorough reload: clear the stale SW + caches so we don't reload the same
    // broken shell.
    clearCachesAndReload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4 px-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mb-2">
            <span className="text-3xl">⚠️</span>
          </div>
          <h2 className="text-lg font-semibold text-foreground">Erro ao carregar a página</h2>
          <p className="text-sm text-muted-foreground max-w-xs">
            Não foi possível apresentar esta página. Tenta novamente ou recarrega a aplicação.
          </p>
          <div className="flex gap-3">
            <button
              onClick={this.handleRetry}
              className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium"
            >
              Tentar novamente
            </button>
            <button
              onClick={this.handleReload}
              className="px-4 py-2 rounded-xl bg-secondary text-secondary-foreground text-sm font-medium"
            >
              Recarregar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // TikTok/Instagram-style: show stale data instantly, refetch in background
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes cache
      refetchOnWindowFocus: false,
      retry: 1,
      networkMode: 'offlineFirst',
    },
  },
});

function ProtectedRoute({ children, skipOnboardingCheck }: { children: React.ReactNode; skipOnboardingCheck?: boolean }) {
  const { user, profile, loading, profileError, refreshProfile, signOut } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-12 h-12 rounded-2xl bg-primary animate-pulse" />
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/welcome" replace />;
  }

  // Do not expose protected content while the profile is still being fetched.
  if (!skipOnboardingCheck && !profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center">
        <p role={profileError ? 'alert' : 'status'}>
          {profileError ? 'Não foi possível carregar o perfil. Verifique a ligação e tente novamente.' : 'A carregar perfil…'}
        </p>
        {profileError && (
          <>
            <button type="button" onClick={() => void refreshProfile()} className="rounded-lg bg-primary px-5 py-3 text-primary-foreground">
              Tentar novamente
            </button>
            <button type="button" onClick={() => void signOut('local')} className="rounded-lg px-5 py-2 underline">
              Iniciar sessão novamente
            </button>
          </>
        )}
      </div>
    );
  }

  // Redirect to onboarding if not completed (except on the onboarding page itself)
  if (!skipOnboardingCheck && profile && !profile.onboarding_completed) {
    return <Navigate to="/onboarding" replace />;
  }
  
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-12 h-12 rounded-2xl bg-primary animate-pulse" />
      </div>
    );
  }
  
  if (user) {
    return <Navigate to="/feed" replace />;
  }
  
  return <>{children}</>;
}

function AnimatedRoutes() {
  const location = useLocation();
  
  return (
    <LazyLoadErrorBoundary>
    <Suspense fallback={<PageLoader />}>
      <AnimatePresence mode="wait">
        <Routes location={location}>
          <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/profile/:userId" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/contacts" element={<ProtectedRoute><Contacts /></ProtectedRoute>} />
          <Route path="/chat/:conversationId" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="/calls" element={<ProtectedRoute><Calls /></ProtectedRoute>} />
          <Route path="/scheduled-call/:sessionId" element={<ProtectedRoute><ScheduledCallRoom /></ProtectedRoute>} />
          <Route path="/call/:callId" element={<ProtectedRoute><Call /></ProtectedRoute>} />
          <Route path="/status" element={<ProtectedRoute><Status /></ProtectedRoute>} />
          <Route path="/feed" element={<ProtectedRoute><Feed /></ProtectedRoute>} />
          <Route path="/muxi" element={<ProtectedRoute><Feed /></ProtectedRoute>} />
          <Route path="/mokubico" element={<ProtectedRoute><MokubHome /></ProtectedRoute>} />
          <Route path="/academia" element={<ProtectedRoute><AcademiaHome /></ProtectedRoute>} />
          <Route path="/academia/create" element={<ProtectedRoute><AcademiaCreateSession /></ProtectedRoute>} />
          <Route path="/academia/live/:sessionId" element={<ProtectedRoute><AcademiaLiveRoom /></ProtectedRoute>} />
          <Route path="/academia/mentor/:mentorId" element={<ProtectedRoute><MentorProfileScreen /></ProtectedRoute>} />
          <Route path="/academia/:sessionId" element={<ProtectedRoute><AcademiaSession /></ProtectedRoute>} />
          <Route path="/mokubico/conversa/:id" element={<ProtectedRoute><MokubicoConversa /></ProtectedRoute>} />
          <Route path="/mokubico/:space" element={<ProtectedRoute><MokubicoSpace /></ProtectedRoute>} />
          <Route path="/papos" element={<ProtectedRoute><Home /></ProtectedRoute>} />
          <Route path="/perfil" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/ritmos" element={<ProtectedRoute><Ritmos /></ProtectedRoute>} />
          
          <Route path="/palco" element={<ProtectedRoute><Palco /></ProtectedRoute>} />
          <Route path="/palco/dashboard" element={<ProtectedRoute><GuideDashboard /></ProtectedRoute>} />
          <Route path="/palco/:palcoId/manage" element={<ProtectedRoute><PalcoManage /></ProtectedRoute>} />
          <Route path="/palco/create" element={<ProtectedRoute><CreatePalco /></ProtectedRoute>} />
          <Route path="/palco/:palcoId/edit" element={<ProtectedRoute><CreatePalco /></ProtectedRoute>} />
          <Route path="/palco/:palcoId" element={<ProtectedRoute><PalcoDetail /></ProtectedRoute>} />
          <Route path="/palco/:palcoId/roda/:rodaId" element={<ProtectedRoute><RodaView /></ProtectedRoute>} />
          <Route path="/palco/:palcoId/roda/:rodaId/voices" element={<ProtectedRoute><VoicePool /></ProtectedRoute>} />
          <Route path="/palco/:palcoId/roda/:rodaId/voz/:vozId" element={<ProtectedRoute><VoiceDetail /></ProtectedRoute>} />
          <Route path="/palco/:palcoId/roda/:rodaId/checkout" element={<ProtectedRoute><CheckoutVoice /></ProtectedRoute>} />
          <Route path="/palco/:palcoId/roda/:rodaId/success" element={<ProtectedRoute><PurchaseSuccess /></ProtectedRoute>} />
          <Route path="/discover" element={<ProtectedRoute><Discover /></ProtectedRoute>} />
          <Route path="/dev" element={<DevTools />} />
          <Route path="/dev-tools" element={<DevTools />} />
          <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
          <Route path="/admin/monetization" element={<ProtectedRoute><AdminMonetization /></ProtectedRoute>} />
          <Route path="/admin/applications" element={<ProtectedRoute><AdminApplications /></ProtectedRoute>} />
          <Route path="/admin/afroloc-certifications" element={<ProtectedRoute><AdminAfrolocCertifications /></ProtectedRoute>} />
          <Route path="/admin/payouts" element={<ProtectedRoute><AdminPayoutsPage /></ProtectedRoute>} />
          <Route path="/admin/billing" element={<ProtectedRoute><AdminBilling /></ProtectedRoute>} />
          <Route path="/moderation" element={<ProtectedRoute><Moderation /></ProtectedRoute>} />
          <Route path="/advertising" element={<ProtectedRoute><Advertising /></ProtectedRoute>} />
          <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
          <Route path="/kumbu" element={<ProtectedRoute><KumbuWallet /></ProtectedRoute>} />
          <Route path="/kumbu/history" element={<ProtectedRoute><KumbuHistory /></ProtectedRoute>} />
          <Route path="/ranking" element={<ProtectedRoute><RankingPage /></ProtectedRoute>} />
          <Route path="/creator/apply" element={<ProtectedRoute><CreatorApply /></ProtectedRoute>} />
          <Route path="/payouts" element={<ProtectedRoute><KumbuPayouts /></ProtectedRoute>} />
          <Route path="/brand-book" element={<BrandBook />} />
          <Route path="/promo" element={<PromoVideos />} />
          <Route path="/apply" element={<Apply />} />
          <Route path="/install" element={<Install />} />
          <Route path="/apresentacao" element={<Presentation />} />
          <Route path="/apresentacao/pdf" element={<PresentationPrint />} />
          <Route path="/manual/contas/pdf" element={<UserAccountsManualPrint />} />
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/help" element={<HelpCenter />} />
          <Route path="/join/:code" element={<JoinGroup />} />
          {/* ONE shared LiveStreamProvider across the banda hub and the live
              view so the host's room survives navigation (/banda → /live/:id).
              Separate providers were unmounting the room mid-transition, which
              ended the live the instant it opened. */}
          <Route
            element={
              <ProtectedRoute>
                <LiveStreamProvider>
                  <Outlet />
                </LiveStreamProvider>
              </ProtectedRoute>
            }
          >
            <Route path="/banda" element={<BandaHub />} />
            <Route path="/live" element={<LiveHub />} />
            <Route path="/live/:sessionId" element={<Live />} />
          </Route>
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
          <Route path="/welcome" element={<PublicRoute><Welcome /></PublicRoute>} />
          <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
          <Route path="/reset-password" element={<PublicRoute><ResetPassword /></PublicRoute>} />
          {/* Open to everyone (authed or not) — ecosystem deep-link target */}
          <Route path="/u/:username" element={<PublicProfile />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AnimatePresence>
    </Suspense>
    </LazyLoadErrorBoundary>
  );
}

function AppContent() {



  // Catch unhandled promise rejections to prevent blank screens
  useEffect(() => {
    const handleRejection = (event: PromiseRejectionEvent) => {
      console.error('Unhandled rejection:', event.reason);
      event.preventDefault();
    };
    window.addEventListener('unhandledrejection', handleRejection);
    return () => window.removeEventListener('unhandledrejection', handleRejection);
  }, []);

  // Unlock AudioContext on FIRST user gesture anywhere in the app.
  // This ensures the ringtone can play when an incoming call arrives via Realtime.
  useEffect(() => {
    const unlock = () => {
      const ctx = getSharedAudioContext();
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {/* non-fatal */});
      }
      document.removeEventListener('click', unlock, true);
      document.removeEventListener('touchstart', unlock, true);
      document.removeEventListener('keydown', unlock, true);
    };
    document.addEventListener('click', unlock, true);
    document.addEventListener('touchstart', unlock, true);
    document.addEventListener('keydown', unlock, true);
    return () => {
      document.removeEventListener('click', unlock, true);
      document.removeEventListener('touchstart', unlock, true);
      document.removeEventListener('keydown', unlock, true);
    };
  }, []);

  return (
    <BrowserRouter>

      <OnlineStatusTracker />
      <GlobalMessageNotifier />
      <GlobalLiveInviteNotifier />
      <KumbuEarnNotifier />
      <ThemeSync />
      <AutomaticAccountBackup />
      <ActiveCallProvider>
        <AnimatedRoutes />
      </ActiveCallProvider>
    </BrowserRouter>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AppContent />
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
