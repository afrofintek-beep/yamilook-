import { Button } from '@/components/ui/button';
import { uiText, useUiLocale } from '@/i18n/ui-copy';

/** Entry points only: address creation and access remain under AFROLOC/NJILA. */
export function AngolaAfrolocExperience({ country }: { country?: string | null }) {
  useUiLocale();
  if (country?.trim().toUpperCase() !== 'AO') return null;
  return <section aria-label={uiText('Experimentar AFROLOC em Angola')} className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
    <h3 className="font-semibold">{uiText('O meu endereço AFROLOC')}</h3>
    <p className="text-sm text-muted-foreground">{uiText('Experimenta o AFROLOC e explora Angola no mapa NJILA. Podes continuar o registo e experimentar mais tarde.')}</p>
    <div className="flex flex-wrap gap-2">
      <Button type="button" asChild><a href="https://app.afroloc.ao" target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">{uiText('Experimentar AFROLOC')}</a></Button>
      <Button type="button" variant="outline" asChild><a href="https://www.njilamaps.com/" target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">{uiText('Abrir mapa NJILA')}</a></Button>
    </div>
    <p className="text-xs text-muted-foreground">{uiText('Abre numa nova janela. O AFROLOC pode pedir início de sessão. A escolha do país não verifica a residência; confirma a validade e as permissões do endereço no AFROLOC antes de o partilhares.')}</p>
  </section>;
}
