import { loadPublicPost } from '../shared/public-post.mjs';
import { renderPublicPost } from '../server/public-post-page.mjs';
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('CDN-Cache-Control', 'no-store');
  res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self' https:; media-src https:; style-src 'self'; script-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
  if (!['GET', 'HEAD'].includes(req.method)) {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).end();
  }
  try {
    const post = await loadPublicPost(req.query.id, {
      url: process.env.VITE_SUPABASE_URL,
      key: process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      signal: AbortSignal.timeout(8000),
    });
    res.status(post ? 200 : 404);
    return res.end(req.method === 'HEAD' ? undefined : renderPublicPost(post));
  } catch {
    res.status(503);
    res.setHeader('Retry-After', '30');
    return res.end(req.method === 'HEAD' ? undefined : renderPublicPost(null, { unavailable: true }));
  }
}
