import { describe, expect, it } from 'vitest';
import { authorizedPaymentWebhook, settledPaymentStatus } from '../../supabase/functions/appypay-webhook/validation';
describe('payment webhook boundary', () => {
  it('fails closed without configured secret or with an untrusted caller', () => {
    expect(authorizedPaymentWebhook(undefined, undefined)).toBe(false);
    expect(authorizedPaymentWebhook('', '')).toBe(false);
    expect(authorizedPaymentWebhook('server-secret', 'wrong')).toBe(false);
    expect(authorizedPaymentWebhook('server-secret', 'server-secret')).toBe(true);
  });
  it('never credits a pending or unsuccessful payment', () => {
    expect(settledPaymentStatus({code:101,status:'Success'}, undefined)).toBe(false);
    expect(settledPaymentStatus({status:'unsuccessful'}, undefined)).toBe(false);
    expect(settledPaymentStatus({status:'not approved'}, undefined)).toBe(false);
    expect(settledPaymentStatus({code:100}, undefined)).toBe(true);
    expect(settledPaymentStatus({status:'Paid'}, undefined)).toBe(true);
  });
});
