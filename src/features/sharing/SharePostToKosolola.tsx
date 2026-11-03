import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useConversations } from '@/hooks/useChat';
import { useContacts } from '@/hooks/useContacts';
import { createChatConversation } from '@/lib/chat-conversations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import PostSharePreview, { fetchSharedPost } from '@/components/sharing/PostSharePreview';
import { sendSharedPost } from './send-shared-post';
import { isPostId } from '../../../shared/public-post.mjs';

type Recipient = { key: string; name: string; avatar?: string | null; conversationId?: string; contactId?: string; group?: boolean };
export default function SharePostToKosolola() {
  const { postId = '' } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { conversations, loading: conversationsLoading, refresh } = useConversations();
  const { contacts, loading: contactsLoading, error: contactsError } = useContacts();
  const { data: post, isPending, isError, refetch } = useQuery({ queryKey: ['shared-public-post', postId], queryFn: ({ signal }) => fetchSharedPost(postId, signal), enabled: isPostId(postId), staleTime: 0 });
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Recipient | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef<{ key: string; messageId: string; conversationId?: string } | null>(null);
  const sending = useRef(false);
  const represented = new Set<string>();
  const blocked = new Set(contacts.filter(contact => contact.is_blocked).map(contact => contact.contact_user_id));
  const recipients: Recipient[] = conversations.filter(conversation => conversation.type === 'group' || !conversation.participants?.some(member => member.user_id !== user?.id && blocked.has(member.user_id))).map(conversation => {
    const other = conversation.participants?.find(member => member.user_id !== user?.id);
    if (conversation.type !== 'group' && other) represented.add(other.user_id);
    return { key: conversation.id, conversationId: conversation.id, name: conversation.type === 'group' ? conversation.name || 'Grupo' : other?.profile?.display_name || 'Conversa', avatar: conversation.type === 'group' ? conversation.avatar_url : other?.profile?.avatar_url, group: conversation.type === 'group' };
  });
  for (const contact of contacts) {
    if (contact.is_blocked || represented.has(contact.contact_user_id) || contact.contact_user_id === user?.id) continue;
    recipients.push({ key: `contact:${contact.contact_user_id}`, contactId: contact.contact_user_id, name: contact.nickname || contact.profile?.display_name || 'Contacto', avatar: contact.profile?.avatar_url });
  }
  const visibleRecipients = recipients.filter(recipient => recipient.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  const send = async () => {
    if (!selected || !user || !post || sending.current) return;
    sending.current = true; setBusy(true); setError('');
    try {
      // Revalidate public visibility at the time the user confirms sending.
      if (!await fetchSharedPost(postId, AbortSignal.timeout(10000))) throw new Error('Esta publicação já não é pública.');
      if (!pending.current || pending.current.key !== `${user.id}:${postId}:${selected.key}`) pending.current = { key: `${user.id}:${postId}:${selected.key}`, messageId: crypto.randomUUID(), conversationId: selected.conversationId };
      if (!pending.current.conversationId) {
        const result = await createChatConversation([selected.contactId!]);
        if (result.error || !result.data) throw new Error('Não foi possível abrir a conversa.');
        pending.current.conversationId = result.data.id;
      }
      await sendSharedPost({ id: pending.current.messageId, postId, conversationId: pending.current.conversationId, userId: user.id });
      void refresh();
      navigate(`/chat/${pending.current.conversationId}`, { replace: true });
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Não foi possível enviar. Tenta novamente.'); }
    finally { sending.current = false; setBusy(false); }
  };
  return <main className="h-screen-safe safe-top safe-bottom flex flex-col bg-background">
    <header className="flex shrink-0 items-center justify-between border-b p-4"><h1 className="font-semibold">Partilhar na KOSOLOLA</h1><Link to="/papos" aria-disabled={busy} onClick={event => { if (busy) event.preventDefault(); }}>Cancelar</Link></header>
    <div className="min-h-0 flex-1 overflow-y-auto p-4"><div className="mx-auto max-w-lg space-y-4">
      {!isPostId(postId) ? <p role="alert">Ligação inválida.</p> : <>
        <PostSharePreview id={postId} />
        {isError && <Button variant="outline" onClick={() => void refetch()}>Tentar novamente</Button>}
        {post && <><Input aria-label="Procurar contacto ou grupo" placeholder="Procurar contacto ou grupo…" value={search} disabled={busy} onChange={event => setSearch(event.target.value)} />
          {(conversationsLoading || contactsLoading) && <p role="status">A carregar contactos e conversas…</p>}
          {contactsError && <p role="alert">Não foi possível carregar todos os contactos.</p>}
          <div className="space-y-1">{visibleRecipients.map(recipient => <button key={recipient.key} type="button" disabled={busy} aria-pressed={selected?.key === recipient.key} onClick={() => { setSelected(recipient); setError(''); }} className={`flex min-h-16 w-full items-center gap-3 rounded-xl border p-3 text-left ${selected?.key === recipient.key ? 'border-primary bg-primary/10' : 'border-transparent'}`}>
            <Avatar><AvatarImage src={recipient.avatar || ''} /><AvatarFallback>{recipient.name.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar><span className="min-w-0 flex-1 truncate">{recipient.name}<span className="block text-xs text-muted-foreground">{recipient.group ? 'Grupo' : 'Contacto'}</span></span>{selected?.key === recipient.key && <span aria-hidden="true">✓</span>}
          </button>)}</div>
          {!!recipients.length && !visibleRecipients.length && <p role="status">Nenhum contacto ou grupo encontrado.</p>}
          {!conversationsLoading && !contactsLoading && !recipients.length && <p>Ainda não tens contactos ou conversas. <Link to="/contacts" className="underline">Adicionar contacto</Link></p>}
        </>}
      </>}
    </div></div>
    <footer className="shrink-0 border-t bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"><div className="mx-auto max-w-lg">{error && <p role="alert" className="mb-2 text-sm text-destructive">{error}</p>}<Button className="min-h-12 w-full" disabled={!selected || busy || !post || isPending} onClick={() => void send()}>{busy ? 'A enviar…' : selected ? `Enviar para ${selected.name}` : 'Seleciona um contacto ou grupo'}</Button></div></footer>
  </main>;
}
