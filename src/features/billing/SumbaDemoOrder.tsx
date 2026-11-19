import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';

type Balance = {received:number;outstanding:number};
export default function SumbaDemoOrder(){
  const {hash}=useLocation();
  const params=new URLSearchParams(hash.slice(1));
  const ref=params.get('sumba');
  const cents=Number(params.get('centimos'));
  const cache=useQueryClient();
  const [balance,setBalance]=useState<Balance|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState(false);
  if(!ref) return null;
  if(!/^[A-Za-z0-9_-]{1,100}$/.test(ref)||!Number.isSafeInteger(cents)||cents<1||cents>100000000000) return <p role="alert">Referência ou valor de ensaio inválido.</p>;
  async function open(){
    setBusy(true);setError(false);setBalance(null);
    try {
      const {data,error}=await supabase.rpc('billing_import_sumba_demo' as never,{p_ref:ref,p_cents:cents} as never);
      if(error||!data) throw Error();
      setBalance(data as Balance);
      await cache.invalidateQueries({queryKey:['billing-pilot']});
    } catch {setError(true);} finally {setBusy(false);}
  }
  const kz=(n:number)=>n.toLocaleString('pt-AO',{style:'currency',currency:'AOA'});
  return <section className="rounded-xl border p-4 space-y-2">
    <h2 className="font-semibold">Encomenda de ensaio da SUMBA</h2>
    <p>{ref} · {kz(cents/100)}</p><p>Confirme o valor trazido da demonstração. A primeira consulta regista a venda fictícia.</p>
    <Button disabled={busy} onClick={open}>{busy?'A consultar…':balance?'Actualizar saldo':'Confirmar e consultar'}</Button>
    {balance&&<p role="status">Recebido {kz(balance.received)} · Em dívida {kz(balance.outstanding)}</p>}
    {error&&<p role="alert">Falha na consulta. Verifique o acesso do comerciante de ensaio e o valor da encomenda.</p>}
  </section>;
}