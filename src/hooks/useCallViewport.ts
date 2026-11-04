import { useLayoutEffect, useState, type RefObject } from 'react';

/** Fit the call to the visible viewport without remounting its media. */
export function useCallViewport(rootRef: RefObject<HTMLDivElement>) {
  const [compact, setCompact] = useState(false);

  useLayoutEffect(() => {
    const visual = window.visualViewport;
    let baseline = window.innerHeight;
    let lastWidth = window.innerWidth;
    const fit = () => {
      // Pinch zoom is not a keyboard transition.
      if (visual && Math.abs(visual.scale - 1) > 0.01) return;
      const height = visual?.height ?? window.innerHeight;
      const width = window.innerWidth;
      if (Math.abs(width - lastWidth) > 80) baseline = window.innerHeight;
      lastWidth = width;
      baseline = Math.max(baseline, window.innerHeight, height);
      const root = rootRef.current;
      if (!root) return;
      root.style.height = `${height}px`;
      root.style.top = `${visual?.offsetTop ?? 0}px`;
      const focused = document.activeElement;
      const editing = focused instanceof HTMLTextAreaElement && root.contains(focused);
      setCompact(width <= 900 && (baseline - height > 120 || (editing && height < 600)));
    };
    fit();
    visual?.addEventListener('resize', fit);
    visual?.addEventListener('scroll', fit);
    window.addEventListener('resize', fit);
    document.addEventListener('focusin', fit);
    document.addEventListener('focusout', fit);
    return () => {
      visual?.removeEventListener('resize', fit);
      visual?.removeEventListener('scroll', fit);
      window.removeEventListener('resize', fit);
      document.removeEventListener('focusin', fit);
      document.removeEventListener('focusout', fit);
    };
  }, [rootRef]);

  return compact;
}
