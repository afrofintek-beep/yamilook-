const LUANDA_OFFSET_MS = 60 * 60 * 1000;

/** datetime-local must use the displayed Luanda zone, never the device's zone. */
export function toLuandaInput(value: string | null): string {
  if (!value) return '';
  const epoch = Date.parse(value);
  if (!Number.isFinite(epoch)) return '';
  return new Date(epoch + LUANDA_OFFSET_MS).toISOString().slice(0, 16);
}

export function fromLuandaInput(value: string): string | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error('invalid_schedule');
  const epoch = Date.parse(`${value}:00+01:00`);
  if (!Number.isFinite(epoch)) throw new Error('invalid_schedule');
  const result = new Date(epoch).toISOString();
  if (toLuandaInput(result) !== value) throw new Error('invalid_schedule');
  return result;
}

export function formatLuanda(value: string | null, locale = 'pt'): string {
  if (!value) return '—';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '—';
  return date.toLocaleString(locale === 'pt-banda' ? 'pt-AO' : locale, {
    timeZone: 'Africa/Luanda', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}
