import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ViewOnceMediaBubble } from './ViewOnceMedia';
afterEach(cleanup);

it.each(['image','video'] as const)('does not let the sender consume or preview a sent %s', type => {
  const onView = vi.fn().mockResolvedValue(undefined);
  const { container, rerender } = render(<ViewOnceMediaBubble url="https://example.com/private" type={type} isOwn isViewed={false} onView={onView} />);
  fireEvent.click(screen.getByRole('status'));
  expect(onView).not.toHaveBeenCalled();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  expect(container.querySelector('img,video')).toBeNull();
  rerender(<ViewOnceMediaBubble url="https://example.com/private" type={type} isOwn isViewed onView={onView} />);
  expect(screen.getByRole('status')).toHaveTextContent('apenas para o destinatário');
  expect(screen.queryByText('Opened')).not.toBeInTheDocument();
});

it('lets the recipient request opening but prevents a second click', () => {
  const onView = vi.fn().mockResolvedValue(undefined);
  const { container } = render(<ViewOnceMediaBubble url="https://example.com/private" type="image" isViewed={false} onView={onView} />);
  const open = screen.getByRole('button');
  fireEvent.click(open);
  fireEvent.click(open);
  expect(onView).toHaveBeenCalledOnce();
});

it('does not offer opening for an already viewed recipient message', () => {
  const onView = vi.fn();
  render(<ViewOnceMediaBubble url="https://example.com/private" type="image" isViewed onView={onView} />);
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  expect(onView).not.toHaveBeenCalled();
});
