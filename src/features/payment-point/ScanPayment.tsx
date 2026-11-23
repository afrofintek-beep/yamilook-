import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { parseOrderLink } from './api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export function ScanPayment({ onScan }: { onScan: (id: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const onResult = useRef(onScan); onResult.current = onScan;
  const [error, setError] = useState('');
  const [link, setLink] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [camera, setCamera] = useState<'starting' | 'ready' | 'failed'>('starting');
  useEffect(() => {
    setCamera('starting');
    setError('');
    let stopped = false; let stream: MediaStream | undefined; let frame = 0;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true });
    const scan = () => {
      if (stopped) return;
      const element = video.current;
      if (element && element.readyState >= 2 && element.videoWidth && context) {
        canvas.width = Math.min(element.videoWidth, 640);
        canvas.height = Math.round(element.videoHeight * canvas.width / element.videoWidth);
        context.drawImage(element, 0, 0, canvas.width, canvas.height);
        const data = context.getImageData(0, 0, canvas.width, canvas.height);
        const qr = jsQR(data.data, data.width, data.height);
        if (qr) {
          try { const id = parseOrderLink(qr.data); stream?.getTracks().forEach(t => t.stop()); onResult.current(id); return; }
          catch (e) { setError((e as Error).message); }
        }
      }
      frame = requestAnimationFrame(scan);
    };
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamera('failed');
      setError('A câmara está indisponível. Cole a ligação do pedido.');
      return;
    }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false }).then(async media => {
      if (stopped) { media.getTracks().forEach(t => t.stop()); return; }
      stream = media;
      if (video.current) { video.current.srcObject = media; await video.current.play(); if (!stopped) { setCamera('ready'); scan(); } }
    }).catch(cause => {
      if (stopped) return;
      stream?.getTracks().forEach(track => track.stop());
      setCamera('failed');
      setError(cause?.name === 'NotAllowedError'
        ? 'Permita o acesso à câmara nas definições ou cole a ligação do pedido.'
        : 'Não foi possível abrir a câmara. Tente novamente ou cole a ligação.');
    });
    return () => { stopped = true; cancelAnimationFrame(frame); stream?.getTracks().forEach(t => t.stop()); };
  }, [attempt]);
  return <div className="space-y-3">
    {camera === 'starting' && <p role="status">A activar a câmara…</p>}
    {camera === 'failed' && <Button variant="outline" onClick={() => setAttempt(value => value + 1)}>Tentar novamente</Button>}
    <video hidden={camera !== 'ready'} ref={video} playsInline muted className="w-full rounded-xl bg-black" />
    <label className="block text-sm">Ligação do pedido<Input value={link} onChange={e => setLink(e.target.value)} /></label>
    <Button disabled={!link.trim()} onClick={() => { try { onScan(parseOrderLink(link)); } catch (e) { setError((e as Error).message); } }}>Abrir pedido</Button>
    {error && <p role="alert">{error}</p>}
  </div>;
}
