import { describe, expect, it } from 'vitest';
import { legalContent, legalLabel } from './legal-content';

describe('translated legal documents', () => {
  it('has complete sections, text and contact details in all ten languages', () => {
    const source = legalContent('pt');
    for (const language of ['pt','en','fr','ar','am','sw','ln','yo','sn','zu']) {
      const data = legalContent(language);
      expect(data.texts).toHaveLength(source.texts.length);
      expect(data.texts.every(text => typeof text === 'string' && text.trim())).toBe(true);
      expect(data.documents).toEqual(source.documents);
      expect(data.documents.terms.sections).toHaveLength(12);
      expect(data.documents.privacy.sections).toHaveLength(12);
      expect(data.texts.join(' ')).toContain('suporte@yamilook.com');
      expect(data.texts.join(' ')).toContain('privacidade@yamilook.com');
      expect(data.texts.join(' ')).not.toContain('###');
    }
  });
  it('uses Portuguese legal wording for informal and regional Portuguese', () => {
    expect(legalContent('pt-banda')).toBe(legalContent('pt'));
    expect(legalContent('pt-AO')).toBe(legalContent('pt'));
    expect(legalLabel('pt', 'terms')).toBe('Termos de Serviço');
    expect(legalLabel('en', 'terms')).toBe('Terms of Service');
    expect(legalContent('ar')).not.toBe(legalContent('pt'));
  });
});
