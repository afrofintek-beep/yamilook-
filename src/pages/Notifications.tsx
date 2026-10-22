import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, 
  UserPlus, 
  Heart, 
  MessageCircle, 
  Phone, 
  PhoneMissed,
  Eye,
  Check,
  X,
  Users
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { pt } from 'date-fns/locale';
import { AFRICAN_REACTIONS } from '@/lib/reactions';

interface Notification {
  id: string;
  type: 'friend_request' | 'post_reaction' | 'comment' | 'missed_call' | 'status_view' | 'mention';
  title: string;
  message: string;
  avatar_url?: string;
  created_at: string;
  read: boolean;
  action_data?: {
    sender_id?: string;
    post_id?: string;
    request_id?: string;
    call_id?: string;
    status_id?: string;
    reaction_type?: string;
  };
}

export default function Notifications() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    if (user) {
      fetchNotifications();
    }
  }, [user]);

  const fetchNotifications = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const allNotifications: Notification[] = [];
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      // Fetch pending friend requests (received)
      const { data: friendRequests, error: frError } = await supabase
        .from('friend_requests')
        .select(`
          id,
          created_at,
          status,
          sender_id
        `)
        .eq('receiver_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(20);

      if (friendRequests && friendRequests.length > 0) {
        // Get sender profiles
        const senderIds = friendRequests.map(r => r.sender_id);
        const { data: senderProfiles } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url')
          .in('id', senderIds);

        const profileMap = new Map(senderProfiles?.map(p => [p.id, p]) || []);

        friendRequests.forEach((req) => {
          const sender = profileMap.get(req.sender_id);
          allNotifications.push({
            id: `fr_${req.id}`,
            type: 'friend_request',
            title: sender?.display_name || 'Utilizador',
            message: 'mandou-te um pedido para ser kamba',
            avatar_url: sender?.avatar_url,
            created_at: req.created_at,
            read: false,
            action_data: { 
              sender_id: req.sender_id,
              request_id: req.id 
            }
          });
        });
      }

      // Fetch accepted friend requests (sent by user, accepted by others)
      const { data: acceptedRequests, error: arError } = await supabase
        .from('friend_requests')
        .select(`
          id,
          created_at,
          updated_at,
          status,
          receiver_id
        `)
        .eq('sender_id', user.id)
        .eq('status', 'accepted')
        .gte('updated_at', sevenDaysAgo.toISOString())
        .order('updated_at', { ascending: false })
        .limit(20);

      if (acceptedRequests && acceptedRequests.length > 0) {
        // Get receiver profiles (people who accepted)
        const receiverIds = acceptedRequests.map(r => r.receiver_id);
        const { data: receiverProfiles } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url')
          .in('id', receiverIds);

        const profileMap = new Map(receiverProfiles?.map(p => [p.id, p]) || []);

        acceptedRequests.forEach((req) => {
          const receiver = profileMap.get(req.receiver_id);
          allNotifications.push({
            id: `fa_${req.id}`,
            type: 'friend_request',
            title: receiver?.display_name || 'Utilizador',
            message: 'aceitou o teu pedido para ser kamba 🎉',
            avatar_url: receiver?.avatar_url,
            created_at: req.updated_at,
            read: true,
            action_data: { 
              sender_id: req.receiver_id
            }
          });
        });
      }

      // First get user's posts
      const { data: userPosts } = await supabase
        .from('posts')
        .select('id')
        .eq('user_id', user.id);

      const userPostIds = userPosts?.map(p => p.id) || [];

      if (userPostIds.length > 0) {
        // Fetch reactions on user's posts
        const { data: postReactions, error: prError } = await supabase
          .from('post_likes')
          .select('id, created_at, reaction_type, user_id, post_id')
          .in('post_id', userPostIds)
          .neq('user_id', user.id)
          .gte('created_at', sevenDaysAgo.toISOString())
          .order('created_at', { ascending: false })
          .limit(30);

        if (postReactions && postReactions.length > 0) {
          const reactorIds = [...new Set(postReactions.map(r => r.user_id))];
          const { data: reactorProfiles } = await supabase
            .from('profiles')
            .select('id, display_name, avatar_url')
            .in('id', reactorIds);

          const profileMap = new Map(reactorProfiles?.map(p => [p.id, p]) || []);

          postReactions.forEach((reaction) => {
            const reactor = profileMap.get(reaction.user_id);
            const reactionEmoji = AFRICAN_REACTIONS.find(r => r.type === reaction.reaction_type)?.icon || '💛';
            allNotifications.push({
              id: `pr_${reaction.id}`,
              type: 'post_reaction',
              title: reactor?.display_name || 'Utilizador',
              message: `reagiu ao teu post com ${reactionEmoji}`,
              avatar_url: reactor?.avatar_url,
              created_at: reaction.created_at,
              read: true,
              action_data: { 
                post_id: reaction.post_id,
                reaction_type: reaction.reaction_type
              }
            });
          });
        }

        // Fetch comments on user's posts
        const { data: comments, error: cmError } = await supabase
          .from('post_comments')
          .select('id, created_at, content, user_id, post_id')
          .in('post_id', userPostIds)
          .neq('user_id', user.id)
          .gte('created_at', sevenDaysAgo.toISOString())
          .order('created_at', { ascending: false })
          .limit(30);

        if (comments && comments.length > 0) {
          const commenterIds = [...new Set(comments.map(c => c.user_id))];
          const { data: commenterProfiles } = await supabase
            .from('profiles')
            .select('id, display_name, avatar_url')
            .in('id', commenterIds);

          const profileMap = new Map(commenterProfiles?.map(p => [p.id, p]) || []);

          comments.forEach((comment) => {
            const commenter = profileMap.get(comment.user_id);
            allNotifications.push({
              id: `cm_${comment.id}`,
              type: 'comment',
              title: commenter?.display_name || 'Utilizador',
              message: `comentou: "${comment.content?.substring(0, 50)}${comment.content?.length > 50 ? '...' : ''}"`,
              avatar_url: commenter?.avatar_url,
              created_at: comment.created_at,
              read: true,
              action_data: { post_id: comment.post_id }
            });
          });
        }
      }

      // Fetch missed calls
      const { data: missedCalls, error: mcError } = await supabase
        .from('calls')
        .select('id, created_at, type, caller_id')
        .eq('callee_id', user.id)
        .eq('status', 'missed')
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(20);

      if (missedCalls && missedCalls.length > 0) {
        const callerIds = [...new Set(missedCalls.map(c => c.caller_id).filter(Boolean))];
        const { data: callerProfiles } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url')
          .in('id', callerIds);

        const profileMap = new Map(callerProfiles?.map(p => [p.id, p]) || []);

        missedCalls.forEach((call) => {
          const caller = profileMap.get(call.caller_id);
          allNotifications.push({
            id: `mc_${call.id}`,
            type: 'missed_call',
            title: caller?.display_name || 'Utilizador',
            message: `perdeste uma chamada ${call.type === 'video' ? 'de vídeo' : 'de voz'}`,
            avatar_url: caller?.avatar_url,
            created_at: call.created_at,
            read: true,
            action_data: { 
              call_id: call.id,
              sender_id: call.caller_id
            }
          });
        });
      }

      // Fetch user's statuses first
      const { data: userStatuses } = await supabase
        .from('statuses')
        .select('id')
        .eq('user_id', user.id);

      const userStatusIds = userStatuses?.map(s => s.id) || [];

      if (userStatusIds.length > 0) {
        // Fetch status views
        const { data: statusViews, error: svError } = await supabase
          .from('status_views')
          .select('id, viewed_at, viewer_id, status_id')
          .in('status_id', userStatusIds)
          .neq('viewer_id', user.id)
          .gte('viewed_at', sevenDaysAgo.toISOString())
          .order('viewed_at', { ascending: false })
          .limit(30);

        if (statusViews && statusViews.length > 0) {
          const viewerIds = [...new Set(statusViews.map(v => v.viewer_id))];
          const { data: viewerProfiles } = await supabase
            .from('profiles')
            .select('id, display_name, avatar_url')
            .in('id', viewerIds);

          const profileMap = new Map(viewerProfiles?.map(p => [p.id, p]) || []);

          // Group by viewer to avoid duplicates
          const viewerMap = new Map<string, (typeof statusViews)[number]>();
          statusViews.forEach((view) => {
            if (!viewerMap.has(view.viewer_id)) {
              viewerMap.set(view.viewer_id, view);
            }
          });

          viewerMap.forEach((view) => {
            const viewer = profileMap.get(view.viewer_id);
            allNotifications.push({
              id: `sv_${view.id}`,
              type: 'status_view',
              title: viewer?.display_name || 'Utilizador',
              message: 'viu o teu estado',
              avatar_url: viewer?.avatar_url,
              created_at: view.viewed_at,
              read: true,
              action_data: { status_id: view.status_id }
            });
          });
        }
      }

      // Sort all notifications by date
      allNotifications.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setNotifications(allNotifications);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptRequest = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from('friend_requests')
        .update({ status: 'accepted' })
        .eq('id', requestId);

      if (error) throw error;

      toast({ title: 'Pedido aceite!' });
      setNotifications(prev => prev.filter(n => n.action_data?.request_id !== requestId));
    } catch (error) {
      toast({ title: 'Erro ao aceitar pedido', variant: 'destructive' });
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from('friend_requests')
        .update({ status: 'rejected' })
        .eq('id', requestId);

      if (error) throw error;

      toast({ title: 'Pedido rejeitado' });
      setNotifications(prev => prev.filter(n => n.action_data?.request_id !== requestId));
    } catch (error) {
      toast({ title: 'Erro ao rejeitar pedido', variant: 'destructive' });
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'friend_request':
        return <UserPlus className="w-4 h-4 text-primary" />;
      case 'post_reaction':
        return <Heart className="w-4 h-4 text-reaction-sankofa" />;
      case 'comment':
        return <MessageCircle className="w-4 h-4 text-reaction-ubuntu" />;
      case 'missed_call':
        return <PhoneMissed className="w-4 h-4 text-destructive" />;
      case 'status_view':
        return <Eye className="w-4 h-4 text-muted-foreground" />;
      case 'mention':
        return <Users className="w-4 h-4 text-primary" />;
      default:
        return <Heart className="w-4 h-4" />;
    }
  };

  const filteredNotifications = activeTab === 'all' 
    ? notifications 
    : notifications.filter(n => n.type === activeTab);

  const pendingRequests = notifications.filter(n => n.type === 'friend_request');

  return (
    <div className="h-screen-safe overflow-hidden pb-[env(safe-area-inset-bottom,0px)] bg-background flex flex-col">
      {/* Header */}
      <header className="shrink-0 relative z-50 bg-card/95 backdrop-blur-sm border-b border-border safe-top">
        <div className="flex items-center gap-3 px-4 py-3">
          <Button 
            variant="ghost" 
            size="icon" 
            className="rounded-full"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-semibold">Notificações</h1>
          {pendingRequests.length > 0 && (
            <span className="ml-auto bg-primary text-primary-foreground text-xs font-medium px-2 py-0.5 rounded-full">
              {pendingRequests.length}
            </span>
          )}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full justify-start gap-1 px-4 pb-2 bg-transparent h-auto">
            <TabsTrigger 
              value="all" 
              className="rounded-full px-4 py-1.5 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              Todas
            </TabsTrigger>
            <TabsTrigger 
              value="friend_request" 
              className="rounded-full px-4 py-1.5 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              Pedidos
            </TabsTrigger>
            <TabsTrigger 
              value="post_reaction" 
              className="rounded-full px-4 py-1.5 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              Reações
            </TabsTrigger>
            <TabsTrigger 
              value="comment" 
              className="rounded-full px-4 py-1.5 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              Comentários
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </header>

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {loading ? (
          <div className="p-4 space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3">
                <Skeleton className="w-12 h-12 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center px-8">
            <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mb-4">
              <Heart className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Sem notificações</h3>
            <p className="text-muted-foreground text-sm">
              As tuas notificações aparecerão aqui
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            <AnimatePresence mode="popLayout">
              {filteredNotifications.map((notification, index) => {
                // Handle navigation based on notification type
                const handleNotificationClick = () => {
                  // Don't navigate if clicking on buttons (friend requests, calls)
                  if (notification.type === 'friend_request' && notification.action_data?.request_id) {
                    // For pending friend requests, clicking navigates to profile
                    if (notification.action_data?.sender_id) {
                      navigate(`/profile/${notification.action_data.sender_id}`);
                    }
                    return;
                  }
                  
                  switch (notification.type) {
                    case 'post_reaction':
                    case 'comment':
                      if (notification.action_data?.post_id) {
                        navigate(`/discover?post=${notification.action_data.post_id}`);
                      }
                      break;
                    case 'friend_request':
                      // Accepted friend request - navigate to user profile
                      if (notification.action_data?.sender_id) {
                        navigate(`/profile/${notification.action_data.sender_id}`);
                      }
                      break;
                    case 'status_view':
                      navigate('/status');
                      break;
                    case 'missed_call':
                      // Handled by specific button
                      break;
                    default:
                      break;
                  }
                };

                const isClickable = notification.type !== 'missed_call' || !notification.action_data?.sender_id;
                
                return (
                  <motion.div
                    key={notification.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -100 }}
                    transition={{ delay: index * 0.03 }}
                    className={`flex items-start gap-3 p-4 hover:bg-secondary/50 transition-colors ${
                      !notification.read ? 'bg-primary/5' : ''
                    } ${isClickable ? 'cursor-pointer' : ''}`}
                    onClick={isClickable ? handleNotificationClick : undefined}
                  >
                    <div className="relative">
                      <Avatar className="w-12 h-12 border-2 border-background">
                        <AvatarImage src={notification.avatar_url || ''} />
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {notification.title[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-card border-2 border-background flex items-center justify-center">
                        {getNotificationIcon(notification.type)}
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm">
                            <span className="font-semibold">{notification.title}</span>{' '}
                            <span className="text-muted-foreground">{notification.message}</span>
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDistanceToNow(new Date(notification.created_at), { 
                              addSuffix: true, 
                              locale: pt 
                            })}
                          </p>
                        </div>
                      </div>

                      {/* Friend request actions */}
                      {notification.type === 'friend_request' && notification.action_data?.request_id && (
                        <div className="flex gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
                          <Button 
                            size="sm" 
                            className="rounded-full flex-1 bg-primary hover:bg-primary/90"
                            onClick={() => handleAcceptRequest(notification.action_data!.request_id!)}
                          >
                            <Check className="w-4 h-4 mr-1" />
                            Aceitar
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="rounded-full flex-1"
                            onClick={() => handleRejectRequest(notification.action_data!.request_id!)}
                          >
                            <X className="w-4 h-4 mr-1" />
                            Recusar
                          </Button>
                        </div>
                      )}

                      {/* Missed call action */}
                      {notification.type === 'missed_call' && notification.action_data?.sender_id && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="rounded-full mt-3"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/call/${notification.action_data?.sender_id}`);
                          }}
                        >
                          <Phone className="w-4 h-4 mr-1" />
                          Ligar de volta
                        </Button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
