import { MessageCircle, Linkedin, Music2, Youtube, Facebook, Instagram, MoreHorizontal, MessagesSquare } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { shareApplications } from '../../../shared/share-destinations.mjs';

const icons = [MessagesSquare, MessageCircle, Linkedin, Music2, Youtube, Facebook, Instagram, MoreHorizontal];

/** Keep the prepared File in the parent; choosing a destination never re-exports it. */
export default function FileApplicationPicker({ onShare, disabled = false }: { onShare: () => void; disabled?: boolean }) {
  const [selected, setSelected] = useState('');
  return <div className="space-y-3" aria-label="Aplicações para partilhar">
    <div className="grid grid-cols-2 gap-2">
      {shareApplications.map((label, index) => { const Icon = icons[index]; return <Button key={label} variant="outline" className="min-h-12" disabled={disabled} aria-pressed={selected === label} onClick={() => { setSelected(label); if (label === 'Outros') onShare(); }}><Icon className="mr-2 h-5 w-5 shrink-0" aria-hidden="true" />{label}</Button>; })}
    </div>
    {selected && selected !== 'Outros' && <>
      <p role="note" className="text-sm text-muted-foreground">{selected === 'Kosolola'
        ? 'Guarda a cópia com marca e anexa-a na conversa ou grupo da Kosolola.'
        : `Escolhe ${selected} nas opções do telemóvel. Se não aparecer, guarda a cópia e anexa-a nessa aplicação.`}</p>
      {selected === 'Kosolola' ? <Button asChild variant="outline"><a href="https://www.kosolola.com" target="_blank" rel="noopener noreferrer">Abrir Kosolola</a></Button>
        : <Button className="w-full" disabled={disabled} onClick={onShare}>Abrir opções do telemóvel</Button>}
    </>}
  </div>;
}
