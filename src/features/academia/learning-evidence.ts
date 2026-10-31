export function safeEvidenceUrl(value: string | null) {
  try { const url = new URL(value || ''); return url.protocol === 'https:' ? url.href : null; } catch { return null; }
}
