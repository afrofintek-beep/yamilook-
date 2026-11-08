import { useEffect, useState } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import i18n, { changeAppLanguage } from './index';
import { uiText, useUiLocale } from './ui-copy';
import { format, formatDistanceToNow } from './ui-date';
import { Calendar } from '@/components/ui/calendar';
import { ACADEMIA_COPY } from '@/features/academia/copy';
import { invitationMessage } from '@/lib/invite-delivery';

const languages = ['pt', 'en', 'fr', 'ar', 'am', 'sw', 'ln', 'yo', 'sn', 'zu'];
const dictionaries = import.meta.glob('./interface/*.json', { eager: true, import: 'default' }) as Record<string, Record<string, string>>;
const adminDictionaries = import.meta.glob('./admin-interface/*.json', { eager: true, import: 'default' }) as Record<string, Record<string, string>>;
const locales = import.meta.glob('./locales/*.json', { eager: true, import: 'default' }) as Record<string, Record<string, unknown>>;
const variables = (text: string) => [...text.matchAll(/{{\s*([^}]+)\s*}}/g)].map(m => m[1].trim()).sort();
function flatten(value: Record<string, unknown>, prefix = ''): Record<string, string> {
  return Object.fromEntries(Object.entries(value).flatMap(([key, v]) => typeof v === 'object' && v !== null
    ? Object.entries(flatten(v as Record<string, unknown>, `${prefix}${key}.`)) : [[prefix + key, String(v)]]));
}
afterEach(async () => { cleanup(); await changeAppLanguage('pt'); });

describe('complete interface dictionaries', () => {
  for (const language of languages) it(`covers copy, variables and existing keys in ${language}`, () => {
    const base = { ...dictionaries['./interface/pt.json'], ...adminDictionaries['./admin-interface/pt.json'] };
    const translated = { ...dictionaries[`./interface/${language}.json`], ...adminDictionaries[`./admin-interface/${language}.json`] };
    expect(Object.keys(translated).sort()).toEqual(Object.keys(base).sort());
    for (const [source, text] of Object.entries(translated)) {
      expect(text.trim(), source).not.toBe('');
      expect(variables(text), source).toEqual(variables(source));
      expect(text, source).not.toMatch(/ZXQ\d|QXZ|\[UI\d/);
    }
    const local = flatten(locales[`./locales/${language}.json`]);
    for (const [key, source] of Object.entries(flatten(locales['./locales/pt.json']))) {
      expect(local[key]?.trim(), key).toBeTruthy();
      expect(variables(local[key]), key).toEqual(variables(source));
    }
  });
});

it('changes labels and direction without remounting or erasing a typed form', async () => {
  let mounts = 0;
  function Form() {
    useUiLocale();
    const [value, setValue] = useState('');
    useEffect(() => { mounts++; }, []);
    return <><label>{uiText('Criar grupo')}<input aria-label="draft" value={value} onChange={e => setValue(e.target.value)} /></label><p>{ACADEMIA_COPY.createSession}</p></>;
  }
  await changeAppLanguage('pt'); render(<Form />);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Equipa António — فريق' } });
  for (const language of ['en', 'ar', 'am', 'pt']) {
    await act(async () => { await changeAppLanguage(language); });
    expect(screen.getByRole('textbox')).toHaveValue('Equipa António — فريق');
    expect(screen.getByText(dictionaries[`./interface/${language}.json`]['Criar sessão'])).toBeInTheDocument();
    expect(document.documentElement.dir).toBe(language === 'ar' ? 'rtl' : 'ltr');
  }
  expect(mounts).toBe(1);
});

it('keeps invitation recipients, brands, codes and destination language intact', async () => {
  for (const language of languages) {
    await changeAppLanguage(language);
    const message = invitationMessage('antonio+teste@example.com', 'ABCDEF0123456789', 'KOSOLOLA');
    expect(message).toContain('antonio+teste@example.com');
    expect(message).toContain('KOSOLOLA');
    expect(message).toContain('https://www.yamilook.com/register?ref=ABCDEF0123456789&lang=' + language);
    expect(message).not.toContain('{{');
  }
});

it('uses the selected locale for dates and real words for relative time', async () => {
  const date = new Date(2026, 10, 8, 12, 30);
  for (const language of languages) {
    await changeAppLanguage(language);
    expect(format(date, 'd MMMM yyyy')).toBe(new Intl.DateTimeFormat(language, { day: 'numeric', month: 'long', year: 'numeric' }).format(date));
    expect(formatDistanceToNow(Date.now() - 120000, { addSuffix: true })).not.toMatch(/^-2\s*min$/);
    expect(format(date, "yyyy-MM-dd'T'HH:mm")).toBe('2026-11-08T12:30');
  }
  expect(i18n.language).toBe('zu');
});

it('localizes the actual calendar caption and navigation in every language', async () => {
  const month = new Date(2026, 10, 8);
  for (const language of languages) {
    await changeAppLanguage(language);
    const view = render(<Calendar month={month} />);
    expect(screen.getByText(new Intl.DateTimeFormat(language, { month: 'long', year: 'numeric' }).format(month))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: uiText('Mês seguinte') })).toBeInTheDocument();
    view.unmount();
  }
});
