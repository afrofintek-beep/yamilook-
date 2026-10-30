import { afterEach, expect, it, vi } from 'vitest';
import { communityReturn, referralWork, shareValidatedWork, workShareUrl } from './community-links';
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();});
it('always shares the canonical public site, including from preview origins',()=>{
 expect(workShareUrl('work-id')).toBe('https://www.yamilook.com/academia/trabalhos/work-id');
});
it('preserves the community and referral after authentication',()=>{
 const target='/academia/comunidades/criacao-digital/turmas/11111111-1111-4111-8111-111111111111?origem=22222222-2222-4222-8222-222222222222';
 expect(communityReturn('?next='+encodeURIComponent(target))).toBe(target);
});
it.each(['https://evil.example/path','//evil.example/path','/login','/academia/percursos/private','/academia/comunidades/../../settings','/\\evil.example/path','javascript:alert(1)'])('rejects an unsafe return destination %s',target=>{
 expect(communityReturn('?next='+encodeURIComponent(target))).toBeNull();
});
it('only accepts a complete proof UUID for referral attribution',()=>{
 expect(referralWork('?origem=11111111-1111-4111-8111-111111111111')).toBe('11111111-1111-4111-8111-111111111111');
 expect(referralWork('?origem=not-a-proof')).toBeUndefined();
});
it('a cancelled native share does not copy or send a message',async()=>{
 const copy=vi.fn();vi.stubGlobal('navigator',{share:vi.fn().mockRejectedValue(new DOMException('Cancelled','AbortError')),clipboard:{writeText:copy}});
 expect(await shareValidatedWork('work','Meu trabalho')).toBe('Partilha cancelada.');expect(copy).not.toHaveBeenCalled();
});
it('falls back to copying the canonical link when native sharing is unavailable',async()=>{
 const copy=vi.fn().mockResolvedValue(undefined);vi.stubGlobal('navigator',{clipboard:{writeText:copy}});
 await shareValidatedWork('work','Meu trabalho');expect(copy).toHaveBeenCalledWith('https://www.yamilook.com/academia/trabalhos/work');
});

it('does not carry arbitrary authentication or redirect parameters into the return route',()=>{
 expect(communityReturn('?next='+encodeURIComponent('/academia/comunidades/criacao-digital?code=unexpected&next=https://evil.example'))).toBe('/academia/comunidades/criacao-digital');
});
