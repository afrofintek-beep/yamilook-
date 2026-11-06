import { uploadUrl } from './security.mjs';
export class ProviderError extends Error { constructor(status) { super('linkedin_rejected'); this.status = status; } }
export function provider({ token, version, fetcher = fetch }) {
  const headers = { Authorization: `Bearer ${token}`, 'Linkedin-Version': version, 'X-Restli-Protocol-Version': '2.0.0', 'Content-Type': 'application/json' };
  const call = async (path, method = 'GET', body) => {
    const response = await fetcher(`https://api.linkedin.com/rest/${path}`, { method, headers, body: body && JSON.stringify(body), redirect: 'error', signal: AbortSignal.timeout(25000) });
    if (!response.ok) throw new ProviderError(response.status);
    return response;
  };
  return {
    async initialize(kind, owner, size) {
      const request = kind === 'video' ? { owner, fileSizeBytes: size, uploadCaptions: false, uploadThumbnail: false } : { owner };
      const { value } = await (await call(`${kind === 'video' ? 'videos' : 'images'}?action=initializeUpload`, 'POST', { initializeUploadRequest: request })).json();
      const media = value[kind];
      if (typeof media !== 'string' || !media.startsWith(`urn:li:${kind}:`)) throw new Error('invalid_media');
      const parts = kind === 'video' ? value.uploadInstructions : [{ uploadUrl: value.uploadUrl, firstByte: 0, lastByte: size - 1 }];
      let offset = 0;
      for (const part of parts) {
        uploadUrl(part.uploadUrl);
        if (part.firstByte !== offset || !Number.isSafeInteger(part.lastByte) || part.lastByte < offset || part.lastByte - offset + 1 > 4194304) throw new Error('invalid_upload_parts');
        offset = part.lastByte + 1;
      }
      if (offset !== size) throw new Error('invalid_upload_parts');
      return { media, parts, uploadToken: value.uploadToken || '' };
    },
    async upload(part, bytes, type) {
      const result = await fetcher(uploadUrl(part.uploadUrl), { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': type }, body: bytes, redirect: 'error', signal: AbortSignal.timeout(55000) });
      if (!result.ok) throw new ProviderError(result.status);
      return result.headers.get('etag')?.replace(/^"|"$/g, '') || '';
    },
    async finalize(media, uploadToken, ids) {
      await call('videos?action=finalizeUpload', 'POST', { finalizeUploadRequest: { video: media, uploadToken, uploadedPartIds: ids } });
    },
    async ready(media) {
      const body = await (await call(`videos/${encodeURIComponent(media)}`)).json();
      if (body.status === 'PROCESSING_FAILED') throw new Error('processing_failed');
      return body.status === 'AVAILABLE';
    },
    async publish(owner, media, commentary, visibility) {
      const response = await call('posts', 'POST', {
        author: owner, commentary, visibility, distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
        content: { media: { id: media } }, lifecycleState: 'PUBLISHED', isReshareDisabledByAuthor: false,
      });
      const id = response.headers.get('x-restli-id');
      if (!/^urn:li:(share|ugcPost):\d+$/.test(id || '')) throw new Error('missing_post_id');
      return id;
    },
  };
}
