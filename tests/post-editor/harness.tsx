import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { EditPostSheet } from '../../src/components/feed/EditPostSheet';
import { changeAppLanguage } from '../../src/i18n';
import '../../src/index.css';

const initialText = '📍 “Já cheguei ao bairro… mas onde fica exactamente?”\n\nQuem já procurou uma casa, uma loja ou um serviço conhece esta dificuldade.\n\nA NJILA aproxima as pessoas dos lugares que procuram. A localização ajuda a encontrar negócios, serviços e oportunidades.\n\nLocalizar é incluir.';
await changeAppLanguage(new URLSearchParams(location.search).get('lang') || 'pt');
document.documentElement.classList.add('dark');
function Harness() {
 const [open, setOpen] = useState(true);
 const [saved, setSaved] = useState('');
 return <><button onClick={() => setOpen(true)}>Open editor</button><output>{saved}</output><EditPostSheet open={open} onOpenChange={setOpen} post={{ id: 'fixture', content: initialText, location: 'Talatona', privacy: 'everyone', media_urls: [] } as never} onSave={async updates => { setSaved(JSON.stringify(updates)); }} /></>;
}
createRoot(document.getElementById('root')!).render(<Harness />);
