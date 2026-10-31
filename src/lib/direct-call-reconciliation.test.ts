import { describe,it,expect } from 'vitest';
import { callHasBothPeers,missingPeerGraceExpired } from '../../supabase/functions/reconcile-direct-calls/decision';
describe('server-owned direct call recovery',()=>{
  it('does not treat a participant count as proof that the two invitees are present',()=>{
    expect(callHasBothPeers('a','b',['a','intruder'])).toBe(false);
    expect(callHasBothPeers('a','b',['a','b'])).toBe(true);
  });
  it('allows reconnection grace and does not trust missing or malformed observations',()=>{
    const now=Date.now();
    expect(missingPeerGraceExpired(null,now)).toBe(false);
    expect(missingPeerGraceExpired('invalid',now)).toBe(false);
    expect(missingPeerGraceExpired(new Date(now-44_999).toISOString(),now)).toBe(false);
    expect(missingPeerGraceExpired(new Date(now-45_000).toISOString(),now)).toBe(true);
  });
});
