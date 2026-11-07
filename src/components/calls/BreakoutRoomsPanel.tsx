import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutGrid, Plus, X, Users, ArrowRight,
  Trash2, MoreVertical, Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useHostControls, BreakoutRoom } from '@/hooks/useHostControls';

interface Participant {
  id: string;
  user_id: string;
  display_name: string;
  avatar_url: string | null;
}

interface BreakoutRoomsPanelProps {
  callId: string;
  participants: Participant[];
  isOpen: boolean;
  onClose: () => void;
}

export function BreakoutRoomsPanel({
  callId,
  participants,
  isOpen,
  onClose
}: BreakoutRoomsPanelProps) {
  useUiLocale();
  const [breakoutRooms, setBreakoutRooms] = useState<BreakoutRoom[]>([]);
  const [newRoomName, setNewRoomName] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState<string | null>(null);

  const {
    createBreakoutRoom,
    closeBreakoutRoom,
    assignToBreakoutRoom,
    moveToMainRoom,
    fetchBreakoutRooms,
    closeAllBreakoutRooms,
  } = useHostControls(callId);

  // Fetch breakout rooms
  useEffect(() => {
    const loadRooms = async () => {
      const rooms = await fetchBreakoutRooms();
      setBreakoutRooms(rooms);
    };

    if (isOpen) {
      loadRooms();
    }

    // Subscribe to changes
    const channel = supabase
      .channel(`breakout-rooms-${callId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'breakout_rooms',
          filter: `call_id=eq.${callId}`,
        },
        () => loadRooms()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'breakout_room_participants',
        },
        () => loadRooms()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [callId, isOpen, fetchBreakoutRooms]);

  const handleCreateRoom = async () => {
    if (!newRoomName.trim()) return;

    await createBreakoutRoom(newRoomName);
    setNewRoomName('');
    setShowCreateDialog(false);

    const rooms = await fetchBreakoutRooms();
    setBreakoutRooms(rooms);
  };

  const handleAssignParticipant = async (roomId: string, userId: string) => {
    await assignToBreakoutRoom(roomId, userId);
    const rooms = await fetchBreakoutRooms();
    setBreakoutRooms(rooms);
  };

  const handleMoveToMain = async (userId: string) => {
    await moveToMainRoom(userId);
    const rooms = await fetchBreakoutRooms();
    setBreakoutRooms(rooms);
  };

  const handleCloseRoom = async (roomId: string) => {
    await closeBreakoutRoom(roomId);
    const rooms = await fetchBreakoutRooms();
    setBreakoutRooms(rooms);
  };

  // Get participants not in any breakout room
  const mainRoomParticipants = participants.filter(
    p => !breakoutRooms.some(room =>
      room.participants.some(rp => rp.user_id === p.user_id)
    )
  );

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: 300, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 300, opacity: 0 }}
        className="absolute right-0 top-0 bottom-0 w-96 bg-background/95 backdrop-blur-lg border-l border-border z-40 flex flex-col"
      >
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <LayoutGrid className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">{uiText("Breakout Rooms")}</h3>
            </div>
            <div className="flex items-center gap-2">
              <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogTrigger asChild>
                  <Button size="icon" variant="outline">
                    <Plus className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{uiText("Create Breakout Room")}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <Input
                      placeholder={uiText("Room name")}
                      value={newRoomName}
                      onChange={(e) => setNewRoomName(e.target.value)}
                    />
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setShowCreateDialog(false)}>{uiText("Cancel")}</Button>
                      <Button onClick={handleCreateRoom}>{uiText("Create")}</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Rooms List */}
        <ScrollArea className="flex-1 p-4">
          {/* Main Room */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-muted-foreground">{uiText("Main Room")}</h4>
              <Badge variant="outline">{mainRoomParticipants.length}</Badge>
            </div>
            <div className="space-y-2 p-3 rounded-xl bg-secondary/30 border border-border/50">
              {mainRoomParticipants.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-2">{uiText("No participants in main room")}</p>
              ) : (
                mainRoomParticipants.map((participant) => (
                  <div
                    key={participant.id}
                    className="flex items-center gap-2 p-2 rounded-lg bg-background/50"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={participant.avatar_url || undefined} />
                      <AvatarFallback className="text-xs">
                        {participant.display_name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="flex-1 text-sm truncate">
                      {participant.display_name}
                    </span>
                    {breakoutRooms.length > 0 && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-6 w-6">
                            <ArrowRight className="h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          {breakoutRooms.map((room) => (
                            <DropdownMenuItem
                              key={room.id}
                              onClick={() => handleAssignParticipant(room.id, participant.user_id)}
                            >{uiText("Move to ")}{room.name}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Breakout Rooms */}
          {breakoutRooms.map((room) => (
            <motion.div
              key={room.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4"
            >
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium">{room.name}</h4>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{room.participants.length}</Badge>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" variant="ghost" className="h-6 w-6">
                        <MoreVertical className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => handleCloseRoom(room.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />{uiText("Close Room")}</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              <div className="space-y-2 p-3 rounded-xl bg-primary/10 border border-primary/20">
                {room.participants.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-2">{uiText("No participants yet")}</p>
                ) : (
                  room.participants.map((participant) => (
                    <div
                      key={participant.id}
                      className="flex items-center gap-2 p-2 rounded-lg bg-background/50"
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={participant.avatar_url || undefined} />
                        <AvatarFallback className="text-xs">
                          {participant.display_name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="flex-1 text-sm truncate">
                        {participant.display_name}
                      </span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => handleMoveToMain(participant.user_id)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          ))}

          {/* Empty State */}
          {breakoutRooms.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <LayoutGrid className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-sm text-center">{uiText("No breakout rooms yet.")}<br />{uiText("Create one to split participants.")}</p>
            </div>
          )}
        </ScrollArea>

        {/* Footer Actions */}
        {breakoutRooms.length > 0 && (
          <div className="p-4 border-t border-border">
            <Button
              variant="destructive"
              className="w-full"
              onClick={closeAllBreakoutRooms}
            >
              <Clock className="h-4 w-4 mr-2" />{uiText("Close All Rooms")}</Button>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
