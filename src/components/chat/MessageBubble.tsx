import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { useState } from 'react';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { Check, CheckCheck, MoreVertical, Trash2, Copy } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';

interface MessageBubbleProps {
  message: {
    id: string;
    content: string | null;
    message_type: string;
    is_deleted: boolean;
    is_edited: boolean;
    created_at: string;
    sender_id: string;
    delivered_at?: string | null;
    read_by?: unknown;
    sender_profile?: {
      id: string;
      display_name: string;
      username: string;
      avatar_url: string | null;
    };
  };
  isOwn: boolean;
  showAvatar?: boolean;
  isGroupChat?: boolean;
  onDelete?: (id: string) => Promise<void>;
}

export function MessageBubble({
  message,
  isOwn,
  showAvatar = true,
  isGroupChat = false,
  onDelete,
}: MessageBubbleProps) {
  useUiLocale();
  const { toast } = useToast();
  const [showMenu, setShowMenu] = useState(false);

  const displayName = message.sender_profile?.display_name || 'Unknown';
  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const handleCopy = () => {
    if (message.content) {
      navigator.clipboard.writeText(message.content);
      toast({ title: uiText("Copied to clipboard") });
    }
  };

  const handleDelete = async () => {
    if (onDelete) {
      await onDelete(message.id);
    }
  };

  if (message.is_deleted) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`flex gap-2 px-4 py-1 ${isOwn ? 'justify-end' : 'justify-start'}`}
      >
        {!isOwn && showAvatar && <div className="w-8" />}
        <div className="px-4 py-2 rounded-2xl bg-muted/50 italic text-muted-foreground text-sm">{uiText("This message was deleted")}</div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex gap-2 px-4 py-1 group ${isOwn ? 'justify-end' : 'justify-start'}`}
      onMouseEnter={() => setShowMenu(true)}
      onMouseLeave={() => setShowMenu(false)}
    >
      {!isOwn && showAvatar && (
        <Avatar className="w-8 h-8 mt-auto">
          <AvatarImage src={message.sender_profile?.avatar_url || ''} />
          <AvatarFallback className="text-xs bg-secondary">{initials}</AvatarFallback>
        </Avatar>
      )}
      {!isOwn && !showAvatar && <div className="w-8" />}

      <div className={`flex flex-col max-w-[75%] ${isOwn ? 'items-end' : 'items-start'}`}>
        {isGroupChat && !isOwn && showAvatar && (
          <span className="text-xs text-muted-foreground mb-1 ml-1">{displayName}</span>
        )}

        <div className="flex items-end gap-1">
          {isOwn && showMenu && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleCopy}>
                  <Copy className="w-4 h-4 mr-2" />{uiText("Copy")}</DropdownMenuItem>
                {onDelete && (
                  <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                    <Trash2 className="w-4 h-4 mr-2" />{uiText("Delete")}</DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <div
            className={`px-4 py-2 rounded-2xl ${
              isOwn
                ? 'bubble-sent rounded-br-md'
                : 'bubble-received rounded-bl-md'
            }`}
          >
            <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
          </div>

          {!isOwn && showMenu && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={handleCopy}>
                  <Copy className="w-4 h-4 mr-2" />{uiText("Copy")}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <div className={`flex items-center gap-1 mt-0.5 ${isOwn ? 'mr-1' : 'ml-1'}`}>
          <span className="text-[10px] text-muted-foreground">
            {format(new Date(message.created_at), 'h:mm a')}
          </span>
          {message.is_edited && (
            <span className="text-[10px] text-muted-foreground italic">{uiText("edited")}</span>
          )}
          {isOwn && (
            Array.isArray(message.read_by) && message.read_by.length > 0 ? (
              <CheckCheck className="w-3.5 h-3.5 text-primary" />
            ) : message.delivered_at || !message.id.startsWith('temp-') ? (
              <CheckCheck className="w-3.5 h-3.5 text-muted-foreground" />
            ) : (
              <Check className="w-3.5 h-3.5 text-muted-foreground" />
            )
          )}
        </div>
      </div>
    </motion.div>
  );
}
