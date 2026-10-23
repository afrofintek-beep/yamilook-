import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
