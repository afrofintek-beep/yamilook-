import { act, fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import i18n, { changeAppLanguage } from '@/i18n';
import PaposLanguageSelector from './PaposLanguageSelector';
import PaposBrand from './PaposBrand';
import { appLanguages, normalizeAppLanguage } from '@/i18n/afroloc-languages';

afterEach(async () => { cleanup(); await act(async () => { await changeAppLanguage('pt'); }); });
describe('YAMILOOK language rollout', () => {
  it('shows exactly the ten enabled languages', async () => {
    await changeAppLanguage('pt');
    render(<PaposLanguageSelector />);
    expect(screen.getAllByRole('option').map(option => [option.getAttribute('value'), option.textContent])).toEqual([
      ['en','English'],['fr','Français'],['pt','Português'],['ar','العربية'],['am','አማርኛ'],
      ['sw','Kiswahili'],['ln','Lingála'],['yo','Yorùbá'],['sn','ChiShona'],['zu','isiZulu'],
    ]);
  });
  it('loads Yoruba labels and persists the choice', async () => {
    render(<PaposLanguageSelector />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'yo' } });
    await waitFor(() => expect(i18n.language).toBe('yo'));
    expect(i18n.t('auth.login')).toBe('Wọle');
    expect(localStorage.setItem).toHaveBeenCalledWith('i18nextLng', 'yo');
    expect(screen.queryByText(/Àwọn ìtumọ̀ ṣì ń lọ lọ́wọ́/)).not.toBeInTheDocument();
    expect(i18n.t('auth.enterCredentials')).toBe('Tẹ àlàyé rẹ sílẹ̀ láti tẹ̀síwájú');
  });
  it('updates and restores document direction', async () => {
    await changeAppLanguage('ar');
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('ar');
    await changeAppLanguage('fr');
    expect(document.documentElement.dir).toBe('ltr');
    expect(i18n.t('auth.password')).not.toBe('Palavra-passe');
  });
  it('updates the visible brand slogan through the selector in every enabled language', async () => {
    const slogans: Record<string, string> = {
      pt: 'A conversa é nossa.',
      en: 'The conversation is ours.',
      fr: 'La conversation est à nous.',
      ar: 'المحادثة لنا.',
      am: 'ውይይቱ የእኛ ነው።',
      sw: 'Mazungumzo ni yetu.',
      ln: 'Lisolo ezali ya biso.',
      yo: 'Ìjíròrò náà jẹ́ tiwa.',
      sn: 'Hurukuro ndeyedu.',
      zu: 'Ingxoxo ingeyethu.',
    };
    await changeAppLanguage('pt');
    render(<><PaposLanguageSelector /><PaposBrand /></>);
    for (const { code } of appLanguages) {
      fireEvent.change(screen.getByRole('combobox'), { target: { value: code } });
      await waitFor(() => expect(screen.getByText(slogans[code], { exact: true })).toBeVisible());
      expect(i18n.getResource(code, 'translation', 'kosolola.tagline')).toBe(slogans[code]);
      expect(document.documentElement.dir).toBe(code === 'ar' ? 'rtl' : 'ltr');
      if (code !== 'pt') expect(screen.queryByText(slogans.pt, { exact: true })).not.toBeInTheDocument();
    }
  });
  it('normalizes regional language codes while retaining legacy Yamilook choices', () => {
    expect(normalizeAppLanguage('fr-CD')).toBe('fr');
    expect(normalizeAppLanguage('pt-AO')).toBe('pt');
    expect(normalizeAppLanguage('pt-BANDA')).toBe('pt-banda');
    expect(normalizeAppLanguage('cjk')).toBe('cjk');
    expect(normalizeAppLanguage('unknown')).toBe('pt');
  });
});
