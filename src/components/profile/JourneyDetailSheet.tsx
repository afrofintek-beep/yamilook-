import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { X, Users, Image as ImageIcon, MessageSquare, Video, Heart, Sparkles, ChevronRight } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';

type DetailType = 'friends' | 'posts' | 'momambos' | 'messages' | 'calls' | 'reactions';

interface JourneyDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: DetailType | null;
  userId: string;
  onNavigate?: () => void;
}

interface FriendItem {
  id: string;
  display_name: string;
  username: string;
  avatar_url: string | null;
}

interface PostItem {
  id: string;
  content: string;
  created_at: string;
  media_urls: string[];
  type: string;
}

interface MomamboItem {
  id: string;
  title: string;
  cover_url: string | null;
  created_at: string;
}

interface MessageItem {
  id: string;
  conversation_name: string;
  last_message: string;
  created_at: string;
}

interface CallItem {
  id: string;
  caller_name: string;
  call_type: string;
  duration_seconds: number | null;
  created_at: string;
}

const titles: Record<DetailType, string> = {
  friends: 'Kambas na tua rede',
  posts: 'Publicações feitas',
  momambos: 'Momambos criados',
  messages: 'Mensagens enviadas',
  calls: 'Chamadas atendidas',
  reactions: 'Reacções dadas',
};

const icons: Record<DetailType, React.ElementType> = {
  friends: Users,
  posts: ImageIcon,
  momambos: Sparkles,
  messages: MessageSquare,
  calls: Video,
  reactions: Heart,
};

export function JourneyDetailSheet({ open, onOpenChange, type, userId, onNavigate }: JourneyDetailSheetProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [momambos, setMomambos] = useState<MomamboItem[]>([]);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [calls, setCalls] = useState<CallItem[]>([]);

  useEffect(() => {
    if (!open || !type || !userId) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        switch (type) {
          case 'friends': {
            const { data: contactsData } = await supabase
              .from('contacts')
              .select('contact_user_id')
              .eq('user_id', userId)
              .limit(20);

            if (contactsData?.length) {
              const userIds = contactsData.map(c => c.contact_user_id);
              const { data: profiles } = await supabase
                .from('public_profiles')
                .select('id, display_name, username, avatar_url')
                .in('id', userIds);
              setFriends(profiles || []);
            } else {
              setFriends([]);
            }
            break;
          }

          case 'posts': {
            const { data: postsData } = await supabase
              .from('posts')
              .select('id, content, created_at, media_urls, type')
              .eq('user_id', userId)
              .order('created_at', { ascending: false })
              .limit(20);
            setPosts(postsData || []);
            break;
          }

          case 'momambos': {
            const { data: highlightsData } = await supabase
              .from('profile_highlights')
              .select('id, title, cover_url, created_at')
              .eq('user_id', userId)
              .order('created_at', { ascending: false })
              .limit(20);
            setMomambos(highlightsData || []);
            break;
          }

          case 'messages': {
            const { data: messagesData } = await supabase
              .from('messages')
              .select(`
                id,
                content,
                created_at,
                conversation_id,
                conversations!inner(name)
              `)
              .eq('sender_id', userId)
              .order('created_at', { ascending: false })
              .limit(20);

            const formattedMessages = (messagesData || []).map((m) => ({
              id: m.id,
              conversation_name: m.conversations?.name || 'Conversa',
              last_message: m.content || '[Media]',
              created_at: m.created_at,
            }));
            setMessages(formattedMessages);
            break;
          }

          case 'calls': {
            const { data: callsData } = await supabase
              .from('call_participants')
              .select(`
                id,
                call_id,
                calls!inner(id, type, duration_seconds, created_at, caller_id)
              `)
              .eq('user_id', userId)
              .eq('status', 'connected')
              .order('joined_at', { ascending: false })
              .limit(20);

            const callerIds = [...new Set((callsData || []).map((c) => c.calls?.caller_id).filter(Boolean))];
            const profileMap = new Map<string, string>();
            if (callerIds.length > 0) {
              const { data: profiles } = await supabase
                .from('public_profiles')
                .select('id, display_name')
                .in('id', callerIds);
              profiles?.forEach(p => profileMap.set(p.id, p.display_name));
            }

            const formattedCalls = (callsData || []).map((c) => ({
              id: c.id,
              caller_name: profileMap.get(c.calls?.caller_id) || 'Utilizador',
              call_type: c.calls?.type || 'audio',
              duration_seconds: c.calls?.duration_seconds,
              created_at: c.calls?.created_at,
            }));
            setCalls(formattedCalls);
            break;
          }

          case 'reactions':
            // We'll show a simple placeholder for reactions
            break;
        }
      } catch (error) {
        console.error('Error fetching detail data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [open, type, userId]);

  const handleNavigate = (path: string) => {
    onOpenChange(false);
    onNavigate?.();
    navigate(path);
  };

  if (!type) return null;

  const Icon = icons[type];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[70vh] rounded-t-3xl p-0">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#F2A900]/20 to-[#C0392B]/20 flex items-center justify-center">
              <Icon className="w-5 h-5 text-[#F2A900]" />
            </div>
            <SheetTitle className="text-lg font-semibold">{titles[type]}</SheetTitle>
          </div>
          <button onClick={() => onOpenChange(false)} className="p-2">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto" style={{ maxHeight: 'calc(70vh - 72px)' }}>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {/* Friends List */}
              {type === 'friends' && (
                friends.length > 0 ? (
                  friends.map((friend, index) => (
                    <motion.button
                      type="button"
                      aria-label={`Ver perfil de ${friend.display_name}`}
                      key={friend.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="w-full text-left flex items-center gap-3 p-3 rounded-xl bg-muted/50 cursor-pointer hover:bg-muted/80 transition-colors"
                      onClick={() => handleNavigate(`/profile/${friend.id}`)}
                    >
                      <Avatar className="w-12 h-12">
                        <AvatarImage src={friend.avatar_url || undefined} />
                        <AvatarFallback>{friend.display_name?.charAt(0) || 'U'}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">{friend.display_name}</p>
                        <p className="text-sm text-muted-foreground truncate">@{friend.username}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
                    </motion.button>
                  ))
                ) : (
                  <EmptyState message="Ainda não tens kambas na tua rede" />
                )
              )}

              {/* Posts List */}
              {type === 'posts' && (
                posts.length > 0 ? (
                  posts.map((post, index) => (
                    <motion.div
                      key={post.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="w-full text-left flex items-center gap-3 p-3 rounded-xl bg-muted/50 cursor-pointer hover:bg-muted/80 transition-colors"
                      onClick={() => handleNavigate('/feed')}
                    >
                      {post.media_urls?.length > 0 ? (
                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted">
                          <img src={post.media_urls[0]} alt="" className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-[#F2A900]/20 to-[#C0392B]/20 flex items-center justify-center">
                          <ImageIcon className="w-5 h-5 text-[#F2A900]" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground line-clamp-2">{post.content || '[Sem texto]'}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(post.created_at), "d MMM yyyy", { locale: pt })}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
                    </motion.div>
                  ))
                ) : (
                  <EmptyState message="Ainda não publicaste nada" />
                )
              )}

              {/* Momambos List */}
              {type === 'momambos' && (
                momambos.length > 0 ? (
                  momambos.map((momambo, index) => (
                    <motion.div
                      key={momambo.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="flex items-center gap-3 p-3 rounded-xl bg-muted/50"
                    >
                      {momambo.cover_url ? (
                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted">
                          <img src={momambo.cover_url} alt="" className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-[#F2A900]/20 to-[#C0392B]/20 flex items-center justify-center">
                          <Sparkles className="w-5 h-5 text-[#F2A900]" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">{momambo.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(momambo.created_at), "d MMM yyyy", { locale: pt })}
                        </p>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <EmptyState message="Ainda não criaste momambos" />
                )
              )}

              {/* Messages - Stats Only (Privacy) */}
              {type === 'messages' && (
                <PrivacyStatCard
                  icon={MessageSquare}
                  count={messages.length}
                  label="mensagens enviadas"
                  description="Por razões de privacidade, os detalhes das mensagens não são listados aqui."
                  onAction={() => handleNavigate('/chat')}
                  actionLabel="Ir para Conversas"
                />
              )}

              {/* Calls - Stats Only (Privacy) */}
              {type === 'calls' && (
                <PrivacyStatCard
                  icon={Video}
                  count={calls.length}
                  label="chamadas atendidas"
                  description="Por razões de privacidade, os detalhes das chamadas não são listados aqui."
                  onAction={() => handleNavigate('/calls')}
                  actionLabel="Ir para Chamadas"
                />
              )}

              {/* Reactions placeholder */}
              {type === 'reactions' && (
                <EmptyState message="As reacções serão adicionadas em breve" />
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <Sparkles className="w-8 h-8 text-muted-foreground" />
      </div>
      <p className="text-muted-foreground">{message}</p>
    </div>
  );
}

interface PrivacyStatCardProps {
  icon: React.ElementType;
  count: number;
  label: string;
  description: string;
  onAction: () => void;
  actionLabel: string;
}

function PrivacyStatCard({ icon: Icon, count, label, description, onAction, actionLabel }: PrivacyStatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-8 text-center"
    >
      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#F2A900]/20 to-[#C0392B]/20 flex items-center justify-center mb-4">
        <Icon className="w-10 h-10 text-[#F2A900]" />
      </div>
      <p className="text-4xl font-bold text-foreground mb-1">{count}</p>
      <p className="text-muted-foreground mb-4">{label}</p>
      <p className="text-sm text-muted-foreground/70 max-w-xs mb-6">{description}</p>
      <button
        onClick={onAction}
        className="px-6 py-2.5 rounded-full bg-gradient-to-r from-[#F2A900] to-[#C0392B] text-white font-medium text-sm hover:opacity-90 transition-opacity"
      >
        {actionLabel}
      </button>
    </motion.div>
  );
}
