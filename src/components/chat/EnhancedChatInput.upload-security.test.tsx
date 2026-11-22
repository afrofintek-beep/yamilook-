import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { EnhancedChatInput } from './EnhancedChatInput';
import { assertUploadAllowed } from '@/lib/upload-safety';
import { changeAppLanguage } from '@/i18n';
import { uiText } from '@/i18n/ui-copy';

const { uploadMedia } = vi.hoisted(() => ({ uploadMedia: vi.fn() }));
vi.mock('@/hooks/useMediaUpload', () => ({
  useVoiceRecorder: () => ({ isRecording: false }),
  useMediaUpload: () => ({ uploading: false, uploadMedia }),
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('@/features/payment-point/WalletAccess', () => ({ useWalletAccess: () => ({ allowed: false }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: vi.fn() } }));
vi.mock('./StickerPicker', () => ({ StickerPicker: () => null }));
vi.mock('./GifPicker', () => ({ GifPicker: () => null }));
vi.mock('./EmojiPanel', () => ({ EmojiPanel: () => null }));
vi.mock('./ScheduleMessageSheet', () => ({ ScheduleMessageSheet: () => null }));

beforeEach(() => { uploadMedia.mockReset(); });
afterEach(async () => { cleanup(); await changeAppLanguage('pt'); });

function composer() {
  const onSend = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(<MemoryRouter><QueryClientProvider client={client}>
    <EnhancedChatInput onSend={onSend} onTyping={vi.fn()} conversationId="chat" />
  </QueryClientProvider></MemoryRouter>);
  const input = view.container.querySelector('input[type="file"]') as HTMLInputElement;
  return { input, onSend };
}

it.each(['pt', 'en', 'fr', 'ar', 'am', 'sw', 'ln', 'yo', 'sn', 'zu'])('shows the upload admission reason in %s without sending a message', async language => {
  await changeAppLanguage(language);
  uploadMedia.mockImplementation((file: File) => assertUploadAllowed(file, file.name, file.type));
  const { input, onSend } = composer();
  fireEvent.change(input, { target: { files: [new File(['<svg></svg>'], 'photo.svg', { type: 'image/svg+xml' })] } });
  const source = 'Este tipo de ficheiro não é permitido. Escolhe uma fotografia, vídeo, áudio ou documento compatível.';
  expect(await screen.findByRole('alert')).toHaveTextContent(uiText(source));
  if (language !== 'pt') expect(uiText(source)).not.toBe(source);
  expect(onSend).not.toHaveBeenCalled();
  expect(input).toHaveValue('');
});

it('does not expose a raw upload failure as an admission message', async () => {
  uploadMedia.mockRejectedValue(new Error('internal upload detail'));
  const { input, onSend } = composer();
  fireEvent.change(input, { target: { files: [new File(['fixture'], 'photo.jpg', { type: 'image/jpeg' })] } });
  const alert = await screen.findByRole('alert');
  expect(alert).toHaveTextContent('Ficheiro não enviado. Seleciona-o novamente para tentar de novo.');
  expect(alert).not.toHaveTextContent('internal upload detail');
  expect(onSend).not.toHaveBeenCalled();
});
