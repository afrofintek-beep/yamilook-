import { SessionAttendance } from '../components/SessionAttendance';
import { useAdmin } from '@/hooks/useAdmin';
import { SessionManagement } from '../components/SessionManagement';
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
  const { isAdmin } = useAdmin();
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
        archivedAt: data.archived_at,
        cancellationReason: data.cancellation_reason,
      };
    },
  });

  const { data: canReview = false } = useQuery({
    queryKey: ['academia-can-review', sessionId, user?.id], enabled: !!sessionId && !!user,
    refetchOnWindowFocus: true, staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('academia_can_review', { p_session: sessionId! });
      if (error) throw error;
      return data === true;
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
      <div className="fixed inset-0 flex h-screen-safe min-w-0 flex-col overflow-hidden bg-background pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)]">
        <header className="relative z-30 shrink-0 border-b border-border/40 bg-background/95 backdrop-blur-md safe-top">
          <div className="mx-auto flex min-h-14 w-full max-w-2xl min-w-0 items-center gap-2 px-3 py-1">
            <button onClick={() => navigate('/academia', { replace: true })} aria-label="Voltar à Academia" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <ArrowLeft className="h-5 w-5 text-foreground" />
            </button>
            <GraduationCap className="h-5 w-5 shrink-0 text-primary" />
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
    <div className="fixed inset-0 flex h-screen-safe min-w-0 flex-col overflow-hidden bg-background pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)]">
      <header className="relative z-30 shrink-0 border-b border-border/40 bg-background/95 backdrop-blur-md safe-top">
        <div className="mx-auto flex min-h-14 w-full max-w-2xl min-w-0 items-center gap-2 px-3 py-1">
          <button onClick={() => navigate('/academia', { replace: true })} aria-label="Voltar à Academia" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
          <GraduationCap className="h-5 w-5 shrink-0 text-primary" />
          <h1 className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground sm:text-base" title={session.title}>{session.title}</h1>
        </div>
      </header>

      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">
        <div className="mx-auto w-full max-w-2xl min-w-0 space-y-5 px-4 py-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))]">
        {/* Mentor */}
        <button
          className="flex items-center gap-3 w-full text-left"
          onClick={() => navigate(`/academia/mentor/${session.mentorId}`)}
        >
          <Avatar className="h-14 w-14 shrink-0 ring-2 ring-primary/20">
            <AvatarImage src={session.mentorAvatar} />
            <AvatarFallback className="bg-muted text-lg">{session.mentorName.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <span className="block break-words text-base font-semibold text-foreground [overflow-wrap:anywhere]">{session.mentorName}</span>
            <p className="text-xs text-muted-foreground">Mentor</p>
          </div>
        </button>

        {/* Title & description */}
        <div className="space-y-2">
          <h2 className="break-words text-lg font-bold leading-snug text-foreground [overflow-wrap:anywhere]">{session.title}</h2>
          {session.description && (
            <p className="break-words text-sm leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">{session.description}</p>
          )}
        </div>

        {/* Info grid */}
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-0">
            <div className="grid grid-cols-2 divide-x divide-y divide-border/40">
              <div className="flex min-w-0 items-center gap-2.5 p-3 [&>div]:min-w-0 [&_p]:break-words">
                <Calendar className="h-4 w-4 text-primary shrink-0" />
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Data</p>
                  <p className="text-sm font-medium text-foreground">{session.date}</p>
                </div>
              </div>
              <div className="flex min-w-0 items-center gap-2.5 p-3 [&>div]:min-w-0 [&_p]:break-words">
                <Clock className="h-4 w-4 text-primary shrink-0" />
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Hora</p>
                  <p className="text-sm font-medium text-foreground">{session.time}</p>
                </div>
              </div>
              <div className="flex min-w-0 items-center gap-2.5 p-3 [&>div]:min-w-0 [&_p]:break-words">
                <MonitorPlay className="h-4 w-4 text-primary shrink-0" />
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Formato</p>
                  <p className="text-sm font-medium text-foreground capitalize">{session.format}</p>
                </div>
              </div>
              <div className="flex min-w-0 items-center gap-2.5 p-3 [&>div]:min-w-0 [&_p]:break-words">
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
        <div className="flex flex-wrap gap-2">
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
            {!isMentor && canReview && (
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
      </div>

      {(isMentor || isAdmin) && ['live', 'ended', 'completed'].includes(session.status) && <SessionAttendance sessionId={session.id} />}
      {(isMentor || isAdmin) && <div className="flex justify-end px-4"><SessionManagement session={session} /></div>}
      {session.cancellationReason && <Alert className="mx-4 w-auto"><AlertDescription>Sessão cancelada: {session.cancellationReason}</AlertDescription></Alert>}
      {!session.archivedAt && ((!isEnded && !isRegistrationClosed) || (isMentor && !['completed','cancelled'].includes(session.status))) && (
        <div className="shrink-0 border-t border-border/40 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] [&>button]:whitespace-normal">
          {isLive ? (
            <Button variant="destructive" className="w-full rounded-full" onClick={() => navigate(`/academia/live/${session.id}`)}>
              {ACADEMIA_COPY.enter}
            </Button>
          ) : isMentor ? (
            <div className="space-y-2">
            {!isEnded && <Button className="w-full rounded-full" onClick={() => navigate(`/academia/live/${session.id}`)}>Abrir sala de vídeo</Button>}
            <Button
              className="w-full rounded-full"
              disabled={completeMutation.isPending || session.status === 'completed'}
              onClick={() => completeMutation.mutate()}
            >
              {session.status === 'completed'
                ? 'Sessão concluída'
                : completeMutation.isPending ? 'A concluir…' : 'Concluir e receber'}
            </Button>
            </div>
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
          if (user?.id === session.mentorId || !canReview) {
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
