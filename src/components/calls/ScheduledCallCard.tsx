import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { format, formatDistanceToNow } from 'date-fns';
import { motion } from 'framer-motion';
import { 
  Calendar, 
  Clock, 
  Video, 
  Phone, 
  Users, 
  Check, 
  X, 
  HelpCircle,
  Link,
  Share2,
  Copy,
  MoreVertical,
  Trash2,
  Edit,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/hooks/useAuth';
import { useCalls, ScheduledCall } from '@/hooks/useCalls';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface ScheduledCallCardProps {
  call: ScheduledCall;
  onJoin?: () => void;
  onEdit?: () => void;
}

interface Invitee {
  user_id: string;
  rsvp_status: string;
  display_name: string;
  avatar_url: string | null;
}

export function ScheduledCallCard({ call, onJoin, onEdit }: ScheduledCallCardProps) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const { updateRsvp, cancelScheduledCall } = useCalls();
  const { toast } = useToast();
  const [invitees, setInvitees] = useState<Invitee[]>([]);
  const [myRsvp, setMyRsvp] = useState<string>('pending');

  const isOrganizer = call.organizer_id === user?.id;
  const scheduledDate = new Date(call.scheduled_at);
  const isUpcoming = scheduledDate > new Date();
  const timeUntil = formatDistanceToNow(scheduledDate, { addSuffix: true });

  useEffect(() => {
    const fetchInvitees = async () => {
      const { data } = await supabase
        .from('scheduled_call_invites')
        .select('user_id, rsvp_status')
        .eq('scheduled_call_id', call.id);

      if (data) {
        const inviteesWithProfiles = await Promise.all(
          data.map(async (invite) => {
            const { data: profile } = await supabase
              .from('public_profiles')
              .select('display_name, avatar_url')
              .eq('id', invite.user_id)
              .single();

            if (invite.user_id === user?.id) {
              setMyRsvp(invite.rsvp_status);
            }

            return {
              user_id: invite.user_id,
              rsvp_status: invite.rsvp_status,
              display_name: profile?.display_name || 'Unknown',
              avatar_url: profile?.avatar_url || null,
            };
          })
        );
        setInvitees(inviteesWithProfiles);
      }
    };

    fetchInvitees();
  }, [call.id, user?.id]);

  const handleRsvp = async (status: 'accepted' | 'declined' | 'maybe') => {
    await updateRsvp(call.id, status);
    setMyRsvp(status);
    toast({
      title: status === 'accepted' ? t('calls.answer') : status === 'declined' ? t('calls.declined') : t('calls.maybe'),
      description: `You've responded ${status} to this call`,
    });
  };

  const copyInviteLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/join/${call.invite_link}`);
    toast({
      title: t('calls.copyInviteLink'),
      description: t('calls.copyInviteLink'),
    });
  };

  const handleCancel = async () => {
    await cancelScheduledCall(call.id);
    toast({
      title: t('calls.cancelCall'),
      description: t('calls.callEnded'),
    });
  };

  const rsvpCounts = {
    accepted: invitees.filter(i => i.rsvp_status === 'accepted').length,
    declined: invitees.filter(i => i.rsvp_status === 'declined').length,
    pending: invitees.filter(i => i.rsvp_status === 'pending' || i.rsvp_status === 'maybe').length,
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 rounded-2xl border border-border bg-card"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-lg">{call.title}</h3>
            <Badge variant={call.call_type === 'video' ? 'default' : 'secondary'} className="rounded-full">
              {call.call_type === 'video' ? (
                <Video className="w-3 h-3 mr-1" />
              ) : (
                <Phone className="w-3 h-3 mr-1" />
              )}
              {call.call_type}
            </Badge>
          </div>
          {call.description && (
            <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
              {call.description}
            </p>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={copyInviteLink}>
              <Copy className="w-4 h-4 mr-2" />
              {t('calls.copyInviteLink')}
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Share2 className="w-4 h-4 mr-2" />
              {t('calls.share')}
            </DropdownMenuItem>
            {isOrganizer && (
              <>
                <DropdownMenuItem onClick={onEdit}>
                  <Edit className="w-4 h-4 mr-2" />
                  {t('common.edit')}
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={handleCancel}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  {t('calls.cancelCall')}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Date & Time */}
      <div className="flex items-center gap-4 text-sm mb-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Calendar className="w-4 h-4" />
          <span>{format(scheduledDate, 'EEEE, MMMM d, yyyy')}</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock className="w-4 h-4" />
          <span>{format(scheduledDate, 'h:mm a')}</span>
          <span className="text-xs">({call.duration_minutes} min)</span>
        </div>
      </div>

      {/* Time until */}
      {isUpcoming && (
        <div className={cn(
          "inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium mb-4",
          scheduledDate.getTime() - Date.now() < 3600000 
            ? "bg-green-500/10 text-green-500" 
            : "bg-primary/10 text-primary"
        )}>
          <Clock className="w-3 h-3" />
          {timeUntil}
        </div>
      )}

      {/* Invitees */}
      {invitees.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium flex items-center gap-2">
              <Users className="w-4 h-4" />
              {t('calls.invitedCount', { count: invitees.length })}
            </span>
            <div className="flex items-center gap-2 text-xs">
              <span className="flex items-center gap-1 text-green-500">
                <Check className="w-3 h-3" /> {rsvpCounts.accepted}
              </span>
              <span className="flex items-center gap-1 text-destructive">
                <X className="w-3 h-3" /> {rsvpCounts.declined}
              </span>
              <span className="flex items-center gap-1 text-muted-foreground">
                <HelpCircle className="w-3 h-3" /> {rsvpCounts.pending}
              </span>
            </div>
          </div>

          <div className="flex -space-x-2">
            {invitees.slice(0, 5).map((invitee) => (
              <Avatar 
                key={invitee.user_id} 
                className={cn(
                  "w-8 h-8 border-2 border-background",
                  invitee.rsvp_status === 'accepted' && "ring-2 ring-green-500",
                  invitee.rsvp_status === 'declined' && "opacity-50"
                )}
              >
                <AvatarImage src={invitee.avatar_url || ''} />
                <AvatarFallback className="text-xs bg-gradient-primary text-white">
                  {invitee.display_name[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
            ))}
            {invitees.length > 5 && (
              <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-medium border-2 border-background">
                +{invitees.length - 5}
              </div>
            )}
          </div>
        </div>
      )}

      {/* RSVP Buttons (for invitees) */}
      {!isOrganizer && isUpcoming && (
        <div className="flex gap-2 mb-4">
          <Button
            size="sm"
            variant={myRsvp === 'accepted' ? 'default' : 'outline'}
            className={cn(
              "flex-1 rounded-xl",
              myRsvp === 'accepted' && "bg-green-500 hover:bg-green-600"
            )}
            onClick={() => handleRsvp('accepted')}
          >
            <Check className="w-4 h-4 mr-1" />
            Yes
          </Button>
          <Button
            size="sm"
            variant={myRsvp === 'maybe' ? 'default' : 'outline'}
            className="flex-1 rounded-xl"
            onClick={() => handleRsvp('maybe')}
          >
            <HelpCircle className="w-4 h-4 mr-1" />
            Maybe
          </Button>
          <Button
            size="sm"
            variant={myRsvp === 'declined' ? 'default' : 'outline'}
            className={cn(
              "flex-1 rounded-xl",
              myRsvp === 'declined' && "bg-destructive hover:bg-destructive/90"
            )}
            onClick={() => handleRsvp('declined')}
          >
            <X className="w-4 h-4 mr-1" />
            No
          </Button>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        {isUpcoming ? (
        <>
            <Button 
              className="flex-1 rounded-xl bg-gradient-primary text-white"
              onClick={onJoin}
            >
              {call.call_type === 'video' ? (
                <Video className="w-4 h-4 mr-2" />
              ) : (
                <Phone className="w-4 h-4 mr-2" />
              )}
              {t('calls.joinCall')}
            </Button>
            <Button 
              variant="outline" 
              size="icon"
              className="rounded-xl"
              onClick={copyInviteLink}
            >
              <Link className="w-4 h-4" />
            </Button>
          </>
        ) : (
          <Badge variant="secondary" className="w-full justify-center py-2">
            {t('calls.callEnded')}
          </Badge>
        )}
      </div>

      {/* Recurring indicator */}
      {call.is_recurring && (
        <div className="mt-3 pt-3 border-t border-border/50">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <span className="w-1 h-1 bg-primary rounded-full" />
            {t('calls.recurring')}: {call.recurrence_pattern}
          </p>
        </div>
      )}
    </motion.div>
  );
}
