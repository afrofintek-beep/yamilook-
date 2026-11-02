import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MessageActionsSheet } from './MessageActionsSheet';

vi.mock('@/components/ui/responsive-modal', () => ({
  ResponsiveModal: ({ open, children }: { open: boolean; children: ReactNode }) =>
    open ? <div role="dialog">{children}</div> : null,
}));
vi.mock('./MediaPreview', () => ({
  useResolvedMediaUrl: (url: string) => ({
    resolvedUrl: url,
    error: false,
    onError: vi.fn(),
  }),
}));

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function makeProps(overrides: Record<string, unknown> = {}) {
  return {
    open: true,
    onOpenChange: vi.fn(),
    messageType: 'text',
    messageContent: 'Olá',
    isOwn: true,
    isStarred: false,
    isPinned: false,
    onReply: vi.fn(),
    onCopy: vi.fn(),
    onReact: vi.fn(),
    onStar: vi.fn(),
    onPin: vi.fn(),
    onHighlight: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('KOSOLOLA compact message actions', () => {
  it('shows cultural reactions in a compact row and explains their meaning on demand', async () => {
    const props = makeProps();
    render(<MessageActionsSheet {...props} />);
    expect(screen.getByRole('group', { name: 'Reações africanas' }).querySelectorAll('button')).toHaveLength(5);
    fireEvent.click(screen.getByRole('button', { name: 'O que significam?' }));
    expect(screen.getByText(/Love with memory and respect/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Ubuntu: Solidarity/ }));
    await waitFor(() => expect(props.onReact).toHaveBeenCalledWith('ubuntu'));
  });

  it('displays a private-safe attachment summary rather than a generated filename', () => {
    const props = makeProps({
      messageType: 'image',
      mediaUrl: 'https://example.org/123_IMG_6448.png',
      messageContent: 'IMG_6448.png',
    });
    render(<MessageActionsSheet {...props} />);
    expect(screen.getByAltText('Miniatura da fotografia')).toHaveAttribute('src', props.mediaUrl);
    expect(screen.getByText('Fotografia')).toBeInTheDocument();
    expect(screen.queryByText('IMG_6448.png')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Copiar' })).not.toBeInTheDocument();
  });

  it('does not request or reveal a view-once photo in its preview', () => {
    const props = makeProps({
      messageType: 'image',
      mediaUrl: 'https://example.org/secret.png',
      messageContent: 'secret.png',
      isViewOnce: true,
    });
    render(<MessageActionsSheet {...props} />);
    expect(screen.getByText('Conteúdo de visualização única')).toBeInTheDocument();
    expect(screen.queryByAltText('Miniatura da fotografia')).not.toBeInTheDocument();
  });

  it('saves the selected color and a suggested label with visible selection', async () => {
    const props = makeProps();
    render(<MessageActionsSheet {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /Destaque com cor e etiqueta/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Cor green' }));
    expect(screen.getByRole('button', { name: 'Cor green' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Trabalho' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar destaque' }));
    await waitFor(() => expect(props.onHighlight).toHaveBeenCalledWith('green', 'Trabalho'));
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  it('keeps the menu open and alerts the user if saving fails', async () => {
    const props = makeProps({ onHighlight: vi.fn().mockRejectedValue(new Error('offline')) });
    render(<MessageActionsSheet {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /Destaque com cor e etiqueta/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Cor blue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar destaque' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Tenta novamente'));
    expect(props.onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
