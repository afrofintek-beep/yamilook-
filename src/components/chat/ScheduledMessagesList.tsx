import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Clock, Edit2, Trash2, Send, Repeat, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
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
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface ScheduledMessage {
  id: string;
  conversation_id: string;
  content: string | null;
  message_type: string;
  scheduled_for: string;
  is_recurring: boolean;
  recurrence_pattern: string | null;
  status: string;
  conversation_name?: string;
}

interface ScheduledMessagesListProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId?: string; // If provided, only show messages for this conversation
}

export function ScheduledMessagesList({
  open,
  onOpenChange,
  conversationId,
}: ScheduledMessagesListProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<ScheduledMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (open && user) {
      fetchScheduledMessages();
    }
  }, [open, user, conversationId]);

  const fetchScheduledMessages = async () => {
    if (!user) return;

    setLoading(true);
    try {
      let query = supabase
        .from('scheduled_messages')
        .select('*')
        .eq('sender_id', user.id)
        .eq('status', 'pending')
        .order('scheduled_for', { ascending: true });

      if (conversationId) {
        query = query.eq('conversation_id', conversationId);
      }

      const { data } = await query;

      // Enrich with conversation names
      const enriched = await Promise.all(
        (data || []).map(async (msg) => {
          const { data: conv } = await supabase
            .from('conversations')
            .select('name, type')
            .eq('id', msg.conversation_id)
            .maybeSingle();

          let conversationName = conv?.name;
          if (conv?.type === 'direct') {
            const { data: participants } = await supabase
              .from('conversation_participants')
              .select('user_id')
              .eq('conversation_id', msg.conversation_id)
              .neq('user_id', user.id)
              .limit(1);

            if (participants?.[0]) {
              const { data: profile } = await supabase
                .from('public_profiles')
                .select('display_name')
                .eq('id', participants[0].user_id)
                .maybeSingle();
              conversationName = profile?.display_name;
            }
          }

          return { ...msg, conversation_name: conversationName || 'Chat' };
        })
      );

      setMessages(enriched);
    } catch (err) {
      console.error('Error fetching scheduled messages:', err);
    } finally {
      setLoading(false);
    }
  };

  const cancelMessage = async (id: string) => {
    const { error } = await supabase
      .from('scheduled_messages')
      .update({ status: 'cancelled' })
      .eq('id', id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Scheduled message cancelled' });
      setMessages((prev) => prev.filter((m) => m.id !== id));
    }
    setDeleteId(null);
  };

  const sendNow = async (msg: ScheduledMessage) => {
    // Send the message immediately
    const { error: sendError } = await supabase.from('messages').insert({
      conversation_id: msg.conversation_id,
      sender_id: user!.id,
      content: msg.content,
      message_type: msg.message_type,
    });

    if (sendError) {
      toast({ title: 'Error', description: sendError.message, variant: 'destructive' });
      return;
    }

    // Mark scheduled message as sent
    await supabase.from('scheduled_messages').update({ status: 'sent' }).eq('id', msg.id);

    toast({ title: 'Message sent' });
    setMessages((prev) => prev.filter((m) => m.id !== msg.id));
  };

  const getTimeStatus = (scheduledFor: string) => {
    const scheduled = new Date(scheduledFor);
    const now = new Date();
    const diff = scheduled.getTime() - now.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (diff < 0) return { text: 'Overdue', variant: 'destructive' as const };
    if (hours < 1) return { text: `In ${minutes}m`, variant: 'default' as const };
    if (hours < 24) return { text: `In ${hours}h`, variant: 'secondary' as const };
    return { text: format(scheduled, 'MMM d'), variant: 'outline' as const };
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader className="pb-4">
            <SheetTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Scheduled Messages
            </SheetTitle>
          </SheetHeader>

          <ScrollArea className="h-[calc(100vh-8rem)]">
            {loading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="p-4 rounded-xl bg-secondary/50 animate-pulse">
                    <div className="h-4 w-24 bg-muted rounded mb-2" />
                    <div className="h-3 w-full bg-muted rounded" />
                  </div>
                ))}
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center py-12">
                <Clock className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No scheduled messages</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Messages you schedule will appear here
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((msg) => {
                  const timeStatus = getTimeStatus(msg.scheduled_for);
                  return (
                    <div
                      key={msg.id}
                      className="p-4 rounded-xl bg-secondary/50 border border-border"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant={timeStatus.variant}>{timeStatus.text}</Badge>
                            {msg.is_recurring && (
                              <Badge variant="outline" className="gap-1">
                                <Repeat className="w-3 h-3" />
                                {msg.recurrence_pattern}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            To: {msg.conversation_name} • {format(new Date(msg.scheduled_for), 'MMM d, h:mm a')}
                          </p>
                        </div>
                      </div>

                      <p className="text-sm mb-3 line-clamp-2">{msg.content || '(Media message)'}</p>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => sendNow(msg)}
                        >
                          <Send className="w-3 h-3 mr-1" />
                          Send now
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeleteId(msg.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel scheduled message?</AlertDialogTitle>
            <AlertDialogDescription>
              This message will not be sent. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && cancelMessage(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Cancel Message
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
