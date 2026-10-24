import { createChatConversation } from '@/lib/chat-conversations';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MoreVertical, Star, UserMinus, Ban, Edit2, MessageCircle, Phone, Video, Circle } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useActiveCall } from '@/components/calls/ActiveCallProvider';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCloseFriends } from '@/hooks/useCloseFriends';
import { useToast } from '@/hooks/use-toast';
import { getCloseFriendLabel } from '@/lib/close-friend-label';
interface ContactCardProps {
  contact: {
    id: string;
    nickname: string | null;
    is_favorite: boolean;
    is_blocked: boolean;
    contact_user_id: string;
    profile?: {
      id: string;
      display_name: string;
      username: string;
      avatar_url: string | null;
      bio: string | null;
      is_online: boolean;
      last_seen: string | null;
      status_message: string | null;
      gender: string | null;
    };
  };
  onToggleFavorite: (id: string) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onBlock: (id: string) => Promise<void>;
  onUpdateNickname: (id: string, nickname: string) => Promise<void>;
}

export function ContactCard({
  contact,
  onToggleFavorite,
  onRemove,
  onBlock,
  onUpdateNickname,
}: ContactCardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const activeCall = useActiveCall();
  const startCall = activeCall?.startCall;
  const { isCloseFriend, toggleCloseFriend } = useCloseFriends();
  const [nicknameDialogOpen, setNicknameDialogOpen] = useState(false);
  const [newNickname, setNewNickname] = useState(contact.nickname || '');
  const [loading, setLoading] = useState(false);
  
  const isInCloseFriends = isCloseFriend(contact.contact_user_id);
  const contactGender = contact.profile?.gender as 'male' | 'female' | 'other' | null | undefined;
  const closeFriendLabel = getCloseFriendLabel(contactGender);

  const handleToggleCloseFriend = async () => {
    const { error } = await toggleCloseFriend(contact.contact_user_id);
    if (error) {
      toast({
        title: t('common.error'),
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: isInCloseFriends 
          ? `Removido dos ${closeFriendLabel}s` 
          : `Adicionado aos ${closeFriendLabel}s`,
        description: isInCloseFriends 
          ? `Esta pessoa já não verá os teus estados de ${closeFriendLabel}s`
          : `Esta pessoa verá os teus estados de ${closeFriendLabel}s`,
      });
    }
  };

  const displayName = contact.nickname || contact.profile?.display_name || 'Unknown';
  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const handleStartChat = async () => {
    if (!user) return;
    
    const { data, error } = await createChatConversation([contact.contact_user_id]);
    if (error || !data) {
      toast({ title: 'Não foi possível abrir a conversa', variant: 'destructive' });
      return;
    }
    navigate(`/chat/${data.id}`);
  };

  const handleNicknameSave = async () => {
    setLoading(true);
    await onUpdateNickname(contact.id, newNickname);
    setLoading(false);
    setNicknameDialogOpen(false);
  };

  return (
    <>
      <div className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors">
        <button
          onClick={() => navigate(`/profile/${contact.contact_user_id}`)}
          className="relative focus:outline-none"
        >
          <Avatar className="w-12 h-12">
            <AvatarImage src={contact.profile?.avatar_url || ''} />
            <AvatarFallback className="bg-gradient-primary text-white">
              {initials}
            </AvatarFallback>
          </Avatar>
          {contact.profile?.is_online && (
            <span className="absolute bottom-0 right-0 w-3.5 h-3.5 status-online rounded-full border-2 border-background pulse-online" />
          )}
        </button>

        <div
          className="flex-1 min-w-0 cursor-pointer"
          onClick={() => navigate(`/profile/${contact.contact_user_id}`)}
        >
          <div className="flex items-center gap-2">
            <span className="font-semibold truncate">{displayName}</span>
            {contact.is_favorite && (
              <Star className="w-4 h-4 text-warning fill-warning" />
            )}
            {isInCloseFriends && (
              <Circle className="w-4 h-4 text-primary" />
            )}
          </div>
          <p className="text-sm text-muted-foreground truncate">
            @{contact.profile?.username || 'unknown'}
          </p>
        </div>

        <div className="flex items-center gap-1">
          <Button 
            variant="ghost" 
            size="icon" 
            className="rounded-full h-9 w-9"
            onClick={handleStartChat}
          >
            <MessageCircle className="w-5 h-5" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="rounded-full h-9 w-9"
            onClick={() => startCall?.(contact.contact_user_id, 'voice')}
          >
            <Phone className="w-5 h-5" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="rounded-full h-9 w-9"
            onClick={() => startCall?.(contact.contact_user_id, 'video')}
          >
            <Video className="w-5 h-5" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full h-9 w-9">
                <MoreVertical className="w-5 h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => onToggleFavorite(contact.id)}>
                <Star
                  className={`w-4 h-4 mr-2 ${
                    contact.is_favorite ? 'fill-warning text-warning' : ''
                  }`}
                />
                {contact.is_favorite ? t('settings.favorites') : t('settings.favorites')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleToggleCloseFriend}>
                <Circle
                  className={`w-4 h-4 mr-2 ${
                    isInCloseFriends ? 'text-primary' : ''
                  }`}
                />
                {isInCloseFriends 
                  ? `Tirar dos ${closeFriendLabel}s`
                  : `Pôr nos ${closeFriendLabel}s`}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setNicknameDialogOpen(true)}>
                <Edit2 className="w-4 h-4 mr-2" />
                {t('common.edit')} nickname
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onRemove(contact.id)}
                className="text-destructive"
              >
                <UserMinus className="w-4 h-4 mr-2" />
                Remove contact
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onBlock(contact.id)}
                className="text-destructive"
              >
                <Ban className="w-4 h-4 mr-2" />
                Block user
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Dialog open={nicknameDialogOpen} onOpenChange={setNicknameDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Nickname</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="nickname">Nickname for {contact.profile?.display_name}</Label>
              <Input
                id="nickname"
                value={newNickname}
                onChange={(e) => setNewNickname(e.target.value)}
                placeholder="Enter a nickname"
              />
              <p className="text-xs text-muted-foreground">
                Only you will see this nickname
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setNicknameDialogOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleNicknameSave}
              disabled={loading}
              className="bg-gradient-primary text-white"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
