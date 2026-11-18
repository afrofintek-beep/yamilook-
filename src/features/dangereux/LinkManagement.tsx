import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { pilotPath } from './paths';

export function LinkManagement() {
  const [url,setUrl] = useState('');
  const [message,setMessage] = useState('');
  const [busy,setBusy] = useState(false);
  async function change(enable: boolean) {
    if (busy || !window.confirm(enable ? 'Criar uma nova ligação e invalidar a anterior?' : 'Desactivar a ligação dos convidados?')) return;
    setBusy(true);
    try {
      const {data,error} = await supabase.rpc('change_dangereux_link' as never, {p_enable:enable} as never);
      if (error) throw error;
      setUrl(enable ? location.origin + pilotPath + '#acesso=' + data : '');
      setMessage(enable ? 'Nova ligação pronta para partilhar.' : 'A ligação dos convidados foi desactivada.');
    } catch { setMessage('Não foi possível alterar a ligação. Tenta novamente.'); }
    finally { setBusy(false); }
  }
  return <section className="dg-box" style={{marginBottom:20}}>
    <h3>Ligação de acesso ao bairro</h3><p>Quem receber a ligação pode visitar a demonstração. O painel de Administração fica reservado à equipa.</p>
    <div className="dg-actions"><button className="dg-btn pale" disabled={busy} onClick={()=>void change(true)}>Gerar nova ligação</button>
    <button className="dg-text" disabled={busy} onClick={()=>void change(false)}>Desactivar ligação</button></div>
    {url && <label>Ligação privada<input readOnly value={url} onFocus={e=>e.target.select()}/></label>}
    <p role="status">{message}</p>
  </section>;
}
