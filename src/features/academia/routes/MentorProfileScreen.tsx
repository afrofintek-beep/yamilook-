import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Star, GraduationCap, Calendar, Users, Crown } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { SessionCard } from '../components/SessionCard';
import { ACADEMIA_COPY } from '../copy';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { EmptyStateBack } from '@/components/common/EmptyStateBack';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';

export default function MentorProfileScreen() {
  const { mentorId } = useParams<{ mentorId: string }>();
  const navigate = useNavigate();

  // Fetch profile + mentor data
  const { data: mentor, isLoading } = useQuery({
    queryKey: ['mentor-profile', mentorId],
    enabled: !!mentorId,
    queryFn: async () => {
      const [{ data: profiles }, { data: mentorProfile }] = await Promise.all([
        supabase.rpc('get_public_profiles_by_ids', { p_ids: [mentorId!] }),
        supabase.from('mentor_profiles').select('*').eq('user_id', mentorId!).maybeSingle(),
      ]);

      const profile = profiles?.[0];
      if (!profile) return null;

      return {
        id: profile.id,
        name: profile.display_name || 'Anónimo',
        avatar: profile.avatar_url ?? undefined,
        bio: profile.bio,
        level: profile.level,
        specialty: mentorProfile?.specialty || '',
        mentorBio: mentorProfile?.mentor_bio,
        isVerifiedMentor: mentorProfile?.is_verified_mentor ?? false,
      };
    },
  });

  // Fetch sessions by this mentor
  const { data: sessions = [] } = useQuery({
    queryKey: ['mentor-sessions', mentorId],
    enabled: !!mentorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('academia_sessions')
        .select('*')
        .eq('mentor_id', mentorId!)
        .order('scheduled_at', { ascending: false });

      if (error) throw error;
      return (data ?? []).map((s) => {
        const dt = new Date(s.scheduled_at);
        return {
          id: s.id,
          title: s.title,
          mentorName: mentor?.name ?? '',
          format: s.format,
          scheduledAt: s.scheduled_at,
          date: format(dt, 'd MMM', { locale: pt }),
          time: format(dt, 'HH:mm'),
          spots: s.spots,
          spotsLeft: s.spots_left,
          isPremium: (s.price_coins ?? 0) > 0,
          status: s.status,
        };
      });
    },
  });

  // Fetch reviews
  const { data: reviews = [] } = useQuery({
    queryKey: ['mentor-reviews', mentorId],
    enabled: !!mentorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('academia_reviews')
        .select('*')
        .eq('mentor_id', mentorId!)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      if (!data?.length) return [];

      // Get reviewer names
      const reviewerIds = [...new Set(data.map((r) => r.reviewer_id))];
      const { data: profiles } = await supabase.rpc('get_public_profiles_by_ids', { p_ids: reviewerIds });
      const profileMap: Record<string, string> = {};
      if (profiles) {
        for (const p of profiles) {
          profileMap[p.id] = p.display_name || 'Anónimo';
        }
      }

      return data.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        reviewerName: profileMap[r.reviewer_id] ?? 'Anónimo',
        createdAt: r.created_at,
      }));
    },
  });

  // Computed stats
  const totalSessions = sessions.length;
  const avgRating = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : 0;
  const upcomingSessions = sessions.filter((s) => s.status === 'scheduled');
  const pastSessions = sessions.filter((s) => s.status === 'ended');

  if (isLoading) {
    return (
      <div className="flex flex-col h-screen-safe overflow-hidden bg-background">
        <header className="relative shrink-0 z-30 bg-background/80 backdrop-blur-md border-b border-border/40 px-4 safe-top">
          <div className="flex items-center gap-3 h-14">
            <button onClick={() => navigate(-1)} className="p-1 -ml-1">
              <ArrowLeft className="h-5 w-5 text-foreground" />
            </button>
            <GraduationCap className="h-5 w-5 text-primary" />
            <Skeleton className="h-5 w-40" />
          </div>
        </header>
        <div className="flex-1 px-4 py-6 space-y-4">
          <div className="flex flex-col items-center gap-3">
            <Skeleton className="h-20 w-20 rounded-full" />
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
      </div>
    );
  }

  if (!mentor) {
    return <EmptyStateBack message="Mentor não encontrado." fallbackRoute="/academia" />;
  }

  return (
    <div className="flex flex-col h-screen-safe overflow-hidden bg-background pb-[calc(5rem+env(safe-area-inset-bottom,0px))]">
      <header className="relative shrink-0 z-30 bg-background/80 backdrop-blur-md border-b border-border/40 px-4 safe-top">
        <div className="flex items-center gap-3 h-14">
          <button onClick={() => navigate(-1)} className="p-1 -ml-1">
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
          <GraduationCap className="h-5 w-5 text-primary" />
          <h1 className="text-base font-bold text-foreground truncate">Perfil de Mentor</h1>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-6 space-y-6">
        {/* Profile Header */}
        <div className="flex flex-col items-center text-center gap-3">
          <div className="relative">
            <div className="rounded-full p-[2px] bg-gradient-to-br from-primary/60 to-primary/20">
              <Avatar className="h-20 w-20 border-2 border-card">
                <AvatarImage src={mentor.avatar} />
                <AvatarFallback className="bg-secondary text-foreground text-lg font-semibold">
                  {mentor.name.charAt(0)}
                </AvatarFallback>
              </Avatar>
            </div>
            {mentor.isVerifiedMentor && (
              <div className="absolute -bottom-0.5 -right-0.5 bg-card rounded-full p-0.5">
                <CheckCircle2 className="h-4 w-4 text-primary fill-primary/20" />
              </div>
            )}
          </div>

          <div>
            <span className="text-lg font-bold text-foreground">{mentor.name}</span>
            {mentor.specialty && (
              <Badge variant="secondary" className="ml-2 text-xs rounded-full">{mentor.specialty}</Badge>
            )}
          </div>

          {mentor.mentorBio && (
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">{mentor.mentorBio}</p>
          )}
        </div>

        {/* Stats Card */}
        <Card className="border-border/30 bg-card/50">
          <CardContent className="p-0">
            <div className="grid grid-cols-3 divide-x divide-border/40">
              <div className="flex flex-col items-center py-3 gap-0.5">
                <Star className="h-4 w-4 text-primary mb-1" />
                <span className="text-base font-bold text-foreground">
                  {avgRating > 0 ? avgRating.toFixed(1) : '—'}
                </span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Avaliação</span>
              </div>
              <div className="flex flex-col items-center py-3 gap-0.5">
                <Calendar className="h-4 w-4 text-primary mb-1" />
                <span className="text-base font-bold text-foreground">{totalSessions}</span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Sessões</span>
              </div>
              <div className="flex flex-col items-center py-3 gap-0.5">
                <Users className="h-4 w-4 text-primary mb-1" />
                <span className="text-base font-bold text-foreground">{reviews.length}</span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Reviews</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Sessions */}
        {upcomingSessions.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Próximas Sessões
            </h2>
            <div className="space-y-3">
              {upcomingSessions.map((s) => (
                <SessionCard
                  key={s.id}
                  id={s.id}
                  title={s.title}
                  mentorName={s.mentorName}
                  format={s.format}
                  scheduledAt={s.scheduledAt}
                  date={s.date}
                  time={s.time}
                  spots={s.spots}
                  spotsLeft={s.spotsLeft}
                  isPremium={s.isPremium}
                  isLive={s.status === 'live'}
                  onPress={() => navigate(
                    s.status === 'live' ? `/academia/live/${s.id}` : `/academia/${s.id}`
                  )}
                />
              ))}
            </div>
          </section>
        )}

        {/* Past Sessions */}
        {pastSessions.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Sessões Anteriores
            </h2>
            <div className="space-y-3">
              {pastSessions.slice(0, 5).map((s) => (
                <SessionCard
                  key={s.id}
                  id={s.id}
                  title={s.title}
                  mentorName={s.mentorName}
                  format={s.format}
                  scheduledAt={s.scheduledAt}
                  date={s.date}
                  time={s.time}
                  spots={s.spots}
                  spotsLeft={s.spotsLeft}
                  isPremium={s.isPremium}
                  isLive={false}
                  onPress={() => navigate(`/academia/${s.id}`)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Reviews */}
        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Avaliações ({reviews.length})
          </h2>
          {reviews.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">
              Ainda sem avaliações.
            </p>
          ) : (
            <div className="space-y-3">
              {reviews.map((review) => (
                <Card key={review.id} className="border-border/30 bg-card/50">
                  <CardContent className="p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">{review.reviewerName}</span>
                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`h-3 w-3 ${i < review.rating ? 'fill-primary text-primary' : 'text-muted-foreground/30'}`}
                          />
                        ))}
                      </div>
                    </div>
                    {review.comment && (
                      <p className="text-xs text-muted-foreground leading-relaxed">{review.comment}</p>
                    )}
                    <span className="text-[10px] text-muted-foreground/60">
                      {format(new Date(review.createdAt), 'd MMM yyyy', { locale: pt })}
                    </span>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
