import { logger } from '@/lib/logger';
const key = 'academia-call-diagnostics-v1';
interface CallEvent { timestamp: string; event: string; detail: string }
export function readAcademiaDiagnostics(): CallEvent[] {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(key) || '[]');
    return Array.isArray(value) ? value.filter((entry): entry is CallEvent =>
      !!entry && typeof entry.timestamp === 'string' && typeof entry.event === 'string' && typeof entry.detail === 'string').slice(-40) : [];
  } catch { return []; }
}
export function recordAcademiaCall(event: string, detail: string) {
  const entry = { timestamp: new Date().toISOString(), event, detail };
  logger.info(event, 'academia-video', { detail });
  try { sessionStorage.setItem(key, JSON.stringify([...readAcademiaDiagnostics(), entry].slice(-40))); } catch { /* Storage may be disabled. */ }
}
export function downloadAcademiaDiagnostics() {
  const url = URL.createObjectURL(new Blob([JSON.stringify(readAcademiaDiagnostics(), null, 2)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = 'academia-diagnostico.json'; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
