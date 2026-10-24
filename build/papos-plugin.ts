import { createHash } from 'node:crypto';
import type { Plugin } from 'vite';

/** Independent app shell and cache; API responses and personal media never enter it. */
export function paposApplication(): Plugin {
  return {
    name: 'papos-application', enforce: 'post',
    transformIndexHtml: {
      order: 'post',
      handler(html, context) {
        if (context.path !== '/papos-app/index.html') return html;
        return html.replace(/<link\b[^>]*rel=["']manifest["'][^>]*>/g, '')
          .replace('</head>', '<link rel="manifest" href="/papos-app/manifest.webmanifest"></head>');
      },
    },
    generateBundle(_options, bundle) {
      const entry = Object.values(bundle).find(item => item.type === 'chunk' && item.isEntry &&
        (item.facadeModuleId?.endsWith('/papos-app/index.html') || item.name === 'papos'));
      if (!entry || entry.type !== 'chunk') throw new Error('Papos entry missing');
      const files = new Set<string>(['papos-app/index.html']);
      const visit = (name: string) => {
        if (files.has(name)) return;
        files.add(name); const chunk = bundle[name];
        if (chunk?.type === 'chunk') {
          [...chunk.imports, ...chunk.dynamicImports].forEach(visit);
          chunk.viteMetadata?.importedCss.forEach(file => files.add(file));
          chunk.viteMetadata?.importedAssets.forEach(file => files.add(file));
        }
      };
      visit(entry.fileName);
      const version = createHash('sha256').update([...files].sort().map(name => {
        const item = bundle[name]; return name + (item?.type === 'chunk' ? item.code : item?.type === 'asset' ? String(item.source) : '');
      }).join('\n')).digest('hex').slice(0, 16);
      const assets = [...files].map(name => '/' + name).concat(['/papos-app/kosolola-icon-192.png', '/papos-app/kosolola-icon-512.png']);
      this.emitFile({ type: 'asset', fileName: 'papos-app/sw.js', source: `
const PREFIX='papos-app-assets-', CACHE=PREFIX+'${version}', SHELL='/papos-app/index.html';
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(${JSON.stringify(assets)})).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{const names=(await caches.keys()).filter(name=>name.startsWith(PREFIX));const keep=new Set([CACHE,...names.filter(name=>name!==CACHE).slice(-1)]);await Promise.all(names.filter(name=>!keep.has(name)).map(name=>caches.delete(name)));await self.clients.claim();})());});
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin)return;
 if(request.mode==='navigate'&&url.pathname.startsWith('/papos-app/')){
  event.respondWith(fetch(request).then(response=>{if(!response.ok)throw new Error('Unavailable');return response;}).catch(async()=>{const cache=await caches.open(CACHE);return(await cache.match(SHELL))||Response.error();}));return;
 }
 if(!url.pathname.startsWith('/assets/')&&!/^\\/papos-app\\/kosolola-icon-(192|512)\\.png$/.test(url.pathname))return;
 event.respondWith((async()=>{const names=(await caches.keys()).filter(name=>name.startsWith(PREFIX));for(const name of names){const cached=await(await caches.open(name)).match(request);if(cached)return cached;}return fetch(request);})());
});` });
    },
  };
}
