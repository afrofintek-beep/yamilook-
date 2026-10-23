import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import BottomNav from '@/components/BottomNav';
import { ArchivedChatsSheet } from '@/components/settings/ArchivedChatsSheet';
import { BlockedUsersSheet } from '@/components/settings/BlockedUsersSheet';
import PaposBrand from './PaposBrand';
export default function PaposSettings() {
  const { profile, updateProfile, signOut } = useAuth(); const { toast } = useToast(); const navigate = useNavigate();
  const [archived, setArchived] = useState(false); const [blocked, setBlocked] = useState(false); const [busy, setBusy] = useState(false);
  const privacy = [ ['show_online_status', 'Mostrar quando estou online'], ['show_last_seen', 'Mostrar última vez online'], ['show_read_receipts', 'Confirmações de leitura'], ['show_typing_indicators', 'Mostrar quando estou a escrever'] ] as const;
  const change = async (key: typeof privacy[number][0], value: boolean) => {
    setBusy(true);
    try { const result = await updateProfile({ [key]: value }); if (result.error) throw result.error; }
    catch { toast({ title: 'Não foi possível guardar', variant: 'destructive' }); }
    finally { setBusy(false); }
  };
  return <div className="h-screen-safe flex flex-col bg-background pb-[calc(5rem+env(safe-area-inset-bottom,0px))]">
    <header className="safe-top shrink-0 border-b p-4"><h1 className="text-xl font-bold">Definições</h1></header>
    <main className="flex-1 overflow-y-auto p-4 space-y-6 max-w-lg w-full mx-auto"><PaposBrand />
      <Button asChild variant="outline" className="w-full"><Link to="/profile">{profile?.display_name || 'O meu perfil'}</Link></Button>
      <section className="rounded-2xl border p-4 space-y-5"><h2 className="font-semibold">Privacidade</h2>{privacy.map(([key, label]) => <label key={key} className="flex items-center justify-between gap-3 text-sm"><span>{label}</span><Switch checked={profile?.[key] ?? true} disabled={busy} onCheckedChange={value => void change(key, value)} /></label>)}<p className="text-xs text-muted-foreground">Estas preferências são partilhadas com a Yamilook.</p></section>
      <div className="grid gap-3"><Button variant="outline" onClick={() => setArchived(true)}>Conversas arquivadas</Button><Button variant="outline" onClick={() => setBlocked(true)}>Pessoas bloqueadas</Button><Button asChild variant="outline"><Link to="/install">Instalação e acesso</Link></Button><Button asChild variant="outline"><a href="/muxi">Abrir Yamilook</a></Button></div>
      <p className="text-xs text-muted-foreground">MVP: mensagens e chamadas usam o serviço Yamilook. Os alertas dependem de a aplicação estar aberta. A encriptação de ponta a ponta ainda não está implementada.</p>
      <Button variant="ghost" disabled={busy} onClick={async () => { setBusy(true); try { await signOut('local'); navigate('/login', { replace: true }); } catch { toast({ title: 'Não foi possível sair', variant: 'destructive' }); } finally { setBusy(false); } }}>Terminar sessão</Button>
    </main><ArchivedChatsSheet open={archived} onOpenChange={setArchived} /><BlockedUsersSheet open={blocked} onOpenChange={setBlocked} /><BottomNav /></div>;
}
