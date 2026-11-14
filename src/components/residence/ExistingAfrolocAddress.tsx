import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { addressFromCard, readAfrolocCard } from '@/lib/afroloc-card-import';

export function ExistingAfrolocAddress({ code, onChange, disabled = false }: { code: string; onChange: (code: string) => void; disabled?: boolean }) {
  useUiLocale();
  const id = useId();
  const request = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const [filename, setFilename] = useState('');
  const [reading, setReading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => () => { request.current++; }, []);
  const importCard = async (file?: File) => {
    if (!file) return;
    const current = ++request.current;
    setFilename(file.name); setReading(true); setError(''); setMessage('');
    try {
      const value = await readAfrolocCard(file);
      if (request.current !== current) return;
      onChange(value); setMessage('Código lido. Confirma o endereço antes de guardar a Banda.');
    } catch (e) {
      if (request.current === current) setError((e as Error).message);
    } finally { if (request.current === current) setReading(false); }
  };
  return <section className="min-w-0 space-y-3" aria-label={uiText('Carregar cartão ou endereço AFROLOC')}>
    <input ref={fileInput} id={`${id}-file`} aria-label={uiText('Carregar imagem do cartão AFROLOC')} type="file" accept="image/jpeg,image/png,image/webp" disabled={disabled || reading} className="sr-only" tabIndex={-1} onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; void importCard(file); }} />
    <Button type="button" className="w-full h-auto whitespace-normal" disabled={disabled || reading} onClick={()=>fileInput.current?.click()}>{uiText(reading?'A ler o cartão…':'Escolher imagem do cartão')}</Button>
    {filename&&<p className="text-sm break-all">{filename}</p>}
    <p className="text-xs text-muted-foreground">{uiText('JPG, PNG ou WebP, até 10 MB. A imagem é lida neste dispositivo e não é enviada nem guardada.')}</p>
    <label className="block text-sm space-y-2" htmlFor={`${id}-code`}><span>{uiText('Código AFROLOC existente')}</span>
      <Input id={`${id}-code`} value={code} disabled={disabled} maxLength={160} className="text-base" autoCapitalize="characters" spellCheck={false} placeholder={uiText('Cola o código aqui')} onChange={e => { request.current++; setReading(false); setError(''); setMessage(''); onChange(addressFromCard(e.target.value) || e.target.value.toUpperCase()); }} />
    </label>
    {(reading || message) && <p role="status" className="text-sm">{uiText(reading ? 'A ler o cartão…' : message)}</p>}
    {error && <p role="alert" className="text-sm text-destructive">{uiText(error)}</p>}
    <p className="text-xs text-muted-foreground">{uiText('Confirma a Banda para associar este endereço à tua conta. O cartão ou código, por si só, não comprova residência; o direito de utilização será verificado.')}</p>
  </section>;
}
