import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Smile, Mic } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface ChatInputProps {
  onSend: (content: string) => Promise<void>;
  onTyping: () => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, onTyping, disabled }: ChatInputProps) {
  useUiLocale();
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [message]);

  const handleSend = () => {
    if (!message.trim() || sending || disabled) return;

    const content = message.trim();

    // Clear UI immediately
    setMessage('');

    // Brief lock to prevent double-taps
    setSending(true);
    window.setTimeout(() => setSending(false), 150);

    // Fire & forget (errors handled upstream)
    void onSend(content);

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    onTyping();
  };

  return (
    <div className="sticky bottom-0 glass border-t border-border/50 safe-bottom">
      <div className="flex items-end gap-2 p-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 rounded-full flex-shrink-0"
          disabled={disabled}
        >
          <Paperclip className="w-5 h-5" />
        </Button>

        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={uiText("Type a message...")}
            className="min-h-[44px] max-h-[120px] py-3 pr-12 rounded-2xl resize-none bg-secondary/50 border-0 focus-visible:ring-1 focus-visible:ring-primary/50"
            disabled={disabled}
            rows={1}
          />
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 bottom-1.5 h-8 w-8 rounded-full"
            disabled={disabled}
          >
            <Smile className="w-5 h-5 text-muted-foreground" />
          </Button>
        </div>

        {message.trim() ? (
          <Button
            size="icon"
            className="h-10 w-10 rounded-full bg-gradient-primary text-white flex-shrink-0"
            onClick={handleSend}
            disabled={sending || disabled}
          >
            <Send className="w-5 h-5" />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-full flex-shrink-0"
            disabled={disabled}
          >
            <Mic className="w-5 h-5" />
          </Button>
        )}
      </div>
    </div>
  );
}
