import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { readEntry } from '@/lib/business-entry';
import { businessInvitationCopy } from '@/lib/business-invitation-copy';

export function BusinessInviteRequest({draft, scene, ready}: {draft: ReturnType<typeof readEntry>; scene: string; ready: boolean}) {
  const { i18n } = useTranslation();
  const labels = businessInvitationCopy(i18n.language);
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<'idle'|'sending'|'done'|'error'>('idle');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || state === 'sending') return;
    const fields = new FormData(event.currentTarget);
    setState('sending');
    try {
      const { error } = await supabase.rpc('request_business_invitation', {
        p_owner: String(fields.get('owner')).trim(), p_email: String(fields.get('email')).trim(),
        p_name: draft.name.trim(), p_activity: draft.activity, p_scene: scene,
        p_year: draft.planned ? null : Number(draft.year), p_planned: draft.planned, p_language: labels.language,
      });
      setState(error ? 'error' : 'done');
    } catch { setState('error'); }
  }
  if (!open) return <Button variant="outline" className="w-full" disabled={!ready} onClick={() => setOpen(true)}>{labels.request}</Button>;
  if (state === 'done') return <p role="status">{labels.received}</p>;
  return <form className="space-y-3 rounded-xl border p-4" onSubmit={submit}>
    <label className="block">{labels.owner}<Input name="owner" autoComplete="name" required maxLength={120} pattern=".*\S.*" /></label>
    <label className="block">{labels.email}<Input name="email" type="email" autoComplete="email" required maxLength={254} /></label>
    {state === 'error' && <p role="alert">{labels.retry}</p>}
    <Button className="w-full" disabled={!ready || state === 'sending'}>{state === 'sending' ? '…' : labels.submit}</Button>
  </form>;
}
