import SumbaDemoOrder from './SumbaDemoOrder';
import { BillingIntegrations } from './BillingIntegrations';
import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

type Sale = { id:string; business:string; nif:string; customer:string; description:string; total:number; billing_pilot_receipts:{amount:number;method:string}[] };
const money = (value:number) => value.toLocaleString('pt-AO',{style:'currency',currency:'AOA'});
const fields = [
  ['business','Nome fiscal do negócio'],['nif','NIF'],['customer','Cliente'],['description','Produto ou serviço'],
  ['quantity','Quantidade'],['unit_price','Preço unitário sem IVA (Kz)'],['rate','Taxa de IVA para simulação (%)']
] as const;

export default function BillingPilot(){
  const { user } = useAuth();
  const cache = useQueryClient();
  const key = ['billing-pilot',user?.id];
  const [message,setMessage] = useState('');
  const [busy,setBusy] = useState(false);
  const sales = useQuery({queryKey:key,enabled:!!user,queryFn:async()=>{
    const {data,error}=await supabase.from('billing_pilot_sales' as never)
      .select('id,business,nif,customer,description,total,billing_pilot_receipts(amount,method)').order('created_at',{ascending:false});
    if(error) throw error;
    return data as unknown as Sale[];
  }});
  async function submit(event:FormEvent<HTMLFormElement>,sale?:Sale){
    event.preventDefault();
    const form=event.currentTarget;
    const values=Object.fromEntries(new FormData(form));
    const id=form.dataset.requestId ||= crypto.randomUUID();
    setBusy(true);
    setMessage('');
    try {
      const result=sale ? await supabase.rpc('billing_pilot_receive' as never,{
        p_id:id,p_sale:sale.id,p_amount:values.amount,p_method:values.method
      } as never) : await supabase.from('billing_pilot_sales' as never).insert({...values,id} as never);
      if(result.error && (sale || result.error.code !== '23505')) throw result.error;
      delete form.dataset.requestId;
      form.reset();
      await cache.invalidateQueries({queryKey:key});
      setMessage(sale?'Recebimento de teste registado.':'Venda de teste guardada.');
    } catch {
      setMessage('O registo não foi confirmado. Verifique o saldo, os dados e a ligação.');
    } finally {setBusy(false);}
  }
  return <main className="mx-auto max-w-2xl space-y-6 p-5 safe-top">
    <Link to="/payment-point?tab=business">← Negócios</Link>
    <h1 className="text-3xl font-bold">Yamilook Facturação</h1>
    <p>Ambiente de teste · Sem valor fiscal. Utilize dados fictícios.</p>
    <form className="space-y-3 rounded-xl border p-4" onSubmit={e=>submit(e)}>
      <h2 className="text-xl font-semibold">Registar venda de teste</h2>
      {fields.map(([name,label],i)=><label key={name} className="block">{label}
        <Input required name={name} type={i>=4?'number':'text'} step={i===4?'1':'0.01'}
          min={i===6?0:i===4?1:0.01} max={i===6?100:i===4?10000:undefined}
          pattern={name==='nif'?'[A-Za-z0-9]{8,16}':undefined} defaultValue={i===4?1:undefined}/>
      </label>)}
      <Button disabled={busy}>Guardar venda</Button>
    </form>
    <p role="status">{message}</p>
    <SumbaDemoOrder key={window.location.hash} />
    <BillingIntegrations sales={sales.data ?? []} />
    <h2 className="text-xl font-semibold">Vendas e recebimentos</h2>
    {sales.isLoading && <p>A carregar vendas…</p>}
    {sales.isError && <p>Não foi possível consultar as vendas.</p>}
    {sales.data?.length===0 && <p>Ainda não há vendas de teste.</p>}
    {sales.data?.map(sale=>{
      const received=sale.billing_pilot_receipts.filter(r=>r.method!=='Kumbu').reduce((sum,r)=>sum+Math.round(Number(r.amount)*100),0)/100;
      const due=Math.round((sale.total-received)*100)/100;
      return <article key={sale.id} className="space-y-2 rounded-xl border p-4">
        <h3 className="font-semibold">{sale.business} · {sale.description}</h3>
        <p>{sale.customer} · Total {money(sale.total)}</p>
        <p>Recebido {money(received)} · Em dívida {money(due)}</p>
        {due>0 && <form className="space-y-2" onSubmit={e=>submit(e,sale)}>
          <label>Valor recebido (Kz)<Input name="amount" type="number" min=".01" max={due} step=".01" required/></label>
          <label>Meio de pagamento <select name="method"><option>Numerário</option><option>Transferência</option></select></label>
          <Button disabled={busy}>Registar recebimento de teste</Button>
        </form>}
      </article>;
    })}
  </main>;
}