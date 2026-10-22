import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { format, formatDistanceToNow } from 'date-fns';
import { pt } from 'date-fns/locale';
import { X, Users, Image as ImageIcon, Calendar, MessageSquare, Video, Heart, Sparkles, ChevronRight } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { supabase } from '@/integrations/supabase/client';
import YamilookLogo from '@/components/brand/YamilookLogo';
import { JourneyDetailSheet } from './JourneyDetailSheet';

interface JourneyStats {
  joinedDate: string;
  friendsCount: number;
  postsCount: number;
  momambosCount: number;
  messagesCount: number;
  callsCount: number;
  likesGiven: number;
}

interface JourneyVisibility {
  show_journey_friends: boolean;
  show_journey_posts: boolean;
  show_journey_momambos: boolean;
  show_journey_messages: boolean;
  show_journey_calls: boolean;
  show_journey_reactions: boolean;
}

interface YamilookJourneySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  displayName?: string;
}

type DetailType = 'friends' | 'posts' | 'momambos' | 'messages' | 'calls' | 'reactions';

const StatCard = React.forwardRef<
  HTMLDivElement,
  { 
    icon: React.ElementType; 
    label: string; 
    value: number | string; 
    delay: number;
    onClick?: () => void;
  }
>(({ icon: Icon, label, value, delay, onClick }, ref) => {
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className={`flex items-center gap-3 p-4 rounded-xl bg-muted/50 backdrop-blur-sm ${
        onClick ? 'cursor-pointer hover:bg-muted/80 active:scale-[0.98] transition-all' : ''
      }`}
      onClick={onClick}
      whileTap={onClick ? { scale: 0.98 } : undefined}
    >
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#F2A900]/20 to-[#C0392B]/20 flex items-center justify-center">
        <Icon className="w-5 h-5 text-[#F2A900]" />
      </div>
      <div className="flex-1">
        <p className="text-lg font-bold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
      {onClick && (
        <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
      )}
    </motion.div>
  );
});
StatCard.displayName = 'StatCard';

export function YamilookJourneySheet({ 
  open, 
  onOpenChange, 
  userId,
  displayName = 'Utilizador'
}: YamilookJourneySheetProps) {
  const { t } = useTranslation();
  const [stats, setStats] = useState<JourneyStats | null>(null);
  const [visibility, setVisibility] = useState<JourneyVisibility>({
    show_journey_friends: true,
    show_journey_posts: true,
    show_journey_momambos: true,
    show_journey_messages: true,
    show_journey_calls: true,
    show_journey_reactions: true,
  });
  const [loading, setLoading] = useState(true);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailType, setDetailType] = useState<DetailType | null>(null);

  const handleOpenDetail = (type: DetailType) => {
    setDetailType(type);
    setDetailOpen(true);
  };

  useEffect(() => {
    if (!open || !userId) return;

    const fetchJourneyStats = async () => {
      setLoading(true);
      try {
        // Fetch all stats and visibility settings in parallel
        const [
          profileResult,
          contactsResult,
          postsResult,
          momambosResult,
          messagesResult,
          callsResult,
          settingsResult
        ] = await Promise.all([
          supabase.from('public_profiles').select('created_at').eq('id', userId).single(),
          supabase.from('contacts').select('id', { count: 'exact', head: true }).eq('user_id', userId),
          supabase.from('posts').select('id', { count: 'exact', head: true }).eq('user_id', userId),
          supabase.from('profile_highlights').select('id', { count: 'exact', head: true }).eq('user_id', userId),
          supabase.from('messages').select('id', { count: 'exact', head: true }).eq('sender_id', userId),
          supabase.from('call_participants').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'connected'),
          supabase.from('user_settings').select('show_journey_friends, show_journey_posts, show_journey_momambos, show_journey_messages, show_journey_calls, show_journey_reactions').eq('user_id', userId).maybeSingle()
        ]);

        // Update visibility settings if user has customized them
        if (settingsResult.data) {
          setVisibility({
            show_journey_friends: settingsResult.data.show_journey_friends ?? true,
            show_journey_posts: settingsResult.data.show_journey_posts ?? true,
            show_journey_momambos: settingsResult.data.show_journey_momambos ?? true,
            show_journey_messages: settingsResult.data.show_journey_messages ?? true,
            show_journey_calls: settingsResult.data.show_journey_calls ?? true,
            show_journey_reactions: settingsResult.data.show_journey_reactions ?? true,
          });
        }

        setStats({
          joinedDate: profileResult.data?.created_at || new Date().toISOString(),
          friendsCount: contactsResult.count || 0,
          postsCount: postsResult.count || 0,
          momambosCount: momambosResult.count || 0,
          messagesCount: messagesResult.count || 0,
          callsCount: callsResult.count || 0,
          likesGiven: 0 // We'll skip this for now as the table may not exist
        });
      } catch (error) {
        console.error('Error fetching journey stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchJourneyStats();
  }, [open, userId]);

  const formatJoinedDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return format(date, "d 'de' MMMM 'de' yyyy", { locale: pt });
  };

  const getTimeSinceJoined = (dateStr: string) => {
    const date = new Date(dateStr);
    return formatDistanceToNow(date, { locale: pt, addSuffix: false });
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent 
          side="bottom" 
          className="h-[85vh] rounded-t-3xl p-0 overflow-hidden"
          hideCloseButton
        >
          {/* Gradient Header */}
          <div 
            className="relative h-40 flex items-center justify-center"
            style={{ 
              background: 'linear-gradient(135deg, #F2A900 0%, #E67E22 50%, #C0392B 100%)' 
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
            >
              <YamilookLogo size="lg" showTagline={false} animate={false} bgClassName="bg-transparent" className="text-white [&_h1]:text-white" />
            </motion.div>
            
            {/* Close button */}
            <button 
              onClick={() => onOpenChange(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 10rem)' }}>
            <SheetHeader className="text-left mb-6">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <SheetTitle className="text-xl font-bold">
                  A tua jornada no Yamilook
                </SheetTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {displayName}, aqui está o resumo da tua actividade
                </p>
              </motion.div>
            </SheetHeader>

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />
                ))}
              </div>
            ) : stats && (
              <div className="space-y-3">
                {/* Joined Date - Special card */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4, duration: 0.4 }}
                  className="p-4 rounded-xl bg-gradient-to-r from-[#F2A900]/10 to-[#C0392B]/10 border border-[#F2A900]/20"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#F2A900] to-[#C0392B] flex items-center justify-center">
                      <Sparkles className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">
                        Membro há <span className="font-bold text-[#F2A900]">{getTimeSinceJoined(stats.joinedDate)}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Juntaste-te em {formatJoinedDate(stats.joinedDate)}
                      </p>
                    </div>
                  </div>
                </motion.div>

                {visibility.show_journey_friends && (
                  <StatCard 
                    icon={Users} 
                    label={t('journey.friendsStat')} 
                    value={stats.friendsCount} 
                    delay={0.5}
                    onClick={() => handleOpenDetail('friends')}
                  />
                )}
                {visibility.show_journey_posts && (
                  <StatCard 
                    icon={ImageIcon} 
                    label={t('journey.postsStat')} 
                    value={stats.postsCount} 
                    delay={0.6}
                    onClick={() => handleOpenDetail('posts')}
                  />
                )}
                {visibility.show_journey_momambos && (
                  <StatCard 
                    icon={Calendar} 
                    label={t('journey.momambosStat')} 
                    value={stats.momambosCount} 
                    delay={0.7}
                    onClick={() => handleOpenDetail('momambos')}
                  />
                )}
                {visibility.show_journey_messages && (
                  <StatCard 
                    icon={MessageSquare} 
                    label={t('journey.messagesStat')} 
                    value={stats.messagesCount} 
                    delay={0.8}
                    onClick={() => handleOpenDetail('messages')}
                  />
                )}
                {visibility.show_journey_calls && (
                  <StatCard 
                    icon={Video} 
                    label={t('journey.callsStat')} 
                    value={stats.callsCount} 
                    delay={0.9}
                    onClick={() => handleOpenDetail('calls')}
                  />
                )}
                {visibility.show_journey_reactions && (
                  <StatCard 
                    icon={Heart} 
                    label={t('journey.reactionsStat')} 
                    value={stats.likesGiven} 
                    delay={1.0}
                    onClick={() => handleOpenDetail('reactions')}
                  />
                )}
              </div>
            )}

            {/* Footer */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2 }}
              className="text-center text-xs text-muted-foreground mt-8"
            >
              A vida como ela é. ✨
            </motion.p>
          </div>
        </SheetContent>
      </Sheet>

      <JourneyDetailSheet
        open={detailOpen}
        onOpenChange={setDetailOpen}
        type={detailType}
        userId={userId}
      />
    </>
  );
}
