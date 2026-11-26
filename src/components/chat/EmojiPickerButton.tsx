import { useRef, useState, type ReactNode, type RefObject } from 'react';
import { Smile } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { EmojiPanel } from './EmojiPanel';

type TextField = HTMLInputElement | HTMLTextAreaElement;

interface EmojiPickerButtonProps {
  fieldRef: RefObject<TextField>;
  onInsert: (value: string, cursor: number) => void;
  disabled?: boolean;
  className?: string;
  align?: 'start' | 'end';
  onOpenChange?: (open: boolean) => void;
  children?: (close: () => void) => ReactNode;
}

export function EmojiPickerButton({ fieldRef, onInsert, disabled, className, align = 'end', onOpenChange, children }: EmojiPickerButtonProps) {
  const [open, setOpen] = useState(false);
  const inserted = useRef(false);
  const changeOpen = (next: boolean) => {
    setOpen(next);
    onOpenChange?.(next);
  };
  const close = () => changeOpen(false);

  const insert = (emoji: string) => {
    const field = fieldRef.current;
    if (!field || disabled || field.disabled || field.readOnly) return;
    const { value, selectionStart, selectionEnd, maxLength } = field;
    const start = selectionStart ?? value.length;
    const end = selectionEnd ?? start;
    const next = value.slice(0, start) + emoji + value.slice(end);
    if (maxLength >= 0 && next.length > maxLength) return;

    const cursor = start + emoji.length;
    inserted.current = true;
    onInsert(next, cursor);
    close();
    // Focusing within the tap lets iOS reopen the keyboard. Restore the cursor after React updates the field.
    field.focus({ preventScroll: true });
    requestAnimationFrame(() => {
      if (field === document.activeElement && field.value === next) field.setSelectionRange(cursor, cursor);
    });
  };

  return (
    <Popover open={open && !disabled} onOpenChange={changeOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="icon" aria-label="Emojis" disabled={disabled}
          className={cn('h-10 w-10 shrink-0 rounded-full text-muted-foreground', className)}>
          <Smile className="h-5 w-5" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" align={align} collisionPadding={8}
        className="z-[210] w-auto max-h-[var(--radix-popover-content-available-height)] overflow-y-auto p-2"
        onCloseAutoFocus={event => {
          if (!inserted.current) return;
          inserted.current = false;
          event.preventDefault();
        }}>
        <EmojiPanel onSelect={insert} />
        {children && <div className="mt-2 flex flex-col gap-2 border-t pt-2">{children(close)}</div>}
      </PopoverContent>
    </Popover>
  );
}
