import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { UserPlus, Check, X, Loader2 } from 'lucide-react';
import { MokubicoInviteSheet, type InvitedUser } from '@/features/mokubico/components/MokubicoInviteSheet';
import { toast } from 'sonner';

interface PendingRow {
  id: string;
  user_id: string;
  name: string;
  avatar_url: string | null;
}

/** Host-only: pending join requests (approve/deny, realtime) + pre-authorize
 *  contacts for a banda-restricted live. */
export function LivePendingRequests({ sessionId }: { sessionId: string }) {
  useUiLocale();
  const [pending, setPending] = useState<PendingRow[]>([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  // user_ids already seen — so we alert the host only about NEW requests.
  const seenRef = useRef<Set<string> | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('live_access')
      .select('id, user_id')
      .eq('session_id', sessionId)
      .eq('status', 'pending');
    if (!data?.length) { setPending([]); seenRef.current = new Set(); return; }

    const ids = data.map((r) => r.user_id);
    const { data: profiles } = await supabase.rpc('get_public_profiles_by_ids', { p_ids: ids });
    const map = new Map<string, { display_name: string; avatar_url: string | null }>();
    for (const p of profiles ?? []) map.set(p.id, { display_name: p.display_name, avatar_url: p.avatar_url });
    const list: PendingRow[] = data.map((r) => ({
      id: r.id,
      user_id: r.user_id,
      name: map.get(r.user_id)?.display_name || 'Alguém',
      avatar_url: map.get(r.user_id)?.avatar_url ?? null,
    }));
    // Notify the host about newly-arrived requests (not on the first load).
    if (seenRef.current) {
      for (const r of list) {
        if (!seenRef.current.has(r.user_id)) toast.info(uiText("{{value1}} pediu para entrar na live.", { value1: (r.name) ?? "" }));
      }
    }
    seenRef.current = new Set(list.map((r) => r.user_id));
    setPending(list);
  }, [sessionId]);

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`live-requests-${sessionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_access', filter: `session_id=eq.${sessionId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [sessionId, load]);

  const decide = async (id: string, status: 'approved' | 'denied') => {
    setPending((prev) => prev.filter((r) => r.id !== id)); // optimistic
    const { error } = await supabase.from('live_access').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) { toast.error(uiText("Não foi possível responder ao pedido.")); load(); }
  };

  const preAuthorize = async (users: InvitedUser[]) => {
    if (!users.length) return;
    // Convite (status 'invited') — a pessoa recebe e tem de ACEITAR para entrar,
    // já não é entrada directa.
    const { error } = await supabase.rpc('live_invite', { p_session: sessionId, p_user_ids: users.map((u) => u.id) });
    if (error) { toast.error(uiText("Não foi possível convidar.")); return; }
    toast.success(`${users.length} ${users.length === 1 ? 'pessoa convidada' : 'pessoas convidadas'}.`);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-white/90">{uiText("Pedidos ")}{pending.length > 0 && <span className="ml-1 rounded-full bg-amber-400 px-1.5 text-black font-bold">{pending.length}</span>}
        </span>
        <button
          type="button"
          onClick={() => setInviteOpen(true)}
          className="flex items-center gap-1 text-xs font-medium text-white/90 hover:text-white"
        >
          <UserPlus className="w-3.5 h-3.5" />{uiText(" Convidar")}</button>
      </div>

      {pending.map((r) => (
        <div key={r.id} className="flex items-center gap-2 rounded-xl bg-amber-400/15 border border-amber-400/40 p-1.5">
          <Avatar className="h-8 w-8 shrink-0 ring-2 ring-amber-400/60">
            <AvatarImage src={r.avatar_url ?? undefined} />
            <AvatarFallback className="text-xs">{r.name.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <span className="flex-1 min-w-0 truncate text-sm font-medium text-amber-200">{r.name}</span>
          <Button size="icon" className="h-8 w-8 rounded-full bg-green-600 hover:bg-green-700" onClick={() => decide(r.id, 'approved')}>
            <Check className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full text-white hover:bg-white/10" onClick={() => decide(r.id, 'denied')}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}

      <MokubicoInviteSheet open={inviteOpen} onOpenChange={setInviteOpen} selected={[]} onConfirm={preAuthorize} />
    </div>
  );
}
