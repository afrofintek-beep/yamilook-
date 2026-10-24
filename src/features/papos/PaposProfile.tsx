import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useConversations } from '@/hooks/useChat';
import { useActiveCall } from '@/components/calls/ActiveCallProvider';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import BottomNav from '@/components/BottomNav';
export default function PaposProfile() {
  const { userId } = useParams(); const { user, profile } = useAuth(); const navigate = useNavigate(); const call = useActiveCall();
  const { createConversation } = useConversations(); const { toast } = useToast(); const own = !userId || userId === user?.id;
  const targetId = own ? user?.id : userId;
  const { data, isLoading, isError } = useQuery({
    queryKey: ['papos-profile', targetId, own ? 'private' : 'public'],
    enabled: !!targetId,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
    queryFn: async () => {
      const result = await supabase.from(own ? 'profiles' : 'public_profiles')
        .select('id,display_name,username,avatar_url,bio').eq('id', targetId!).maybeSingle();
      if (result.error) throw result.error;
      return result.data;
    },
  });
  const person = own ? data ?? profile : data;
  const message = async () => { if (!userId) return; const result = await createConversation([userId]); if (result.error || !result.data) { toast({ title: 'Não foi possível abrir a conversa', variant: 'destructive' }); return; } navigate(`/chat/${result.data.id}`); };
  return <div className="h-screen-safe pb-[calc(5rem+env(safe-area-inset-bottom,0px))] bg-background flex flex-col">
    <header className="safe-top shrink-0 border-b p-4"><Button asChild variant="ghost"><Link to="/papos">Voltar às conversas</Link></Button></header>
    <main className="flex-1 overflow-y-auto p-6 max-w-md w-full mx-auto space-y-5">
      {!own && isLoading ? <p role="status">A carregar perfil…</p> : !person || (!own && isError) ? <p role="alert">Perfil indisponível.</p> : <>
        <Avatar className="w-24 h-24"><AvatarImage src={person.avatar_url || ''} alt={`Fotografia de ${person.display_name || person.username}`} className="object-cover" /><AvatarFallback>{person.display_name?.[0] || 'P'}</AvatarFallback></Avatar>
        <h1 className="text-2xl font-bold break-words">{person.display_name}</h1><p className="text-muted-foreground">@{person.username}</p><p className="whitespace-pre-wrap break-words">{person.bio}</p>
        {!own && <div className="grid gap-3"><Button onClick={() => void message()}>Enviar mensagem</Button><Button variant="outline" onClick={() => void call?.startCall(userId!, 'voice')}>Chamada de voz</Button><Button variant="outline" onClick={() => void call?.startCall(userId!, 'video')}>Videochamada</Button></div>}
        <Button asChild variant="outline" className="w-full"><a href={own ? '/profile' : `/profile/${encodeURIComponent(userId!)}`}>{own ? 'Editar o meu perfil na Yamilook' : 'Ver perfil e Muxi na Yamilook'}</a></Button>
      </>}
    </main><BottomNav /></div>;
}
