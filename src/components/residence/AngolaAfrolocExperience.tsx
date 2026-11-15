import { Button } from '@/components/ui/button';
import { uiText, useUiLocale } from '@/i18n/ui-copy';

/** Account-bound experience. The owner chooses an address before opening NJILA. */
export function AngolaAfrolocExperience({ country, onExisting, onCreate, hasAddress = false }: { country?: string | null; onExisting?: () => void; onCreate?: () => void; hasAddress?: boolean }) {
  useUiLocale();
  if (country?.trim().toUpperCase() !== 'AO') return null;
  return <section aria-label={uiText('Experimentar AFROLOC em Angola')} className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
    <h3 className="font-semibold">{uiText('O meu endereço AFROLOC')}</h3>
    <p className="text-sm text-muted-foreground">{uiText('Cria o endereço da tua residência e o cartão AFROLOC. Podes marcar a casa no mapa mesmo estando noutro local.')}</p>
    {onCreate && !hasAddress && <Button type="button" className="w-full h-auto whitespace-normal" onClick={onCreate}>{uiText("Criar o meu endereço AFROLOC")}</Button>}
    {hasAddress && <Button type="button" className="w-full h-auto whitespace-normal" asChild><a href="/afroloc/cartao">{uiText("Ver o meu cartão AFROLOC")}</a></Button>}
    {onExisting && <Button type="button" variant="outline" className="w-full h-auto whitespace-normal" onClick={onExisting}>{uiText("Carregar o meu cartão ou endereço AFROLOC")}</Button>}
    <div className="flex flex-wrap gap-2">
      <Button type="button" asChild><a href="/afroloc" target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">{uiText('Experimentar AFROLOC')}</a></Button>
      <Button type="button" variant="outline" asChild><a href="/afroloc" target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">{uiText('Abrir mapa NJILA')}</a></Button>
    </div>
    <p className="text-xs text-muted-foreground">{uiText('Usa a tua conta Yamilook. Criar um endereço temporário não certifica a residência.')}</p>
  </section>;
}
