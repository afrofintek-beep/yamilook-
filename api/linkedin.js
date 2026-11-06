import { handleLinkedIn } from '../server/linkedin/handler.mjs';
export const config = { api: { bodyParser: false } };
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('CDN-Cache-Control', 'no-store');
  res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
  try {
    const origin = process.env.LINKEDIN_ORIGIN || 'https://www.yamilook.com';
    const url = new URL(req.url, origin);
    if (req.headers.host !== new URL(origin).host) { res.status(403).json({ error: 'invalid_origin' }); return; }
    const binary = url.searchParams.get('action') === 'upload';
    const limit = binary ? 4194304 : 16384;
    const chunks = []; let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > limit) { res.status(413).json({ error: 'request_too_large' }); return; }
      chunks.push(chunk);
    }
    const headers = new Headers();
    for (const [name, value] of Object.entries(req.headers)) if (typeof value === 'string') headers.set(name, value);
    const request = new Request(url, { method: req.method, headers, ...(!['GET', 'HEAD'].includes(req.method) ? { body: Buffer.concat(chunks) } : {}) });
    const response = await handleLinkedIn(request);
    res.status(response.status);
    response.headers.forEach((value, name) => res.setHeader(name, value));
    res.end(await response.text());
  } catch { res.status(503).json({ error: 'service_unavailable' }); }
}
