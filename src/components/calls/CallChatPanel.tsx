import { useEffect, useRef, useState, type RefObject } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMessages } from '@/hooks/useChat';
import { useAuth } from '@/hooks/useAuth';
import { EnhancedMessageBubble } from '@/components/chat/EnhancedMessageBubble';
import { createChatConversation } from '@/lib/chat-conversations';

/**
 * The conversation stays attached to the active call; opening the composer
 * must never start a second call or request microphone/camera permission.
 * Its height follows the visible iOS keyboard viewport in the KOSOLOLA PWA.
 */
export function CallChatPanel({ conversationId, contactId, open, onClose, inputRef, inline = false }: {
  inline?: boolean;
  conversationId?: string | null;
  contactId?: string;
  open: boolean;
  onClose: () => void;
  inputRef: RefObject<HTMLTextAreaElement>;
}) {
  const { user } = useAuth();
  const [resolvedId, setResolvedId] = useState(conversationId || null);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const pending = useRef<ReturnType<typeof createChatConversation> | null>(null);
  const { messages, reactions, starredIds, pinnedIds, viewOnceViewedIds, markViewOnce, loading, sendMessage } = useMessages(resolvedId);
  const messagesViewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (conversationId) {
      setResolvedId(conversationId);
      return;
    }
    if (!contactId) return;
    let active = true;
    pending.current ||= createChatConversation([contactId]);
    void pending.current.then(({ data, error }) => {
      if (!active) return;
      if (error || !data) setError('Não foi possível abrir a conversa.');
      else setResolvedId(data.id);
    });
    return () => { active = false; };
  }, [conversationId, contactId]);

  useEffect(() => {
    if (!open) return;
    const viewport = messagesViewportRef.current;
    if (viewport) viewport.scrollTop = viewport.scrollHeight;
  }, [messages, open]);

  useEffect(() => {
    if (!open) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', onEscape);
    return () => document.removeEventListener('keydown', onEscape);
  }, [open, onClose]);

  const send = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!resolvedId || sending || !draft.trim()) return;
    setSending(true);
    setError('');
    try {
      const result = await sendMessage(draft.trim());
      if (result.error) setError('Não foi possível enviar. A mensagem foi conservada.');
      else setDraft('');
    } catch {
      setError('Não foi possível enviar. A mensagem foi conservada.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      role={inline ? "region" : "dialog"}
      aria-modal={inline ? undefined : open}
      aria-label="Mensagens durante a chamada"
      aria-hidden={!open}
      className={open
        ? `${inline ? 'relative min-h-[7.5rem] flex-[1.2] basis-0 border-y' : 'fixed inset-x-0 z-[90]'} flex flex-col overflow-hidden bg-background text-foreground`
        : 'hidden'}
      style={open && !inline ? {
        top: 'var(--kosolola-top, 0px)',
        height: 'var(--kosolola-height, 100dvh)',
      } : undefined}
    >
      <header className={inline ? "flex shrink-0 items-center gap-3 border-b px-3 py-1" : "flex shrink-0 items-center gap-3 border-b px-3 pb-2 pt-2"}>
        <Button variant="ghost" type="button" onClick={onClose} aria-label="Voltar à chamada" className={inline ? "h-8 gap-2 px-2" : "gap-2 px-2"}>
          <ArrowLeft className="h-5 w-5" />
          <span>Chamada</span>
        </Button>
        <span className="text-sm font-semibold">Mensagens</span>
      </header>

      <div
        ref={messagesViewportRef}
        role="log"
        aria-label="Mensagens da conversa"
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain overflow-x-hidden px-2 py-3"
      >
        {loading && <p role="status" className="p-4">A carregar mensagens…</p>}
        {!resolvedId && !contactId && <p className="p-4">Esta chamada não tem uma conversa associada.</p>}
        {messages.map(message => (
          <EnhancedMessageBubble
            key={message.id}
            message={message}
            currentUserId={user?.id || ''}
            isOwn={message.sender_id === user?.id}
            reactions={reactions[message.id] || []}
            isStarred={starredIds.has(message.id)}
            isPinned={pinnedIds.has(message.id)}
            viewOnceViewed={viewOnceViewedIds.has(message.id)}
            onViewOnce={async id => { await markViewOnce(id); }}
          />
        ))}
      </div>

      {error && <p role="alert" className="shrink-0 px-3 py-2 text-sm text-destructive">{error}</p>}
      <form
        onSubmit={send}
        className={`flex shrink-0 items-end gap-2 border-t bg-background px-3 ${inline ? "py-2" : "pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] pt-3"}`}
      >
        <textarea
          ref={inputRef}
          aria-label="Escrever mensagem"
          placeholder="Mensagem…"
          value={draft}
          onChange={event => setDraft(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          disabled={sending}
          enterKeyHint="send"
          rows={1}
          className="max-h-32 min-h-11 flex-1 min-w-0 resize-none rounded-2xl border bg-background px-4 py-3 text-base"
        />
        <Button type="submit" disabled={!resolvedId || sending || !draft.trim()} className="min-h-11 shrink-0">
          {sending ? 'A enviar…' : 'Enviar'}
        </Button>
      </form>
    </div>
  );
}
