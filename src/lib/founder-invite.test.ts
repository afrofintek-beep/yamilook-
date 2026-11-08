import { describe, expect, it } from 'vitest';
import { appLanguages } from '@/i18n/afroloc-languages';
import { buildFounderInviteMessage } from './founder-invite';

describe('Founder invitation message', () => {
  it('prepares Portuguese personal invitation without manufacturing a link', () => {
    const text = buildFounderInviteMessage({name:'Ana',profession:'educação',reason:'valorizo o teu trabalho',language:'pt'});
    expect(text).toContain('Olá Ana');
    expect(text).toContain('educação');
    expect(text).toContain('valorizo o teu trabalho');
    expect(text).toContain('[Ligação individual — por gerar]');
    expect(text).not.toContain('vercel.app');
  });
  it('includes the issued canonical URL verbatim', () => {
    const url='https://www.yamilook.com/register?ref=ABC123';
    expect(buildFounderInviteMessage({name:'Ana',profession:'',reason:'',language:'pt',link:url})).toContain(url);
  });
  it('generates a distinct personal message in each of the ten app languages', () => {
    const messages = appLanguages.map(({ code }) => {
      const link = `https://www.yamilook.com/register?ref=ABC123&lang=${code}`;
      const text = buildFounderInviteMessage({ name: 'Ana', profession: '', reason: '', language: code, link });
      expect(text).toContain('Ana');
      expect(text).toContain('YAMILOOK');
      expect(text).toContain('António H. da Silva');
      expect(text).toContain(link);
      return text.replace(link, '');
    });
    expect(new Set(messages).size).toBe(10);
  });
});
