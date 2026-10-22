import { useEffect, useState, useCallback } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Loader2, ShieldOff, UserX } from 'lucide-react';

interface BlockedUser {
  rowId: string;
  userId: string;
  displayName: string | null;
  username: string | null;
  avatarUrl: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function BlockedUsersSheet({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const [blocked, setBlocked] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    // RLS limits rows to the current user's own blocks (blocker_id = auth.uid()).
    const { data: rows } = await supabase
      .from('blocked_users')
      .select('id, blocked_id, created_at')
      .order('created_at', { ascending: false });

    const ids = (rows ?? []).map((r) => r.blocked_id);
    let profilesById: Record<string, { display_name: string | null; username: string | null; avatar_url: string | null }> = {};
    if (ids.length) {
      const { data: profs } = await supabase
        .from('public_profiles')
        .select('id, display_name, username, avatar_url')
        .in('id', ids);
      profilesById = Object.fromEntries((profs ?? []).map((p) => [p.id, p]));
    }

    setBlocked(
      (rows ?? []).map((r) => ({
        rowId: r.id,
        userId: r.blocked_id,
        displayName: profilesById[r.blocked_id]?.display_name ?? null,
        username: profilesById[r.blocked_id]?.username ?? null,
        avatarUrl: profilesById[r.blocked_id]?.avatar_url ?? null,
      })),
    );
    setLoading(false);
  }, [user]);

  useEffect(() => { if (open) load(); }, [open, load]);

  const unblock = async (b: BlockedUser) => {
    setActing(b.rowId);
    const { error } = await supabase.from('blocked_users').delete().eq('id', b.rowId);
    if (error) {
      toast.error('Não foi possível desbloquear.');
    } else {
      // Best-effort: reflect it on the contact row too, if there is one.
      if (user) {
        await supabase.from('contacts')
          .update({ is_blocked: false })
          .eq('user_id', user.id).eq('contact_user_id', b.userId);
      }
      toast.success('Utilizador desbloqueado.');
      setBlocked((list) => list.filter((x) => x.rowId !== b.rowId));
    }
    setActing(null);
  };

  const initials = (b: BlockedUser) =>
    (b.displayName || b.username || '?').split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0">
        <SheetHeader className="p-4 border-b border-border">
          <SheetTitle className="flex items-center gap-2">
            <ShieldOff className="w-5 h-5 text-primary" /> Utilizadores bloqueados
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-72px)]">
          <div className="p-4 space-y-2">
            {loading && (
              <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            )}

            {!loading && blocked.length === 0 && (
              <div className="text-center py-12 space-y-2">
                <UserX className="h-9 w-9 text-muted-foreground/50 mx-auto" />
                <p className="text-sm text-muted-foreground">Não bloqueaste ninguém.</p>
              </div>
            )}

            {blocked.map((b) => (
              <div key={b.rowId} className="flex items-center gap-3 rounded-xl border border-border p-3">
                <div className="h-10 w-10 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center shrink-0">
                  {b.avatarUrl
                    ? <img src={b.avatarUrl} alt="" className="h-full w-full object-cover" />
                    : <span className="text-sm font-semibold text-primary">{initials(b)}</span>}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{b.displayName || 'Utilizador'}</p>
                  {b.username && <p className="text-xs text-muted-foreground truncate">@{b.username}</p>}
                </div>
                <Button
                  size="sm" variant="outline" className="rounded-lg shrink-0"
                  disabled={acting === b.rowId}
                  onClick={() => unblock(b)}
                >
                  {acting === b.rowId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Desbloquear'}
                </Button>
              </div>
            ))}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
