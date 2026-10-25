import { describe, it, expect } from 'vitest';
import { activeCall, allowedEndpoint, validSubscription } from '../../supabase/functions/call-push/validation';
describe('call push security', () => {
  it.each(['https://web.push.apple.com/Q', 'https://fcm.googleapis.com/fcm/send/test', 'https://updates.push.services.mozilla.com/wpush/v2/test'])('accepts push service %s', url => expect(allowedEndpoint(url)).toBe(true));
  it.each(['http://web.push.apple.com/Q','https://127.0.0.1/','https://169.254.169.254/','https://web.push.apple.com.attacker.test/Q','https://user:pass@fcm.googleapis.com/Q','https://fcm.googleapis.com:444/Q','https://example.com/Q',null])('rejects arbitrary destinations %s', url => expect(allowedEndpoint(url)).toBe(false));
  it('requires well-formed encryption keys', () => {
    const s={endpoint:'https://web.push.apple.com/test',keys:{p256dh:'A'.repeat(87),auth:'B'.repeat(22)}};
    expect(validSubscription(s)).toBe(true); expect(validSubscription({...s,keys:{auth:'x'}})).toBe(false);
  });
  it('only allows the initiator of a current ringing call', () => {
    const now=Date.now(), call={initiator_id:'caller',status:'ringing',created_at:new Date(now-1000).toISOString()};
    expect(activeCall(call,'caller',now)).toBe(true);
    expect(activeCall(call,'other',now)).toBe(false);
    expect(activeCall({...call,status:'ended'},'caller',now)).toBe(false);
    expect(activeCall({...call,created_at:new Date(now-90000).toISOString()},'caller',now)).toBe(false);
    expect(activeCall({...call,created_at:'bad'},'caller',now)).toBe(false);
  });
});
