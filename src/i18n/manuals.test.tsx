import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { changeAppLanguage } from './index';
import UserAccountsManualPrint from '@/pages/UserAccountsManualPrint';
import PresentationPrint from '@/pages/PresentationPrint';
import DocumentControls from '@/components/DocumentControls';

const dictionaries = import.meta.glob('./manuals/*.json', { eager: true, import: 'default' }) as Record<string, Record<string, string>>;
const languages = ['pt', 'en', 'fr', 'ar', 'am', 'sw', 'ln', 'yo', 'sn', 'zu'];
afterEach(async () => { cleanup(); vi.restoreAllMocks(); window.history.replaceState(null, '', '/'); await changeAppLanguage('pt'); });

it('changes all manual pages and the presentation while preserving technical identifiers', async () => {
  await changeAppLanguage('pt');
  const view = render(<MemoryRouter><UserAccountsManualPrint /></MemoryRouter>);
  await waitFor(() => expect(screen.getByRole('button')).toBeEnabled());
  const fields = [...view.container.querySelectorAll('code')].map(node => node.textContent);
  expect(fields).toContain('display_name');
  for (const language of languages) {
    fireEvent.change(screen.getByRole('combobox'), { target: { value: language } });
    await waitFor(() => expect(screen.getByRole('button')).toBeEnabled());
    const copy = dictionaries[`./manuals/${language}.json`];
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(copy['Manual de Contas']);
    expect(screen.getByText(copy['Confidencial — Apenas para equipa YamiLook'])).toBeInTheDocument();
    expect(view.container.querySelectorAll('.print-page')).toHaveLength(12);
    expect([...view.container.querySelectorAll('code')].map(node => node.textContent)).toEqual(fields);
    expect(document.documentElement.dir).toBe(language === 'ar' ? 'rtl' : 'ltr');
    expect(new URL(window.location.href).searchParams.get('lang')).toBe(language);
  }
  cleanup();
  window.history.replaceState(null, '', '/?lang=ar');
  const presentation = render(<MemoryRouter><PresentationPrint /></MemoryRouter>);
  await waitFor(() => expect(screen.getByRole('button')).toBeEnabled());
  expect(presentation.container.querySelectorAll('.print-slide')).toHaveLength(16);
  expect(screen.getByText(dictionaries['./manuals/ar.json']['10 línguas disponíveis na aplicação.'])).toBeInTheDocument();
  await act(async () => { await changeAppLanguage('en'); });
  expect(screen.getByText(dictionaries['./manuals/en.json']['10 línguas disponíveis na aplicação.'])).toBeInTheDocument();
});

it('waits for fonts and the selected language before printing', async () => {
  window.history.replaceState(null, '', '/?lang=ar');
  let loaded!: () => void;
  const previous = Object.getOwnPropertyDescriptor(document, 'fonts');
  Object.defineProperty(document, 'fonts', { configurable: true, value: { ready: new Promise<void>(resolve => { loaded = resolve; }) } });
  const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
  try {
    render(<DocumentControls title="Yamilook" />);
    await waitFor(() => expect(screen.getByRole('button')).toBeEnabled());
    expect(document.documentElement.lang).toBe('ar');
    fireEvent.click(screen.getByRole('button'));
    expect(print).not.toHaveBeenCalled();
    await act(async () => { loaded(); });
    expect(print).toHaveBeenCalledOnce();
  } finally {
    if (previous) Object.defineProperty(document, 'fonts', previous);
    else Reflect.deleteProperty(document, 'fonts');
  }
});
