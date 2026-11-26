import { useLayoutEffect, useRef, type RefObject } from 'react';
import { Textarea, type TextareaProps } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

/** Scroll the editor as a whole instead of trapping long text in a small box. */
export function PostContentTextarea({ className, value, fieldRef, ...props }: TextareaProps & {
  fieldRef?: RefObject<HTMLTextAreaElement>;
}) {
  const localRef = useRef<HTMLTextAreaElement>(null);
  const ref = fieldRef ?? localRef;

  useLayoutEffect(() => {
    const field = ref.current;
    if (!field) return;
    const resize = () => {
      field.style.height = 'auto';
      field.style.height = `${field.scrollHeight + field.offsetHeight - field.clientHeight}px`;
    };
    resize();
    let width = field.clientWidth;
    const observer = new ResizeObserver(() => {
      if (field.clientWidth === width) return;
      width = field.clientWidth;
      resize();
    });
    observer.observe(field);
    return () => observer.disconnect();
  }, [ref, value]);

  return <Textarea {...props} ref={ref} value={value} className={cn('resize-none overflow-hidden text-base leading-relaxed', className)} />;
}
