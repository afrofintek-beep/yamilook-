import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useContacts } from '@/hooks/useContacts';
import { createChatConversation } from '@/lib/chat-conversations';
import { Button } from '@/components/ui/button';
import { RequestPayment } from './RequestPayment';
import { useReceiveLabels } from './receive-labels';

function ContactPicker() {
  const copy = useReceiveLabels();
  const navigate = useNavigate();
  const { contacts, loading, error } = useContacts();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const available = contacts.filter(contact => !contact.is_blocked);
  async function select(id: string) {
    setBusy(true);
    setFailed(false);
    try {
      const result = await createChatConversation([id]);
      if (!result.data || result.error) throw new Error();
      navigate('/chat/' + result.data.id + '?requestPayment=1');
    } catch {
      setFailed(true);
    } finally { setBusy(false); }
  }
  return <div className="grid gap-2 max-h-[50dvh] overflow-y-auto">
    <p>{copy.choose}</p>
    {loading && <p>{copy.loading}</p>}
    {(failed || error) && <p role="alert">{copy.error}</p>}
    {!loading && !error && !available.length && <p>{copy.empty}</p>}
    {available.map(contact => <Button variant="outline" disabled={busy} key={contact.contact_user_id}
      onClick={() => void select(contact.contact_user_id)}>{contact.nickname || contact.profile?.display_name || contact.profile?.username}</Button>)}
  </div>;
}

export function ReceiveOptions({ onCreated }: { onCreated: (id: string) => Promise<void> }) {
  const copy = useReceiveLabels();
  const [mode, setMode] = useState<'contact' | 'qr'>();
  if (mode === 'contact') return <ContactPicker />;
  if (mode === 'qr') return <RequestPayment onCreated={onCreated} />;
  return <div className="grid gap-3"><Button onClick={() => setMode('contact')}>{copy.contact}</Button>
    <Button variant="outline" onClick={() => setMode('qr')}>{copy.qr}</Button></div>;
}
