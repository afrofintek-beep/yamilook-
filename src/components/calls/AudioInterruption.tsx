import { useEffect, useRef, useState } from 'react';
import { uiText } from '@/i18n/ui-copy';

export function AudioInterruption({ stream, muted, recover, report }: {
  stream: MediaStream | null; muted: boolean; recover: () => Promise<void>; report?: (value: boolean) => void;
}) {
  const [interrupted, setInterrupted] = useState(false);
  const [failed, setFailed] = useState(false);
  const actions = useRef({ recover, report });
  actions.current = { recover, report };
  useEffect(() => {
    actions.current.report?.(interrupted);
    if (!interrupted) return;
    const resume = () => {
      if (!document.hidden) void actions.current.recover().catch(() => setFailed(true));
    };
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('focus', resume);
    return () => {
      document.removeEventListener('visibilitychange', resume);
      window.removeEventListener('focus', resume);
    };
  }, [interrupted]);
  const track = stream?.getAudioTracks()[0];
  useEffect(() => {
    const check = () => setInterrupted(!!track && !muted && (track.muted || track.readyState === 'ended'));
    check();
    track?.addEventListener('mute', check);
    track?.addEventListener('unmute', check);
    track?.addEventListener('ended', check);
    document.addEventListener('visibilitychange', check);
    return () => {
      track?.removeEventListener('mute', check);
      track?.removeEventListener('unmute', check);
      track?.removeEventListener('ended', check);
      document.removeEventListener('visibilitychange', check);
    };
  }, [track, muted]);
  if (!interrupted) return null;
  return <button className="fixed top-24 left-3 z-[100] rounded-xl border bg-background p-3" onClick={async () => {
    try { await recover(); setFailed(false); }
    catch { setFailed(true); }
  }}>{failed ? uiText("Microfone indisponível. Tentar novamente") : uiText("Áudio interrompido · Retomar chamada")}</button>;
}
