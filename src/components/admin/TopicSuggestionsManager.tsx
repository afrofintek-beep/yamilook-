import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Lightbulb, 
  Check, 
  X, 
  Loader2,
  Clock,
  User,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
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
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { pt } from 'date-fns/locale';

interface TopicSuggestion {
  id: string;
  name: string;
  slug: string;
  status: 'pending' | 'approved' | 'rejected';
  suggested_by: string | null;
  created_at: string;
  rejection_reason: string | null;
  suggestor?: {
    display_name: string;
    avatar_url: string | null;
  };
}

export function TopicSuggestionsManager() {
  const { user } = useAuth();
  const [suggestions, setSuggestions] = useState<TopicSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [suggestionToReject, setSuggestionToReject] = useState<TopicSuggestion | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    fetchSuggestions();
  }, []);

  const fetchSuggestions = async () => {
    try {
      const { data, error } = await supabase
        .from('topic_suggestions')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch suggestor profiles
      const userIds = [...new Set((data || []).filter(s => s.suggested_by).map(s => s.suggested_by))];
      const profilesMap: Record<string, { display_name: string; avatar_url: string | null }> = {};

      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('public_profiles')
          .select('id, display_name, avatar_url')
          .in('id', userIds);

        profiles?.forEach(p => {
          profilesMap[p.id] = { display_name: p.display_name, avatar_url: p.avatar_url };
        });
      }

      const enrichedSuggestions = (data || []).map(s => ({
        ...s,
        suggestor: s.suggested_by ? profilesMap[s.suggested_by] : undefined,
      })) as TopicSuggestion[];

      setSuggestions(enrichedSuggestions);
    } catch (error) {
      console.error('Error fetching suggestions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (suggestion: TopicSuggestion) => {
    if (!user) return;

    setProcessing(suggestion.id);
    try {
      // Get max display_order
      const { data: maxOrderData } = await supabase
        .from('discover_topics')
        .select('display_order')
        .order('display_order', { ascending: false })
        .limit(1)
        .single();

      const nextOrder = (maxOrderData?.display_order || 0) + 1;

      // Create the topic
      const { error: topicError } = await supabase
        .from('discover_topics')
        .insert({
          name: suggestion.name,
          slug: suggestion.slug,
          display_order: nextOrder,
          post_count: 0,
          is_trending: false,
        });

      if (topicError) {
        if (topicError.code === '23505') {
          toast.error('Já existe um tópico com este nome');
        } else {
          throw topicError;
        }
        return;
      }

      // Update suggestion status
      await supabase
        .from('topic_suggestions')
        .update({
          status: 'approved',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', suggestion.id);

      toast.success(`Tópico "${suggestion.name}" aprovado e criado!`);
      setSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
    } catch (error) {
      console.error('Error approving suggestion:', error);
      toast.error('Erro ao aprovar sugestão');
    } finally {
      setProcessing(null);
    }
  };

  const openRejectDialog = (suggestion: TopicSuggestion) => {
    setSuggestionToReject(suggestion);
    setRejectionReason('');
    setRejectDialogOpen(true);
  };

  const handleReject = async () => {
    if (!suggestionToReject || !user) return;

    setProcessing(suggestionToReject.id);
    try {
      await supabase
        .from('topic_suggestions')
        .update({
          status: 'rejected',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          rejection_reason: rejectionReason.trim() || null,
        })
        .eq('id', suggestionToReject.id);

      toast.success(`Sugestão "${suggestionToReject.name}" rejeitada`);
      setSuggestions(prev => prev.filter(s => s.id !== suggestionToReject.id));
      setRejectDialogOpen(false);
      setSuggestionToReject(null);
    } catch (error) {
      console.error('Error rejecting suggestion:', error);
      toast.error('Erro ao rejeitar sugestão');
    } finally {
      setProcessing(null);
    }
  };

  const pendingCount = suggestions.length;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5" />
            Sugestões de Tópicos
            {pendingCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {pendingCount} pendente{pendingCount !== 1 ? 's' : ''}
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Aprovar ou rejeitar sugestões de novos tópicos dos utilizadores
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : suggestions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Lightbulb className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Nenhuma sugestão pendente</p>
            </div>
          ) : (
            <ScrollArea className="h-[300px]">
              <div className="space-y-3">
                <AnimatePresence>
                  {suggestions.map(suggestion => (
                    <motion.div
                      key={suggestion.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -100 }}
                      className="p-4 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors"
                    >
                      <div className="space-y-3">
                        {/* Header with name and slug */}
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="text-primary">
                            #{suggestion.name}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            slug: {suggestion.slug}
                          </span>
                        </div>
                        
                        {/* User and time info */}
                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            <span>{suggestion.suggestor?.display_name || 'Utilizador anónimo'}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>
                              {formatDistanceToNow(new Date(suggestion.created_at), {
                                addSuffix: true,
                                locale: pt,
                              })}
                            </span>
                          </div>
                        </div>

                        {/* Action buttons - full width on mobile */}
                        <div className="flex items-center gap-2 pt-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => openRejectDialog(suggestion)}
                            disabled={processing === suggestion.id}
                          >
                            <X className="w-4 h-4" />
                            Rejeitar
                          </Button>
                          <Button
                            size="sm"
                            className="flex-1 gap-1"
                            onClick={() => handleApprove(suggestion)}
                            disabled={processing === suggestion.id}
                          >
                            {processing === suggestion.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Check className="w-4 h-4" />
                            )}
                            Aprovar
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Reject Dialog */}
      <AlertDialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rejeitar Sugestão</AlertDialogTitle>
            <AlertDialogDescription>
              Rejeitar a sugestão de tópico "{suggestionToReject?.name}"?
              Podes adicionar uma razão (opcional).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            placeholder="Razão da rejeição (opcional)"
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReject}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Rejeitar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}