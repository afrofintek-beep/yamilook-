import { useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useManageAcademiaSession, type AcademiaSession } from '../hooks/useAcademia';
import { sessionActions, type SessionAction } from '../session-management';
const labels: Record<SessionAction, string> = { archive: 'Arquivar', restore: 'Restaurar', cancel: 'Cancelar sessão', delete: 'Eliminar' };
const descriptions: Record<SessionAction, string> = {
  archive: 'A sessão sai da lista principal. O histórico e os materiais são preservados. Inscrições pendentes precisam de conclusão ou cancelamento.',
  restore: 'A sessão volta ao histórico ou à lista de próximas sessões, conforme o seu estado. Não reabre inscrições de sessões canceladas.',
  cancel: 'Os inscritos recebem um aviso na Academia e o Kumbu retido é devolvido. Indique o motivo.',
  delete: 'Só é permitido eliminar sessões sem inscrições, avaliações ou movimentos de Kumbu. A sessão deixa de estar acessível e a ação fica registada.',
};
export function SessionManagement({ session }: { session: AcademiaSession }) {
  const mutation = useManageAcademiaSession();
  const [action, setAction] = useState<SessionAction | null>(null);
  const [reason, setReason] = useState('');
  const actions = sessionActions(session);
  if (!actions.length) return null;
  return <>
    <DropdownMenu>
      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`Gerir sessão: ${session.title}`}><MoreHorizontal className="h-5 w-5" /></Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end">{actions.map(a => <DropdownMenuItem key={a} onSelect={() => { setReason(''); setAction(a); }}>{labels[a]}</DropdownMenuItem>)}</DropdownMenuContent>
    </DropdownMenu>
    <Dialog open={!!action} onOpenChange={open => { if (!open && !mutation.isPending) setAction(null); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>{action ? labels[action] : ''}: {session.title}</DialogTitle><DialogDescription>{action ? descriptions[action] : ''}</DialogDescription></DialogHeader>
        {action === 'cancel' && <div><label htmlFor={`cancel-reason-${session.id}`}>Motivo do cancelamento</label><Textarea id={`cancel-reason-${session.id}`} value={reason} maxLength={1000} onChange={e => setReason(e.target.value)} /></div>}
        <DialogFooter>
          <Button variant="outline" disabled={mutation.isPending} onClick={() => setAction(null)}>Voltar</Button>
          <Button disabled={mutation.isPending || (action === 'cancel' && reason.trim().length < 3)} onClick={() => {
            if (!action) return;
            mutation.mutate({ sessionId: session.id, action, reason: action === 'cancel' ? reason.trim() : undefined }, {
              onSuccess: () => { toast.success('Sessão atualizada.'); setAction(null); },
              onError: error => toast.error(error.message),
            });
          }}>{mutation.isPending ? 'A processar…' : 'Confirmar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
