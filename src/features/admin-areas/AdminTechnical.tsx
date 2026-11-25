import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { adminAreaCopy } from './copy';
import { AdminAreaPage } from './AdminAreas';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

export default function AdminTechnical() {
  return <AdminAreaPage area="admin_test_data"><TechnicalActions /></AdminAreaPage>;
}
function TechnicalActions() {
  const copy = adminAreaCopy(useUiLocale());
  const [confirmation, setConfirmation] = useState<'seed' | 'clear' | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const run = async () => {
    const action = confirmation;
    if (!action || busy) return;
    setBusy(true); setConfirmation(null); setMessage('');
    try {
      if (action === 'seed') {
        const { data, error } = await supabase.functions.invoke('seed-test-users');
        if (error || !data?.success) throw new Error('seed_failed');
        setMessage(uiText('Dados de teste criados!'));
      } else {
        const { data, error } = await supabase.rpc('admin_clear_test_data' as never, {} as never);
        if (error || (data as { ok?: boolean } | null)?.ok !== true) throw new Error('clear_failed');
        setMessage(uiText('Dados de teste apagados!'));
      }
    } catch {
      setMessage(action === 'seed' ? uiText('Erro ao criar dados de teste') : uiText('Erro ao apagar dados de teste'));
    } finally { setBusy(false); }
  };
  return <section className="space-y-4 rounded-xl border bg-card p-4">
    <h1 className="text-xl font-semibold">{copy.labels.admin_test_data}</h1>
    <p>{uiText('Gerir dados de teste para desenvolvimento')}</p>
    <div className="flex flex-wrap gap-3">
      <Button disabled={busy} onClick={() => setConfirmation('seed')}>{uiText('Criar/Atualizar Dados de Teste')}</Button>
      <Button variant="destructive" disabled={busy} onClick={() => setConfirmation('clear')}>{uiText('Apagar Dados de Teste')}</Button>
    </div>
    <p role="status">{message}</p>
    <AlertDialog open={confirmation !== null} onOpenChange={open => { if (!open) setConfirmation(null); }}>
      <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{copy.labels.admin_test_data}</AlertDialogTitle>
        <AlertDialogDescription>{confirmation === 'seed' ? copy.confirmSeed : uiText('Tens a certeza que queres apagar TODOS os dados de teste? Esta ação é irreversível.')}</AlertDialogDescription>
      </AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>{copy.cancel}</AlertDialogCancel><AlertDialogAction onClick={() => void run()}>{copy.confirm}</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
    </AlertDialog>
  </section>;
}
