import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, GraduationCap, Calendar, Clock, Users, Coins, MonitorPlay } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { ReviewModal } from '../components/ReviewModal';
import { EmptyStateBack } from '@/components/common/EmptyStateBack';
import { ACADEMIA_COPY } from '../copy';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSubmitAcademiaReview } from '../hooks/useAcademia';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';

export default function AcademiaSession() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { user, refreshProfile, patchProfile } = useAuth();
  const queryClient = useQueryClient();
  const submitReview = useSubmitAcademiaReview();
  const [reviewOpen, setReviewOpen] = useState(false);

  const { data: session, isLoading } = useQuery({
    queryKey: ['academia-session', sessionId],
    enabled: !!sessionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('academia_sessions')
        .select('*')
        .eq('id', sessionId!)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      const { data: profiles } = await supabase.rpc('get_public_profiles_by_ids', {
        p_ids: [data.mentor_id],
      });
      const mentor = profiles?.[0];

      const dt = new Date(data.scheduled_at);
      return {
        id: data.id,
        title: data.title,
        description: data.description,
        mentorId: data.mentor_id,
        mentorName: mentor?.display_name || 'Anónimo',
        mentorAvatar: mentor?.avatar_url ?? undefined,
        date: format(dt, 'd MMMM', { locale: pt }),
        time: format(dt, "HH:mm"),
        scheduledAt: data.scheduled_at,
        format: data.format,
        spots: data.spots,
        spotsLeft: data.spots_left,
        isPremium: (data.price_coins ?? 0) > 0,
        priceCoins: data.price_coins ?? 0,
        status: data.status,
      };
    },
  });

  // Check if user already reserved
  const { data: myReservation } = useQuery({
    queryKey: ['academia-reservation', sessionId, user?.id],
    enabled: !!sessionId && !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from('academia_reservations')
        .select('id')
        .eq('session_id', sessionId!)
        .eq('user_id', user!.id)
        .maybeSingle();
      return data;
    },
  });

  const reserveMutation = useMutation({
    mutationFn: async () => {
      if (!user || !sessionId) throw new Error('Not authenticated');
      // Atomic + server-authoritative: charges the learner and holds the Kumbu.
      // The mentor is paid on completion (academia_complete). Guards double-book,
      // full/past/own sessions.
      const { data, error } = await supabase.rpc('academia_reserve', { p_session: sessionId });
      if (error) throw error;
      const r = data as { ok: boolean; reason?: string };
      if (!r.ok) throw new Error(r.reason || 'reserve_failed');
    },
    onSuccess: () => {
      toast.success('Lugar reservado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['academia-session', sessionId] });
      queryClient.invalidateQueries({ queryKey: ['academia-reservation', sessionId] });
      queryClient.invalidateQueries({ queryKey: ['academia-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['kumbu-ledger'] });
    },
    onError: (err: unknown) => {
      const reason = err instanceof Error ? err.message : '';
      const msg: Record<string, string> = {
        insufficient: 'Kumbu insuficiente para reservar esta sessão.',
        already: 'Já reservaste esta sessão.',
        full: 'Sessão lotada.',
        past: 'Esta sessão já passou.',
        closed: 'Esta sessão já foi encerrada.',
        own_session: 'É a tua própria sessão.',
      };
      toast.error(msg[reason] ?? 'Erro ao reservar. Tenta novamente.');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      if (!user || !sessionId) throw new Error('Not authenticated');
      // Atomic: releases the seat and refunds the learner (academia_cancel).
      const { data, error } = await supabase.rpc('academia_cancel', { p_session: sessionId });
      if (error) throw error;
      const r = data as { ok: boolean; reason?: string; refunded?: number; available?: string | number | null };
      if (!r.ok) throw new Error(r.reason || 'cancel_failed');
      const amount = Number(r.refunded ?? 0);
      return { refunded: amount > 0, amount, available: r.available != null ? Number(r.available) : null };
    },
    onSuccess: ({ refunded, amount, available }) => {
      toast.success(refunded ? 'Reserva cancelada. Kumbu devolvido.' : 'Reserva cancelada.');
      queryClient.invalidateQueries({ queryKey: ['academia-session', sessionId] });
      queryClient.invalidateQueries({ queryKey: ['academia-reservation', sessionId] });
      queryClient.invalidateQueries({ queryKey: ['academia-sessions'] });

      if (refunded && user && sessionId) {
        // 1) Instant balance: the RPC returned the authoritative new balance,
        //    so patch app state now instead of waiting for a refetch.
        if (available !== null) {
          patchProfile({ kumbu_available: available });
        }

        // 2) Instant ledger: prepend the refund entry to the credit/all views
        //    so it shows immediately; invalidate then reconciles with the real
        //    row (id/created_at) from the server.
        const optimisticRow = {
          id: `optimistic-refund-${sessionId}`,
          user_id: user.id,
          amount,
          action_type: 'spend',
          source: 'academia',
          reference_id: sessionId,
          description: `Reembolso: ${session.title}`,
          created_at: new Date().toISOString(),
        };
        for (const dir of ['all', 'credit'] as const) {
          queryClient.setQueryData(
            ['kumbu-ledger', user.id, dir],
            (old: unknown) => (Array.isArray(old) ? [optimisticRow, ...old] : old),
          );
        }
        void refreshProfile();
      }

      queryClient.invalidateQueries({ queryKey: ['kumbu-ledger'] });
    },
    onError: () => {
      toast.error('Erro ao cancelar. Tenta novamente.');
    },
  });

  // Mentor concludes the session → gets paid (price − platform fee) per
  // attendee. Idempotent server-side (already-attended reservations aren't
  // paid twice).
  const completeMutation = useMutation({
    mutationFn: async () => {
      if (!sessionId) throw new Error('no_session');
      const { data, error } = await supabase.rpc('academia_complete', { p_session: sessionId });
      if (error) throw error;
      const r = data as { ok: boolean; reason?: string; paid_to_mentor?: number };
      if (!r.ok) throw new Error(r.reason || 'complete_failed');
      return r;
    },
    onSuccess: (r) => {
      toast.success((r?.paid_to_mentor ?? 0) > 0
        ? `Sessão concluída. Recebeste ${r.paid_to_mentor} Kumbu. 🎓`
        : 'Sessão concluída.');
      queryClient.invalidateQueries({ queryKey: ['academia-session', sessionId] });
      queryClient.invalidateQueries({ queryKey: ['academia-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['kumbu-ledger'] });
      void refreshProfile();
    },
    onError: () => toast.error('Não foi possível concluir a sessão.'),
  });

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border/40 px-4 safe-top">
          <div className="flex items-center gap-3 h-14">
            <button onClick={() => navigate(-1)} className="p-1 -ml-1">
              <ArrowLeft className="h-5 w-5 text-foreground" />
            </button>
            <GraduationCap className="h-5 w-5 text-primary" />
            <Skeleton className="h-5 w-40" />
          </div>
        </header>
        <div className="flex-1 px-4 py-6 space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
    );
  }

  if (!session) {
    return <EmptyStateBack message="Sessão não encontrada." fallbackRoute="/academia" />;
  }

  const isLive = session.status === 'live';
  const isEnded = session.status === 'ended' || session.status === 'completed' || session.status === 'cancelled';
  const isReserved = !!myReservation;
  const isMentor = user?.id === session.mentorId;
  const isFull = session.spotsLeft <= 0;

  // Registration deadline: 5 min before start
  const now = new Date();
  const startTime = new Date(session.scheduledAt);
  const fiveMinBefore = new Date(startTime.getTime() - 5 * 60 * 1000);
  const isLateRegistration = !isEnded && !isLive && now >= fiveMinBefore && now < startTime && session.isPremium;
  const isRegistrationClosed = !isEnded && !isLive && now >= startTime;

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border/40 px-4 safe-top">
        <div className="flex items-center gap-3 h-14">
          <button onClick={() => navigate(-1)} className="p-1 -ml-1">
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
          <GraduationCap className="h-5 w-5 text-primary" />
          <h1 className="text-base font-bold text-foreground truncate">{session.title}</h1>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-5">
        {/* Mentor */}
        <button
          className="flex items-center gap-3 w-full text-left"
          onClick={() => navigate(`/academia/mentor/${session.mentorId}`)}
        >
          <Avatar className="h-14 w-14 ring-2 ring-primary/20">
            <AvatarImage src={session.mentorAvatar} />
            <AvatarFallback className="bg-muted text-lg">{session.mentorName.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <span className="text-base font-semibold text-foreground">{session.mentorName}</span>
            <p className="text-xs text-muted-foreground">Mentor</p>
          </div>
        </button>

        {/* Title & description */}
        <div className="space-y-2">
          <h2 className="text-lg font-bold text-foreground leading-tight">{session.title}</h2>
          {session.description && (
            <p className="text-sm text-muted-foreground leading-relaxed">{session.description}</p>
          )}
        </div>

        {/* Info grid */}
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-0">
            <div className="grid grid-cols-2 divide-x divide-y divide-border/40">
              <div className="flex items-center gap-2.5 p-3">
                <Calendar className="h-4 w-4 text-primary shrink-0" />
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Data</p>
                  <p className="text-sm font-medium text-foreground">{session.date}</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 p-3">
                <Clock className="h-4 w-4 text-primary shrink-0" />
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Hora</p>
                  <p className="text-sm font-medium text-foreground">{session.time}</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 p-3">
                <MonitorPlay className="h-4 w-4 text-primary shrink-0" />
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Formato</p>
                  <p className="text-sm font-medium text-foreground capitalize">{session.format}</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 p-3">
                <Users className="h-4 w-4 text-primary shrink-0" />
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Lugares</p>
                  <p className="text-sm font-medium text-foreground">{session.spotsLeft}/{session.spots}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Badges */}
        <div className="flex gap-2">
          <Badge variant={session.isPremium ? 'default' : 'secondary'} className="text-xs rounded-full px-3 py-1">
            {session.isPremium ? `${ACADEMIA_COPY.tabPremium} · ${session.priceCoins} coins` : ACADEMIA_COPY.tabFree}
          </Badge>
          {isReserved && (
            <Badge variant="outline" className="text-xs rounded-full px-3 py-1 border-primary text-primary">
              ✓ Reservado
            </Badge>
          )}
        </div>

        {isEnded && (
          <>
            <Alert className="bg-muted/50 border-border/50">
              <AlertDescription className="text-xs font-medium text-muted-foreground">
                {ACADEMIA_COPY.sessionEndedInfo}
              </AlertDescription>
            </Alert>
            {!isMentor && (
              <Button
                variant="outline"
                className="w-full rounded-full mt-3"
                onClick={() => setReviewOpen(true)}
              >
                {ACADEMIA_COPY.reviewMentor}
              </Button>
            )}
          </>
        )}

        {isLateRegistration && (
          <Alert className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
            <Coins className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <AlertDescription className="text-xs font-medium text-amber-700 dark:text-amber-300">
              {ACADEMIA_COPY.lateRegistration}
            </AlertDescription>
          </Alert>
        )}

        {isRegistrationClosed && (
          <Alert className="bg-muted/50 border-border/50">
            <AlertDescription className="text-xs font-medium text-muted-foreground">
              {ACADEMIA_COPY.registrationClosed}
            </AlertDescription>
          </Alert>
        )}
      </div>

      {!isEnded && !isRegistrationClosed && (
        <div className="p-4 border-t border-border/40">
          {isLive ? (
            <Button variant="destructive" className="w-full rounded-full" onClick={() => navigate(`/academia/live/${session.id}`)}>
              {ACADEMIA_COPY.enter}
            </Button>
          ) : isMentor ? (
            <Button
              className="w-full rounded-full"
              disabled={completeMutation.isPending || session.status === 'completed'}
              onClick={() => completeMutation.mutate()}
            >
              {session.status === 'completed'
                ? 'Sessão concluída'
                : completeMutation.isPending ? 'A concluir…' : 'Concluir e receber'}
            </Button>
          ) : isReserved ? (
            <Button
              variant="outline"
              className="w-full rounded-full"
              disabled={cancelMutation.isPending}
              onClick={() => cancelMutation.mutate()}
            >
              {cancelMutation.isPending ? 'A cancelar…' : 'Cancelar reserva'}
            </Button>
          ) : (
            <Button
              className="w-full rounded-full"
              disabled={isMentor || isFull || reserveMutation.isPending}
              onClick={() => reserveMutation.mutate()}
            >
              {reserveMutation.isPending ? 'A reservar…' : isFull ? 'Lotado' : isMentor ? 'É a tua sessão' : isLateRegistration ? `${ACADEMIA_COPY.reserve} (+10%)` : ACADEMIA_COPY.reserve}
            </Button>
          )}
        </div>
      )}

      <ReviewModal
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        onSubmit={(rating, comment) => {
          if (!sessionId) return;
          if (user?.id === session.mentorId) {
            toast.error('Não podes avaliar a tua própria sessão.');
            setReviewOpen(false);
            return;
          }
          submitReview.mutate(
            { sessionId, mentorId: session.mentorId, rating, comment },
            {
              onSuccess: () => {
                toast.success('Avaliação enviada. Obrigado!');
                setReviewOpen(false);
              },
              onError: () => toast.error('Erro ao enviar avaliação. Tenta novamente.'),
            },
          );
        }}
      />
    </div>
  );
}
