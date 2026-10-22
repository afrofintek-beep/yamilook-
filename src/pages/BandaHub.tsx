import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Radio, Search, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import BottomNav from '@/components/BottomNav';
import { LiveGridCard } from '@/components/live/LiveGridCard';
import { StartLiveSheet } from '@/components/live/StartLiveSheet';
import { StreamErrorBanner } from '@/components/live/StreamErrorBanner';
import { useLiveStreamContext } from '@/components/live/LiveStreamProvider';
import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

type BandaTab = 'para_ti' | 'banda' | 'em_alta' | 'explorar';

const TABS: { key: BandaTab; label: string }[] = [
  { key: 'para_ti', label: 'Para Ti' },
  { key: 'banda', label: 'Banda' },
  { key: 'em_alta', label: 'Em Alta' },
  { key: 'explorar', label: 'Explorar' },
];

export default function BandaHub() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { liveSessions, fetchLiveSessions, loading, streamError, clearStreamError, forceEndSession } = useLiveStreamContext();
  const [startLiveOpen, setStartLiveOpen] = useState(false);
  const [confirmEndOpen, setConfirmEndOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [activeTab, setActiveTab] = useState<BandaTab>('para_ti');

  useEffect(() => {
    fetchLiveSessions();
  }, [fetchLiveSessions]);

  const filteredSessions = useMemo(() => {
    let sessions = liveSessions;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      sessions = sessions.filter(s =>
        s.title.toLowerCase().includes(q) ||
        s.host?.display_name?.toLowerCase().includes(q) ||
        s.city?.toLowerCase().includes(q) ||
        s.neighborhood?.toLowerCase().includes(q)
      );
    }

    switch (activeTab) {
      case 'banda':
        if (profile?.city) {
          sessions = sessions.filter(s => s.city === profile.city);
        }
        break;
      case 'em_alta':
        sessions = [...sessions].sort((a, b) => (b.viewer_count || 0) - (a.viewer_count || 0));
        break;
      case 'explorar':
      case 'para_ti':
      default:
        break;
    }

    return sessions;
  }, [liveSessions, searchQuery, activeTab, profile?.city]);

  // Find the first active host for the collective message
  const firstActiveHost = filteredSessions.length > 0 ? filteredSessions[0].host : null;
  const hasActiveSessions = filteredSessions.length > 0;

  // Check if current user has an active live session
  const myActiveSession = liveSessions.find(s => s.host_id === user?.id && s.status === 'live');

  const handleEndMyLive = async () => {
    if (!myActiveSession) return;

    try {
      await forceEndSession(myActiveSession.id);
      fetchLiveSessions();
    } catch (e) {
      console.warn('[BandaHub] Error ending stream:', e);
    }
    setConfirmEndOpen(false);
  };

  return (
    <div className="h-screen-safe overflow-hidden pb-[calc(5rem+env(safe-area-inset-bottom,0px))] bg-background flex flex-col">
      {/* Header */}
      <header className="shrink-0 relative z-50 bg-background safe-top">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">📡</span>
            <span className="font-bold text-base text-foreground tracking-tight">Na Banda Ao Vivo</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={() => setShowSearch(!showSearch)}
            >
              <Search className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={() => fetchLiveSessions()}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Search bar (collapsible) */}
        {showSearch && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-4 pb-2"
          >
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Procurar na banda..."
                className="pl-10 rounded-full bg-muted border-0"
                autoFocus
              />
            </div>
          </motion.div>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-0 px-2 border-b border-border/30">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`relative flex-1 py-2.5 text-sm font-medium text-center transition-colors ${
                activeTab === tab.key
                  ? 'text-foreground'
                  : 'text-muted-foreground'
              }`}
            >
              {tab.label}
              {activeTab === tab.key && (
                <motion.div
                  layoutId="banda-tab-indicator"
                  className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-foreground rounded-full"
                />
              )}
            </button>
          ))}
        </div>
      </header>

      <ScrollArea className="min-h-0 flex-1 [&_[data-radix-scroll-area-viewport]]:overscroll-y-contain">
        {/* Error Banner */}
        {streamError && (
          <StreamErrorBanner
            error={streamError}
            onDismiss={clearStreamError}
            onRetry={() => {
              clearStreamError();
              setStartLiveOpen(true);
            }}
          />
        )}

        {/* My active live banner */}
        {myActiveSession && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-2 mt-2 px-4 py-3 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 rounded-full bg-destructive animate-pulse flex-shrink-0" />
              <p className="text-sm font-medium text-foreground truncate">
                A tua live está ativa
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                size="sm"
                variant="outline"
                className="rounded-full text-xs"
                onClick={() => navigate(`/live/${myActiveSession.id}`)}
              >
                Entrar
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="rounded-full text-xs"
                onClick={() => setConfirmEndOpen(true)}
              >
                Encerrar
              </Button>
            </div>
          </motion.div>
        )}

        <div className="p-2">
          {loading ? (
            <div className="grid grid-cols-3 gap-1.5">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
                <div
                  key={i}
                  className={`bg-muted rounded-xl animate-pulse ${
                    i === 1 ? 'aspect-[4/5] col-span-2 row-span-2' : 'aspect-square'
                  }`}
                />
              ))}
            </div>
          ) : hasActiveSessions ? (
            <>
              {/* Collective state message */}
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 px-3 py-4 rounded-2xl bg-primary/5 border border-primary/10 text-center"
              >
                <p className="text-sm text-foreground font-medium mb-1">
                  A banda está ao vivo.
                </p>
                {firstActiveHost && (
                  <div className="flex items-center justify-center gap-2 mb-3">
                    <Avatar className="w-6 h-6">
                      <AvatarImage src={firstActiveHost.avatar_url || ''} />
                      <AvatarFallback className="text-[10px] bg-primary text-primary-foreground">
                        {firstActiveHost.display_name?.[0] || 'G'}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm text-muted-foreground">
                      {firstActiveHost.display_name} está no Palco.
                    </span>
                  </div>
                )}
                <Button
                  className="rounded-full bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                  onClick={() => navigate(`/live/${filteredSessions[0].id}`)}
                >
                  🔴 Entrar no Palco
                </Button>
              </motion.div>

              {/* Grid */}
              <div className="grid grid-cols-3 gap-1.5 auto-rows-auto">
                {filteredSessions.map((session, index) => (
                  <LiveGridCard
                    key={session.id}
                    session={session}
                    isLarge={index === 0 && filteredSessions.length > 1}
                    onClick={() => navigate(`/live/${session.id}`)}
                  />
                ))}
              </div>
            </>
          ) : (
            /* Empty state — nobody live */
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-20"
            >
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">📡</span>
              </div>
              <p className="text-base font-medium text-foreground mb-1">
                A banda está pausada hoje.
              </p>
              <p className="text-sm text-muted-foreground mb-6">
                Quem vai abrir?
              </p>
              <Button
                className="rounded-full bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                onClick={() => setStartLiveOpen(true)}
              >
                🔴 Abrir o Palco
              </Button>
            </motion.div>
          )}
        </div>
      </ScrollArea>

      {/* FAB - Abrir o Palco */}
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className="fixed bottom-24 right-6 w-14 h-14 rounded-full bg-destructive text-destructive-foreground shadow-lg flex items-center justify-center z-40"
        onClick={() => setStartLiveOpen(true)}
        title="Abrir o Palco"
      >
        <Radio className="w-6 h-6" />
      </motion.button>

      <BottomNav />
      <StartLiveSheet open={startLiveOpen} onOpenChange={setStartLiveOpen} />

      {/* Confirm end live dialog */}
      <AlertDialog open={confirmEndOpen} onOpenChange={setConfirmEndOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Encerrar a tua live?</AlertDialogTitle>
            <AlertDialogDescription>
              A transmissão será terminada e todos os espectadores serão desconectados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleEndMyLive} className="bg-destructive hover:bg-destructive/90">
              Encerrar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
