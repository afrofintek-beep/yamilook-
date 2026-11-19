import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Fiscal = {sale_id:string; state:string; provider_document:string|null};
type Tax = {id:string; nif:string; tax:string; due_date:string; amount:number; reference:string; requested_at:string|null; confirmed_reference:string|null};
type Sale = {id:string; nif:string; description:string; business:string};
export function BillingIntegrations({sales}:{sales:Sale[]}) {
  const {user}=useAuth();
  const cache=useQueryClient();
  const key=['billing-integrations',user?.id];
  const [saleId,choose]=useState('');
  const [order,setOrder]=useState('');
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);
  const current=sales.find(s=>s.id===saleId);
  const info=useQuery({queryKey:key,enabled:!!user,queryFn:async()=>{
    const [f,t]=await Promise.all([supabase.from('billing_fiscal_requests' as never).select('*'),supabase.from('billing_tax_pilot' as never).select('*').order('due_date')]);
    if(f.error||t.error) throw f.error||t.error;
    return {fiscal:f.data as unknown as Fiscal[],taxes:t.data as unknown as Tax[]};
  }});
  async function run(action:()=>Promise<void>) {
    setBusy(true); setMessage('');
    try {
      await action();
      await Promise.all([cache.invalidateQueries({queryKey:key}),cache.invalidateQueries({queryKey:['billing-pilot',user?.id]})]);
      setMessage('Operação de teste concluída.');
    } catch {setMessage('Operação por confirmar. Consulte o estado e verifique os dados.');}
    finally {setBusy(false);}
  }
  async function ledger() {
    const rows:unknown[]=[];
    for(let offset=0;;offset+=250){
      const {data,error}=await supabase.from('billing_pilot_journal' as never).select('*').eq('sale_id',saleId)
        .order('source_id').order('account_role').range(offset,offset+249);
      if(error) throw error;
      rows.push(...data);
      if(data.length<250) break;
    }
    const url=URL.createObjectURL(new Blob([JSON.stringify({ambiente:'teste',moeda:'AOA',lancamentos:rows},null,2)],{type:'application/json'}));
    const link=document.createElement('a'); link.href=url; link.download='diario-teste-'+saleId+'.json'; link.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  const fiscal=info.data?.fiscal.find(f=>f.sale_id===saleId);
  return <section className="space-y-4 rounded-xl border p-4">
    <h2 className="text-xl font-semibold">Integrações de teste</h2>
    {info.isError && <p role="alert">Não foi possível carregar os estados das integrações.</p>}
    <label className="block">Venda <select className="block w-full" value={saleId} onChange={e=>choose(e.target.value)}>
      <option value="">Escolher venda</option>{sales.map(s=><option key={s.id} value={s.id}>{s.business} · {s.description} · {s.id.slice(0,8)}</option>)}</select></label>
    {current && <fieldset disabled={busy} className="space-y-3">
      <Button disabled={!info.isSuccess||!!fiscal} onClick={()=>run(async()=>{
        const {error}=await supabase.from('billing_fiscal_requests' as never).insert({sale_id:saleId} as never); if(error) throw error;
      })}>Preparar emissão de teste</Button>
      {fiscal && <p>Pedido fiscal · {({pending:'A aguardar o motor',accepted:'Aceite em teste',rejected:'Rejeitado'} as Record<string,string>)[fiscal.state]} {fiscal.provider_document}</p>}
      <Button variant="outline" onClick={()=>run(ledger)}>Exportar lançamentos da venda</Button>
      <form className="space-y-2" onSubmit={e=>{e.preventDefault();void run(async()=>{
        const {error}=await supabase.rpc('billing_match_kumbu' as never,{p_sale:saleId,p_order:order.trim()} as never); if(error) throw error;setOrder('');
      });}}>
        <label>Referência do pedido pago na Kumbu<Input required value={order} onChange={e=>setOrder(e.target.value)}/></label>
        <Button>Conciliar recebimento</Button>
      </form>
      <form className="space-y-2" onSubmit={e=>{e.preventDefault();const form=e.currentTarget;const values=Object.fromEntries(new FormData(form));
        void run(async()=>{const {error}=await supabase.from('billing_tax_pilot' as never).insert({...values,nif:current.nif} as never);
          if(error) throw error;form.reset();});
      }}>
        <h3>Obrigação fiscal de teste · {current.nif}</h3>
        <label>Imposto e período<Input required name="tax"/></label><label>Data limite<Input required type="date" name="due_date"/></label>
        <label>Valor (Kz)<Input required name="amount" type="number" min=".01" step=".01"/></label>
        <label>Referência de teste<Input name="reference" required/></label><Button>Guardar obrigação</Button>
      </form>
    </fieldset>}
    {info.data?.taxes.map(t=><article className="border-t py-2" key={t.id}>
      <strong>{t.tax}</strong><p>{t.nif} · {t.amount} Kz · {t.due_date}</p>
      {t.confirmed_reference?<p>Pagamento de teste confirmado · {t.confirmed_reference}</p>:t.requested_at?<p>Pedido de teste a aguardar confirmação</p>:
      <Button disabled={busy} onClick={()=>run(async()=>{const {error}=await supabase.rpc('billing_tax_request' as never,{p_id:t.id} as never);if(error)throw error;})}>Preparar pagamento de teste</Button>}
    </article>)}
    <p role="status">{message}</p>
  </section>;
}
