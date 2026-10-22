import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Check, X, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useHostControls } from '@/hooks/useHostControls';

interface WaitingParticipant {
  id: string;
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
}

interface WaitingRoomPanelProps {
  callId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function WaitingRoomPanel({ callId, isOpen, onClose }: WaitingRoomPanelProps) {
  const [waitingParticipants, setWaitingParticipants] = useState<WaitingParticipant[]>([]);
  const { admitParticipant, admitAllParticipants } = useHostControls(callId);

  // Fetch waiting participants
  useEffect(() => {
    const fetchWaitingParticipants = async () => {
      const { data } = await supabase
        .from('call_participants')
        .select('id, user_id, created_at')
        .eq('call_id', callId)
        .eq('status', 'waiting');

      if (data) {
        const participantsWithProfiles = await Promise.all(
          data.map(async (p) => {
            const { data: profile } = await supabase
              .from('public_profiles')
              .select('display_name, avatar_url')
              .eq('id', p.user_id)
              .single();

            return {
              id: p.id,
              user_id: p.user_id,
              display_name: profile?.display_name || 'Unknown',
              avatar_url: profile?.avatar_url || null,
              created_at: p.created_at,
            };
          })
        );
        setWaitingParticipants(participantsWithProfiles);
      }
    };

    if (isOpen) {
      fetchWaitingParticipants();
    }

    // Subscribe to changes
    const channel = supabase
      .channel(`waiting-room-${callId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'call_participants',
          filter: `call_id=eq.${callId}`,
        },
        () => {
          fetchWaitingParticipants();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [callId, isOpen]);

  const handleAdmit = async (userId: string) => {
    await admitParticipant(userId);
  };

  const handleDeny = async (userId: string) => {
    await supabase
      .from('call_participants')
      .update({ status: 'removed' })
      .eq('call_id', callId)
      .eq('user_id', userId);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: 300, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 300, opacity: 0 }}
        className="absolute right-0 top-0 bottom-0 w-80 bg-background/95 backdrop-blur-lg border-l border-border z-40 flex flex-col"
      >
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Waiting Room</h3>
              {waitingParticipants.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {waitingParticipants.length}
                </Badge>
              )}
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Waiting List */}
        <ScrollArea className="flex-1 p-4">
          {waitingParticipants.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-sm">No one is waiting</p>
            </div>
          ) : (
            <div className="space-y-3">
              {waitingParticipants.map((participant) => (
                <motion.div
                  key={participant.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50"
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={participant.avatar_url || undefined} />
                    <AvatarFallback>
                      {participant.display_name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{participant.display_name}</p>
                    <p className="text-xs text-muted-foreground">
                      Waiting since {new Date(participant.created_at).toLocaleTimeString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-8 w-8 border-green-500 text-green-500 hover:bg-green-500 hover:text-white"
                      onClick={() => handleAdmit(participant.user_id)}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-8 w-8 border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
                      onClick={() => handleDeny(participant.user_id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Admit All Button */}
        {waitingParticipants.length > 0 && (
          <div className="p-4 border-t border-border">
            <Button
              className="w-full"
              onClick={admitAllParticipants}
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Admit All ({waitingParticipants.length})
            </Button>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
