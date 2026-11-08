import { MapPin, Navigation } from 'lucide-react';
import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { njilaAddressUrl, type ChatAfroloc } from '@/lib/chat-afroloc';

export function AfrolocAddressCard({ address, interactive = true }: { address: ChatAfroloc; interactive?: boolean }) {
  useUiLocale();
  const href = njilaAddressUrl(address.reference);
  return <section aria-label={uiText("Endereço AFROLOC")} className="min-w-0 space-y-3 p-1" onPointerDown={e => { if (interactive) e.stopPropagation(); }} onClick={e => { if (interactive) e.stopPropagation(); }}>
    <div className="flex items-center gap-2 font-semibold"><MapPin className="h-5 w-5 shrink-0" />AFROLOC</div>
    {address.caption && <p className="text-sm whitespace-pre-wrap break-words">{address.caption}</p>}
    <p className="text-sm break-all"><bdi dir="ltr">{address.reference}</bdi></p>
    <p className="text-xs opacity-80">{uiText("Código fornecido pelo remetente. O NJILA consulta a disponibilidade pública do endereço.")}</p>
    {href && interactive && <a className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 underline" href={href} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer"><Navigation className="h-4 w-4" />{uiText("Abrir no NJILA")}</a>}
  </section>;
}
