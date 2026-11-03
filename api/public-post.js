import { videoDescriptor } from '../shared/post-video-sharing.mjs';
import { loadPublicPost, isVideo } from '../shared/public-post.mjs';
import { renderPublicPost } from '../server/public-post-page.mjs';
function contentPolicy(post) {
  const mediaOrigins = [...new Set((post?.media_urls || []).filter(isVideo).map(url => new URL(url).origin))].join(' ');
  return `default-src 'none'; img-src 'self' https:; media-src https:; style-src 'self'; script-src 'self'; connect-src 'self' ${mediaOrigins}; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`;
}
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('CDN-Cache-Control', 'no-store');
  res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Content-Security-Policy', contentPolicy(null));
  if (!['GET', 'HEAD'].includes(req.method)) {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).end();
  }
  const videoRequest = req.query.media === 'video';
  if (videoRequest) res.setHeader('Content-Type', 'application/json; charset=utf-8');
  try {
    const post = await loadPublicPost(req.query.id, {
      url: process.env.VITE_SUPABASE_URL,
      key: process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      signal: AbortSignal.timeout(8000),
    });
    res.setHeader('Content-Security-Policy', contentPolicy(post));
    if (videoRequest) {
      const video = videoDescriptor(post, req.query.index, process.env.VITE_SUPABASE_URL);
      if (!video) { res.status(404); return res.end(req.method === 'HEAD' ? undefined : JSON.stringify({ error: 'Public video unavailable' })); }
      if (req.query.download === '1') {
        res.status(302); res.setHeader('Location', video.downloadUrl); return res.end();
      }
      res.status(200); return res.end(req.method === 'HEAD' ? undefined : JSON.stringify(video));
    }
    res.status(post ? 200 : 404);
    return res.end(req.method === 'HEAD' ? undefined : renderPublicPost(post));
  } catch {
    res.status(503);
    res.setHeader('Retry-After', '30');
    return res.end(req.method === 'HEAD' ? undefined : videoRequest ? JSON.stringify({ error: 'Public video service unavailable' }) : renderPublicPost(null, { unavailable: true }));
  }
}
