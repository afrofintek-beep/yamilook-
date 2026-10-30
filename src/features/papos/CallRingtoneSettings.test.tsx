import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import CallRingtoneSettings from './CallRingtoneSettings';
const { save, play, stop, state } = vi.hoisted(() => ({ save: vi.fn(), play: vi.fn(), stop: vi.fn(), state: { settings: { ringtone_enabled: true, ringtone_volume: 0.5, ringtone_pattern: 'default' } } }));
vi.mock('@/hooks/useSettings', () => ({ useSettings: () => ({ ...state, loading: false, updateSettings: save }) }));
vi.mock('@/hooks/useRingtone', () => ({ useRingtonePreview: () => ({ playPreview: play, stopRingtone: stop }) }));
beforeEach(() => { vi.clearAllMocks(); save.mockResolvedValue({ error: null }); state.settings.ringtone_pattern = 'default'; });
afterEach(cleanup);
it('offers five audible tones and lets the user save and test a choice', async () => {
  render(<CallRingtoneSettings />);
  expect(screen.getAllByRole('option')).toHaveLength(6);
  fireEvent.change(screen.getByLabelText('Escolher toque'), { target: { value: 'modern' } });
  await waitFor(() => expect(save).toHaveBeenCalledWith({ ringtone_pattern: 'modern' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Testar toque' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Testar toque' }));
  expect(play).toHaveBeenCalledWith(3000);
  fireEvent.click(screen.getByRole('button', { name: 'Parar teste' }));
  expect(stop).toHaveBeenCalled();
});
it('explains silence and disables the preview when silent is selected', () => {
  state.settings.ringtone_pattern = 'silent'; render(<CallRingtoneSettings />);
  expect(screen.getByRole('status')).toHaveTextContent('O toque está silencioso.');
  expect(screen.getByRole('button', { name: 'Testar toque' })).toBeDisabled();
});
it('shows a save failure', async () => {
  save.mockResolvedValue({ error: new Error('offline') }); render(<CallRingtoneSettings />);
  fireEvent.change(screen.getByLabelText('Escolher toque'), { target: { value: 'gentle' } });
  expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível guardar');
});
