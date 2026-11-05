import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { changeAppLanguage } from '@/i18n';
import { WelcomeCarousel } from './WelcomeCarousel';
import collections from './welcome-collections.json';

beforeEach(async () => {
  vi.mocked(window.matchMedia).mockImplementation(query => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() } as unknown as MediaQueryList));
  await changeAppLanguage('ar'); vi.useFakeTimers();
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });
const selected = () => screen.getAllByRole('button').find(button => button.getAttribute('aria-pressed') === 'true')?.getAttribute('aria-label');

describe('welcome cultural carousel', () => {
  it.each([0, 1, 2, 3, 4])('starts at random position %i and advances every three seconds with wrapping', start => {
    vi.spyOn(Math, 'random').mockReturnValue((start + 0.1) / 5);
    render(<WelcomeCarousel />);
    expect(selected()).toBe(`${start + 1} / 5`);
    act(() => { vi.advanceTimersByTime(2999); });
    expect(selected()).toBe(`${start + 1} / 5`);
    act(() => { vi.advanceTimersByTime(1); });
    expect(selected()).toBe(`${(start + 1) % 5 + 1} / 5`);
    act(() => { vi.advanceTimersByTime(12000); });
    expect(selected()).toBe(`${start + 1} / 5`);
  });

  it('uses the approved Arabic order and the replacement Morocco photograph', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const { container } = render(<WelcomeCarousel />);
    const image = () => container.querySelector('img')!;
    expect(image()).toHaveAttribute('src', collections.ar.overrides[2]);
    const positions = [[1, '-100%', '0%'], [2, '-100%', '-100%'], [3, '0%', '-200%'], [4, '0%', '0%']] as const;
    for (const [i, left, top] of positions) {
      fireEvent.click(screen.getByRole('button', { name: `${i + 1} / 5` }));
      expect(image()).toHaveAttribute('src', collections.ar.src);
      expect(image().style.left).toBe(left);
      expect(image().style.top).toBe(top);
    }
  });

  it('pauses on selection, resumes explicitly and clears the timer on unmount', () => {
    const { unmount } = render(<WelcomeCarousel />);
    fireEvent.click(screen.getByRole('button', { name: '2 / 5' }));
    act(() => { vi.advanceTimersByTime(9000); });
    expect(selected()).toBe('2 / 5');
    fireEvent.click(screen.getByRole('button', { name: 'تشغيل العرض' }));
    act(() => { vi.advanceTimersByTime(3000); });
    expect(selected()).toBe('3 / 5');
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('starts paused for reduced motion', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() } as unknown as MediaQueryList);
    render(<WelcomeCarousel />);
    const initial = selected();
    act(() => { vi.advanceTimersByTime(9000); });
    expect(selected()).toBe(initial);
    expect(screen.getByRole('button', { name: 'تشغيل العرض' })).toBeInTheDocument();
  });

  it('suspends rotation in a hidden tab and restarts when visible', () => {
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    render(<WelcomeCarousel />);
    const initial = selected();
    hidden.mockReturnValue(true);
    fireEvent(document, new Event('visibilitychange'));
    act(() => { vi.advanceTimersByTime(9000); });
    expect(selected()).toBe(initial);
    hidden.mockReturnValue(false);
    fireEvent(document, new Event('visibilitychange'));
    act(() => { vi.advanceTimersByTime(3000); });
    expect(selected()).not.toBe(initial);
  });

  it('switches collections but keeps the same Portuguese photo when changing tone', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const { container } = render(<WelcomeCarousel />);
    await act(async () => { await changeAppLanguage('sn'); });
    expect(container.querySelector('img')).toHaveAttribute('src', collections.sn.src);
    await act(async () => { await changeAppLanguage('pt'); });
    fireEvent.click(screen.getByRole('button', { name: '4 / 5' }));
    await act(async () => { await changeAppLanguage('pt-banda'); });
    expect(selected()).toBe('4 / 5');
    expect(container.querySelector('img')).toHaveAttribute('src', collections.pt.src);
  });
});
