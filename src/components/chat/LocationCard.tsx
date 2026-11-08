import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { MapPin, Navigation, ExternalLink } from 'lucide-react';
import { locationMapUrl, type ChatLocation } from '@/lib/chat-location';
export function LocationCard({ location }: { location: ChatLocation }) {
  useUiLocale();
  return <section aria-label={uiText("Localização partilhada")} className="min-w-0 space-y-3 p-1" onPointerDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
    <div className="flex items-center gap-2 font-semibold"><MapPin className="h-5 w-5 shrink-0" />{uiText("Localização")}</div>
    {location.caption && <p className="text-sm whitespace-pre-wrap break-words">{location.caption}</p>}
    <p className="text-xs opacity-80">{uiText("Localização pontual · {{value1}}, {{value2}}", { value1: (location.latitude.toFixed(5)) ?? "", value2: (location.longitude.toFixed(5)) ?? "" })}</p>
    <div className="flex flex-wrap gap-2 text-sm">
      <a className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 underline" href={locationMapUrl(location)} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" />{uiText("Abrir mapa")}</a>
      <a className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 underline" href={locationMapUrl(location, true)} target="_blank" rel="noopener noreferrer"><Navigation className="h-4 w-4" />{uiText("Como chegar")}</a>
    </div>
  </section>;
}
