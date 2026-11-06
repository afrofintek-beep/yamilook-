import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto';
export const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
export const digest = value => createHash('sha256').update(value).digest('hex');
export const nonce = () => randomBytes(32).toString('base64url');
export function equal(a, b) {
  return typeof a === 'string' && typeof b === 'string' && a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
export function encryptionKey(value) {
  const key = Buffer.from(value || '', 'base64');
  if (key.length !== 32) throw new Error('invalid_encryption_key');
  return key;
}
export function seal(value, key, context) {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(context));
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url');
}
export function unseal(value, key, context) {
  const raw = Buffer.from(value, 'base64url'), decipher = createDecipheriv('aes-256-gcm', key, raw.subarray(0, 12));
  decipher.setAAD(Buffer.from(context)); decipher.setAuthTag(raw.subarray(12, 28));
  return JSON.parse(Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8'));
}
export function uploadUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.port ||
      !['www.linkedin.com', 'api.linkedin.com'].includes(url.hostname) || !url.pathname.startsWith('/dms-uploads/')) throw new Error('invalid_upload_url');
  return url.href;
}
export function returnPath(value) {
  return typeof value === 'string' && /^\/(?!\/)/.test(value) && !/[\\\r\n]/.test(value) && value.length < 1000 && !value.startsWith('/api/') ? value : '/';
}
export function mediaSpec(type, size) {
  const video = type === 'video/mp4';
  if (!video && !['image/jpeg', 'image/png'].includes(type)) throw new Error('unsupported_media');
  if (!Number.isSafeInteger(size) || size < 1 || size > (video ? 100 * 1024 * 1024 : 4 * 1024 * 1024)) throw new Error('media_too_large');
  return video ? 'video' : 'image';
}
