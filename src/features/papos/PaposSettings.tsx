import CallPushSettings from './CallPushSettings';
import CallRingtoneSettings from './CallRingtoneSettings';
import PaposLanguageSelector from './PaposLanguageSelector';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import BottomNav from '@/components/BottomNav';
import { ArchivedChatsSheet } from '@/components/settings/ArchivedChatsSheet';
import { BlockedUsersSheet } from '@/components/settings/BlockedUsersSheet';
import PaposBrand from './PaposBrand';
import { ConnectedDevices } from '@/components/settings/ConnectedDevices';
import { BackupManager } from '@/components/settings/BackupManager';
export default function PaposSettings() {
  const queryClient = useQueryClient();
  const [logoutError, setLogoutError] = useState('');
  const { profile, updateProfile, signOut } = useAuth(); const { toast } = useToast(); const navigate = useNavigate();
  const [archived, setArchived] = useState(false); const [blocked, setBlocked] = useState(false); const [busy, setBusy] = useState(false);
  const privacy = [ ['show_online_status', 'Mostrar quando estou online'], ['show_last_seen', 'Mostrar última vez online'], ['show_read_receipts', 'Confirmações de leitura'], ['show_typing_indicators', 'Mostrar quando estou a escrever'] ] as const;
  const leave = async () => {
    if (busy) return;
    setBusy(true); setLogoutError('');
    try {
      await queryClient.cancelQueries();
      queryClient.clear();
      await signOut('local');
      navigate('/login', { replace: true, state: { signedOut: true } });
    } catch {
      setLogoutError('Não foi possível confirmar a saída. Tenta novamente.');
    } finally { setBusy(false); }
  };
  const change = async (key: typeof privacy[number][0], value: boolean) => {
    setBusy(true);
    try { const result = await updateProfile({ [key]: value }); if (result.error) throw result.error; }
    catch { toast({ title: 'Não foi possível guardar', variant: 'destructive' }); }
    finally { setBusy(false); }
  };
  return <div className="h-screen-safe flex flex-col bg-background pb-[calc(5rem+env(safe-area-inset-bottom,0px))]">
    <header className="safe-top shrink-0 border-b p-4"><Button asChild variant="ghost"><Link to="/papos">Voltar às conversas</Link></Button><h1 className="text-xl font-bold">Definições</h1></header>
    <main className="flex-1 overflow-y-auto p-4 space-y-6 max-w-lg w-full mx-auto"><PaposBrand /><p className="text-xs text-muted-foreground">Uma aplicação do ecossistema AFROFINTEK</p>
      <Button asChild variant="outline" className="w-full"><Link to="/profile">{profile?.display_name || 'O meu perfil'}</Link></Button>
      <PaposLanguageSelector />
      <CallRingtoneSettings />
      <CallPushSettings />
      <ConnectedDevices />
      <section className="rounded-2xl border p-4 space-y-5"><h2 className="font-semibold">Privacidade</h2>{privacy.map(([key, label]) => <label key={key} className="flex items-center justify-between gap-3 text-sm"><span>{label}</span><Switch checked={profile?.[key] ?? true} disabled={busy} onCheckedChange={value => void change(key, value)} /></label>)}<p className="text-xs text-muted-foreground">Estas preferências são partilhadas com a Yamilook.</p></section>
      <div className="grid gap-3"><Button variant="outline" onClick={() => setArchived(true)}>Conversas arquivadas</Button><Button variant="outline" onClick={() => setBlocked(true)}>Pessoas bloqueadas</Button><Button asChild variant="outline"><Link to="/install">Instalação e acesso</Link></Button><Button asChild variant="outline"><a href="https://www.yamilook.com/muxi">Abrir Yamilook</a></Button></div>
      <p className="text-xs text-muted-foreground">MVP: mensagens e chamadas usam o serviço Yamilook. Os alertas fora da aplicação requerem ativação neste dispositivo. A encriptação de ponta a ponta ainda não está implementada.</p>
      <p className="text-xs text-muted-foreground">Terminar sessão sai apenas desta instalação da KOSOLOLA. As conversas ficam guardadas na tua conta.</p>
      {logoutError && <p role="alert" className="text-sm text-destructive">{logoutError}</p>}
      <Button variant="outline" className="w-full" disabled={busy} onClick={() => void leave()}>Terminar sessão</Button>
    </main><ArchivedChatsSheet open={archived} onOpenChange={setArchived} /><BlockedUsersSheet open={blocked} onOpenChange={setBlocked} /><BottomNav /></div>;
}
