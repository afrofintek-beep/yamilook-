import { describe, expect, it } from 'vitest';
import { candidateInvitationEmail, invitationEmail, invitationLanguage, invitationLanguages } from '../../supabase/functions/_shared/invitation-copy';

describe('localized invitation emails', () => {
  for (const language of invitationLanguages) it(`preserves private values and one-use links in ${language}`, () => {
    const message = invitationEmail('antonio+convite@example.com', 'ABCDEF0123456789', language);
    expect(message.html).toContain(`lang="${language}"`);
    expect(message.html).toContain(`dir="${language === 'ar' ? 'rtl' : 'ltr'}"`);
    expect(message.text).toContain('antonio+convite@example.com');
    expect(message.text).toContain('ref=ABCDEF0123456789&lang=' + language);
    expect(message.text).not.toContain('{{');
    const candidate = candidateInvitationEmail('António da Silva', 'AB12CD34', language);
    expect(candidate.text).toContain('António da Silva');
    expect(candidate.text).toContain('AB12CD34');
    expect(candidate.text).toContain('https://www.yamilook.com/register?lang=' + language);
    expect(candidate.subject).not.toBe('');
    expect(candidate.text).not.toContain('{{');
  });
  it('escapes interpolated text and rejects language injection', () => {
    const message = invitationEmail('<script>alert(1)</script>@example.com', 'A&B', 'ar" onclick="alert(1)');
    expect(message.html).not.toContain('<script>');
    expect(message.html).toContain('&lt;script&gt;');
    expect(message.html).toContain('lang="pt"');
    expect(message.text).toContain('ref=A%26B&lang=pt');
    for (const value of [null, undefined, {}, 'xx', 'PT', 'pt-BR']) expect(invitationLanguage(value)).toBe('pt');
  });
});
