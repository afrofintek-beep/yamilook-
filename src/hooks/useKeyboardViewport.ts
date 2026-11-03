import { useLayoutEffect, useState, type CSSProperties } from 'react';

type ViewportStyle = CSSProperties & {
  '--group-viewport-height'?: string;
  '--group-viewport-bottom'?: string;
};

/** Dialog-local measurements, independent of which page opened the form. */
export function useKeyboardViewport(open: boolean) {
  const [viewport, setViewport] = useState({ height: 0, bottom: 0, compact: false });
  useLayoutEffect(() => {
    if (!open) return;
    const visual = window.visualViewport;
    let frame = 0;
    let revealFrame = 0;
    const update = () => {
      if (visual && Math.abs(visual.scale - 1) > 0.01) return;
      const height = visual?.height ?? window.innerHeight;
      const bottom = Math.max(0, window.innerHeight - height - (visual?.offsetTop ?? 0));
      const focused = document.activeElement;
      const editing = focused instanceof HTMLInputElement || focused instanceof HTMLTextAreaElement;
      setViewport({ height, bottom, compact: editing && (bottom > 100 || height < 600) });
      cancelAnimationFrame(revealFrame);
      revealFrame = requestAnimationFrame(() => {
        if (!editing || !(focused instanceof HTMLElement)) return;
        // Scroll the form only, preserving the page behind the dialog.
        let parent = focused.parentElement;
        while (parent && parent.getAttribute('role') !== 'dialog') {
          if (getComputedStyle(parent).overflowY === 'auto') {
            const field = focused.getBoundingClientRect();
            const area = parent.getBoundingClientRect();
            if (field.bottom > area.bottom - 16) parent.scrollTop += field.bottom - area.bottom + 16;
            else if (field.top < area.top + 16) parent.scrollTop -= area.top + 16 - field.top;
            break;
          }
          parent = parent.parentElement;
        }
      });
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    update();
    visual?.addEventListener('resize', schedule);
    visual?.addEventListener('scroll', schedule);
    window.addEventListener('resize', schedule);
    document.addEventListener('focusin', schedule);
    document.addEventListener('focusout', schedule);
    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(revealFrame);
      visual?.removeEventListener('resize', schedule);
      visual?.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      document.removeEventListener('focusin', schedule);
      document.removeEventListener('focusout', schedule);
    };
  }, [open]);
  const style: ViewportStyle | undefined = open && viewport.height ? {
    '--group-viewport-height': `${viewport.height}px`,
    '--group-viewport-bottom': `${viewport.bottom}px`,
  } : undefined;
  return { style, compact: open && viewport.compact };
}
