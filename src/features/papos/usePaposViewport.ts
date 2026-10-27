import { useLayoutEffect } from 'react';

/** Track the visible keyboard viewport without resizing the UI during pinch zoom. */
export function usePaposViewport() {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const viewport = window.visualViewport;
    let frame = 0;
    const update = () => {
      if (viewport && Math.abs(viewport.scale - 1) > 0.01) return;
      const height = viewport?.height ?? window.innerHeight;
      const top = viewport?.offsetTop ?? 0;
      root.style.setProperty('--kosolola-height', `${height}px`);
      root.style.setProperty('--kosolola-top', `${top}px`);
      root.style.setProperty('--kosolola-bottom', `${Math.max(0, window.innerHeight - height - top)}px`);
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    update();
    viewport?.addEventListener('resize', schedule);
    viewport?.addEventListener('scroll', schedule);
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(frame);
      viewport?.removeEventListener('resize', schedule);
      viewport?.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      ['height', 'top', 'bottom'].forEach(key => root.style.removeProperty(`--kosolola-${key}`));
    };
  }, []);
}
