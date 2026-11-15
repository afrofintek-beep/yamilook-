export type LocationRecord = {
  latitude: unknown; longitude: unknown; status?: string; expires_at?: string;
};
export const unavailable = { status: 'not-publicly-available' } as const;
const headers = {
  'Content-Type': 'application/json', 'Cache-Control': 'no-store',
  'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type', 'X-Content-Type-Options': 'nosniff'
};
export function publicPoint(record: LocationRecord | null, now = Date.now()) {
  if (!record) return null;
  if (record.status !== undefined && !['pending', 'approved'].includes(record.status)) return null;
  if (record.expires_at !== undefined && !(Date.parse(record.expires_at) > now)) return null;
  const lat = record.latitude, lon = record.longitude;
  if (typeof lat !== 'number' || typeof lon !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { lat, lon };
}
/** Public QR location policy. Exact-reference reads only; no directory or identity fields. */
export function createHandler(lookup: (reference: string) => Promise<LocationRecord | null>) {
  const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers });
  return async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (req.method !== 'POST') return json({error:'POST required'}, 405);
    if (Number(req.headers.get('content-length')) > 512) return json(unavailable);
    try {
      const raw = await req.text();
      if (raw.length > 512) return json(unavailable);
      const body = JSON.parse(raw);
      // Do not accept mixed grants, identities, alternate locations or batch queries.
      if (!body || Object.keys(body).join(',') !== 'reference' || typeof body.reference !== 'string') return json(unavailable);
      const reference = body.reference.trim();
      if (reference.length > 160 || !/^[A-Z]{2}(?:-[A-Z0-9]+){2,}$/.test(reference)) return json(unavailable);
      const point = publicPoint(await lookup(reference));
      if (!point) return json(unavailable);
      return json({status:'found',place:{reference,name:'AFROLOC',category:'administration',approximatePoint:point,locality:'',verification:'pending'}});
    } catch { return json(unavailable); }
  };
}
