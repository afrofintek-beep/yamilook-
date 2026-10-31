import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SwipeableConversationItem } from './SwipeableConversationItem';
import { ConversationItem } from './ConversationItem';

const conversation = { id: 'chat', type: 'group', name: 'Conversa da banda', avatar_url: null };
afterEach(() => { cleanup(); vi.useRealTimers(); });

function Harness({ selectMode = true, initialSelected = false, onSelect = vi.fn(), onOpen = vi.fn() }) {
  const [selection, setSelection] = useState(selectMode);
  const [selected, setSelected] = useState(initialSelected);
  return <SwipeableConversationItem
    conversation={conversation} currentUserId="me" isSelectionMode={selection} isSelected={selected}
    onClick={onOpen} onSelect={id => { onSelect(id); setSelected(value => !value); }}
    onEnterSelectionMode={() => { setSelection(true); setSelected(true); }}
  />;
}

describe('Papos touch and selection', () => {
  it('does not turn a touch on Arquivar into a conversation long press', () => {
    vi.useFakeTimers();
    const onArchive = vi.fn(), onEnterSelectionMode = vi.fn(), onOpen = vi.fn();
    render(<SwipeableConversationItem conversation={conversation} currentUserId="me"
      onClick={onOpen} onArchive={onArchive} onEnterSelectionMode={onEnterSelectionMode} />);
    const archive = screen.getByText('Arquivar').closest('button')!;
    fireEvent.touchStart(archive, { touches: [{ clientX: 400, clientY: 50 }] });
    act(() => { vi.advanceTimersByTime(550); });
    fireEvent.touchEnd(archive);
    fireEvent.click(archive);
    expect(onArchive).toHaveBeenCalledOnce();
    expect(onEnterSelectionMode).not.toHaveBeenCalled();
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('toggles once when the conversation is tapped, without opening it', () => {
    const onSelect = vi.fn(), onOpen = vi.fn();
    render(<Harness onSelect={onSelect} onOpen={onOpen} />);
    fireEvent.click(screen.getByRole('button', { name: /Conversa da banda/ }));
    expect(onSelect).toHaveBeenCalledExactlyOnceWith('chat');
    expect(screen.getByRole('checkbox')).toBeChecked();
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('toggles once when the checkbox is tapped', () => {
    const onSelect = vi.fn();
    render(<Harness initialSelected onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onSelect).toHaveBeenCalledExactlyOnceWith('chat');
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });

  it('keeps the long-pressed row selected when the finger is released', () => {
    vi.useFakeTimers();
    const onOpen = vi.fn(), onSelect = vi.fn();
    render(<Harness selectMode={false} onSelect={onSelect} onOpen={onOpen} />);
    fireEvent.touchStart(screen.getByRole('button', { name: /Conversa da banda/ }), { touches: [{ clientX: 50, clientY: 50 }] });
    act(() => { vi.advanceTimersByTime(550); });
    fireEvent.touchEnd(screen.getByRole('button', { name: /Conversa da banda/ }));
    fireEvent.click(screen.getByRole('button', { name: /Conversa da banda/ }));
    expect(screen.getByRole('checkbox')).toBeChecked();
    expect(onSelect).not.toHaveBeenCalled();
    expect(onOpen).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Conversa da banda/ }));
    expect(onSelect).toHaveBeenCalledOnce();
  });

  it('cancels the long press when the finger moves to scroll', () => {
    vi.useFakeTimers();
    render(<Harness selectMode={false} />);
    const row = screen.getByRole('button', { name: /Conversa da banda/ });
    fireEvent.touchStart(row, { touches: [{ clientX: 50, clientY: 50 }] });
    fireEvent.touchMove(row, { touches: [{ clientX: 50, clientY: 80 }] });
    act(() => { vi.advanceTimersByTime(550); });
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('keeps selection when a long-press release lands on the newly visible checkbox', () => {
    vi.useFakeTimers();
    const onSelect = vi.fn();
    render(<Harness selectMode={false} onSelect={onSelect} />);
    fireEvent.touchStart(screen.getByRole('button', { name: /Conversa da banda/ }), { touches: [{ clientX: 20, clientY: 50 }] });
    act(() => { vi.advanceTimersByTime(550); });
    fireEvent.click(screen.getByRole('checkbox'));
    expect(screen.getByRole('checkbox')).toBeChecked();
    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe('Papos attachment previews', () => {
  it.each([['video', 'Vídeo'], ['file', 'Documento'], ['voice', 'Mensagem de voz']])('labels a %s instead of showing a raw filename', (type, label) => {
    render(<ConversationItem conversation={{ ...conversation, last_message: {
      content: 'a_very_long_uploaded_filename.mp4', message_type: type, sender_id: 'other', created_at: '2026-10-23T12:00:00Z',
    } }} currentUserId="me" onClick={vi.fn()} />);
    expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.queryByText('a_very_long_uploaded_filename.mp4')).not.toBeInTheDocument();
  });

  it('does not expose deleted text in the conversation preview', () => {
    render(<ConversationItem conversation={{ ...conversation, last_message: {
      content: 'deleted content', message_type: 'text', sender_id: 'other', created_at: '2026-10-23T12:00:00Z', is_deleted: true,
    } }} currentUserId="me" onClick={vi.fn()} />);
    expect(screen.getByText('Mensagem eliminada')).toBeInTheDocument();
    expect(screen.queryByText('deleted content')).not.toBeInTheDocument();
  });
});
