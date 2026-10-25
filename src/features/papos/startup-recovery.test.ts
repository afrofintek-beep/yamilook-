import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { afterEach, describe, expect, it, vi } from 'vitest';

const html = readFileSync(resolve(import.meta.dirname, '../../../papos-app/index.html'), 'utf8');
function setup(options: { blocked?: boolean; stalled?: boolean } = {}) {
  vi.useFakeTimers();
  document.body.innerHTML = html.slice(html.indexOf('<div id="root">'), html.indexOf('<!-- Runs before'));
  const own = { scope: 'https://example.com/papos-app/', unregister: vi.fn() };
  const other = { scope: 'https://example.com/', unregister: vi.fn() };
  const remove = vi.fn();
  const replace = vi.fn();
  const listeners: Record<string, () => void> = {};
  const window = {
    caches: {},
    addEventListener: vi.fn((name, fn) => { listeners[name] = fn; }),
    removeEventListener: vi.fn(),
  };
  runInNewContext(html.match(/<script id="startup-recovery">([\s\S]*?)<\/script>/)![1], {
    document, window, MutationObserver, URL, Promise, Date, setTimeout, clearTimeout,
    navigator: { serviceWorker: { getRegistrations: () => options.stalled ? new Promise(() => {}) : options.blocked ? Promise.reject(new Error('denied')) : Promise.resolve([own, other]) } },
    caches: { keys: async () => ['papos-app-assets-old', 'workbox-main', 'private-drafts'], delete: remove },
    location: { origin: 'https://example.com', href: 'https://example.com/papos-app/chat/123', replace },
  });
  return { own, other, remove, replace, window, listeners };
}
afterEach(() => { document.body.innerHTML = ''; vi.useRealTimers(); });
describe('recovery before the KOSOLOLA module loads', () => {
  it('replaces indefinite loading with help after 15 seconds', async () => {
    setup();
    await vi.advanceTimersByTimeAsync(15000);
    expect(document.getElementById('startup-status')!.textContent).toContain('Não foi possível');
    expect(document.getElementById('startup-help')!.hidden).toBe(false);
  });
  it('handles entry/module errors without depending on React', () => {
    const state = setup(); state.listeners.error();
    expect(document.getElementById('startup-help')!.hidden).toBe(false);
  });
  it('repairs only its own public assets and preserves the deep link', async () => {
    const state = setup();
    document.getElementById('startup-reload')!.click();
    document.getElementById('startup-reload')!.click();
    await vi.advanceTimersByTimeAsync(0);
    expect(state.own.unregister).toHaveBeenCalledOnce();
    expect(state.other.unregister).not.toHaveBeenCalled();
    expect(state.remove.mock.calls).toEqual([['papos-app-assets-old']]);
    expect(state.replace).toHaveBeenCalledOnce();
    expect(state.replace.mock.calls[0][0]).toMatch(/^https:\/\/example.com\/papos-app\/chat\/123\?app-recovery=\d+$/);
  });
  it.each([{ blocked: true }, { stalled: true }])('still reloads if storage is unavailable: %j', async options => {
    const state = setup(options);
    document.getElementById('startup-reload')!.click();
    await vi.advanceTimersByTimeAsync(4000);
    expect(state.replace).toHaveBeenCalledOnce();
  });
  it('cleans up the watchdog once the application replaces the splash', async () => {
    const state = setup();
    document.getElementById('root')!.textContent = 'Login';
    await vi.advanceTimersByTimeAsync(15000);
    expect(document.getElementById('root')!.textContent).toBe('Login');
    expect(state.window.removeEventListener).toHaveBeenCalledWith('error', expect.any(Function), true);
    expect(state.replace).not.toHaveBeenCalled();
  });
});
