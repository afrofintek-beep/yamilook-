import { readFileSync, readdirSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { describe, expect, it, vi } from 'vitest';

const root = `${process.cwd()}/public/guia`;
const script = readFileSync(`${root}/guide.js`, 'utf8');
const languages = ['pt', 'en', 'fr', 'ar', 'am', 'sw', 'ln', 'yo', 'sn', 'zu'];
const pages = readdirSync(root).filter(file => file.endsWith('.html'));
const dictionary = (language: string) => JSON.parse(readFileSync(`${root}/locales/${language}.json`, 'utf8'));
const ready = (window: JSDOM['window']) => new Promise(resolve => window.document.addEventListener('guide:ready', resolve, { once: true }));

async function openGuide(page: string, language: string, saved?: string) {
  const dom = new JSDOM(readFileSync(`${root}/${page}`, 'utf8'), {
    url: `https://www.yamilook.com/guia/${page}${language ? `?lang=${language}` : ''}`, runScripts: 'outside-only',
  });
  if (saved) dom.window.localStorage.setItem('i18nextLng', saved);
  dom.window.fetch = vi.fn(async (url: string) => ({ ok: true, json: async () => dictionary(url.split('/').pop()!.replace('.json', '')) }));
  const loaded = ready(dom.window);
  dom.window.eval(script);
  await loaded;
  return dom;
}

describe('published static guides', () => {
  for (const language of languages) it(`renders all nine pages completely in ${language}`, async () => {
    const translated = dictionary(language);
    const manual = JSON.parse(readFileSync(`${process.cwd()}/src/i18n/manuals/${language}.json`, 'utf8'));
    expect(translated['Academia']).toBe(manual['Academia']);
    expect(translated['Lives']).toBe(manual['Lives']);
    if (language === 'ar') expect(translated['Lives']).toBe('البث المباشر');
    expect(translated['Toca em <strong>Academia</strong> na barra inferior.']).toContain(`<strong>${manual['Academia']}</strong>`);
    expect(Object.keys(translated).sort()).toEqual(Object.keys(dictionary('pt')).sort());
    for (const [source, value] of Object.entries(translated)) {
      expect(value, source).toBeTruthy();
      expect(value, source).not.toMatch(/ZXQ\d|QXZ|\[UI\d/);
      expect((String(value).match(/<\/?(?:strong|b|em|br)>/g) || []).sort(), source)
        .toEqual((source.match(/<\/?(?:strong|b|em|br)>/g) || []).sort());
    }
    for (const page of pages) {
      const dom = await openGuide(page, language);
      const d = dom.window.document;
      expect(d.getElementById('guide-error')!.hidden, page).toBe(true);
      expect(d.documentElement.lang).toBe(language);
      expect(d.documentElement.dir).toBe(language === 'ar' ? 'rtl' : 'ltr');
      for (const node of d.querySelectorAll('[data-guide-copy]')) {
        const expected = new dom.window.DOMParser().parseFromString(translated[node.getAttribute('data-guide-copy')!], 'text/html').body.textContent;
        expect(node.textContent, page).toBe(expected);
      }
      for (const link of d.querySelectorAll('a[href]')) {
        expect(new URL(link.getAttribute('href')!, dom.window.location.href).searchParams.get('lang')).toBe(language);
      }
      expect(dom.window.localStorage.getItem('i18nextLng')).toBe(language);
      dom.window.close();
    }
  });

  it('honours query language over the saved app choice and preserves Portuguese urban preference', async () => {
    for (const [query, saved, expected, persisted] of [['ar', 'fr', 'ar', 'ar'], ['', 'sn-ZW', 'sn', 'sn'], ['', 'pt-banda', 'pt', 'pt-banda'], ['invalid', 'en', 'pt', 'pt']]) {
      const dom = await openGuide('index.html', query, saved);
      expect(dom.window.document.documentElement.lang).toBe(expected);
      expect(dom.window.localStorage.getItem('i18nextLng')).toBe(persisted);
      expect(new URL(dom.window.document.querySelector<HTMLAnchorElement>('.cta')!.href).searchParams.get('lang')).toBe(persisted);
      dom.window.close();
    }
  });

  it('keeps the current text, direction and links when a new language cannot load', async () => {
    const dom = await openGuide('academia.html', 'ar');
    const d = dom.window.document;
    const previous = d.querySelector('h1')!.textContent;
    dom.window.fetch = vi.fn(async () => ({ ok: false }));
    const selected = d.querySelector<HTMLSelectElement>('#guide-language')!;
    const loaded = ready(dom.window);
    selected.value = 'fr'; selected.dispatchEvent(new dom.window.Event('change'));
    await loaded;
    expect(d.querySelector('h1')!.textContent).toBe(previous);
    expect(d.documentElement.dir).toBe('rtl');
    expect(selected.value).toBe('ar');
    expect(d.getElementById('guide-error')!.hidden).toBe(false);
    expect(d.getElementById('guide-error')!.textContent).toBe(dictionary('ar')['Não foi possível carregar este idioma. O texto anterior foi mantido.']);
    dom.window.close();
  });

  it('ignores an older response after a faster language change', async () => {
    const dom = await openGuide('index.html', 'pt');
    const d = dom.window.document;
    const pending = new Map<string, (value: unknown) => void>();
    dom.window.fetch = vi.fn((url: string) => new Promise(resolve => pending.set(url, resolve)));
    const select = d.querySelector<HTMLSelectElement>('#guide-language')!;
    for (const language of ['en', 'fr']) { select.value = language; select.dispatchEvent(new dom.window.Event('change')); }
    const loaded = ready(dom.window);
    pending.get('/guia/locales/fr.json')!({ ok: true, json: async () => dictionary('fr') });
    await loaded;
    pending.get('/guia/locales/en.json')!({ ok: true, json: async () => dictionary('en') });
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(d.documentElement.lang).toBe('fr');
    expect(select.value).toBe('fr');
    dom.window.close();
  });

  it('rejects unexpected markup instead of executing or inserting it', async () => {
    const dom = await openGuide('index.html', 'pt');
    const d = dom.window.document;
    const next = dictionary('en'); next['Guias da Yamilook'] = '<img src=x onerror=alert(1)>';
    dom.window.fetch = vi.fn(async () => ({ ok: true, json: async () => next }));
    const loaded = ready(dom.window);
    const select = d.querySelector<HTMLSelectElement>('#guide-language')!;
    select.value = 'en'; select.dispatchEvent(new dom.window.Event('change'));
    await loaded;
    expect(d.documentElement.lang).toBe('pt');
    expect(d.querySelector('h1 img')).toBeNull();
    expect(d.getElementById('guide-error')!.hidden).toBe(false);
    dom.window.close();
  });
});
