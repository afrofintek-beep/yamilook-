import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { changeAppLanguage } from '@/i18n';
import ResumeRegistration from './ResumeRegistration';

const { signInWithOtp } = vi.hoisted(() => ({ signInWithOtp: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: { signInWithOtp } } }));

afterEach(async () => {
  cleanup();
  signInWithOtp.mockReset();
  await changeAppLanguage('pt');
});

it('requests the resume email in the language chosen on the form', async () => {
  await changeAppLanguage('pt');
  signInWithOtp.mockResolvedValueOnce({ error: null });
  render(<MemoryRouter><ResumeRegistration /></MemoryRouter>);
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'ln' } });
  const submit = await screen.findByRole('button', { name: 'Kokoba komikomisa na ngai' });
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'test@example.com' } });
  fireEvent.click(submit);
  await waitFor(() => expect(signInWithOtp).toHaveBeenCalledWith({
    email: 'test@example.com',
    options: { shouldCreateUser: false, emailRedirectTo: 'https://www.yamilook.com/?lang=ln' },
  }));
});
