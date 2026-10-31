import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { Sheet, SheetContent, SheetTitle } from './sheet';
import { Dialog, DialogContent, DialogTitle } from './dialog';
afterEach(cleanup);
it.each(['bottom','right'] as const)('reserves a close row before sheet content on the %s side', side=>{
  const close=vi.fn();
  render(<Sheet open onOpenChange={close}><SheetContent side={side} aria-describedby={undefined}><SheetTitle>Título comprido da janela</SheetTitle><p>Conteúdo</p></SheetContent></Sheet>);
  const button=screen.getByRole('button',{name:'Close'});
  expect(button).toHaveTextContent('Fechar');
  expect(button.className).not.toContain('absolute');
  const bar=button.closest('[data-modal-close-bar]')!;
  expect(bar.compareDocumentPosition(screen.getByText('Título comprido da janela')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  fireEvent.click(button);expect(close).toHaveBeenCalledWith(false);
});
it('reserves a close row in dialogs and preserves custom-close opt out',()=>{
  const close=vi.fn();
  const {unmount}=render(<Dialog open onOpenChange={close}><DialogContent aria-describedby={undefined}><DialogTitle>Janela</DialogTitle></DialogContent></Dialog>);
  const button=screen.getByRole('button',{name:'Close'});
  expect(button.closest('[data-modal-close-bar]')).not.toBeNull();
  fireEvent.click(button);expect(close).toHaveBeenCalledWith(false);
  unmount();
  render(<Dialog open><DialogContent hideCloseButton aria-describedby={undefined}><DialogTitle>Leitor com fecho próprio</DialogTitle></DialogContent></Dialog>);
  expect(screen.queryByRole('button',{name:'Close'})).not.toBeInTheDocument();
});
