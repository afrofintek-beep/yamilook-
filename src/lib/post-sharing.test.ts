import { describe, it, expect, vi, afterEach } from 'vitest';
import { publicPostUrl, sharePostLink } from './post-sharing';
afterEach(() => vi.unstubAllGlobals());
describe('external post sharing', () => {
  it('always uses the production Yamilook domain', () => expect(publicPostUrl('id')).toBe('https://www.yamilook.com/post/id'));
  it('opens the native sharing sheet', async () => {
    const share=vi.fn().mockResolvedValue(undefined); vi.stubGlobal('navigator',{share});
    expect(await sharePostLink('id')).toBe('shared'); expect(share).toHaveBeenCalledWith({title:'Yamilook',url:publicPostUrl('id')});
  });
  it('does not copy or count a cancelled share', async () => {
    const writeText=vi.fn(); vi.stubGlobal('navigator',{share:vi.fn().mockRejectedValue({name:'AbortError'}),clipboard:{writeText}});
    expect(await sharePostLink('id')).toBe('cancelled'); expect(writeText).not.toHaveBeenCalled();
  });
  it('copies directly for the copy-link menu', async () => {
    const share=vi.fn(),writeText=vi.fn().mockResolvedValue(undefined); vi.stubGlobal('navigator',{share,clipboard:{writeText}});
    expect(await sharePostLink('id',{copyOnly:true})).toBe('copied'); expect(share).not.toHaveBeenCalled(); expect(writeText).toHaveBeenCalledWith(publicPostUrl('id'));
  });
  it('falls back to copying when the browser rejects Web Share', async () => {
    vi.stubGlobal('navigator',{share:vi.fn().mockRejectedValue({name:'NotAllowedError'}),clipboard:{writeText:vi.fn().mockResolvedValue(undefined)}});
    expect(await sharePostLink('id')).toBe('copied');
  });
  it('reports clipboard failure instead of false success', async () => {
    vi.stubGlobal('navigator',{clipboard:{writeText:vi.fn().mockRejectedValue(new Error('denied'))}});
    await expect(sharePostLink('id')).rejects.toThrow('denied');
  });
});
