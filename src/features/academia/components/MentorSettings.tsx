import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { academiaContent } from '../content-copy';
import { uiServerMessage } from '@/i18n/server-copy';
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
  const locale = useUiLocale();
  const { data: mentor, isError, refetch } = useMyMentor();
  const refresh = useRefreshMentors();
  const [editing, setEditing] = useState(false);
  const [specialty, setSpecialty] = useState('');
  const [bio, setBio] = useState('');
  const [experience, setExperience] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const { data: decisions = [] } = useQuery({
    queryKey: ['mentor-audit', mentor?.user_id, 'settings', locale], enabled: !!mentor,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('academia_mentor_audit').select('*').eq('mentor_id', mentor!.user_id).order('created_at', { ascending: false }).limit(10);
      if (error) throw error;
      return data ?? [];
    },
  });
  if (isError) return <Button variant="outline" onClick={() => refetch()}>{uiText("Tentar carregar candidatura novamente")}</Button>;
  if (!mentor) return null;
  const resubmit = ['rejected', 'inactive'].includes(mentor.status);
  const lastDecision = decisions.find(decision => decision.reason);
  const lastReason = academiaContent(lastDecision?.reason, lastDecision?.reason_translations, locale);
  async function save() {
    setBusy(true);
    try {
      const { error } = await supabase.rpc('academia_save_mentor', { p_specialty: specialty, p_bio: bio, p_experience: experience, p_submit: resubmit });
      if (error) throw error;
      await refresh(); setEditing(false); toast.success(resubmit ? uiText("Candidatura reenviada.") : uiText("Perfil actualizado."));
    } catch (error) { toast.error(uiServerMessage((error as Error).message, uiText("Não foi possível guardar as alterações."))); } finally { setBusy(false); }
  }
  async function requestExit() {
    if (!mentor) return;
    setBusy(true);
    try {
      const { error } = await supabase.rpc('academia_manage_mentor', { p_user: mentor.user_id, p_action: 'request_deactivation', p_reason: reason });
      if (error) throw error;
      await refresh(); setReason(''); toast.success(uiText("Pedido enviado. O suporte irá verificar os compromissos pendentes."));
    } catch (error) { toast.error(uiServerMessage((error as Error).message, uiText("Não foi possível guardar as alterações."))); } finally { setBusy(false); }
  }
  return <section className="rounded-xl border p-4 space-y-3" aria-label={uiText("O meu perfil de mentor")}>
    <h2 className="font-semibold">{uiText("O meu perfil de mentor")}</h2>
    <p>{mentorStatus[mentor.status] ?? mentor.status}{mentor.is_verified_mentor ? uiText(" · Verificado para cobrar") : ''}</p>
    {mentor.status !== 'active' && <p className="text-sm text-muted-foreground">{uiText("Novas sessões exigem aprovação. O histórico mantém-se disponível. Completa a tua apresentação para a revisão.")}</p>}
    {lastReason && <p className="text-sm break-words">{uiText("Última indicação: {{value1}}", { value1: `\u2068${lastReason}\u2069` })}</p>}
    {!editing ? <Button variant="outline" onClick={() => { setSpecialty(mentor.specialty); setBio(mentor.mentor_bio ?? ''); setExperience(mentor.experience); setEditing(true); }}>{resubmit ? uiText("Actualizar e recandidatar-me") : uiText("Editar apresentação")}</Button> : <div className="space-y-3">
      <Label htmlFor="edit-specialty">{uiText("Especialidade")}</Label><Input id="edit-specialty" maxLength={120} value={specialty} onChange={e => setSpecialty(e.target.value)} />
      <Label htmlFor="edit-bio">{uiText("Biografia")}</Label><Textarea id="edit-bio" maxLength={2000} value={bio} onChange={e => setBio(e.target.value)} />
      <Label htmlFor="edit-experience">{uiText("Experiência")}</Label><Textarea id="edit-experience" maxLength={2000} value={experience} onChange={e => setExperience(e.target.value)} />
      <p className="text-xs text-muted-foreground">{uiText("Biografia e experiência: mínimo de 10 caracteres cada.")}</p>
      <div className="flex flex-wrap gap-2"><Button disabled={busy || specialty.trim().length < 2 || bio.trim().length < 10 || experience.trim().length < 10} onClick={save}>{resubmit ? uiText("Reenviar candidatura") : uiText("Guardar")}</Button><Button variant="ghost" disabled={busy} onClick={() => setEditing(false)}>{uiText("Cancelar")}</Button></div>
    </div>}
    {mentor.status !== 'inactive' && <details><summary className="cursor-pointer py-3">{uiText("Pedir desactivação")}</summary>
      <p className="text-sm">{uiText("A conta YAMILOOK e o histórico serão preservados. O suporte deverá resolver as sessões, turmas e planos pendentes antes de desactivar.")}</p>
      <Label htmlFor="exit-reason">{uiText("Motivo")}</Label><Textarea id="exit-reason" maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} />
      <Button variant="outline" disabled={busy || reason.trim().length < 3} onClick={requestExit}>{uiText("Enviar pedido de desactivação")}</Button>
    </details>}
  </section>;
}
