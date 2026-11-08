import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Send } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LiveMessage } from '@/hooks/useLiveStream';

interface LiveChatProps {
  messages: LiveMessage[];
  onSendMessage: (message: string) => void;
  isHost?: boolean;
}

export function LiveChat({ messages, onSendMessage, isHost }: LiveChatProps) {
  useUiLocale();
  const navigate = useNavigate();
  const [newMessage, setNewMessage] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (!newMessage.trim()) return;
    onSendMessage(newMessage);
    setNewMessage('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <ScrollArea className="flex-1 p-3" ref={scrollRef}>
        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-start gap-2"
              >
                <button
                  onClick={() => navigate(`/profile/${msg.user_id}`)}
                  className="focus:outline-none"
                >
                  <Avatar className="w-6 h-6 shrink-0 cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all">
                    <AvatarImage src={msg.user?.avatar_url || ''} />
                    <AvatarFallback className="text-[10px]">
                      {msg.user?.display_name?.[0] || 'U'}
                    </AvatarFallback>
                  </Avatar>
                </button>
                <div className="flex-1 min-w-0">
                  <button
                    onClick={() => navigate(`/profile/${msg.user_id}`)}
                    className="text-xs font-medium text-primary hover:underline focus:outline-none"
                  >
                    {msg.user?.display_name || uiText("User")}
                  </button>
                  <p className="text-sm text-white break-words">
                    {msg.message}
                  </p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-3 border-t border-border bg-background/80 backdrop-blur-sm">
        <div className="flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={uiText("Send a message...")}
            className="flex-1 rounded-full bg-muted border-0"
            maxLength={200}
          />
          <Button
            size="icon"
            className="rounded-full shrink-0"
            onClick={handleSend}
            disabled={!newMessage.trim()}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
