import { useState } from 'react';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { changeAppLanguage } from '@/i18n';
import { EMOJI_GROUPS, applyTone, DEFAULT_TONE } from '@/lib/african-emojis';
import { EmojiInput, EmojiTextarea } from './EmojiTextField';

const toneKey = 'yamilook-emoji-tone';
beforeEach(async () => {
  let savedTone: string | null = null;
  vi.mocked(localStorage.getItem).mockImplementation(key => key === toneKey ? savedTone : null);
  vi.mocked(localStorage.setItem).mockImplementation((key, value) => {
    if (key === toneKey) savedTone = value;
  });
  await changeAppLanguage('pt');
});
afterEach(async () => {
  cleanup();
  vi.mocked(localStorage.getItem).mockReset();
  vi.mocked(localStorage.setItem).mockReset();
  await new Promise(resolve => setTimeout(resolve, 0));
});

it('exposes every KOSOLOLA category and does not submit when choosing an emoji', async () => {
  const user = userEvent.setup();
  const submit = vi.fn(event => event.preventDefault());
  function Composer() {
    const [value, setValue] = useState('');
    return <form onSubmit={submit}>
      <EmojiInput aria-label="Mensagem" value={value} onValueChange={setValue} />
      <button type="submit">Enviar</button>
    </form>;
  }
  render(<Composer />);
  await user.click(screen.getByRole('button', { name: 'Emojis' }));
  const panel = within(screen.getByRole('dialog'));
  for (const group of EMOJI_GROUPS) {
    const category = panel.getByRole('button', { name: group.label, exact: true });
    await user.click(category);
    expect(category).toHaveAttribute('aria-pressed', 'true');
    expect(panel.getAllByRole('button', { name: `Emoji ${applyTone(group.emojis[0], DEFAULT_TONE)}`, exact: true }).length).toBeGreaterThan(0);
  }
  await user.click(panel.getByRole('button', { name: 'Emoji 😀', exact: true }));
  expect(screen.getByRole('textbox', { name: 'Mensagem' })).toHaveValue('😀');
  expect(submit).not.toHaveBeenCalled();
});

it('shares the selected skin tone across fields and replaces a selection without losing the cursor', async () => {
  const user = userEvent.setup();
  function Composers() {
    const [chat, setChat] = useState('');
    const [comment, setComment] = useState('Olá, mundo!');
    return <>
      <EmojiInput aria-label="Mensagem" value={chat} onValueChange={setChat} />
      <EmojiTextarea aria-label="Comentário" value={comment} onValueChange={setComment} />
    </>;
  }
  render(<Composers />);
  const [chatPicker, commentPicker] = screen.getAllByRole('button', { name: 'Emojis' });
  await user.click(chatPicker);
  await user.click(screen.getByRole('button', { name: 'Tom de pele: Clara' }));
  await user.click(screen.getByRole('button', { name: 'Emoji 🤝🏻' }));
  expect(screen.getByRole('textbox', { name: 'Mensagem' })).toHaveValue('🤝🏻');

  const comment = screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Comentário' });
  comment.focus();
  comment.setSelectionRange(5, 10);
  await user.click(commentPicker);
  await user.click(screen.getByRole('button', { name: 'Emoji 🤝🏻' }));
  expect(comment).toHaveValue('Olá, 🤝🏻!');
  await waitFor(() => expect(comment.selectionStart).toBe(9));
  expect(comment).toHaveFocus();
});

it('never splits an emoji across the field length limit', async () => {
  const user = userEvent.setup();
  const changed = vi.fn();
  render(<EmojiInput aria-label="Mensagem" maxLength={4} value="abc" onValueChange={changed} />);
  await user.click(screen.getByRole('button', { name: 'Emojis' }));
  await user.click(screen.getByRole('button', { name: 'Emoji 💛' }));
  expect(changed).not.toHaveBeenCalled();
  expect(screen.getByRole('textbox')).toHaveValue('abc');
});
