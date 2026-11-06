import { MessageCircle, Linkedin, Music2, Youtube, Facebook, Instagram, MoreHorizontal, MessagesSquare } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { shareApplications } from '../../../shared/share-destinations.mjs';

const icons = [MessagesSquare, MessageCircle, Linkedin, Music2, Youtube, Facebook, Instagram, MoreHorizontal];

/** Keep the prepared File in the parent; choosing a destination never re-exports it. */
export default function FileApplicationPicker({ onShare, disabled = false, nativeShareAvailable = true, downloadUrl, filename }: { onShare: () => void; disabled?: boolean; nativeShareAvailable?: boolean; downloadUrl?: string; filename?: string }) {
  const [selected, setSelected] = useState('');
  return <div className="space-y-3" aria-label="Aplicações para partilhar">
    <p className="text-sm text-muted-foreground">Escolhe onde publicar. Para LinkedIn, guarda a cópia e abre a aplicação nos passos abaixo.</p>
    <div className="grid grid-cols-2 gap-2">
      {shareApplications.map((label, index) => { const Icon = icons[index]; return <Button key={label} variant="outline" className="min-h-12" disabled={disabled} aria-pressed={selected === label} onClick={() => {
        setSelected(label);
        // Invoke in this tap, before any await, so iOS retains user activation.
        if (label !== 'Kosolola' && label !== 'LinkedIn' && nativeShareAvailable) onShare();
      }}><Icon className="mr-2 h-5 w-5 shrink-0" aria-hidden="true" />{label}</Button>; })}
    </div>
    {selected && selected !== 'Outros' && <>
      {selected !== 'LinkedIn' && <p role="note" className="text-sm text-muted-foreground">{selected === 'Kosolola'
        ? 'Guarda a cópia com marca e anexa-a na conversa ou grupo da Kosolola.'
        : `Escolhe ${selected} nas opções do telemóvel. Se não aparecer, guarda a cópia e anexa-a nessa aplicação.`}</p>}
      {selected === 'Kosolola' && <Button asChild variant="outline"><a href="https://www.kosolola.com" target="_blank" rel="noopener noreferrer">Abrir Kosolola</a></Button>}
      {selected === 'LinkedIn' && <section className="space-y-3 rounded-xl border p-4" aria-label="Publicar no LinkedIn">
        <h4 className="font-semibold">Publicar no LinkedIn</h4>
        <p className="text-sm">1. Guarda esta cópia com o logótipo e o autor.</p>
        {downloadUrl && <Button asChild className="min-h-12 w-full"><a href={downloadUrl} download={filename}>Guardar cópia para LinkedIn</a></Button>}
        <p className="text-xs text-muted-foreground">No iPhone, se o ficheiro abrir numa pré-visualização, toca em Partilhar e escolhe Guardar vídeo ou Guardar imagem. Se ficar em Ficheiros, abre-o aí e usa Partilhar para o guardar nas Fotografias.</p>
        <p className="text-sm">2. Abre o LinkedIn, toca em Publicar e adiciona o vídeo ou a fotografia guardada.</p>
        <Button asChild variant="outline" className="min-h-12 w-full"><a href="https://www.linkedin.com/feed/" target="_blank" rel="noopener noreferrer">Abrir LinkedIn</a></Button>
        <p className="text-xs text-muted-foreground">Se abrir o site, podes continuar nele ou abrir a aplicação LinkedIn no telemóvel. O ficheiro não é anexado automaticamente.</p>
        <p className="text-sm">3. Acrescenta o texto, aguarda o carregamento e confirma a publicação no LinkedIn.</p>
        {nativeShareAvailable && <Button variant="ghost" className="min-h-12 w-full whitespace-normal" disabled={disabled} onClick={onShare}>Tentar partilha pelo menu do telemóvel</Button>}
      </section>}
    </>}
    {selected && selected !== 'LinkedIn' && !nativeShareAvailable && <p role="status" className="text-sm">Este navegador não permite enviar ficheiros diretamente. Guarda a cópia e anexa-a na aplicação.</p>}
  </div>;
}
