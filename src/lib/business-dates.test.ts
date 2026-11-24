import { afterEach, expect, it } from 'vitest';
import { readEntry, saveEntry, clearEntry } from './business-entry';
import { validStartYear } from './business-dates';

afterEach(clearEntry);

it('accepts this year and past years and rejects incomplete or future years', () => {
  const current = new Date().getFullYear();
  expect(validStartYear(String(current))).toBe(true);
  expect(validStartYear('1980')).toBe(true);
  for (const value of ['', '20', 'abcd', String(current + 1)]) expect(validStartYear(value)).toBe(false);
});

it('retains the business date choice across owner registration', () => {
  saveEntry('Quitanda', 'Comércio', 'luanda', '2021', false);
  expect(readEntry()).toMatchObject({ year: '2021', planned: false });
  saveEntry('Quitanda', 'Comércio', 'luanda', '', true);
  expect(readEntry()).toMatchObject({ year: '', planned: true });
});

it('keeps a legacy draft without inferring a start date or planned status', () => {
  sessionStorage.setItem('yl-business-entry-v1', JSON.stringify({ name: 'Quitanda' }));
  expect(readEntry()).toMatchObject({ name: 'Quitanda', year: '', planned: false });
});
