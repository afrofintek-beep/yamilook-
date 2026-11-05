import { useState } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
const { lookup } = vi.hoisted(() => ({ lookup: vi.fn().mockResolvedValue({ data: [{ id: '1', username: 'estella', display_name: 'Estella', avatar_url: null }], error: null }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: () => ({ select: () => ({ ilike: () => ({ order: () => ({ limit: lookup }) }) }) }) } }));
import { MentionInput } from './MentionInput';
describe('mention picker', () => {
 it('selects a suggestion without submitting the comment', async () => {
  const submit = vi.fn();
  function Harness() { const [value, setValue] = useState(''); return <MentionInput value={value} onValueChange={setValue} onSubmit={submit} />; }
  render(<Harness />);
  const input = screen.getByRole('combobox');
  fireEvent.change(input, { target: { value: 'Thanks @est', selectionStart: 11 } });
  await waitFor(() => expect(screen.getByRole('option')).toBeTruthy());
  fireEvent.keyDown(input, { key: 'Enter' });
  expect((input as HTMLInputElement).value).toBe('Thanks @estella ');
  expect(submit).not.toHaveBeenCalled();
 });
});
