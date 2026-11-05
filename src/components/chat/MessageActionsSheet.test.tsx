import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { changeAppLanguage } from '@/i18n';
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

beforeEach(async () => { await changeAppLanguage('pt'); });
afterEach(async () => { cleanup(); vi.restoreAllMocks(); await changeAppLanguage('pt'); });

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
    expect(screen.getByText(/Amor com memória e respeito/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Ubuntu: Solidariedade e humanidade/ }));
    await waitFor(() => expect(props.onReact).toHaveBeenCalledWith('ubuntu'));
  });

  it('follows the selected language in both descriptions and accessible reaction labels', async () => {
    const props = makeProps();
    const view = render(<MessageActionsSheet {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'O que significam?' }));
    expect(screen.getByText(/Indignação justa perante a injustiça/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Eish: Cansaço sincero/ })).toBeInTheDocument();

    await changeAppLanguage('en');
    await waitFor(() => expect(screen.getByText(/Justified anger and moral indignation/)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /Eish: Honest exhaustion/ })).toBeInTheDocument();

    await changeAppLanguage('fr');
    await waitFor(() => expect(screen.getByText(/Une colère justifiée/)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /Ubuntu: La solidarité/ })).toBeInTheDocument();
    view.unmount();
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

it.each([null, 'chat-attachment://voice.webm'])('shows the same compact voice summary with or without a media URL (%s)', mediaUrl => {
  render(<MessageActionsSheet {...makeProps({ messageType: 'voice', messageContent: 'recording.webm', mediaUrl,
    durationSeconds: 77, senderName: 'Ana', isOwn: false })} />);
  expect(screen.getByText('Ana')).toBeInTheDocument();
  expect(screen.getByText('Mensagem de voz')).toBeInTheDocument();
  expect(screen.getByText('1:17')).toBeInTheDocument();
  expect(screen.queryByText('recording.webm')).not.toBeInTheDocument();
  expect(document.querySelector('.lucide-mic')).toBeInTheDocument();
});

it('offers personal deletion for received messages, with confirmation and cancellation', async () => {
  const onDeleteForMe = vi.fn();
  const onDelete = vi.fn();
  const props = makeProps({ isOwn: false, onDeleteForMe, onDelete });
  render(<MessageActionsSheet {...props} />);
  fireEvent.click(screen.getByRole('button', { name: 'Apagar mensagem' }));
  expect(onDeleteForMe).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: 'Apagar para todos' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
  expect(onDeleteForMe).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Apagar mensagem' }));
  fireEvent.click(screen.getByRole('button', { name: 'Apagar só para mim' }));
  await waitFor(() => expect(onDeleteForMe).toHaveBeenCalledOnce());
  expect(onDelete).not.toHaveBeenCalled();
});

it('offers both deletion scopes for own messages and keeps failed deletions open', async () => {
  const props = makeProps({ onDeleteForMe: vi.fn(), onDelete: vi.fn().mockRejectedValue(new Error('denied')) });
  render(<MessageActionsSheet {...props} />);
  fireEvent.click(screen.getByRole('button', { name: 'Apagar mensagem' }));
  expect(screen.getByRole('button', { name: 'Apagar só para mim' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Apagar para todos' }));
  await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  expect(props.onOpenChange).not.toHaveBeenCalledWith(false);
});
