import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { Button } from '@/components/ui/button';

type Row = Database['public']['Tables']['post_screenings']['Row'];
const labels: Record<string,string> = { absent:'Sem conteúdo', pending:'Por analisar', flagged:'Sinalizado', clear:'Sem sinalização', error:'Falha técnica', confirmed:'Sinalização confirmada', dismissed:'Sinalização descartada' };
const filters = { all:'Todas', pending:'Multimédia por analisar', flagged:'Sinalizadas', error:'Com falha técnica' };
type Filter = keyof typeof filters;
function query(filter: Filter) {
  const q = supabase.from('post_screenings').select('*', { count:'exact' });
  if (filter === 'flagged') return q.or('text_status.eq.flagged,media_status.eq.flagged');
  if (filter === 'all') return q;
  return q.eq('media_status',filter);
}

export default function ScreeningTab() {
  const [filter,setFilter] = useState<Filter>('all');
  const [page,setPage] = useState(0);
  const [rows,setRows] = useState<Row[]>([]);
  const [count,setCount] = useState(0);
  const [error,setError] = useState('');
  const [retry,setRetry] = useState(0);
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const id = ++generation.current;
    const r = await query(filter).order('created_at',{ascending:false}).order('post_id').range(page*20,page*20+19);
    if (id !== generation.current) return;
    if (r.error) { setError(r.error.message); return; }
    setRows(r.data || []); setCount(r.count || 0);
  },[filter,page]);
  useEffect(() => { void refresh(); return () => { generation.current++; }; },[refresh]);
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    let stopped = false;
    async function run() {
      try {
        while (!stopped) {
          const q = await supabase.from('post_screenings').select('revision').eq('media_status','pending').order('created_at').limit(1).maybeSingle();
          if (stopped) return;
          if (q.error) throw q.error;
          if (!q.data) { await new Promise(resolve => setTimeout(resolve,15000)); continue; }
          const revision = q.data.revision;
          const files = await supabase.rpc('screening_media',{p_revision:revision});
          if (files.error) throw files.error;
          if (!files.data?.length) continue;
          const { scanMedia } = await import('./scan-media');
          const results = [];
          for (const file of files.data) {
            if (stopped) return;
            results.push(await scanMedia(file));
          }
          if (stopped) return;
          const saved = await supabase.rpc('record_media_screening',{p_revision:revision,p_results:results});
          if (saved.error) throw saved.error;
          await refreshRef.current();
        }
      } catch (e) { if (!stopped) setError((e as Error).message || 'Falha ao analisar'); }
    }
    void run(); return () => { stopped=true; };
  },[retry]);

  async function decide(row: Row, decision: string) {
    const r = await supabase.rpc('review_post_screening',{p_revision:row.revision,p_decision:decision});
    if (r.error) setError(r.error.message);
    await refresh();
  }
  async function repeat(row: Row) {
    const files = await supabase.rpc('screening_media',{p_revision:row.revision});
    if (files.error || !files.data?.length) { setError('Não foi possível obter os ficheiros'); return; }
    const { scanMedia } = await import('./scan-media');
    const results = [];
    for (const file of files.data) results.push(await scanMedia(file));
    const saved = await supabase.rpc('record_media_screening',{p_revision:row.revision,p_results:results});
    if (saved.error) setError(saved.error.message);
    await refresh();
  }
  return <section className="space-y-3 p-2">
    <p>O texto é verificado ao publicar ou editar. Mantém este separador aberto para analisar fotografias e uma amostra de seis fotogramas por vídeo.</p>
    <label>Mostrar <select className="bg-background border rounded p-1" value={filter} onChange={e=>{setFilter(e.target.value as Filter);setPage(0);}}>
      {Object.entries(filters).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
    <p>{count} publicações</p>
    {error && <p role="alert">{error} <Button onClick={()=>{setError('');setRetry(retry+1);void refresh();}}>Tentar novamente</Button></p>}
    {rows.map(row=><article className="rounded border p-3 space-y-1" key={row.revision}>
      <a href={'/post/'+row.post_id} target="_blank" rel="noreferrer" className="underline">Abrir publicação · {new Date(row.created_at).toLocaleString('pt-AO')}</a>
      <p>Texto · {row.text_status==='flagged'?'Possível linguagem obscena':labels[row.text_status]}</p>
      <p>Multimédia · {row.media_status==='flagged'?'Possível conteúdo sexual ou nudez':labels[row.media_status]}</p>
      {Array.isArray(row.media_results) && row.media_results.map((v,i)=><small className="block" key={i}>Ficheiro {i+1} · {labels[String(v)]}</small>)}
      {row.media_status==='error' && <Button onClick={()=>void repeat(row)}>Reanalisar ficheiros</Button>}
      {row.decision ? <p>{labels[row.decision]} · {new Date(row.reviewed_at!).toLocaleString('pt-AO')}</p> :
        (row.text_status==='flagged'||row.media_status==='flagged') && <div className="flex flex-wrap gap-2"><Button onClick={()=>void decide(row,'confirmed')}>Confirmar sinalização</Button><Button variant="outline" onClick={()=>void decide(row,'dismissed')}>Descartar</Button></div>}
    </article>)}
    <div className="flex gap-2"><Button disabled={!page} onClick={()=>setPage(page-1)}>Anterior</Button><Button disabled={(page+1)*20>=count} onClick={()=>setPage(page+1)}>Seguinte</Button></div>
  </section>;
}
