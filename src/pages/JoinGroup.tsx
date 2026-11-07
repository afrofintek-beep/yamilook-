import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users, Loader2, CheckCircle, XCircle, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import YamilookLogo from '@/components/brand/YamilookLogo';

type JoinStatus = 'loading' | 'ready' | 'joining' | 'success' | 'already_member' | 'error';

interface GroupInfo {
  name: string;
  avatar_url: string | null;
  member_count: number;
}

export default function JoinGroup() {
  useUiLocale();
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [status, setStatus] = useState<JoinStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [groupInfo, setGroupInfo] = useState<GroupInfo | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);

  useEffect(() => {
    if (!code) {
      setStatus('error');
      setError(uiText("Código de convite inválido"));
      return;
    }

    if (authLoading) return;

    if (!user) {
      setStatus('ready');
      return;
    }

    validateInvite();
  }, [code, user, authLoading]);

  const validateInvite = async () => {
    if (!code) return;

    setStatus('loading');

    const { data, error } = await supabase.rpc('preview_chat_invite', { invite_code: code });
    const result = data as { success?: boolean; conversation_id?: string; name?: string; avatar_url?: string | null; member_count?: number } | null;
    if (error || !result?.success || !result.conversation_id) {
      setStatus('error');
      setError(uiText("Link de convite inválido ou expirado"));
      return;
    }
    setGroupInfo({ name: result.name || 'Grupo', avatar_url: result.avatar_url || null, member_count: result.member_count || 0 });
    setConversationId(result.conversation_id);
    setStatus('ready');
  };

  const handleJoin = async () => {
    if (!code || !user) return;

    setStatus('joining');

    const { data, error } = await supabase.rpc('use_group_invite', {
      invite_code: code,
    });

    if (error) {
      setStatus('error');
      setError(uiText("Erro ao entrar no grupo"));
      return;
    }

    const result = data as { success: boolean; error?: string; already_member?: boolean; conversation_id?: string };

    if (!result.success) {
      setStatus('error');
      setError(result.error || 'Erro desconhecido');
      return;
    }

    if (result.already_member) {
      setStatus('already_member');
      setConversationId(result.conversation_id || null);
      toast({
        title: uiText("Já és membro!"),
        description: uiText("Já fazes parte deste grupo."),
      });
    } else {
      setStatus('success');
      setConversationId(result.conversation_id || null);
      toast({
        title: uiText("Bem-vindo ao grupo!"),
        description: `Entraste no grupo "${groupInfo?.name}".`,
      });
    }
  };

  const goToGroup = () => {
    if (conversationId) {
      navigate(`/chat/${conversationId}`);
    } else {
      navigate('/');
    }
  };

  const goToLogin = () => {
    // Store the invite code to use after login
    sessionStorage.setItem('pendingInvite', code || '');
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <YamilookLogo size="md" showTagline={false} animate={false} />
        </div>

        <Card className="border-border/50">
          <CardHeader className="text-center">
            {status === 'loading' && (
              <>
                <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-primary" />
                <CardTitle>{uiText("A verificar convite...")}</CardTitle>
              </>
            )}

            {status === 'error' && (
              <>
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-destructive/10 flex items-center justify-center">
                  <XCircle className="w-8 h-8 text-destructive" />
                </div>
                <CardTitle>{uiText("Convite Inválido")}</CardTitle>
                <CardDescription>{error}</CardDescription>
              </>
            )}

            {status === 'ready' && !user && (
              <>
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                  <Users className="w-8 h-8 text-primary" />
                </div>
                <CardTitle>{uiText("Convite para Grupo")}</CardTitle>
                <CardDescription>{uiText("Precisas de iniciar sessão para entrar no grupo")}</CardDescription>
              </>
            )}

            {status === 'ready' && user && groupInfo && (
              <>
                {groupInfo.avatar_url ? (
                  <img
                    src={groupInfo.avatar_url}
                    alt={groupInfo.name}
                    className="w-20 h-20 mx-auto mb-4 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-primary flex items-center justify-center">
                    <Users className="w-10 h-10 text-white" />
                  </div>
                )}
                <CardTitle>{groupInfo.name}</CardTitle>
                <CardDescription>
                  {groupInfo.member_count} {groupInfo.member_count === 1 ? uiText("membro") : uiText("membros")}
                </CardDescription>
              </>
            )}

            {status === 'joining' && (
              <>
                <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-primary" />
                <CardTitle>{uiText("A entrar no grupo...")}</CardTitle>
              </>
            )}

            {(status === 'success' || status === 'already_member') && (
              <>
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/10 flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-green-500" />
                </div>
                <CardTitle>
                  {status === 'already_member' ? uiText("Já és membro!") : uiText("Entraste no grupo!")}
                </CardTitle>
                <CardDescription>
                  {status === 'already_member'
                    ? uiText("Já fazes parte deste grupo.")
                    : `Bem-vindo ao "${groupInfo?.name}"!`}
                </CardDescription>
              </>
            )}
          </CardHeader>

          <CardContent className="space-y-3">
            {status === 'error' && (
              <Button
                className="w-full h-12 rounded-xl"
                onClick={() => navigate('/')}
              >{uiText("Voltar ao início")}</Button>
            )}

            {status === 'ready' && !user && (
              <Button
                className="w-full h-12 rounded-xl gap-2"
                onClick={goToLogin}
              >
                <LogIn className="w-5 h-5" />{uiText("Iniciar sessão para entrar")}</Button>
            )}

            {status === 'ready' && user && (
              <Button
                className="w-full h-12 rounded-xl gap-2"
                onClick={handleJoin}
              >
                <Users className="w-5 h-5" />{uiText("Entrar no grupo")}</Button>
            )}

            {(status === 'success' || status === 'already_member') && (
              <Button
                className="w-full h-12 rounded-xl gap-2"
                onClick={goToGroup}
              >{uiText("Ir para o grupo")}</Button>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
