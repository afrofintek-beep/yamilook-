import { isRecentlyOnline } from '@/lib/online-presence';
import { usePresenceClock } from '@/hooks/usePresenceClock';
import { formatDistanceToNow, isToday, isYesterday, format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Users, Image, Mic, Pin, Film, FileText } from 'lucide-react';

interface ConversationItemProps {
  conversation: {
    id: string;
    type: string;
    name: string | null;
    avatar_url: string | null;
    participants?: {
      user_id: string;
      profile?: {
        id: string;
        display_name: string;
        username: string;
        avatar_url: string | null;
        is_online: boolean;
        last_seen: string | null;
      };
    }[];
    last_message?: {
      content: string | null;
      message_type: string;
      sender_id: string;
      created_at: string;
      is_deleted?: boolean;
    };
    unread_count?: number;
    is_pinned?: boolean;
  };
  currentUserId: string;
  onClick: () => void;
  isActive?: boolean;
}

function formatMessageTime(dateString: string): string {
  const date = new Date(dateString);
  
  if (isToday(date)) {
    return format(date, 'HH:mm');
  }
  
  if (isYesterday(date)) {
    return 'Ontem';
  }
  
  const daysDiff = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (daysDiff < 7) {
    return format(date, 'EEEE', { locale: pt });
  }
  
  return format(date, 'dd/MM/yy');
}

export function ConversationItem({
  conversation,
  currentUserId,
  onClick,
  isActive,
}: ConversationItemProps) {
  const otherParticipant = conversation.participants?.find(
    (p) => p.user_id !== currentUserId
  )?.profile;

  const isGroup = conversation.type === 'group';
  const displayName = isGroup
    ? conversation.name || 'Group Chat'
    : otherParticipant?.display_name || 'Unknown';
  const avatarUrl = isGroup ? conversation.avatar_url : otherParticipant?.avatar_url;
  const presenceNow = usePresenceClock();
  const isOnline = !isGroup && isRecentlyOnline(otherParticipant?.is_online, otherParticipant?.last_seen, presenceNow);

  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const getLastMessagePreview = () => {
    if (!conversation.last_message) {
      return { text: 'Sem mensagens', icon: null, isEmpty: true };
    }
    
    if (conversation.last_message.is_deleted) return { text: 'Mensagem eliminada', icon: null, isEmpty: true };
    const isOwnMessage = conversation.last_message.sender_id === currentUserId;
    const prefix = isOwnMessage ? 'Tu: ' : '';
    
    switch (conversation.last_message.message_type) {
      case 'image':
        return { text: `${prefix}Foto`, icon: <Image className="w-3.5 h-3.5 text-muted-foreground mr-1 flex-shrink-0" />, isEmpty: false };
      case 'video':
        return { text: `${prefix}Vídeo`, icon: <Film className="w-3.5 h-3.5 mr-1 shrink-0" />, isEmpty: false };
      case 'file':
        return { text: `${prefix}Documento`, icon: <FileText className="w-3.5 h-3.5 mr-1 shrink-0" />, isEmpty: false };
      case 'voice':
        return { text: `${prefix}Mensagem de voz`, icon: <Mic className="w-3.5 h-3.5 text-muted-foreground mr-1 flex-shrink-0" />, isEmpty: false };
      default: {
        const content = conversation.last_message.content || '';
        const truncated = content.length > 40 ? content.slice(0, 40) + '…' : content;
        return { text: `${prefix}${truncated}`, icon: null, isEmpty: false };
      }
    }
  };
  
  const messagePreview = getLastMessagePreview();
  const hasUnread = (conversation.unread_count || 0) > 0;
  const isPinned = conversation.is_pinned;

  return (
    <button
      onClick={onClick}
      className={`w-full min-w-0 max-w-full overflow-hidden flex items-center gap-3.5 px-4 py-3 transition-all duration-150 text-left group ${
        isActive
          ? 'bg-primary/5'
          : hasUnread
            ? 'bg-card hover:bg-card/80'
            : 'hover:bg-card/60'
      }`}
    >
      {/* Avatar with online indicator */}
      <div className="relative flex-shrink-0">
        <Avatar className={`w-12 h-12 transition-all ${hasUnread ? 'ring-2 ring-primary/30' : ''}`}>
          <AvatarImage src={avatarUrl || ''} className="object-cover" />
          <AvatarFallback
            className={`text-sm font-semibold ${
              isGroup 
                ? 'bg-secondary text-foreground' 
                : 'bg-secondary text-foreground'
            }`}
          >
            {isGroup ? <Users className="w-5 h-5 text-muted-foreground" /> : initials}
          </AvatarFallback>
        </Avatar>
        {isOnline && (
          <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-success rounded-full border-[2.5px] border-background" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Top row: Name + Time */}
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <span className={`text-[13px] truncate ${hasUnread ? 'font-bold text-foreground' : 'font-medium text-foreground/90'}`}>
              {displayName}
            </span>
            {isPinned && (
              <Pin className="h-3 w-3 text-muted-foreground/40 shrink-0 rotate-45" />
            )}
          </div>
          {conversation.last_message && (
            <span
              className={`text-[11px] flex-shrink-0 tabular-nums ${
                hasUnread
                  ? 'text-primary font-semibold'
                  : 'text-muted-foreground/60'
              }`}
            >
              {formatMessageTime(conversation.last_message.created_at)}
            </span>
          )}
        </div>
        
        {/* Bottom row: Message preview + Badge */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center flex-1 min-w-0">
            {messagePreview.icon}
            <p className={`text-[12px] truncate leading-relaxed ${
              messagePreview.isEmpty 
                ? 'italic text-muted-foreground/40' 
                : hasUnread 
                  ? 'text-foreground/70 font-medium' 
                  : 'text-muted-foreground/60'
            }`}>
              {messagePreview.text}
            </p>
          </div>
          
          {hasUnread && (
            <Badge className="min-w-[20px] h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center border-0">
              {conversation.unread_count! > 99 ? '99+' : conversation.unread_count}
            </Badge>
          )}
        </div>
      </div>
    </button>
  );
}
