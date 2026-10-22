import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InviteSheet } from './InviteSheet';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
const show = (code: string | null = 'ABC123') => render(<InviteSheet open onOpenChange={() => {}} referralCode={code} />);

describe('InviteSheet recovery', () => {
  it('keeps the code and link selectable when clipboard access fails', async () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
    show();
    fireEvent.click(screen.getByRole('button', { name: 'Copiar código' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('copia manualmente'));
    expect(screen.getByLabelText('O teu código de convite')).toHaveValue('ABC123');
    expect(screen.getByLabelText('Link de convite')).toHaveValue(`${window.location.origin}/register?ref=ABC123`);
  });

  it('supports share implementations without canShare and handles cancellation', async () => {
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: undefined });
    const share = vi.fn().mockRejectedValue(new DOMException('cancelled', 'AbortError'));
    Object.defineProperty(navigator, 'share', { configurable: true, value: share });
    show();
    fireEvent.click(screen.getByRole('button', { name: 'Enviar convite' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Partilha cancelada'));
    expect(share).toHaveBeenCalledOnce();
    expect(screen.getByLabelText('O teu código de convite')).toHaveValue('ABC123');
  });

  it('does not offer a registration link without a valid personal code', () => {
    show(null);
    expect(screen.getByRole('alert')).toHaveTextContent('ainda não está disponível');
    expect(screen.queryByRole('button', { name: 'Enviar convite' })).not.toBeInTheDocument();
  });
});
