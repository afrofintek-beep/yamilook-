import { MessageCircle, Linkedin, Music2, Youtube, Facebook, Instagram, MoreHorizontal, MessagesSquare } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { shareApplications } from '../../../shared/share-destinations.mjs';

const icons = [MessagesSquare, MessageCircle, Linkedin, Music2, Youtube, Facebook, Instagram, MoreHorizontal];

/** Keep the prepared File in the parent; choosing a destination never re-exports it. */
export default function FileApplicationPicker({ onShare, disabled = false, nativeShareAvailable = true, downloadUrl, filename }: { onShare: () => void; disabled?: boolean; nativeShareAvailable?: boolean; downloadUrl?: string; filename?: string }) {
  const [selected, setSelected] = useState('');
  return <div className="space-y-3" aria-label="Aplicações para partilhar">
    <p className="text-sm text-muted-foreground">Toca numa aplicação para abrir a partilha do telemóvel e escolhe-a nesse menu.</p>
    <div className="grid grid-cols-2 gap-2">
      {shareApplications.map((label, index) => { const Icon = icons[index]; return <Button key={label} variant="outline" className="min-h-12" disabled={disabled} aria-pressed={selected === label} onClick={() => {
        setSelected(label);
        // Invoke in this tap, before any await, so iOS retains user activation.
        if (label !== 'Kosolola' && nativeShareAvailable) onShare();
      }}><Icon className="mr-2 h-5 w-5 shrink-0" aria-hidden="true" />{label}</Button>; })}
    </div>
    {selected && selected !== 'Outros' && <>
      <p role="note" className="text-sm text-muted-foreground">{selected === 'Kosolola'
        ? 'Guarda a cópia com marca e anexa-a na conversa ou grupo da Kosolola.'
        : `Escolhe ${selected} nas opções do telemóvel. Se não aparecer, guarda a cópia e anexa-a nessa aplicação.`}</p>
      {selected === 'Kosolola' && <Button asChild variant="outline"><a href="https://www.kosolola.com" target="_blank" rel="noopener noreferrer">Abrir Kosolola</a></Button>}
      {selected === 'LinkedIn' && <div className="space-y-2">
        <p className="text-sm">Se o envio falhar, guarda esta cópia. Abre a aplicação LinkedIn, toca em Publicar, adiciona o vídeo ou a fotografia e aguarda o carregamento antes de publicar.</p>
        {downloadUrl && <Button asChild variant="outline" className="w-full"><a href={downloadUrl} download={filename}>Guardar cópia para LinkedIn</a></Button>}
        <Button asChild variant="outline" className="w-full"><a href="https://www.linkedin.com/feed/" target="_blank" rel="noopener noreferrer">Abrir LinkedIn</a></Button>
        <p className="text-xs text-muted-foreground">A publicação só fica concluída depois da confirmação do LinkedIn.</p>
      </div>}
    </>}
    {selected && !nativeShareAvailable && <p role="status" className="text-sm">Este navegador não permite enviar ficheiros diretamente. Guarda a cópia e anexa-a na aplicação.</p>}
  </div>;
}
