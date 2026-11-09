import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { changeAppLanguage } from '@/i18n';
import { EnhancedMessageBubble, type BubbleMessage } from './EnhancedMessageBubble';

vi.mock('@/integrations/supabase/client', () => ({ supabase: { storage: { from: vi.fn() } } }));
beforeEach(() => { vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {}); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const message: BubbleMessage = {
  id: 'video', content: 'clip.mov', message_type: 'video', media_url: 'https://example.com/123_clip.mov',
  thumbnail_url: 'https://example.com/poster.jpg', duration_seconds: 17,
  is_deleted: false, is_edited: false, created_at: '2026-10-23T22:30:00Z', sender_id: 'me', reply_to_id: null,
};

function mount(extra = {}) {
  return render(<MemoryRouter><EnhancedMessageBubble message={message} reactions={[]} isOwn isStarred={false}
    isPinned={false} currentUserId="me" {...extra} /></MemoryRouter>);
}

describe('uploaded videos in the actual chat bubble', () => {
  it('shows a cover and duration instead of a technical filename, then opens the original video', () => {
    mount();
    expect(screen.queryByText('clip.mov')).not.toBeInTheDocument();
    expect(screen.getByText('0:17')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reproduzir vídeo' }));
    expect(screen.getByLabelText('Vídeo da conversa')).toHaveAttribute('src', message.media_url);
    expect(screen.getByLabelText('Vídeo da conversa')).toHaveAttribute('controls');
    fireEvent.click(screen.getByRole('button', { name: 'Fechar pré-visualização' }));
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
  });

  it('keeps genuine user captions', () => {
    mount({ message: { ...message, content: 'O nosso passeio' } });
    expect(screen.getByText('O nosso passeio')).toBeInTheDocument();
  });

  it('selects a message without opening its video when selection mode is active', () => {
    const onToggleSelect = vi.fn();
    mount({ selectionMode: true, onToggleSelect });
    fireEvent.click(screen.getByRole('button', { name: 'Reproduzir vídeo' }));
    expect(onToggleSelect).toHaveBeenCalledOnce();
    expect(screen.queryByLabelText('Vídeo da conversa')).not.toBeInTheDocument();
  });
});

it('uses 24-hour timestamps in Portuguese and highlights the message whose actions are open', async () => {
  await changeAppLanguage('pt');
  const localTime = new Date(2026, 10, 5, 15, 38).toISOString();
  mount({ message: { ...message, created_at: localTime } });
  expect(screen.getByText('15:38')).toBeInTheDocument();
  const bubble = screen.getByText('15:38').closest('.group')!;
  fireEvent.contextMenu(bubble);
  expect(bubble).toHaveClass('ring-primary/60');
  expect(screen.getByRole('button', { name: 'Marcar como favorita' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Fechar ações' }));
  expect(bubble).not.toHaveClass('ring-primary/60');
});

it('renders the AFROLOC destination in a text message and respects selection mode', () => {
  const addressMessage = { ...message, message_type: 'text', content: 'Loja\n📍 https://www.njilamaps.com/?to=AO-example' };
  const view = mount({ message: addressMessage });
  expect(screen.getByRole('link', { name: 'Abrir no NJILA' })).toHaveAttribute('href', 'https://www.njilamaps.com/?to=AO-example');
  view.unmount();
  const onToggleSelect = vi.fn();
  mount({ message: addressMessage, selectionMode: true, onToggleSelect });
  expect(screen.queryByRole('link', { name: 'Abrir no NJILA' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByText('Loja'));
  expect(onToggleSelect).toHaveBeenCalledOnce();
});
