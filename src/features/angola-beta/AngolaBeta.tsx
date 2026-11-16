import { lazy, Suspense, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { buildInviteUrl } from '@/lib/referral';
import { betaAction, type BetaStatus, type BandaInvite, type BetaReport } from './api';

const CreateGroupSheet = lazy(() => import('@/components/chat/CreateGroupSheet').then(module => ({default:module.CreateGroupSheet})));

export function useBetaStatus() {
 return useQuery({ queryKey: ['angola-beta-status'], queryFn: () => betaAction<BetaStatus>('status'), staleTime: 60_000, refetchInterval: 60_000, retry: 1 });
}
export function AngolaBetaBanner() {
 const { data } = useBetaStatus();
 if (!data) return null;
 return <Link to="/angola" className="block rounded-2xl border border-primary/20 bg-primary/5 p-4 my-3 text-sm">
  <strong className="block">A tua banda começa contigo.</strong>
  <span>{data.confirmed.toLocaleString('pt-AO')} de {data.capacity.toLocaleString('pt-AO')} participantes confirmados em Angola</span>
  <span className="block text-primary mt-1">{data.open ? 'Entra gratuitamente e convida cinco pessoas →' : 'Consulta a campanha e a lista de espera →'}</span>
 </Link>;
}
export function BandaInvites() {
 const { user } = useAuth();
 const { data, error } = useQuery({ queryKey: ['angola-beta-mine', user?.id], queryFn: () => betaAction<{ eligible: boolean; invites: BandaInvite[] }>('mine'), enabled: !!user, staleTime: 30_000 });
 const [message, setMessage] = useState('');
 const [groupOpen,setGroupOpen] = useState(false);
 useEffect(() => setMessage(''), [user?.id]);
 if (!user) return null;
 if (error) return <p role="alert">Não foi possível consultar os teus cinco convites. Tenta novamente.</p>;
 if (!data?.eligible) return <p className="text-sm text-muted-foreground">Os cinco convites ficam disponíveis após a confirmação da conta participante em Angola.</p>;
 const share = async (invite: BandaInvite) => {
  const text = `Vem para a minha banda na Yamilook! Cria a tua conta gratuita e junta os teus amigos, familiares e vizinhos. Depois de confirmares a conta, também recebes cinco convites. ${buildInviteUrl(invite.code)}`;
  try {
   if (navigator.share) await navigator.share({ title: 'A nossa banda na Yamilook', text });
   else { await navigator.clipboard.writeText(text); setMessage('Convite copiado. Partilha-o com uma pessoa da tua banda.'); }
  } catch (error) { if (!(error instanceof DOMException && error.name === 'AbortError')) setMessage('Selecciona e copia a ligação abaixo para a partilhar.'); }
 };
 return <section className="space-y-3 my-5" aria-label="Cinco convites para a tua banda">
  <h2 className="font-semibold text-lg">Os teus 5 convites para a tua banda</h2>
  <p className="text-sm text-muted-foreground">Convida familiares, amigos e vizinhos. Cada ligação permite uma inscrição. Não é obrigatório convidar para usar a Yamilook; os convites não reservam vagas.</p>
  {data.invites.map(invite => <div key={invite.code} className="rounded-xl border p-3 space-y-2">
   <div className="flex items-center justify-between gap-2"><span>Convite {invite.slot}</span><span className="text-xs">{invite.confirmed ? 'Conta confirmada' : invite.used ? 'A aguardar confirmação' : 'Disponível'}</span></div>
   {!invite.used && <><a className="block text-xs break-all text-primary underline" href={buildInviteUrl(invite.code)}>{buildInviteUrl(invite.code)}</a><Button variant="outline" onClick={() => void share(invite)}>Partilhar convite {invite.slot}</Button></>}
  </div>)}
  <p role="status" className="text-sm">{message}</p>
  <Button variant="outline" onClick={()=>setGroupOpen(true)}>Criar grupo da minha banda</Button>
  {groupOpen && <Suspense fallback={<p>A abrir grupos…</p>}><CreateGroupSheet open={groupOpen} onOpenChange={setGroupOpen}/></Suspense>}
  <Link to="/academia/comunidades" className="block text-primary underline text-sm">Descobrir comunidades</Link>
 </section>;
}
export function AngolaBetaAdmin() {
 const { data, refetch, error } = useQuery({ queryKey: ['angola-beta-admin'], queryFn: () => betaAction<BetaReport>('report'), refetchInterval: 60_000 });
 const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
 if (error) return <p role="alert">Não foi possível carregar o acompanhamento de Angola.</p>;
 if (!data) return null;
 return <section className="rounded-2xl border p-5 space-y-4 my-6">
  <h2 className="text-xl font-semibold">Angola · primeiros 10.000</h2>
  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{[
   ['Inscrições / vagas ocupadas',data.registered],['Contas confirmadas',data.confirmed],['Por confirmar',data.registered-data.confirmed],
   ['Activos · 24 horas',data.daily_active],['Activos · 7 dias',data.weekly_active],['Presença · últimos 5 min',data.online],['Convites utilizados',data.invites_used],['Lista de espera',data.waitlist]
  ].map(([label,value]) => <div key={label} className="rounded-xl bg-muted p-3"><div className="text-xs">{label}</div><strong className="text-xl">{value}</strong></div>)}</div>
  <p className="text-xs text-muted-foreground">Presença é uma aproximação baseada na última actividade, não uma medição exacta de ligações simultâneas. As inscrições por confirmar reservam vaga. O fim da campanha não apaga nem bloqueia contas existentes.</p>
  <Button disabled={busy} variant="outline" onClick={async () => { setBusy(true); try { await betaAction('configure',{enabled:!data.enabled}); await refetch(); setMessage('Estado actualizado.'); } catch(e) { setMessage((e as Error).message); } finally {setBusy(false);} }}>{data.enabled ? 'Pausar novas inscrições' : 'Abrir novas inscrições'}</Button>
  <p role="status">{message}</p>
  <h3 className="font-semibold">Últimos problemas reportados</h3>
  {!data.feedback.length && <p className="text-sm">Ainda sem relatos.</p>}
  {data.feedback.map(f => <div key={f.id} className="border-t pt-2 text-sm"><time>{new Date(f.created_at).toLocaleString('pt-AO')}</time><p className="whitespace-pre-wrap break-words">{f.message}</p></div>)}
 </section>;
}
export default function AngolaBeta() {
 const { user } = useAuth();
 const { data, error, refetch } = useBetaStatus();
 const [email,setEmail]=useState(''), [consent,setConsent]=useState(false), [feedback,setFeedback]=useState(''), [message,setMessage]=useState(''), [busy,setBusy]=useState(false);
 const submit = async (action: 'waitlist'|'feedback') => { setBusy(true); setMessage(''); try {
  await betaAction(action,action==='waitlist'?{email,consent}:{message:feedback});
  setMessage(action==='waitlist'?'Pedido de inscrição na lista de espera recebido. Não garante uma vaga nem activa cobranças.':'Obrigado. O teu relato ficou registado para o Apoio Técnico.'); setFeedback('');
 } catch(e) {setMessage((e as Error).message);} finally {setBusy(false);} };
 return <main className="min-h-screen bg-background px-4 py-8"><div className="max-w-xl mx-auto space-y-5">
  <Link to={user?'/feed':'/login'} className="text-primary">← Yamilook</Link>
  <p className="text-sm font-semibold text-primary">ANGOLA · ACESSO ANTECIPADO</p>
  <h1 className="text-3xl font-bold">A tua banda começa contigo.</h1>
  <p>Estamos a abrir a Yamilook aos primeiros 10.000 participantes em Angola. Entra, experimenta e ajuda-nos a melhorar.</p>
  {error ? <div role="alert">Não foi possível actualizar o contador. <Button variant="outline" onClick={()=>void refetch()}>Tentar novamente</Button></div> : !data ? <p role="status">A consultar participantes…</p> : <>
   <div className="rounded-2xl bg-primary/5 border border-primary/20 p-6"><strong className="text-3xl">{data.confirmed.toLocaleString('pt-AO')}</strong><span> de {data.capacity.toLocaleString('pt-AO')}</span><p className="text-sm">contas confirmadas em Angola</p><progress className="w-full mt-4 accent-primary" aria-label="Participantes confirmados" value={data.confirmed} max={data.capacity}/></div>
   <p className="text-sm text-muted-foreground">Campanha gratuita de {new Date(data.starts_at).toLocaleDateString('pt-AO')} a {new Date(data.ends_at).toLocaleDateString('pt-AO')}. Sem cobrança automática. As condições posteriores serão comunicadas; as contas e os conteúdos não são apagados no fim do teste.</p>
   {data.open ? !user && <Button asChild className="w-full"><Link to="/onboarding?campaign=angola">Criar conta sem convite</Link></Button> : <section className="rounded-xl border p-4 space-y-3"><h2 className="font-semibold">Lista de espera</h2><p className="text-sm">As novas entradas estão temporariamente fechadas. Podes deixar o teu contacto para uma próxima abertura.</p><Input type="email" aria-label="Email para lista de espera" value={email} onChange={e=>setEmail(e.target.value)} maxLength={254}/><label className="flex gap-2 text-sm"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>Aceito guardar este email para a lista de espera da Yamilook.</label><Button disabled={busy||!consent||!email.includes('@')} onClick={()=>void submit('waitlist')}>Entrar na lista de espera</Button></section>}
  </>}
  <div className="rounded-xl border p-4"><h2 className="font-semibold">Cinco pessoas, mais comunidade</h2><p className="text-sm mt-2">Depois de confirmares a conta, recebes cinco convites individuais para partilhar com as tuas pessoas. Os teus convidados também recebem cinco após confirmarem a conta, dentro do limite da campanha.</p></div>
  <BandaInvites/>
  <p className="text-sm text-muted-foreground">Acesso às funcionalidades disponíveis da Yamilook, com protecções contra abuso e limites técnicos. Serviços externos pagos e certificações AFROLOC mantêm as suas condições. A escolha de Angola no registo é uma declaração de residência.</p>
  {user && <section className="space-y-3"><h2 className="font-semibold">Reportar problema</h2><Textarea aria-label="Descreve o problema" placeholder="O que tentaste fazer e o que aconteceu? Não incluas palavras-passe ou documentos pessoais." value={feedback} onChange={e=>setFeedback(e.target.value)} maxLength={2000}/><Button disabled={busy||feedback.trim().length<5} onClick={()=>void submit('feedback')}>Enviar ao Apoio Técnico</Button></section>}
  <p role="status" className="text-sm">{message}</p>
 </div></main>;
}
