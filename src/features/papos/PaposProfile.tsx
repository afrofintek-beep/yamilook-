import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
      // Keep the two typed relations separate; a table/view union loses the
      // common result shape in the generated PostgREST overloads.
      const fields = 'id,display_name,username,avatar_url,bio';
      const result = own
        ? await supabase.from('profiles').select(fields).eq('id', targetId!).maybeSingle()
        : await supabase.from('public_profiles').select(fields).eq('id', targetId!).maybeSingle();
      if (result.error) throw result.error;
      return result.data;
    },
  });
  const person = own ? data ?? profile : data;
  const message = async () => { if (!userId) return; const result = await createConversation([userId]); if (result.error || !result.data) { toast({ title: t('kosolola.profileOpenChatError'), variant: 'destructive' }); return; } navigate(`/chat/${result.data.id}`); };
  return <div className="h-screen-safe pb-[calc(5rem+env(safe-area-inset-bottom,0px))] bg-background flex flex-col">
    <header className="safe-top shrink-0 border-b p-4"><Button asChild variant="ghost"><Link to="/papos">{t('kosolola.back')}</Link></Button></header>
    <main className="flex-1 overflow-y-auto p-6 max-w-md w-full mx-auto space-y-5">
      {!own && isLoading ? <p role="status">{t('kosolola.profileLoading')}</p> : !person || (!own && isError) ? <p role="alert">{t('kosolola.profileUnavailable')}</p> : <>
        <Avatar className="w-24 h-24"><AvatarImage src={person.avatar_url || ''} alt={t('kosolola.profilePhoto', { name: person.display_name || person.username })} className="object-cover" /><AvatarFallback>{person.display_name?.[0] || 'P'}</AvatarFallback></Avatar>
        <h1 className="text-2xl font-bold break-words">{person.display_name}</h1><p className="text-muted-foreground">@{person.username}</p><p className="whitespace-pre-wrap break-words">{person.bio}</p>
        {!own && <div className="grid gap-3"><Button onClick={() => void message()}>{t('kosolola.profileMessage')}</Button><Button variant="outline" onClick={() => void call?.startCall(userId!, 'voice')}>{t('kosolola.profileVoice')}</Button><Button variant="outline" onClick={() => void call?.startCall(userId!, 'video')}>{t('kosolola.profileVideo')}</Button></div>}
        <Button asChild variant="outline" className="w-full h-auto min-h-11 whitespace-normal"><a href={own ? 'https://www.yamilook.com/profile' : `https://www.yamilook.com/profile/${encodeURIComponent(userId!)}`}>{own ? t('kosolola.profileEdit') : t('kosolola.profileView')}</a></Button>
      </>}
    </main><BottomNav /></div>;
}
