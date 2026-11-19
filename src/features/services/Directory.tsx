import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAdmin } from '@/hooks/useAdmin';
import { useInstitution } from './useInstitution';
import { useAuth } from '@/hooks/useAuth';
import { validHandle } from '@/features/locaccess/api';

const lines = [
  ['Emergência geral, Polícia e assistência médica', '111'],
  ['Protecção Civil e Bombeiros', '115'],
  ['SOS Criança', '15015'],
  ['SOS Violência Doméstica', '15020'],
];
type Unit = { id: string; name: string; service: string; locality: string; coverage: string; phone: string; purpose: string; handle: string | null; institution_id: string | null; source: string; reviewed: string };
const units = () => supabase.from('service_units' as never);
const inputClass = 'w-full rounded-lg border bg-background p-3';
const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

export default function Directory() {
  const { isAdmin } = useAdmin();
  const { user } = useAuth();
  const manager = useInstitution(user?.id);
  const [params] = useSearchParams();
  const institution = params.get('instituicao');
  const [list, setList] = useState<Unit[]>([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [notice, setNotice] = useState('');
  const [edit, setEdit] = useState<Unit | null>(null);
  const [saving, setSaving] = useState(false);
  const [version, refresh] = useState(0);
  useEffect(() => {
    let active = true;
    setStatus('A carregar unidades…');
    setList([]);
    async function load() {
      let request = units().select('*').order('name');
      if (institution) request = request.eq('institution_id', institution);
      const { data, error } = await request;
      if (active) {
        setList((data ?? []) as Unit[]);
        setStatus(error ? 'Não foi possível carregar as unidades.' : '');
      }
    }
    void load();
    return () => { active = false; };
  }, [institution, version]);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = Object.fromEntries(new FormData(form)) as Record<string,string>;
    const handle = fields.handle.trim().split('/acesso/').pop()?.split('?')[0] || null;
    if ((handle && !validHandle(handle)) || !validHandle(fields.institution_id.trim())) {
      setNotice('Verifica o identificador da página e a ligação LOCACCESS.');
      return;
    }
    setSaving(true);
    const row = { ...fields, institution_id: fields.institution_id.trim(), handle, reviewed: new Date().toISOString().slice(0,10) };
    const result = edit ? await units().update(row as never).eq('id', edit.id).select('id').single() : await units().insert(row as never).select('id').single();
    setSaving(false);
    if (result.error) { setNotice('Não foi possível guardar. Verifica os dados e a autorização.'); return; }
    form.reset(); setEdit(null); setNotice('Unidade guardada.'); refresh(v => v+1);
  }
  const shown = list.filter(u => normalize([u.name,u.service,u.locality,u.coverage].join(' ')).includes(normalize(query)));
  return <main className="mx-auto max-w-xl space-y-5 px-4 py-8">
    <Link to="/settings">← Definições</Link>
    <h1 className="text-2xl font-bold">Serviços do Bairro</h1>
    <section aria-label="Linhas de Angola" className="grid gap-2">
      {lines.map(([label,phone]) => <a key={phone} className="flex justify-between gap-4 rounded-xl border p-4" href={'tel:'+phone}>{label}<strong>{phone}</strong></a>)}
    </section>
    <h2 className="text-xl font-semibold">Unidades de atendimento</h2>
    {institution && <Link to="/servicos-do-bairro">Ver todas as instituições</Link>}
    <input className={inputClass} aria-label="Pesquisar unidades" placeholder="Pesquisar por bairro, serviço ou unidade" value={query} onChange={e=>setQuery(e.target.value)} />
    {status ? <p role="status">{status} <button onClick={()=>refresh(v=>v+1)}>Actualizar</button></p> : !shown.length && <p>Sem unidades registadas para esta pesquisa.</p>}
    {shown.map(u=><article key={u.id} className="space-y-2 rounded-xl border p-4">
      <h3 className="font-semibold">{u.name}</h3><p>{u.service} · {u.locality}</p>
      {u.coverage && <p>Bairros atendidos · {u.coverage}</p>}
      <a className="block underline" href={'tel:'+u.phone}>{u.purpose} · {u.phone}</a>
      {u.handle && <Link className="block underline" to={'/afroloc/acesso/'+u.handle}>Consultar endereço AFROLOC</Link>}
      {u.institution_id && !institution && <Link className="block underline" to={'?instituicao='+u.institution_id}>Unidades desta instituição</Link>}
      <a href={u.source} className="block text-sm underline" target="_blank" rel="noreferrer">Fonte consultada · {u.reviewed}</a>
      {(isAdmin || (manager && u.institution_id === user?.id)) && <button onClick={()=>{setEdit(u);document.getElementById('unit-form')?.scrollIntoView();}}>Editar unidade</button>}
    </article>)}
    {(isAdmin || manager) && <form key={edit?.id ?? 'new'} id="unit-form" onSubmit={save} className="space-y-3 rounded-xl border p-4">
      <h2 className="font-semibold">{edit ? 'Editar unidade' : 'Adicionar unidade'}</h2>
      {([['name','Nome da unidade'],['institution_id','Identificador da página institucional'],['locality','Localidade'],['coverage','Bairros atendidos'],['phone','Telefone (+244 seguido de 9 dígitos)'],['source','Fonte pública (https://)'],['handle','Ligação LOCACCESS do endereço AFROLOC']] as const).map(([field,label])=><label key={field} className="block">{label}<input name={field} className={inputClass} readOnly={field==='institution_id' && !isAdmin} defaultValue={field==='institution_id' && !isAdmin ? user?.id : edit?.[field] ?? ''} required={field!=='coverage' && field!=='handle'} pattern={field==='phone'?'[+]244[0-9]{9}':field==='source'?'https://.+':undefined} /></label>)}
      {([['service','Serviço',['Polícia','Bombeiros','INEMA','Saúde']],['purpose','Destino da chamada',['Atendimento institucional','Recepção','Urgência']]] as const).map(([field,label,options])=><label key={field} className="block">{label}<select className={inputClass} name={field} defaultValue={edit?.[field]}>{options.map(o=><option key={o}>{o}</option>)}</select></label>)}
      <button disabled={saving} className="rounded-lg bg-primary px-4 py-2 text-primary-foreground">Guardar unidade</button>
      {edit && <button type="button" className="ml-3" onClick={()=>setEdit(null)}>Cancelar</button>}
    </form>}
    <p role="status">{notice}</p>
  </main>;
}
