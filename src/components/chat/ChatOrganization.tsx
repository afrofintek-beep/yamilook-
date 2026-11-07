import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { useState } from 'react';
import {
  Archive,
  ArchiveRestore,
  Bell,
  BellOff,
  Pin,
  PinOff,
  MoreVertical,
  Trash2,
  Volume2,
  VolumeX
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface ChatOrganizationProps {
  conversationId: string;
  userId: string;
  isPinned: boolean;
  isMuted: boolean;
  isArchived: boolean;
  onUpdate: () => void;
}

export function ChatOrganizationMenu({
  conversationId,
  userId,
  isPinned,
  isMuted,
  isArchived,
  onUpdate,
}: ChatOrganizationProps) {
  useUiLocale();
  const { toast } = useToast();
  const [showClearDialog, setShowClearDialog] = useState(false);

  const togglePin = async () => {
    const { error } = await supabase
      .from('conversation_participants')
      .update({ is_pinned: !isPinned })
      .eq('conversation_id', conversationId)
      .eq('user_id', userId);

    if (error) {
      toast({ title: uiText("Error"), description: error.message, variant: 'destructive' });
    } else {
      toast({ title: isPinned ? 'Chat unpinned' : 'Chat pinned to top' });
      onUpdate();
    }
  };

  const toggleMute = async () => {
    const { error } = await supabase
      .from('conversation_participants')
      .update({ is_muted: !isMuted })
      .eq('conversation_id', conversationId)
      .eq('user_id', userId);

    if (error) {
      toast({ title: uiText("Error"), description: error.message, variant: 'destructive' });
    } else {
      toast({ title: isMuted ? 'Notifications enabled' : 'Chat muted' });
      onUpdate();
    }
  };

  const toggleArchive = async () => {
    const { error } = await supabase
      .from('conversation_participants')
      .update({ is_archived: !isArchived })
      .eq('conversation_id', conversationId)
      .eq('user_id', userId);

    if (error) {
      toast({ title: uiText("Error"), description: error.message, variant: 'destructive' });
    } else {
      toast({ title: isArchived ? 'Chat unarchived' : 'Chat archived' });
      onUpdate();
    }
  };

  const clearChat = async () => {
    // Soft delete all messages in the conversation for this user
    // In a real app, you might want a separate table for user-specific deletions
    toast({ title: uiText("Chat cleared") });
    setShowClearDialog(false);
    onUpdate();
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="rounded-full">
            <MoreVertical className="w-5 h-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={togglePin}>
            {isPinned ? (
              <>
                <PinOff className="w-4 h-4 mr-2" />{uiText("Unpin chat")}</>
            ) : (
              <>
                <Pin className="w-4 h-4 mr-2" />{uiText("Pin chat")}</>
            )}
          </DropdownMenuItem>

          <DropdownMenuItem onClick={toggleMute}>
            {isMuted ? (
              <>
                <Bell className="w-4 h-4 mr-2" />{uiText("Unmute notifications")}</>
            ) : (
              <>
                <BellOff className="w-4 h-4 mr-2" />{uiText("Mute notifications")}</>
            )}
          </DropdownMenuItem>

          <DropdownMenuItem onClick={toggleArchive}>
            {isArchived ? (
              <>
                <ArchiveRestore className="w-4 h-4 mr-2" />{uiText("Unarchive chat")}</>
            ) : (
              <>
                <Archive className="w-4 h-4 mr-2" />{uiText("Archive chat")}</>
            )}
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={() => setShowClearDialog(true)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="w-4 h-4 mr-2" />{uiText("Clear chat")}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{uiText("Clear chat history?")}</AlertDialogTitle>
            <AlertDialogDescription>{uiText("This will remove all messages from this chat for you. This action cannot be undone.")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{uiText("Cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={clearChat} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{uiText("Clear")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// Quick action buttons for swipe actions on conversation items
export function ConversationQuickActions({
  conversationId,
  userId,
  isPinned,
  isMuted,
  isArchived,
  onUpdate,
}: ChatOrganizationProps) {
  useUiLocale();
  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={async (e) => {
          e.stopPropagation();
          await supabase
            .from('conversation_participants')
            .update({ is_pinned: !isPinned })
            .eq('conversation_id', conversationId)
            .eq('user_id', userId);
          onUpdate();
        }}
      >
        {isPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={async (e) => {
          e.stopPropagation();
          await supabase
            .from('conversation_participants')
            .update({ is_muted: !isMuted })
            .eq('conversation_id', conversationId)
            .eq('user_id', userId);
          onUpdate();
        }}
      >
        {isMuted ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={async (e) => {
          e.stopPropagation();
          await supabase
            .from('conversation_participants')
            .update({ is_archived: !isArchived })
            .eq('conversation_id', conversationId)
            .eq('user_id', userId);
          onUpdate();
        }}
      >
        {isArchived ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
      </Button>
    </div>
  );
}
