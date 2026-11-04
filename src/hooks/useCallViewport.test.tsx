import { useRef } from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { useCallViewport } from './useCallViewport';
const original = { width: window.innerWidth, height: window.innerHeight, visual: window.visualViewport };
function Harness() {
  const ref = useRef<HTMLDivElement>(null);
  const compact = useCallViewport(ref);
  return <div ref={ref} data-testid="viewport" data-compact={compact}><textarea aria-label="Mensagem" /></div>;
}
function dimensions(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
}
afterEach(() => { cleanup(); dimensions(original.width, original.height); Object.defineProperty(window, 'visualViewport', { configurable: true, value: original.visual }); });
it('handles Android layout-viewport resizing and restores after keyboard dismissal', () => {
  dimensions(390, 844);
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: undefined });
  render(<Harness />);
  act(() => { dimensions(390, 370); window.dispatchEvent(new Event('resize')); });
  expect(screen.getByTestId('viewport')).toHaveAttribute('data-compact', 'true');
  act(() => { dimensions(390, 844); window.dispatchEvent(new Event('resize')); });
  expect(screen.getByTestId('viewport')).toHaveAttribute('data-compact', 'false');
});
it('ignores pinch zoom and resets the height baseline on rotation', () => {
  dimensions(390, 844);
  const visual = Object.assign(new EventTarget(), { height: 844, offsetTop: 0, scale: 1 });
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: visual });
  render(<Harness />);
  act(() => { visual.scale = 2; visual.height = 400; visual.dispatchEvent(new Event('resize')); });
  expect(screen.getByTestId('viewport')).toHaveStyle({ height: '844px' });
  expect(screen.getByTestId('viewport')).toHaveAttribute('data-compact', 'false');
  act(() => { dimensions(844, 390); visual.scale = 1; visual.height = 390; visual.dispatchEvent(new Event('resize')); });
  expect(screen.getByTestId('viewport')).toHaveAttribute('data-compact', 'false');
  act(() => screen.getByRole('textbox').focus());
  expect(screen.getByTestId('viewport')).toHaveAttribute('data-compact', 'true');
});
