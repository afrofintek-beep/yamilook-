import { expect, it } from 'vitest';
import { isApplicationAssetError, trackAssetLoadErrors } from './asset-load-error';
import { renderDiagnostic } from './render-diagnostic';

it('recognises a Vite import rejection without swallowing it or classifying unrelated fetch failures', () => {
  const stop = trackAssetLoadErrors();
  const error = new TypeError('Load failed');
  const event = Object.assign(new Event('vite:preloadError', { cancelable: true }), { payload: error });
  window.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(false);
  expect(isApplicationAssetError(error)).toBe(true);
  expect(renderDiagnostic(error, '').category).toBe('asset-load');
  expect(isApplicationAssetError(new TypeError('Load failed'))).toBe(false);
  expect(isApplicationAssetError(new TypeError('undefined is not an object'))).toBe(false);
  stop();
  const later = new TypeError('Load failed');
  window.dispatchEvent(Object.assign(new Event('vite:preloadError'), { payload: later }));
  expect(isApplicationAssetError(later)).toBe(false);
});
