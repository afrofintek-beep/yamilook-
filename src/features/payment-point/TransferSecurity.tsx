import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { money, parseAmount } from './api';

const limitFormat = new Intl.NumberFormat('pt-AO', {
  useGrouping: true, minimumFractionDigits: 2, maximumFractionDigits: 2,
});

function parseLimit(value: string) {
  const normalized = value.trim().replace(/^(\d{1,3}(?:[ \u00a0\u202f]\d{3})+)(?=[,.]|$)/, group => group.replace(/\s/g, ''));
  return parseAmount(normalized);
}

function formatOnBlur(value: string) {
  try {
    return limitFormat.format(parseLimit(value) / 100);
  } catch {
    return value;
  }
}

type Preferences = { blocked:boolean; per_transfer:number; per_day:number; keys:string[] };
async function preferences(blocked?:boolean, transfer?:number, daily?:number) {
  const {supabase} = await import('@/integrations/supabase/client');
  const {data,error} = await supabase.rpc('wallet_preferences' as never,{p_blocked:blocked,p_transfer:transfer,p_daily:daily} as never);
  if (error) throw new Error(error.message);
  return data as Preferences;
}
export function TransferSecurity() {
  const [prefs,setPrefs] = useState<Preferences>();
  const [transfer,setTransfer] = useState('');
  const [daily,setDaily] = useState('');
  const [message,setMessage] = useState('');
  const [busy,setBusy] = useState(false);
  function show(value:Preferences) {
    setPrefs(value); setTransfer(limitFormat.format(value.per_transfer/100)); setDaily(limitFormat.format(value.per_day/100));
  }
  useEffect(()=>{void preferences().then(show).catch(e=>setMessage(e.message));},[]);
  async function save(toggle:boolean) {
    if (!prefs) return;
    setBusy(true);
    try {
      show(toggle ? await preferences(!prefs.blocked) : await preferences(undefined,parseLimit(transfer),parseLimit(daily)));
      setMessage('Definições guardadas.');
    } catch(e) {setMessage((e as Error).message);}
    finally {setBusy(false);}
  }
  return <section className="space-y-3">
    {prefs && <>
      <p>Saídas de dinheiro {prefs.blocked ? 'bloqueadas' : 'activas'}.</p>
      <Button disabled={busy} onClick={()=>save(true)}>{prefs.blocked ? 'Desbloquear' : 'Bloquear'} saídas de dinheiro</Button>
      <label className="block">Limite por operação (Kz)<Input inputMode="decimal" value={transfer} onBlur={()=>setTransfer(formatOnBlur(transfer))} onChange={e=>setTransfer(e.target.value)}/></label>
      <label className="block">Limite diário (Kz)<Input inputMode="decimal" value={daily} onBlur={()=>setDaily(formatOnBlur(daily))} onChange={e=>setDaily(e.target.value)}/></label>
      <Button disabled={busy} onClick={()=>save(false)}>Guardar limites</Button>
      <p>Limite diário em vigor {money(prefs.per_day)}. O dia segue a hora de Luanda.</p>
      <p>{prefs.keys.length ? 'Chave de acesso registada em '+new Date(prefs.keys[0]).toLocaleDateString('pt-AO') : 'A primeira chave é registada ao autorizar uma operação. Active primeiro a verificação em dois passos nas definições da conta.'}</p>
    </>}
    <p role="status">{message}</p>
  </section>;
}
