import { useEffect, useState } from 'react';
import { uiText } from '@/i18n/ui-copy';

function elapsedTime(start: number, now: number) {
  const seconds = Math.max(0, Math.floor((now - start) / 1000));
  const minutes = Math.floor(seconds / 60);
  const pad = (value: number) => String(value).padStart(2, '0');
  return (minutes >= 60 ? Math.floor(minutes / 60) + ':' : '') + pad(minutes % 60) + ':' + pad(seconds % 60);
}

export function CallConnectionStatus({ since, online, label }: {
  since?: number;
  online: boolean;
  label: string;
}) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (since === undefined) return;
    const refresh = () => setNow(Date.now());
    refresh();
    const timer = window.setInterval(refresh, 1000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [since]);

  return <span className="inline-flex flex-wrap items-center gap-x-2">
    <span role="status">{online && <span aria-hidden="true" className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-green-500 ring-1 ring-black/40" />}{online ? uiText("Online") : label}</span>
    {since !== undefined && <span role="timer" aria-live="off" className="tabular-nums">{elapsedTime(since, now)}</span>}
  </span>;
}
