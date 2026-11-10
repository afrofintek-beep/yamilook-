import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test/test-utils';
import type { PostWithUser } from '@/hooks/usePosts';
import { EditPostSheet } from './EditPostSheet';

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ profile: null }) }));
const post = { id: 'post-1', content: 'Texto original', location: 'Talatona', privacy: 'everyone', media_urls: ['photo.jpg'] } as PostWithUser;
const onOpenChange = vi.fn();
const onSave = vi.fn();
const props = { open: true, post, onOpenChange, onSave };

beforeEach(() => {
  vi.clearAllMocks();
  onSave.mockResolvedValue(undefined);
});

describe('EditPostSheet', () => {
  it('clears a removed caption and location instead of omitting the update', async () => {
    render(<EditPostSheet {...props} />);
    fireEvent.change(screen.getByLabelText('Texto da publicação'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Adicionar local'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ content: '', location: '', privacy: 'everyone' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('keeps edits after a failed save and supports retry', async () => {
    onSave.mockRejectedValueOnce(new Error('offline'));
    render(<EditPostSheet {...props} />);
    fireEvent.change(screen.getByLabelText('Texto da publicação'), { target: { value: 'Texto alterado' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível guardar');
    expect(screen.getByLabelText('Texto da publicação')).toHaveValue('Texto alterado');
    expect(onOpenChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(onSave).toHaveBeenCalledTimes(2);
  });

  it('requires a deliberate discard after cancel or Escape', () => {
    render(<EditPostSheet {...props} />);
    fireEvent.change(screen.getByLabelText('Texto da publicação'), { target: { value: 'Ainda estou a escrever' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Descartar as alterações?');
    expect(onOpenChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Continuar a editar' }));
    expect(screen.getByLabelText('Texto da publicação')).toHaveValue('Ainda estou a escrever');
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Descartar' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('does not overwrite ongoing edits on a feed refresh, but refreshes when reopened', () => {
    const view = render(<EditPostSheet {...props} />);
    fireEvent.change(screen.getByLabelText('Texto da publicação'), { target: { value: 'Texto em curso' } });
    const freshPost = { ...post, content: 'Texto do servidor' };
    view.rerender(<EditPostSheet {...props} post={freshPost} />);
    expect(screen.getByLabelText('Texto da publicação')).toHaveValue('Texto em curso');
    view.rerender(<EditPostSheet {...props} post={freshPost} open={false} />);
    view.rerender(<EditPostSheet {...props} post={freshPost} />);
    expect(screen.getByLabelText('Texto da publicação')).toHaveValue('Texto do servidor');
  });

  it('prevents duplicate saves and closing during a pending save', async () => {
    let finish!: () => void;
    onSave.mockReturnValue(new Promise<void>(resolve => { finish = resolve; }));
    render(<EditPostSheet {...props} />);
    fireEvent.change(screen.getByLabelText('Texto da publicação'), { target: { value: 'Novo texto' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(screen.getByRole('button', { name: 'A guardar...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    expect(screen.getByLabelText('Texto da publicação')).toBeDisabled();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onOpenChange).not.toHaveBeenCalled();
    finish();
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('does not save an unchanged or empty text-only post', () => {
    render(<EditPostSheet {...props} post={{ ...post, media_urls: [] }} />);
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Texto da publicação'), { target: { value: '  ' } });
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(onSave).not.toHaveBeenCalled();
  });
});
