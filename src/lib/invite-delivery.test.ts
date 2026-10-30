import { describe, expect, it } from 'vitest';
import { buildEmailInviteDraftUrl, buildWhatsAppInviteUrl, invitationMessage } from './invite-delivery';
const email = 'new@example.com', code = 'E200EA12935E4E64';
describe('invitation delivery links', () => {
  it('uses the public domain and the intended email in the message', () => {
    const message = invitationMessage(email, code);
    expect(message).toContain('https://www.yamilook.com/register?ref=' + code);
    expect(message).toContain(email);
    expect(message).not.toContain('vercel.app');
  });
  it('prepares WhatsApp with encoded text; the sender chooses the contact', () => {
    const url = new URL(buildWhatsAppInviteUrl(email, code));
    expect(url.origin).toBe('https://api.whatsapp.com');
    expect(url.pathname).toBe('/send');
    expect(url.searchParams.get('text')).toContain('https://www.yamilook.com/register?ref=' + code);
  });
  it('prepares email without sending it and preserves the destination', () => {
    const draft = buildEmailInviteDraftUrl(email, code);
    expect(draft.startsWith('mailto:new%40example.com?')).toBe(true);
    expect(decodeURIComponent(draft)).toContain('www.yamilook.com/register?ref=' + code);
    expect(draft).not.toContain('vercel.app');
  });
});
