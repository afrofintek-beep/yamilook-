import { afterEach, expect, it } from 'vitest';
import { renderDiagnostic, readRenderDiagnostic } from './render-diagnostic';
afterEach(() => sessionStorage.clear());
it('persists only bounded technical locations and categories across recovery', () => {
 const error=new Error('private message alice@example.com token=secret');
 error.stack='Error: private\n at https://example.com/assets/Calls-abc.js:12:4?token=secret';
 const result=renderDiagnostic(error,'\n at Calls (https://example.com/assets/Calls-abc.js:12:4)');
 expect(result.frames).toEqual(['Calls-abc.js:12:4']);
 expect(result.components).toEqual(['Calls']);
 expect(readRenderDiagnostic()).toContain('render-exception');
 expect(readRenderDiagnostic()).not.toMatch(/private|alice|secret|https/);
});
it('distinguishes hook and update failures without retaining exception text', () => {
 expect(renderDiagnostic(new Error('Rendered fewer hooks than expected'), '').category).toBe('hook-order');
 expect(renderDiagnostic(new Error('Maximum update depth exceeded'), '').category).toBe('update-loop');
});

it.each([
 "'text/html' is not a valid JavaScript MIME type.",
 'Unable to preload CSS for /assets/Chat.css?private=secret',
])('classifies module loading failure without retaining its text: %s', message => {
 const result = renderDiagnostic({ name: 'TypeError', message }, '');
 expect(result.category).toBe('asset-load');
 expect(JSON.stringify(result)).not.toMatch(/secret|private|text\/html/);
});

it('retains safe Safari component locations when the exception has no stack', () => {
 const result = renderDiagnostic({ name: 'TypeError', message: 'private contact' }, '\nAb@https://example.com/assets/ActiveCallProvider-abc.js:14:727\n@https://example.com/assets/vendor-react-def.js:24:10');
 expect(result.frames).toEqual(['ActiveCallProvider-abc.js:14:727', 'vendor-react-def.js:24:10']);
 expect(result.components).toEqual(['Ab']);
 expect(result.errorType).toBe('TypeError');
 expect(result.hasStack).toBe(false);
 expect(JSON.stringify(result)).not.toMatch(/private|contact|https/);
});

it('uses a Safari source location while removing its query string', () => {
 const result = renderDiagnostic({ sourceURL: 'https://example.com/assets/Calls-abc.js?token=secret', line: 14, column: 727 }, '');
 expect(result.frames).toEqual(['Calls-abc.js:14:727']);
 expect(JSON.stringify(result)).not.toMatch(/https|token|secret/);
});

it('identifies minified React and channel failures without copying error messages', () => {
 expect(renderDiagnostic(new Error('Minified React error #185; private URL'), '').category).toBe('update-loop');
 expect(renderDiagnostic(new Error('Minified React error #310; private URL'), '').category).toBe('hook-order');
 const result = renderDiagnostic({ message: 'cannot add postgres_changes callbacks after subscribe() secret' }, '');
 expect(result.reason).toBe('subscription-reused');
 expect(JSON.stringify(result)).not.toContain('secret');
 expect(renderDiagnostic(null, '').reason).toBe('unclassified');
});
