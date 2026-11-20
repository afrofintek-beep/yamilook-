import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import ResidenceMapPicker from '@/components/residence/ResidenceMapPicker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Row = {id:string; label:string; code:string; public:boolean; mine:boolean; accepted:boolean; pending:boolean; recipient:string|null; status:string};
type Division = {code:string; name:string; level:number; parent_code:string};
async function call<T>(fn:string, args:Record<string,unknown>):Promise<T> {
  const {data,error} = await supabase.rpc(fn as never,args as never);
  if (error) throw new Error(error.message);
  return data as T;
}
export default function AfrolocRegistry() {
  const [rows,setRows]=useState<Row[]>([]);
  const [admin,setAdmin]=useState(false);
  const [catalog,setCatalog]=useState<Division[]>([]);
  const [point,setPoint]=useState<{lat:number;lng:number}>();
  const [province,setProvince]=useState('');
  const [municipality,setMunicipality]=useState('');
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);
  const [filter,setFilter]=useState('');
  const request=useRef(crypto.randomUUID());
  async function refresh() {
    const data=await call<{admin:boolean;rows:Row[]}>('afroloc_registry',{action:'list'});
    setRows(data.rows);
    setAdmin(data.admin);
    return data.admin;
  }
  useEffect(()=>{refresh().then(async allowed=>{
    if (allowed) setCatalog((await call<{divisions:Division[]}>('afroloc_experience_action',{p_action:'catalog'})).divisions);
  }).catch(e=>setMessage(e.message))},[]);
  async function submit(action:string,data:Record<string,unknown>,reset?:()=>void) {
    setBusy(true);
    try {
      await call('afroloc_registry',{action,data});
      reset?.();
      await refresh();
      setMessage('Operação concluída.');
    } catch(e) {setMessage(e instanceof Error?e.message:'Tente novamente.')}
    finally {setBusy(false)}
  }
  const communes=catalog.filter(d=>d.parent_code===municipality);
  return <main className="mx-auto max-w-xl space-y-4 p-4">
    <Link to="/afroloc">Voltar ao meu cartão AFROLOC</Link>
    <h1 className="text-xl font-bold">Endereços da comunidade</h1>
    <p role="status">{message}</p>
    {admin && <><p>{rows.length} endereços activos · {rows.filter(r=>r.accepted&&!r.public).length} atribuições privadas aceites · {rows.filter(r=>r.pending).length} pendentes</p>
    <details><summary>Criar endereço</summary>
    <form className="grid gap-3 py-3" onSubmit={e=>{
      e.preventDefault();
      if (!point) return;
      const form=e.currentTarget;
      const fields=Object.fromEntries(new FormData(form));
      void submit('create',{...fields,latitude:point.lat,longitude:point.lng,id:request.current,province,municipality,public:fields.visibility==='public',confirmDuplicate:fields.duplicate==='on',consent:true},()=>{
        form.reset();setPoint(undefined);setProvince('');setMunicipality('');request.current=crypto.randomUUID();
      });
    }}>
      <label>Nome do local<Input name="label" required maxLength={120}/></label>
      <label>Bairro<Input name="neighborhood" required maxLength={120}/></label>
      <label>Província <select required value={province} onChange={e=>{setPoint(undefined);setProvince(e.target.value);setMunicipality('')}}><option value="">Seleccionar</option>{catalog.filter(d=>d.level===1).map(d=><option key={d.code} value={d.code}>{d.name}</option>)}</select></label>
      <label>Município <select required value={municipality} onChange={e=>{setPoint(undefined);setMunicipality(e.target.value)}}><option value="">Seleccionar</option>{catalog.filter(d=>d.level===2&&d.parent_code===province).map(d=><option key={d.code} value={d.code}>{d.name}</option>)}</select></label>
      {communes.length>0&&municipality&&<label>Comuna <select key={municipality} name="commune" onChange={()=>setPoint(undefined)} required><option value="">Seleccionar</option>{communes.map(d=><option key={d.code} value={d.code}>{d.name}</option>)}</select></label>}
      <fieldset className="space-y-2"><legend className="font-medium">Ponto no mapa NJILA</legend>
        <ResidenceMapPicker place point={point} onChange={setPoint} disabled={busy}/>
      </fieldset>
      <label>Visibilidade <select name="visibility"><option value="private">Privado</option><option value="public">Publicar na comunidade</option></select></label>
      <label><input type="checkbox" required/> Confirmo a autorização para cadastrar o local com esta visibilidade.</label>
      {message.includes('duplicado')&&<label><input name="duplicate" type="checkbox"/> Confirmo que é outro endereço na mesma quadrícula.</label>}
      <Button disabled={busy||!point}>Criar endereço</Button>
    </form></details></>}
    <label>Mostrar <select value={filter} onChange={e=>setFilter(e.target.value)}><option value="">Todos os disponíveis</option><option value="pending">Atribuições pendentes</option><option value="public">Endereços públicos</option></select></label>
    {rows.filter(r=>filter==='pending'?r.pending&&(admin||r.mine):filter==='public'?r.public:true).map(r=><article key={r.id} className="space-y-2 rounded-xl border p-3">
      <strong>{r.label}</strong><p>{r.code}</p><p>{r.public?'Público':'Privado'} · {r.status==='approved'?'Verificação aprovada':'A aguardar verificação'}</p>
      {(admin||r.mine)&&<p>{r.recipient&&'@'+r.recipient+' · '}{r.accepted?'Atribuição aceite':r.pending?'A aguardar aceitação':'Sem titular atribuído'}</p>}
      {r.mine&&r.pending&&<Button disabled={busy} onClick={()=>void submit('accept',{id:r.id})}>Aceitar endereço</Button>}
      {admin&&!r.accepted&&<form className="flex gap-2" onSubmit={e=>{e.preventDefault();void submit('assign',{id:r.id,username:new FormData(e.currentTarget).get('username')})}}>
        <Input name="username" aria-label="Nome de utilizador do titular" placeholder="@utilizador" required/><Button disabled={busy}>Atribuir</Button>
      </form>}
    </article>)}
  </main>;
}
