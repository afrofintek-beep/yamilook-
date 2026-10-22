import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Video, Users, MessageSquare } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ReviewModal } from '../components/ReviewModal';
import { ACADEMIA_COPY } from '../copy';
import { EmptyStateBack } from '@/components/common/EmptyStateBack';
import { useSubmitAcademiaReview } from '../hooks/useAcademia';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export default function AcademiaLiveRoom() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [ended, setEnded] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const submitReview = useSubmitAcademiaReview();
  const { user } = useAuth();

  const { data: session, isLoading } = useQuery({
    queryKey: ['academia-live-session', sessionId],
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
      const mentorName = profiles?.[0]?.display_name || 'Anónimo';

      return { ...data, mentorName };
    },
  });

  // Mock: current user is mentor
  const isMentor = false;

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border/40 px-4 safe-top">
          <div className="flex items-center gap-3 h-14">
            <button onClick={() => navigate(-1)} className="p-1 -ml-1">
              <ArrowLeft className="h-5 w-5 text-foreground" />
            </button>
            <Skeleton className="h-5 w-40" />
          </div>
        </header>
        <div className="aspect-video bg-muted/30 border-b border-border/40" />
      </div>
    );
  }

  if (!session) {
    return <EmptyStateBack message="Sessão não encontrada." fallbackRoute="/academia" />;
  }

  const handleEnd = () => {
    setEnded(true);
    if (!isMentor) {
      setReviewOpen(true);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border/40 px-4 safe-top">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => navigate(-1)} className="p-1 -ml-1">
              <ArrowLeft className="h-5 w-5 text-foreground" />
            </button>
            <h1 className="text-sm font-bold text-foreground truncate">{session.title}</h1>
          </div>
          {!ended && (
            <Badge variant="destructive" className="text-[10px] px-2 py-0.5 rounded-full animate-pulse shrink-0">
              {ACADEMIA_COPY.liveNow}
            </Badge>
          )}
        </div>
      </header>

      {/* Video area placeholder */}
      <div className="aspect-video bg-muted/30 border-b border-border/40 flex items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <Video className="h-10 w-10" />
          <span className="text-xs font-medium">{ACADEMIA_COPY.liveVideoArea}</span>
        </div>
      </div>

      {/* People / Chat tabs */}
      <div className="flex-1 overflow-hidden">
        <Tabs defaultValue="people" className="h-full flex flex-col">
          <TabsList className="mx-4 mt-3 bg-muted/50 rounded-full h-8">
            <TabsTrigger value="people" className="rounded-full text-xs flex-1 gap-1">
              <Users className="h-3 w-3" />
              {ACADEMIA_COPY.people}
            </TabsTrigger>
            <TabsTrigger value="chat" className="rounded-full text-xs flex-1 gap-1">
              <MessageSquare className="h-3 w-3" />
              {ACADEMIA_COPY.chat}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="people" className="flex-1 px-4 py-4">
            <p className="text-xs text-muted-foreground text-center py-8">Participantes aparecerão aqui.</p>
          </TabsContent>

          <TabsContent value="chat" className="flex-1 px-4 py-4">
            <p className="text-xs text-muted-foreground text-center py-8">Chat da sessão aparecerá aqui.</p>
          </TabsContent>
        </Tabs>
      </div>

      {/* End button (mentor only) or ended state */}
      <div className="p-4 border-t border-border/40">
        {ended ? (
          <p className="text-center text-sm text-muted-foreground">{ACADEMIA_COPY.sessionEnded}</p>
        ) : isMentor ? (
          <Button variant="destructive" className="w-full rounded-full" onClick={handleEnd}>
            {ACADEMIA_COPY.close}
          </Button>
        ) : (
          <Button variant="outline" className="w-full rounded-full" onClick={() => navigate(-1)}>
            Sair da sessão
          </Button>
        )}
      </div>

      <ReviewModal
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        onSubmit={(rating, comment) => {
          if (!sessionId || !session) return;
          if (user?.id === session.mentor_id) {
            toast.error('Não podes avaliar a tua própria sessão.');
            setReviewOpen(false);
            return;
          }
          submitReview.mutate(
            { sessionId, mentorId: session.mentor_id, rating, comment },
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
