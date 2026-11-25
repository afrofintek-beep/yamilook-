import { useAdminAreas } from '@/features/admin-areas/useAdminAreas';
import { useAuth } from '@/hooks/useAuth';
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
type Candidate = {id:string; username:string; display_name:string|null};

function AssignHolder({address,refresh}:{address:Row;refresh:()=>Promise<boolean>}) {
  const [query,setQuery]=useState('');
  const [open,setOpen]=useState(false);
  const [selected,setSelected]=useState<Candidate|null>(null);
  const [choices,setChoices]=useState<Candidate[]>([]);
  const [loading,setLoading]=useState(false);
  const [saving,setSaving]=useState(false);
  const [notice,setNotice]=useState('');
  useEffect(()=>{
    if (!open) return;
    let active=true;
    const timer=setTimeout(async ()=>{
      const term=query.trim().replace(/^@/,'');
      // Quote the PostgREST filter value so punctuation stays inside the search term.
      const pattern=JSON.stringify('%'+term.replace(/[%_]/g,c=>'\\'+c)+'%');
      let request=supabase.from('profiles').select('id,username,display_name').ilike('country_code','AO').not('username','is',null);
      if (term) request=request.or('username.ilike.'+pattern+',display_name.ilike.'+pattern);
      const {data,error}=await request.order('username').limit(12);
      if (!active) return;
      setLoading(false);
      setChoices((data??[]).flatMap(p=>p.username?[{...p,username:p.username}]:[]));
      if(error) setNotice('Não foi possível carregar os utilizadores. Volta a pesquisar.');
    },180);
    return ()=>{active=false;clearTimeout(timer)};
  },[query,open]);
  function search(value:string) {
    setQuery(value);setSelected(null);setChoices([]);setNotice('');setLoading(true);setOpen(true);
  }
  async function assign() {
    if (!selected||saving) return;
    setSaving(true);
    try {
      await call('afroloc_registry',{action:'assign',data:{id:address.id,username:selected.username}});
      setNotice('Endereço atribuído a @'+selected.username+' · A aguardar aceitação.');
      setSelected(null);setQuery('');
      await refresh();
    } catch(e) {setNotice(e instanceof Error?e.message:'Tenta novamente.')}
    finally {setSaving(false)}
  }
  return <div className="space-y-2">
    <label>Escolher titular<Input value={query} placeholder="Pesquisar nome ou @utilizador" disabled={saving}
      onFocus={()=>{if (!selected&&!open) search(query)}} onChange={e=>search(e.target.value)} /></label>
    {open&&<div className="rounded-lg border p-2">
      {loading?<p>A pesquisar…</p>:choices.length===0?<p>Nenhum utilizador encontrado.</p>:choices.map(person=><button type="button" key={person.id}
        className="block w-full min-h-11 rounded px-2 text-left" onClick={()=>{setSelected(person);setQuery('@'+person.username);setOpen(false);setNotice('Titular seleccionado. Confirma a atribuição abaixo.')}}>
        {person.display_name} <span>@{person.username}</span>
      </button>)}
      <button type="button" className="underline" onClick={()=>setOpen(false)}>Fechar pesquisa</button>
    </div>}
    <Button type="button" disabled={!selected||saving} onClick={()=>void assign()}>{saving?'A atribuir…':selected?'Atribuir a @'+selected.username:'Atribuir endereço'}</Button>
    <p role="status" className="text-sm">{notice}</p>
  </div>;
}
export default function AfrolocRegistry() {
  const access = useAdminAreas();
  const { user } = useAuth();
  const administrative = access.allowed.admin_addresses;
  return <Registry key={`${user?.id}:${administrative}`} administrative={administrative} />;
}
function Registry({ administrative }: { administrative: boolean }) {
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
    setAdmin(data.admin && administrative);
    return data.admin && administrative;
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
  return <main className="mx-auto max-w-xl space-y-4 p-4 [&_select]:bg-white [&_select]:text-gray-900 [&_select]:[color-scheme:light] [&_option]:bg-white [&_option]:text-gray-900">
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
      {admin&&!r.accepted&&<AssignHolder address={r} refresh={refresh}/>}
    </article>)}
  </main>;
}
