import { readFileSync } from 'node:fs';
import type { Plugin } from 'vite';
const source = new URL('../shared/post-video-sharing.mjs', import.meta.url);
/** Serve exactly the same helper in the unbundled public viewer and React app. */
export function publicSharing(): Plugin {
  return {
    name: 'public-video-sharing',
    generateBundle() { this.emitFile({ type: 'asset', fileName: 'public-video-sharing.mjs', source: readFileSync(source, 'utf8') }); },
    configureServer(server) {
      server.middlewares.use('/public-video-sharing.mjs', (_req, res) => {
        res.setHeader('Content-Type', 'text/javascript'); res.end(readFileSync(source, 'utf8'));
      });
    },
  };
}
