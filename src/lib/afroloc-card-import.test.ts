import { expect, it } from 'vitest';
import { addressFromCard, readAfrolocCard } from './afroloc-card-import';
it('imports address data from codes and known links only', () => {
 expect(addressFromCard('ao–lda–tal–kta–dig–g10–35fd–n24qy')).toBe('AO-LDA-TAL-KTA-DIG-G10-35FD-N24QY');
 expect(addressFromCard('https://app.afroloc.ao/?code=AO-ZU-G10-ABC-DEF')).toBe('AO-ZU-G10-ABC-DEF');
 for (const raw of ['https://evil.test/?code=AO-ZU-G10-ABC-DEF', 'https://app.afroloc.ao/?key=secret', 'javascript:alert(1)', 'secret', 'x'.repeat(2049)]) expect(addressFromCard(raw)).toBeNull();
});
it('rejects unsupported and oversized files before image decoding', async () => {
 await expect(readAfrolocCard(new File(['test'], 'card.html', {type:'text/html'}))).rejects.toThrow('JPG');
 await expect(readAfrolocCard(new File([new Uint8Array(10*1024*1024+1)], 'card.png', {type:'image/png'}))).rejects.toThrow('10 MB');
});
