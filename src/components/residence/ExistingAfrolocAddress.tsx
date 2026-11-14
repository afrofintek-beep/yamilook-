import { useEffect, useId, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { addressFromCard, readAfrolocCard } from '@/lib/afroloc-card-import';

export function ExistingAfrolocAddress({ code, onChange, disabled = false }: { code: string; onChange: (code: string) => void; disabled?: boolean }) {
  useUiLocale();
  const id = useId();
  const request = useRef(0);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => () => { request.current++; }, []);
  const importCard = async (file?: File) => {
    if (!file) return;
    const current = ++request.current;
    setReading(true); setError(''); setMessage('');
    try {
      const value = await readAfrolocCard(file);
      if (request.current !== current) return;
      onChange(value); setMessage('Código lido. Confirma o endereço antes de guardar a Banda.');
    } catch (e) {
      if (request.current === current) setError((e as Error).message);
    } finally { if (request.current === current) setReading(false); }
  };
  return <section className="rounded-xl border p-4 space-y-3" aria-label={uiText('Carregar cartão ou endereço AFROLOC')}>
    <h3 className="font-semibold">{uiText('Já tenho um endereço AFROLOC')}</h3>
    <label className="block text-sm space-y-2" htmlFor={`${id}-file`}><span>{uiText('Carregar imagem do cartão AFROLOC')}</span>
      <input id={`${id}-file`} type="file" accept="image/jpeg,image/png,image/webp" disabled={disabled || reading} className="block w-full min-w-0 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-3 file:text-primary-foreground" onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; void importCard(file); }} />
    </label>
    <p className="text-xs text-muted-foreground">{uiText('JPG, PNG ou WebP, até 10 MB. A imagem é lida neste dispositivo e não é enviada nem guardada.')}</p>
    <label className="block text-sm space-y-2" htmlFor={`${id}-code`}><span>{uiText('Código AFROLOC existente')}</span>
      <Input id={`${id}-code`} value={code} disabled={disabled} maxLength={160} className="text-base" autoCapitalize="characters" spellCheck={false} placeholder={uiText('Escreve ou cola o endereço AFROLOC')} onChange={e => { request.current++; setReading(false); setError(''); setMessage(''); onChange(addressFromCard(e.target.value) || e.target.value.toUpperCase()); }} />
    </label>
    {(reading || message) && <p role="status" className="text-sm">{uiText(reading ? 'A ler o cartão…' : message)}</p>}
    {error && <p role="alert" className="text-sm text-destructive">{uiText(error)}</p>}
    <p className="text-xs text-muted-foreground">{uiText('Confirma a Banda para associar este endereço à tua conta. O cartão ou código, por si só, não comprova residência; o direito de utilização será verificado.')}</p>
  </section>;
}
