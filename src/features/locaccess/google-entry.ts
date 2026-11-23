type Coordinates = { lat: number; lon: number };

function validPoint(point: Coordinates) {
  return Number.isFinite(point.lat) && Math.abs(point.lat) <= 90 &&
    Number.isFinite(point.lon) && Math.abs(point.lon) <= 180;
}

export function parseGoogleEntry(value: string): Coordinates | null {
  const match = /^\s*(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/.exec(value);
  if (!match) return null;
  const point = { lat: Number(match[1]), lon: Number(match[2]) };
  return validPoint(point) ? point : null;
}

export type ExternalRoute = { status: 'denied' } | {
  status: 'ready'; entryPoint: Coordinates; expiresAt: string;
};

export function googleEntryUrl(route: ExternalRoute, now = Date.now()): string | null {
  if (route.status !== 'ready' || !route.entryPoint || !validPoint(route.entryPoint)) return null;
  const expiresAt = Date.parse(route.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt <= now || expiresAt > now + 25000) return null;

  const { lat, lon } = route.entryPoint;
  const params = new URLSearchParams({ api: '1', destination: `${lat},${lon}`, dir_action: 'navigate' });
  return `https://www.google.com/maps/dir/?${params}`;
}

export function openGoogleEntry(url: string) {
  const link = document.createElement('a');
  link.href = url;
  link.referrerPolicy = 'no-referrer';
  link.click();
}
