import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

import { formatSessionTime, sessionTiming, type TimedSession } from '../session-clock';

export function SessionClock({ session, isMentor, onUpdated }: {
  session: TimedSession; isMentor: boolean; onUpdated: () => Promise<void>;
}) {
  const [now, setNow] = useState(Date.now);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (session.status !== 'live' || !session.started_at) return;
    const tick = () => setNow(Date.now());
    tick();
    const interval = window.setInterval(tick, 1000);
    document.addEventListener('visibilitychange', tick);
    return () => { window.clearInterval(interval); document.removeEventListener('visibilitychange', tick); };
  }, [session.status, session.started_at]);
  const { duration, elapsed, remaining } = sessionTiming(session, now);
  const live = session.status === 'live';
  const warning = live && remaining !== null ? remaining <= 0 ? 'Tempo previsto terminado. A sessão continua até o mentor encerrar.'
    : remaining <= 300 ? 'Faltam 5 minutos ou menos.' : remaining <= 600 ? 'Faltam 10 minutos ou menos.' : '' : '';
  const extend = async () => {
    if (saving) return;
    setSaving(true); setError('');
    try {
      // Compare the previous duration to avoid lost updates from another mentor device.
      const { data, error } = await supabase.from('academia_sessions')
        .update({ duration_minutes: duration + 15 }).eq('id', session.id)
        .eq('status', 'live').eq('duration_minutes', duration).select('id').single();
      if (error || !data) throw new Error('Não foi possível prolongar. Atualiza a sessão e tenta novamente.');
      await onUpdated();
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível prolongar.'); }
    finally { setSaving(false); }
  };
  return <section aria-label="Tempo da sessão" className="border-t px-3 py-2 space-y-1 text-xs">
    <div className="flex flex-wrap items-center justify-between gap-2 tabular-nums">
      <span>Previsto: {duration} min</span>
      {elapsed !== null ? <><span>{live ? 'Decorrido' : 'Duração real'}: {formatSessionTime(elapsed)}</span>
        {live && <span>{remaining! >= 0 ? 'Restante' : 'Tempo adicional'}: {formatSessionTime(Math.abs(remaining!))}</span>}</>
        : <span>{live ? 'Hora de início indisponível para esta sessão.' : 'O cronómetro começa ao iniciar a sala.'}</span>}
      {isMentor && live && duration <= 465 && <Button variant="outline" size="sm" disabled={saving} onClick={()=>void extend()}>{saving ? 'A prolongar…' : 'Prolongar +15 min'}</Button>}
    </div>
    <p role="status" className="text-amber-600 dark:text-amber-400">{warning}</p>
    {error && <p role="alert" className="text-destructive">{error}</p>}
  </section>;
}
