import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Radio, Search, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import BottomNav from '@/components/BottomNav';
import { LiveGridCard } from '@/components/live/LiveGridCard';
import { StartLiveSheet } from '@/components/live/StartLiveSheet';
import { StreamErrorBanner } from '@/components/live/StreamErrorBanner';
import { useLiveStreamContext } from '@/components/live/LiveStreamProvider';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type LiveTab = 'para_ti' | 'banda' | 'em_alta' | 'explorar';

const TABS: { key: LiveTab; label: string }[] = [
  { key: 'para_ti', label: 'Para Ti' },
  { key: 'banda', label: 'Banda' },
  { key: 'em_alta', label: 'Em Alta' },
  { key: 'explorar', label: 'Explorar' },
];

export default function LiveHub() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, profile } = useAuth();
  const { isAdmin } = useAdmin();
  const { liveSessions, fetchLiveSessions, loading, streamError, clearStreamError } = useLiveStreamContext();
  const [startLiveOpen, setStartLiveOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [activeTab, setActiveTab] = useState<LiveTab>('para_ti');
  const [endingId, setEndingId] = useState<string | null>(null);
  const [ending, setEnding] = useState(false);

  useEffect(() => {
    fetchLiveSessions();
  }, [fetchLiveSessions]);

  const handleEndLive = async () => {
    if (!endingId) return;
    setEnding(true);
    const { error } = await supabase
      .from('live_sessions')
      .update({ status: 'ended', ended_at: new Date().toISOString() })
      .eq('id', endingId);
    setEnding(false);
    setEndingId(null);
    if (error) {
      toast.error('Não foi possível terminar a live');
    } else {
      toast.success('Live terminada');
      fetchLiveSessions();
    }
  };

  const filteredSessions = useMemo(() => {
    let sessions = liveSessions;

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      sessions = sessions.filter(s =>
        s.title.toLowerCase().includes(q) ||
        s.host?.display_name?.toLowerCase().includes(q) ||
        s.city?.toLowerCase().includes(q) ||
        s.neighborhood?.toLowerCase().includes(q)
      );
    }

    // Tab filter
    switch (activeTab) {
      case 'banda':
        // Filter by user's city/neighborhood
        if (profile?.city) {
          sessions = sessions.filter(s => s.city === profile.city);
        }
        break;
      case 'em_alta':
        // Sort by viewer count (trending)
        sessions = [...sessions].sort((a, b) => (b.viewer_count || 0) - (a.viewer_count || 0));
        break;
      case 'explorar':
      case 'para_ti':
      default:
        // Show all, default order
        break;
    }

    return sessions;
  }, [liveSessions, searchQuery, activeTab, profile?.city]);

  return (
    <div className="h-screen-safe overflow-hidden pb-[calc(5rem+env(safe-area-inset-bottom,0px))] bg-background flex flex-col">
      {/* Header - TikTok LIVE style */}
      <header className="shrink-0 relative z-50 bg-background safe-top">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-2">
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

        {/* Tabs - TikTok style */}
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
                  layoutId="live-tab-indicator"
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

        {/* Content */}
        <div className="p-2">
          {loading ? (
            /* Skeleton grid */
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
          ) : filteredSessions.length > 0 ? (
            /* TikTok-style grid: first item large, rest small */
            <div className="grid grid-cols-3 gap-1.5 auto-rows-auto">
              {filteredSessions.map((session, index) => (
                <LiveGridCard
                  key={session.id}
                  session={session}
                  isLarge={index === 0 && filteredSessions.length > 1}
                  onClick={() => navigate(`/live/${session.id}`)}
                  isOwnLive={!!user && session.host_id === user.id}
                  onEnd={() => setEndingId(session.id)}
                />
              ))}
            </div>
          ) : (
            /* Empty state */
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-20"
            >
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <Radio className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2 text-foreground">
                {activeTab === 'banda'
                  ? 'A banda está pausada na tua zona'
                  : 'A banda está pausada hoje'}
              </h3>
              <p className="text-muted-foreground text-sm mb-6">
                {activeTab === 'banda'
                  ? 'Quem vai abrir o Palco no teu bairro?'
                  : 'Quem vai abrir?'}
              </p>
              <Button
                className="rounded-full bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                onClick={() => setStartLiveOpen(true)}
              >
                🔴 Entrar na Banda
              </Button>
            </motion.div>
          )}
        </div>
      </ScrollArea>

      {/* FAB */}
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className="fixed bottom-24 right-6 w-14 h-14 rounded-full bg-destructive text-destructive-foreground shadow-lg flex items-center justify-center z-40"
        onClick={() => setStartLiveOpen(true)}
      >
        <Radio className="w-6 h-6" />
      </motion.button>

      <BottomNav />

      <StartLiveSheet open={startLiveOpen} onOpenChange={setStartLiveOpen} />

      <AlertDialog open={!!endingId} onOpenChange={(o) => !o && setEndingId(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Terminar a tua live?</AlertDialogTitle>
            <AlertDialogDescription>
              A transmissão será encerrada para todos os espectadores. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleEndLive}
              disabled={ending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl"
            >
              {ending ? 'A terminar…' : 'Terminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
