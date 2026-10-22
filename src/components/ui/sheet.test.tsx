import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from './sheet';
afterEach(cleanup);
describe('shared panel dismissal', () => {
  it('dismisses a panel with its accessible close control', () => {
    const close = vi.fn();
    render(<Sheet open onOpenChange={close}><SheetContent><SheetTitle>Definições</SheetTitle><SheetDescription>Painel</SheetDescription></SheetContent></Sheet>);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(close).toHaveBeenCalledWith(false);
  });
  it('preserves custom close controls when the default is hidden', () => {
    render(<Sheet open><SheetContent hideCloseButton><SheetTitle>Convites</SheetTitle><SheetDescription>Painel</SheetDescription></SheetContent></Sheet>);
    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
  });
});
