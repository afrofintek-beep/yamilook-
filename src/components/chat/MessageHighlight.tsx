import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { useState } from 'react';
import { Highlighter, Tag, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface MessageHighlightProps {
  messageId: string;
  currentColor?: string;
  currentLabel?: string;
  onHighlight: (color: string, label?: string) => Promise<void>;
  onRemove: () => Promise<void>;
}

const HIGHLIGHT_COLORS = [
  { name: 'yellow', color: 'bg-yellow-200 dark:bg-yellow-900/50', border: 'border-yellow-400' },
  { name: 'blue', color: 'bg-blue-200 dark:bg-blue-900/50', border: 'border-blue-400' },
  { name: 'green', color: 'bg-green-200 dark:bg-green-900/50', border: 'border-green-400' },
  { name: 'pink', color: 'bg-pink-200 dark:bg-pink-900/50', border: 'border-pink-400' },
  { name: 'orange', color: 'bg-orange-200 dark:bg-orange-900/50', border: 'border-orange-400' },
  { name: 'purple', color: 'bg-purple-200 dark:bg-purple-900/50', border: 'border-purple-400' },
];

export function MessageHighlightPicker({
  messageId,
  currentColor,
  currentLabel,
  onHighlight,
  onRemove,
}: MessageHighlightProps) {
  useUiLocale();
  const [selectedColor, setSelectedColor] = useState(currentColor || '');
  const [label, setLabel] = useState(currentLabel || '');
  const [isOpen, setIsOpen] = useState(false);

  const handleSave = async () => {
    if (selectedColor) {
      await onHighlight(selectedColor, label || undefined);
    }
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 px-2">
          <Highlighter className={cn('w-4 h-4', currentColor && 'text-primary')} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="start">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{uiText("Highlight message")}</span>
            {currentColor && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-destructive"
                onClick={async () => {
                  await onRemove();
                  setIsOpen(false);
                }}
              >{uiText("Remove")}</Button>
            )}
          </div>

          <div className="flex gap-2 flex-wrap">
            {HIGHLIGHT_COLORS.map((c) => (
              <button
                key={c.name}
                onClick={() => setSelectedColor(c.name)}
                className={cn(
                  'w-8 h-8 rounded-full border-2 transition-transform hover:scale-110',
                  c.color,
                  selectedColor === c.name ? c.border : 'border-transparent'
                )}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={uiText("Add label (optional)")}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="h-8 text-sm"
            />
          </div>

          <Button
            size="sm"
            className="w-full"
            onClick={handleSave}
            disabled={!selectedColor}
          >{uiText("Save highlight")}</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Helper to get highlight background class
export function getHighlightClass(color: string) {
  const colorMap: Record<string, string> = {
    yellow: 'bg-yellow-100/50 dark:bg-yellow-900/30 border-l-4 border-yellow-400',
    blue: 'bg-blue-100/50 dark:bg-blue-900/30 border-l-4 border-blue-400',
    green: 'bg-green-100/50 dark:bg-green-900/30 border-l-4 border-green-400',
    pink: 'bg-pink-100/50 dark:bg-pink-900/30 border-l-4 border-pink-400',
    orange: 'bg-orange-100/50 dark:bg-orange-900/30 border-l-4 border-orange-400',
    purple: 'bg-purple-100/50 dark:bg-purple-900/30 border-l-4 border-purple-400',
  };
  return colorMap[color] || '';
}

// Highlight badge display
interface HighlightBadgeProps {
  color: string;
  label?: string;
}

export function HighlightBadge({ color, label }: HighlightBadgeProps) {
  useUiLocale();
  const colorMap: Record<string, string> = {
    yellow: 'bg-yellow-200 text-yellow-800',
    blue: 'bg-blue-200 text-blue-800',
    green: 'bg-green-200 text-green-800',
    pink: 'bg-pink-200 text-pink-800',
    orange: 'bg-orange-200 text-orange-800',
    purple: 'bg-purple-200 text-purple-800',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium',
        colorMap[color] || 'bg-secondary text-secondary-foreground'
      )}
    >
      <Highlighter className="w-2.5 h-2.5" />
      {label || uiText("Highlighted")}
    </span>
  );
}
