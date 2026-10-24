import { useEffect, useRef, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useMessages } from '@/hooks/useChat';
import { useAuth } from '@/hooks/useAuth';
import { EnhancedMessageBubble } from '@/components/chat/EnhancedMessageBubble';
import { createChatConversation } from '@/lib/chat-conversations';

export function CallChatPanel({ conversationId, contactId, onClose }: {
  conversationId?: string | null; contactId?: string; onClose: () => void;
}) {
  const { user } = useAuth();
  const [resolvedId, setResolvedId] = useState(conversationId || null);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const pending = useRef<ReturnType<typeof createChatConversation> | null>(null);
  const { messages, reactions, starredIds, pinnedIds, viewOnceViewedIds, markViewOnce, loading, sendMessage } = useMessages(resolvedId);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (conversationId || !contactId) return;
    let active = true;
    pending.current ||= createChatConversation([contactId]);
    void pending.current.then(({ data, error }) => {
      if (!active) return;
      if (error || !data) setError('Não foi possível abrir o papo. Fecha o painel e tenta novamente.');
      else setResolvedId(data.id);
    });
    return () => { active = false; };
  }, [conversationId, contactId]);
  useEffect(() => { endRef.current?.scrollIntoView?.({ block: 'end' }); }, [messages]);
  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!resolvedId || sending || !draft.trim()) return;
    setSending(true); setError('');
    try {
      const result = await sendMessage(draft.trim());
      if (result.error) setError('Não foi possível enviar. O texto foi mantido para tentares novamente.');
      else setDraft('');
    } catch { setError('Não foi possível enviar. O texto foi mantido para tentares novamente.'); }
    finally { setSending(false); }
  };
  return <Sheet open onOpenChange={open => { if (!open) onClose(); }}>
    <SheetContent side="right" className="flex flex-col w-full sm:max-w-lg h-screen-safe gap-0 p-0 safe-top safe-bottom overflow-hidden">
      <SheetHeader className="shrink-0 px-4 py-4 pr-16 border-b text-left">
        <SheetTitle>Papo durante a chamada</SheetTitle>
        <SheetDescription>Fecha este painel para voltar à chamada, sem desligar.</SheetDescription>
      </SheetHeader>
      <div role="log" aria-label="Mensagens da conversa" className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden py-3">
        {loading && <p role="status" className="p-4">A carregar mensagens…</p>}
        {!resolvedId && !contactId && <p className="p-4">Esta chamada não tem um papo associado.</p>}
        {messages.map(message => <EnhancedMessageBubble key={message.id} message={message}
          currentUserId={user?.id || ''} isOwn={message.sender_id === user?.id}
          reactions={reactions[message.id] || []} isStarred={starredIds.has(message.id)} isPinned={pinnedIds.has(message.id)}
          viewOnceViewed={viewOnceViewedIds.has(message.id)} onViewOnce={async id => { await markViewOnce(id); }} />)}
        <div ref={endRef} />
      </div>
      {error && <p role="alert" className="shrink-0 p-3 text-sm text-destructive">{error}</p>}
      <form onSubmit={send} className="shrink-0 flex gap-2 border-t p-3">
        <textarea aria-label="Mensagem durante a chamada" placeholder="Escreve uma mensagem…" value={draft}
          onChange={event => setDraft(event.target.value)} disabled={!resolvedId || sending}
          rows={2} className="flex-1 min-w-0 rounded-xl border bg-background p-3 text-sm" />
        <Button type="submit" disabled={!resolvedId || sending || !draft.trim()}>{sending ? 'A enviar…' : 'Enviar'}</Button>
      </form>
    </SheetContent>
  </Sheet>;
}
