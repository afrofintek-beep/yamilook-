import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export function SessionAttendance({ sessionId }: { sessionId: string }) {
  const client = useQueryClient();
  const roster = useQuery({
    queryKey: ['academia-attendance', sessionId],
    queryFn: async () => {
      const [{ data: reservations, error }, { data: attendance, error: attendanceError }] = await Promise.all([
        supabase.from('academia_reservations').select('user_id').eq('session_id', sessionId).in('status', ['reserved', 'attended']),
        supabase.from('academia_attendance').select('user_id').eq('session_id', sessionId),
      ]);
      if (error || attendanceError) throw error || attendanceError;
      if (!reservations?.length) return [];
      const { data: profiles, error: profilesError } = await supabase.rpc('get_public_profiles_by_ids', { p_ids: reservations.map(r => r.user_id) });
      if (profilesError) throw profilesError;
      return reservations.map(r => ({ userId: r.user_id, name: profiles?.find(p => p.id === r.user_id)?.display_name ?? 'Participante', confirmed: !!attendance?.some(a => a.user_id === r.user_id) }));
    },
  });
  const confirm = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.rpc('academia_confirm_attendance', { p_session: sessionId, p_user: userId });
      if (error) throw error;
    },
    onSuccess: () => { void client.invalidateQueries({ queryKey: ['academia-attendance', sessionId] }); void client.invalidateQueries({ queryKey: ['academia-can-review', sessionId] }); toast.success('Presença confirmada.'); },
    onError: error => toast.error(error.message),
  });
  return <section className="mx-4 my-3 rounded-xl border p-4 space-y-3"><h2 className="font-semibold">Confirmar presenças</h2><p className="text-sm text-muted-foreground">Confirma apenas quem participou. Este registo permite avaliar após o fim da sessão; não altera pagamentos.</p>
    {roster.isLoading && <p>A carregar inscrições…</p>}{roster.isError && <Button onClick={() => roster.refetch()}>Tentar novamente</Button>}
    {roster.data?.length === 0 && <p>Sem inscrições válidas.</p>}{roster.data?.map(r => <div key={r.userId} className="flex items-center justify-between gap-2"><span>{r.name}</span><Button variant="outline" disabled={r.confirmed || confirm.isPending} onClick={() => confirm.mutate(r.userId)}>{r.confirmed ? 'Presença confirmada' : 'Confirmar presença'}</Button></div>)}
  </section>;
}
