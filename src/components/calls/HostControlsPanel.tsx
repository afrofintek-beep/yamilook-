import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, X, MicOff, UserMinus, Crown, Pin,
  Lock, Unlock, Hand, Users, LayoutGrid
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useHostControls } from '@/hooks/useHostControls';

interface Participant {
  id: string;
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  is_muted: boolean;
  is_video_enabled: boolean;
  is_hand_raised: boolean;
  is_spotlight: boolean;
  role: string;
}

interface CallSettings {
  is_locked: boolean;
  waiting_room_enabled: boolean;
}

interface HostControlsPanelProps {
  callId: string;
  participants: Participant[];
  isOpen: boolean;
  onClose: () => void;
  onOpenWaitingRoom: () => void;
  onOpenBreakoutRooms: () => void;
}

export function HostControlsPanel({
  callId,
  participants,
  isOpen,
  onClose,
  onOpenWaitingRoom,
  onOpenBreakoutRooms,
}: HostControlsPanelProps) {
  useUiLocale();
  const [callSettings, setCallSettings] = useState<CallSettings>({
    is_locked: false,
    waiting_room_enabled: false,
  });
  const [waitingCount, setWaitingCount] = useState(0);

  const {
    muteAllParticipants,
    removeParticipant,
    makeCoHost,
    spotlightParticipant,
    toggleCallLock,
    toggleWaitingRoom,
    lowerAllHands,
  } = useHostControls(callId);

  // Fetch call settings
  useEffect(() => {
    const fetchCallSettings = async () => {
      const { data } = await supabase
        .from('calls')
        .select('is_locked, waiting_room_enabled')
        .eq('id', callId)
        .single();

      if (data) {
        setCallSettings({
          is_locked: data.is_locked,
          waiting_room_enabled: data.waiting_room_enabled,
        });
      }
    };

    const fetchWaitingCount = async () => {
      const { count } = await supabase
        .from('call_participants')
        .select('*', { count: 'exact', head: true })
        .eq('call_id', callId)
        .eq('status', 'waiting');

      setWaitingCount(count || 0);
    };

    if (isOpen) {
      fetchCallSettings();
      fetchWaitingCount();
    }

    // Subscribe to changes
    const channel = supabase
      .channel(`call-settings-${callId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'calls',
          filter: `id=eq.${callId}`,
        },
        (payload) => {
          setCallSettings({
            is_locked: payload.new.is_locked,
            waiting_room_enabled: payload.new.waiting_room_enabled,
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'call_participants',
          filter: `call_id=eq.${callId}`,
        },
        () => fetchWaitingCount()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [callId, isOpen]);

  const handleToggleLock = async (locked: boolean) => {
    await toggleCallLock(locked);
    setCallSettings(prev => ({ ...prev, is_locked: locked }));
  };

  const handleToggleWaitingRoom = async (enabled: boolean) => {
    await toggleWaitingRoom(enabled);
    setCallSettings(prev => ({ ...prev, waiting_room_enabled: enabled }));
  };

  const raisedHandsCount = participants.filter(p => p.is_hand_raised).length;

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
              <Shield className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">{uiText("Host Controls")}</h3>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1 p-4">
          {/* Quick Actions */}
          <div className="space-y-3 mb-6">
            <h4 className="text-sm font-medium text-muted-foreground">{uiText("Quick Actions")}</h4>

            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={muteAllParticipants}
            >
              <MicOff className="h-4 w-4 mr-2" />{uiText("Mute All Participants")}</Button>

            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={lowerAllHands}
              disabled={raisedHandsCount === 0}
            >
              <Hand className="h-4 w-4 mr-2" />{uiText("Lower All Hands")}{raisedHandsCount > 0 && (
                <Badge variant="secondary" className="ml-auto">
                  {raisedHandsCount}
                </Badge>
              )}
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={onOpenWaitingRoom}
            >
              <Users className="h-4 w-4 mr-2" />{uiText("View Waiting Room")}{waitingCount > 0 && (
                <Badge variant="destructive" className="ml-auto">
                  {waitingCount}
                </Badge>
              )}
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={onOpenBreakoutRooms}
            >
              <LayoutGrid className="h-4 w-4 mr-2" />{uiText("Manage Breakout Rooms")}</Button>
          </div>

          {/* Call Settings */}
          <div className="space-y-4 mb-6">
            <h4 className="text-sm font-medium text-muted-foreground">{uiText("Call Settings")}</h4>

            <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
              <div className="flex items-center gap-2">
                {callSettings.is_locked ? (
                  <Lock className="h-4 w-4 text-destructive" />
                ) : (
                  <Unlock className="h-4 w-4" />
                )}
                <div>
                  <p className="text-sm font-medium">{uiText("Lock Call")}</p>
                  <p className="text-xs text-muted-foreground">{uiText("Prevent new participants")}</p>
                </div>
              </div>
              <Switch
                checked={callSettings.is_locked}
                onCheckedChange={handleToggleLock}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <div>
                  <p className="text-sm font-medium">{uiText("Waiting Room")}</p>
                  <p className="text-xs text-muted-foreground">{uiText("Approve before joining")}</p>
                </div>
              </div>
              <Switch
                checked={callSettings.waiting_room_enabled}
                onCheckedChange={handleToggleWaitingRoom}
              />
            </div>
          </div>

          {/* Participants List */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">{uiText("Participants ({{value1}})", { value1: (participants.length) ?? "" })}</h4>

            {participants.map((participant) => (
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
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{participant.display_name}</p>
                    {participant.role === 'host' && (
                      <Crown className="h-3 w-3 text-yellow-500" />
                    )}
                    {participant.role === 'co_host' && (
                      <Shield className="h-3 w-3 text-primary" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {participant.is_muted && <MicOff className="h-3 w-3" />}
                    {participant.is_hand_raised && (
                      <Hand className="h-3 w-3 text-yellow-500" />
                    )}
                    {participant.is_spotlight && (
                      <Pin className="h-3 w-3 text-primary" />
                    )}
                  </div>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="icon" variant="ghost" className="h-8 w-8">
                      <X className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => spotlightParticipant(participant.user_id, !participant.is_spotlight)}
                    >
                      <Pin className="h-4 w-4 mr-2" />
                      {participant.is_spotlight ? uiText("Remove Spotlight") : uiText("Spotlight")}
                    </DropdownMenuItem>
                    {participant.role === 'participant' && (
                      <DropdownMenuItem
                        onClick={() => makeCoHost(participant.user_id)}
                      >
                        <Shield className="h-4 w-4 mr-2" />{uiText("Make Co-Host")}</DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => removeParticipant(participant.user_id)}
                    >
                      <UserMinus className="h-4 w-4 mr-2" />{uiText("Remove from Call")}</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </motion.div>
            ))}
          </div>
        </ScrollArea>
      </motion.div>
    </AnimatePresence>
  );
}
