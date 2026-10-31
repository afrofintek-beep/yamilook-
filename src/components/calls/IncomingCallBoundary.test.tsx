import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { IncomingCallBoundary } from './IncomingCallBoundary';
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn() } }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); sessionStorage.clear(); });
function Broken(): never { throw new Error('presentation failure'); }
it('keeps answering and declining available without replacing the rest of the app', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const answer=vi.fn(), decline=vi.fn();
  render(<><p>Histórico</p><IncomingCallBoundary onAnswer={answer} onDecline={decline}><Broken /></IncomingCallBoundary></>);
  expect(screen.getByText('Histórico')).toBeVisible();
  fireEvent.click(screen.getByRole('button',{name:'Atender'}));expect(answer).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button',{name:'Recusar'}));expect(decline).toHaveBeenCalledOnce();
});
it('resets the presentation for a different incoming call', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const props={onAnswer:vi.fn(),onDecline:vi.fn()};
  const view=render(<IncomingCallBoundary key="first" {...props}><Broken /></IncomingCallBoundary>);
  view.rerender(<IncomingCallBoundary key="second" {...props}><p>Nova chamada</p></IncomingCallBoundary>);
  expect(screen.getByText('Nova chamada')).toBeVisible();
  expect(screen.queryByText('Pode atender ou recusar a chamada.')).not.toBeInTheDocument();
});

it('exposes a current diagnostic while keeping the incoming call actionable', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const { container } = render(<IncomingCallBoundary onAnswer={vi.fn()} onDecline={vi.fn()}><Broken /></IncomingCallBoundary>);
  expect(container.querySelector('pre')).toHaveTextContent('render-exception');
  expect(sessionStorage.getItem('kosolola-render-diagnostic-v1')).toContain('render-exception');
});
