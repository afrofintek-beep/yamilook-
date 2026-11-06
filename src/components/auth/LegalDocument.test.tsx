import { act, render, screen, cleanup } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { LegalDocument } from './LegalDocument';
import { legalLabel } from '@/i18n/legal-content';
vi.mock('./EntryLanguageSelector', () => ({ EntryLanguageSelector: () => null }));
afterEach(cleanup);
it.each(['terms','privacy'] as const)('updates the complete %s document on language changes', async (kind) => {
  const i18n = createInstance();
  const languages = ['pt','en','fr','ar','am','sw','ln','yo','sn','zu','pt-banda'];
  await i18n.init({ lng: 'pt', fallbackLng: 'pt', resources: Object.fromEntries(languages.map(l => [l,{translation:{}}])) });
  render(<I18nextProvider i18n={i18n}><MemoryRouter><LegalDocument kind={kind} /></MemoryRouter></I18nextProvider>);
  for (const language of languages) {
    await act(async () => { await i18n.changeLanguage(language); });
    expect(screen.getByRole('heading', {level:1}).textContent).toBe(legalLabel(language, kind));
    expect(screen.getAllByRole('heading', {level:2})).toHaveLength(12);
    expect(screen.getByRole('main').getAttribute('dir')).toBe(language === 'ar' ? 'rtl' : 'ltr');
    expect(screen.getByRole('link').getAttribute('href')).toBe(kind === 'terms' ? '/privacy' : '/terms');
  }
});
