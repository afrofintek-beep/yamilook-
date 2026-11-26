import { useRef, type ComponentPropsWithoutRef, type RefObject } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { EmojiPickerButton } from './EmojiPickerButton';

interface EmojiFieldProps {
  value: string;
  onValueChange: (value: string) => void;
  wrapperClassName?: string;
}

type EmojiInputProps = EmojiFieldProps & Omit<ComponentPropsWithoutRef<typeof Input>, 'type' | 'value' | 'onChange'> & {
  onEmojiOpenChange?: (open: boolean) => void;
};
type EmojiTextareaProps = EmojiFieldProps & Omit<ComponentPropsWithoutRef<typeof Textarea>, 'value' | 'onChange'> & {
  fieldRef?: RefObject<HTMLTextAreaElement>;
};

export function EmojiInput({ value, onValueChange, wrapperClassName, className, disabled, readOnly, onEmojiOpenChange, ...props }: EmojiInputProps) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className={cn('relative min-w-0', wrapperClassName)}>
      <Input {...props} ref={ref} value={value} onChange={event => onValueChange(event.target.value)}
        disabled={disabled} readOnly={readOnly} className={cn('text-base sm:text-sm', className, 'pe-12')} />
      <EmojiPickerButton fieldRef={ref} onInsert={onValueChange} disabled={disabled || readOnly} onOpenChange={onEmojiOpenChange}
        className="absolute end-0.5 top-1/2 -translate-y-1/2" />
    </div>
  );
}

export function EmojiTextarea({ value, onValueChange, wrapperClassName, className, fieldRef, disabled, readOnly, ...props }: EmojiTextareaProps) {
  const localRef = useRef<HTMLTextAreaElement>(null);
  const ref = fieldRef ?? localRef;
  return (
    <div className={cn('relative min-w-0', wrapperClassName)}>
      <Textarea {...props} ref={ref} value={value} onChange={event => onValueChange(event.target.value)}
        disabled={disabled} readOnly={readOnly} className={cn('text-base sm:text-sm', className, 'pe-12')} />
      <EmojiPickerButton fieldRef={ref} onInsert={onValueChange} disabled={disabled || readOnly}
        className="absolute end-0.5 top-0.5" />
    </div>
  );
}
