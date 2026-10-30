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
