import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Radio, Users, Sparkles, Headphones } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { MOKUBICO_COPY } from '../copy';
import { useActiveLiveSession, useBandaActiveCount, useNovidadesCount, useBandaActiveMembers } from '../hooks/useMokubicoData';

export function LiveSummaryCard() {
  const navigate = useNavigate();
  const [membersOpen, setMembersOpen] = useState(false);
  const members = useBandaActiveMembers(membersOpen);
  const { data: liveSession } = useActiveLiveSession();
  const { data: bandaCount } = useBandaActiveCount();
  const { data: novidades } = useNovidadesCount();

  return (
    <section className="space-y-3">
      {/* Palco ao vivo */}
      <AnimatePresence mode="wait">
        {liveSession ? (
          <motion.div
            key="live"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4 }}
            className="relative overflow-hidden rounded-2xl border border-destructive/20"
          >
            {/* Animated gradient background */}
            <div className="absolute inset-0 bg-gradient-to-r from-destructive/15 via-primary/10 to-destructive/15 animate-pulse" />
            <div className="absolute top-0 right-0 w-32 h-32 bg-destructive/10 rounded-full blur-3xl -translate-y-8 translate-x-8" />
            <div className="absolute bottom-0 left-0 w-20 h-20 bg-primary/10 rounded-full blur-2xl translate-y-6 -translate-x-4" />
            
            <div className="relative flex items-center justify-between gap-3 p-4">
              <div className="flex items-center gap-3 min-w-0">
                {/* Pulsing live icon */}
                <div className="relative h-12 w-12 rounded-xl bg-destructive/20 flex items-center justify-center shrink-0">
                  <div className="absolute inset-0 rounded-xl bg-destructive/20 animate-ping opacity-30" />
                  <Headphones className="h-5 w-5 text-destructive relative z-10" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground">{MOKUBICO_COPY.palcoLiveNow}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {liveSession.hostName} — {liveSession.title}
                  </p>
                  {liveSession.viewerCount > 0 && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="flex items-center gap-1 text-[10px] text-destructive/80">
                        <Users className="h-2.5 w-2.5" />
                        {liveSession.viewerCount} a ouvir
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <Button
                size="sm"
                variant="destructive"
                className="rounded-full text-xs h-9 px-5 shrink-0 font-semibold shadow-lg shadow-destructive/25"
                onClick={() => navigate(`/live/${liveSession.id}`)}
              >
                {MOKUBICO_COPY.enterPalco}
              </Button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="offline"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4 }}
            className="rounded-2xl bg-card border border-border/30 p-4 flex items-center gap-3 cursor-pointer active:scale-[0.98] transition-transform"
            onClick={() => navigate('/palco')}
          >
            <div className="h-11 w-11 rounded-xl bg-muted flex items-center justify-center shrink-0">
              <Radio className="h-5 w-5 text-muted-foreground/50" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">Nenhum palco ao vivo</p>
              <p className="text-[10px] text-muted-foreground/50">Sê o primeiro a abrir uma roda</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mini stats */}
      <div className="grid grid-cols-2 gap-3">
        <motion.button
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.15, duration: 0.4 }}
          className="text-left min-w-0 rounded-2xl bg-card border border-border/30 p-3.5 flex items-center gap-3 group hover:border-primary/20 transition-colors duration-300 cursor-pointer active:scale-[0.97]"
          type="button"
          aria-label="Ver membros da banda ativa"
          onClick={() => setMembersOpen(true)}
        >
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/15 transition-colors">
            <Users className="h-4.5 w-4.5 text-primary" />
          </div>
          <div>
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{MOKUBICO_COPY.bandaActive}</p>
            <p className="text-xl font-bold text-foreground tabular-nums">{bandaCount ?? 0}</p>
          </div>
        </motion.button>
        <motion.div
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="rounded-2xl bg-card border border-border/30 p-3.5 flex items-center gap-3 group hover:border-success/20 transition-colors duration-300 cursor-pointer active:scale-[0.97]"
          onClick={() => navigate('/muxi')}
        >
          <div className="h-10 w-10 rounded-xl bg-success/10 flex items-center justify-center shrink-0 group-hover:bg-success/15 transition-colors">
            <Sparkles className="h-4.5 w-4.5 text-success" />
          </div>
          <div>
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{MOKUBICO_COPY.news}</p>
            <p className="text-xl font-bold text-foreground tabular-nums">{novidades ?? 0}</p>
          </div>
        </motion.div>
      </div>
      <Sheet open={membersOpen} onOpenChange={setMembersOpen}>
        <SheetContent side="bottom" className="h-[80dvh] rounded-t-2xl flex flex-col overflow-hidden pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
          <SheetHeader className="shrink-0 pr-10">
            <SheetTitle>Membros da banda</SheetTitle>
            <SheetDescription>Pessoas que pertencem à tua banda selecionada.</SheetDescription>
          </SheetHeader>
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain mt-4 space-y-1">
            {members.isLoading ? <p role="status">A carregar membros…</p> : members.isError ? <div role="alert"><p>Não foi possível carregar a banda.</p><Button variant="outline" onClick={() => void members.refetch()}>Tentar novamente</Button></div> : !members.data?.length ? <p>A tua banda ainda não tem membros disponíveis.</p> : members.data.map(member => (
              <button type="button" key={member.id} className="w-full flex items-center gap-3 rounded-xl p-3 text-left hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary" onClick={() => {setMembersOpen(false); navigate(`/profile/${member.id}`);}}>
                <Avatar className="h-11 w-11 shrink-0"><AvatarImage src={member.avatar_url || undefined} /><AvatarFallback>{member.display_name?.[0]?.toUpperCase() || 'M'}</AvatarFallback></Avatar>
                <span className="min-w-0"><span className="block font-medium break-words">{member.display_name || 'Membro da banda'}</span>{member.username && <span className="block text-sm text-muted-foreground truncate">@{member.username.trim()}</span>}</span>
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </section>
  );
}
