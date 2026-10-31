import { useState, useEffect, useCallback } from 'react';
import { Radio, Users, X, RefreshCw, Loader2, Clock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { pt } from 'date-fns/locale';

interface LiveSession {
  id: string;
  title: string;
  host_id: string;
  status: string;
  viewer_count: number;
  started_at: string | null;
  created_at: string;
  host?: {
    display_name: string;
    avatar_url: string | null;
  };
}

export function LiveSessionsManager() {
  const [loadError, setLoadError] = useState(false);
  const [confirmAll, setConfirmAll] = useState(false);
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [endingSession, setEndingSession] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    session: LiveSession | null;
  }>({ open: false, session: null });

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const { data, error } = await supabase
        .from('live_sessions')
        .select('id, title, host_id, status, viewer_count, started_at, created_at')
        .eq('status', 'live')
        .order('started_at', { ascending: false });

      if (error) throw error;

      const ids = [...new Set((data || []).map(s => s.host_id))];
      const { data: profiles, error: profileError } = ids.length
        ? await supabase.from('public_profiles').select('id, display_name, avatar_url').in('id', ids)
        : { data: [], error: null };
      if (profileError) throw profileError;
      const formattedSessions = (data || []).map(s => ({ ...s, host: profiles?.find(p => p.id === s.host_id) }));
      setSessions(formattedSessions);
    } catch (error) {
      setLoadError(true);
      console.error('Error fetching live sessions:', error);
      toast.error('Erro ao carregar sessões');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleEndSession = async (session: LiveSession) => {
    setEndingSession(session.id);
    try {
      const { error } = await supabase
        .from('live_sessions')
        .update({
          status: 'ended',
          ended_at: new Date().toISOString(),
        })
        .eq('id', session.id).select('id').single();

      if (error) throw error;

      toast.success(`Sessão "${session.title}" terminada`);
      setSessions((prev) => prev.filter((s) => s.id !== session.id));
    } catch (error) {
      console.error('Error ending session:', error);
      toast.error('Erro ao terminar sessão');
    } finally {
      setEndingSession(null);
      setConfirmDialog({ open: false, session: null });
    }
  };

  const handleEndAllSessions = async () => {
    if (sessions.length === 0) return;

    setLoading(true);
    try {
      const { data: ended, error } = await supabase
        .from('live_sessions')
        .update({
          status: 'ended',
          ended_at: new Date().toISOString(),
        })
        .eq('status', 'live').in('id', sessions.map(s => s.id)).select('id');

      if (error) throw error;

      toast.success(`${ended?.length ?? 0} sessões terminadas`);
      await fetchSessions();
    } catch (error) {
      console.error('Error ending all sessions:', error);
      toast.error('Erro ao terminar sessões');
    } finally {
      setLoading(false);
      setConfirmAll(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Radio className="w-5 h-5 text-destructive" />
              Sessões Live
            </CardTitle>
            <CardDescription>
              Gerir transmissões em direto
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={fetchSessions}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            {sessions.length > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setConfirmAll(true)}
                disabled={loading}
              >
                Terminar Todas
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : loadError ? (<div role="alert">Não foi possível carregar sessões. <Button onClick={fetchSessions}>Tentar novamente</Button></div>) : sessions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Radio className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p>Nenhuma sessão em direto</p>
            </div>
          ) : (
            <ScrollArea className="h-[300px]">
              <div className="space-y-3">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={session.host?.avatar_url || ''} />
                      <AvatarFallback>
                        {session.host?.display_name?.[0] || 'H'}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{session.title}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{session.host?.display_name || 'Unknown'}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {session.viewer_count}
                        </span>
                        {session.started_at && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatDistanceToNow(new Date(session.started_at), {
                                addSuffix: false,
                                locale: pt,
                              })}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <Badge variant="destructive" className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                      LIVE
                    </Badge>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => setConfirmDialog({ open: true, session })}
                      disabled={endingSession === session.id}
                    >
                      {endingSession === session.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <X className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={confirmAll} onOpenChange={setConfirmAll}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Terminar todas as sessões apresentadas?</AlertDialogTitle><AlertDialogDescription>Esta ação termina as transmissões listadas.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={handleEndAllSessions}>Terminar</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog({ open, session: null })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Terminar Sessão</AlertDialogTitle>
            <AlertDialogDescription>
              Tens a certeza que queres terminar "{confirmDialog.session?.title}"?
              Todos os espectadores serão desconectados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDialog.session && handleEndSession(confirmDialog.session)}
              className="bg-destructive hover:bg-destructive/90"
            >
              Terminar Sessão
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
