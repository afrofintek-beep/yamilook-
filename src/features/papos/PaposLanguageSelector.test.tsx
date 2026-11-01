import { act, fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import i18n, { changeAppLanguage } from '@/i18n';
import PaposLanguageSelector from './PaposLanguageSelector';
import { normalizeAppLanguage } from '@/i18n/afroloc-languages';

afterEach(async () => { cleanup(); await act(async () => { await changeAppLanguage('pt'); }); });
describe('AFROLOC language selection', () => {
  it('shows exactly the 13 options from the deployed AFROLOC selector', async () => {
    await changeAppLanguage('pt');
    render(<PaposLanguageSelector />);
    expect(screen.getAllByRole('option').map(option => [option.getAttribute('value'), option.textContent])).toEqual([
      ['en','English'],['fr','Français'],['pt','Português'],['ar','العربية'],['am','አማርኛ'],
      ['sw','Kiswahili'],['ln','Lingála'],['yo','Yorùbá'],['sn','ChiShona'],['zu','isiZulu'],
      ['kmb','Kimbundu'],['umb','Umbundu'],['kg','Kikongo'],
    ]);
  });
  it('loads Yoruba labels and persists the choice', async () => {
    render(<PaposLanguageSelector />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'yo' } });
    await waitFor(() => expect(i18n.language).toBe('yo'));
    expect(i18n.t('auth.login')).toBe('Wọle');
    expect(localStorage.setItem).toHaveBeenCalledWith('i18nextLng', 'yo');
    expect(screen.getByText(/Àwọn ìtumọ̀ ṣì ń lọ lọ́wọ́/)).toBeInTheDocument();
    expect(i18n.t('auth.enterCredentials')).toBe('Enter your details to continue');
  });
  it('updates and restores document direction', async () => {
    await changeAppLanguage('ar');
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('ar');
    await changeAppLanguage('fr');
    expect(document.documentElement.dir).toBe('ltr');
    expect(i18n.t('auth.password')).not.toBe('Palavra-passe');
  });
  it('normalizes regional language codes while retaining legacy Yamilook choices', () => {
    expect(normalizeAppLanguage('fr-CD')).toBe('fr');
    expect(normalizeAppLanguage('pt-AO')).toBe('pt');
    expect(normalizeAppLanguage('pt-BANDA')).toBe('pt-banda');
    expect(normalizeAppLanguage('cjk')).toBe('cjk');
    expect(normalizeAppLanguage('unknown')).toBe('pt');
  });
});
