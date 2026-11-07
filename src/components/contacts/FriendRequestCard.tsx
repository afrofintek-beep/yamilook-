import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, X } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';

interface FriendRequestCardProps {
  request: {
    id: string;
    sender_id: string;
    receiver_id: string;
    message: string | null;
    status: 'pending' | 'accepted' | 'rejected' | 'blocked';
    created_at: string;
    sender_profile?: {
      id: string;
      display_name: string;
      username: string;
      avatar_url: string | null;
      bio: string | null;
    };
    receiver_profile?: {
      id: string;
      display_name: string;
      username: string;
      avatar_url: string | null;
      bio: string | null;
    };
  };
  currentUserId: string;
  onAccept: (id: string) => Promise<void>;
  onReject: (id: string) => Promise<void>;
  onCancel: (id: string) => Promise<void>;
}

export function FriendRequestCard({
  request,
  currentUserId,
  onAccept,
  onReject,
  onCancel,
}: FriendRequestCardProps) {
  useUiLocale();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const isReceived = request.receiver_id === currentUserId;
  const profile = isReceived ? request.sender_profile : request.receiver_profile;
  const displayName = profile?.display_name || 'Unknown';
  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const handleAccept = async () => {
    setLoading(true);
    await onAccept(request.id);
    setLoading(false);
  };

  const handleReject = async () => {
    setLoading(true);
    await onReject(request.id);
    setLoading(false);
  };

  const handleCancel = async () => {
    setLoading(true);
    await onCancel(request.id);
    setLoading(false);
  };

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors">
      <button
        onClick={() => navigate(`/profile/${profile?.id}`)}
        className="focus:outline-none"
      >
        <Avatar className="w-12 h-12">
          <AvatarImage src={profile?.avatar_url || ''} />
          <AvatarFallback className="bg-gradient-accent text-white">
            {initials}
          </AvatarFallback>
        </Avatar>
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold truncate">{displayName}</span>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
          </span>
        </div>
        <p className="text-sm text-muted-foreground truncate">
          {isReceived ? uiText("Wants to connect with you") : uiText("Request pending")}
        </p>
        {request.message && (
          <p className="text-sm text-foreground/80 mt-1 line-clamp-2">
            "{request.message}"
          </p>
        )}
      </div>

      {isReceived ? (
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="outline"
            className="h-9 w-9 rounded-full border-destructive text-destructive hover:bg-destructive hover:text-white"
            onClick={handleReject}
            disabled={loading}
          >
            <X className="w-4 h-4" />
          </Button>
          <Button
            size="icon"
            className="h-9 w-9 rounded-full bg-gradient-primary text-white"
            onClick={handleAccept}
            disabled={loading}
          >
            <Check className="w-4 h-4" />
          </Button>
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={handleCancel}
          disabled={loading}
          className="text-destructive"
        >{uiText("Cancel")}</Button>
      )}
    </div>
  );
}
