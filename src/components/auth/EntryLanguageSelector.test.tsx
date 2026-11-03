import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import i18n, { changeAppLanguage } from '@/i18n';
import { afrolocLanguages } from '@/i18n/afroloc-languages';
import Welcome from '@/pages/Welcome';

afterEach(async () => { cleanup(); await changeAppLanguage('pt'); });

describe('public language selection', () => {
  it('has every entry string in each of the 13 resource bundles without fallback', async () => {
    expect(afrolocLanguages).toHaveLength(13);
    for (const { code } of afrolocLanguages) {
      await changeAppLanguage(code);
      for (const key of ['chooseLanguage', 'title', 'subtitle', 'languageError', 'createAccount', 'login', 'terms', 'privacy']) {
        const value = i18n.getResource(code, 'translation', `entry.${key}`);
        expect(typeof value, `${code}: ${key}`).toBe('string');
        expect(value.trim().length, `${code}: ${key}`).toBeGreaterThan(0);
      }
    }
  });

  it('changes language before registration, persists the choice and preserves invitation parameters', async () => {
    await changeAppLanguage('pt');
    render(<MemoryRouter initialEntries={['/welcome?invite=single-use-code&ref=founder']}><Welcome /></MemoryRouter>);
    expect(screen.getAllByRole('option')).toHaveLength(13);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'ar' } });
    await waitFor(() => expect(screen.getByRole('heading').textContent).toBe(i18n.getResource('ar', 'translation', 'entry.title')));
    expect(document.documentElement.dir).toBe('rtl');
    expect(localStorage.setItem).toHaveBeenCalledWith('i18nextLng', 'ar');
    expect(screen.getByRole('link', { name: i18n.t('entry.createAccount') }).getAttribute('href')).toBe('/onboarding?invite=single-use-code&ref=founder');
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'fr' } });
    await waitFor(() => expect(document.documentElement.dir).toBe('ltr'));
    expect(screen.getByRole('heading').textContent).toBe('Bienvenue sur YAMILOOK');
  });
});
