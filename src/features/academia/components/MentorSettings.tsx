import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { mentorStatus, useMyMentor, useRefreshMentors } from '../hooks/useMentorGovernance';

export function MentorSettings() {
  const { data: mentor, isError, refetch } = useMyMentor();
  const refresh = useRefreshMentors();
  const [editing, setEditing] = useState(false);
  const [specialty, setSpecialty] = useState('');
  const [bio, setBio] = useState('');
  const [experience, setExperience] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const { data: decisions = [] } = useQuery({
    queryKey: ['mentor-audit', mentor?.user_id], enabled: !!mentor,
    queryFn: async () => {
      const { data, error } = await supabase.from('academia_mentor_audit').select('*').eq('mentor_id', mentor!.user_id).order('created_at', { ascending: false }).limit(10);
      if (error) throw error;
      return data ?? [];
    },
  });
  if (isError) return <Button variant="outline" onClick={() => refetch()}>Tentar carregar candidatura novamente</Button>;
  if (!mentor) return null;
  const resubmit = ['rejected', 'inactive'].includes(mentor.status);
  async function save() {
    setBusy(true);
    try {
      const { error } = await supabase.rpc('academia_save_mentor', { p_specialty: specialty, p_bio: bio, p_experience: experience, p_submit: resubmit });
      if (error) throw error;
      await refresh(); setEditing(false); toast.success(resubmit ? 'Candidatura reenviada.' : 'Perfil actualizado.');
    } catch (error) { toast.error((error as Error).message); } finally { setBusy(false); }
  }
  async function requestExit() {
    if (!mentor) return;
    setBusy(true);
    try {
      const { error } = await supabase.rpc('academia_manage_mentor', { p_user: mentor.user_id, p_action: 'request_deactivation', p_reason: reason });
      if (error) throw error;
      await refresh(); setReason(''); toast.success('Pedido enviado. O suporte irá verificar os compromissos pendentes.');
    } catch (error) { toast.error((error as Error).message); } finally { setBusy(false); }
  }
  return <section className="rounded-xl border p-4 space-y-3" aria-label="O meu perfil de mentor">
    <h2 className="font-semibold">O meu perfil de mentor</h2>
    <p>{mentorStatus[mentor.status] ?? mentor.status}{mentor.is_verified_mentor ? ' · Verificado para cobrar' : ''}</p>
    {mentor.status !== 'active' && <p className="text-sm text-muted-foreground">Novas sessões exigem aprovação. O histórico mantém-se disponível. Completa a tua apresentação para a revisão.</p>}
    {decisions.find(d => d.reason)?.reason && <p className="text-sm">Última indicação: {decisions.find(d => d.reason)?.reason}</p>}
    {!editing ? <Button variant="outline" onClick={() => { setSpecialty(mentor.specialty); setBio(mentor.mentor_bio ?? ''); setExperience(mentor.experience); setEditing(true); }}>{resubmit ? 'Actualizar e recandidatar-me' : 'Editar apresentação'}</Button> : <div className="space-y-3">
      <Label htmlFor="edit-specialty">Especialidade</Label><Input id="edit-specialty" maxLength={120} value={specialty} onChange={e => setSpecialty(e.target.value)} />
      <Label htmlFor="edit-bio">Biografia</Label><Textarea id="edit-bio" maxLength={2000} value={bio} onChange={e => setBio(e.target.value)} />
      <Label htmlFor="edit-experience">Experiência</Label><Textarea id="edit-experience" maxLength={2000} value={experience} onChange={e => setExperience(e.target.value)} />
      <p className="text-xs text-muted-foreground">Biografia e experiência: mínimo de 10 caracteres cada.</p>
      <div className="flex flex-wrap gap-2"><Button disabled={busy || specialty.trim().length < 2 || bio.trim().length < 10 || experience.trim().length < 10} onClick={save}>{resubmit ? 'Reenviar candidatura' : 'Guardar'}</Button><Button variant="ghost" disabled={busy} onClick={() => setEditing(false)}>Cancelar</Button></div>
    </div>}
    {mentor.status !== 'inactive' && <details><summary className="cursor-pointer py-3">Pedir desactivação</summary>
      <p className="text-sm">A conta YAMILOOK e o histórico serão preservados. O suporte deverá resolver as sessões, turmas e planos pendentes antes de desactivar.</p>
      <Label htmlFor="exit-reason">Motivo</Label><Textarea id="exit-reason" maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} />
      <Button variant="outline" disabled={busy || reason.trim().length < 3} onClick={requestExit}>Enviar pedido de desactivação</Button>
    </details>}
  </section>;
}
