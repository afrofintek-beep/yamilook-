// Browser fixture: the production media dialog, without an account or API writes.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MediaPreview } from '../../src/components/chat/MediaPreview';
import '../../src/index.css';
function Fixture() {
  const [open, setOpen] = useState(false);
  return <><button onClick={() => setOpen(true)}>Abrir media</button><MediaPreview open={open} onClose={() => setOpen(false)} type="image" url="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3C/svg%3E" /></>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
