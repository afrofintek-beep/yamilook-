import { useState, useEffect } from 'react';
import { 
  Link2, 
  Copy, 
  Check, 
  Trash2, 
  Clock, 
  Users, 
  Plus,
  Loader2,
  Share2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ResponsiveModal } from '@/components/ui/responsive-modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { formatDistanceToNow } from 'date-fns';
import { pt } from 'date-fns/locale';

interface GroupInvite {
  id: string;
  code: string;
  expires_at: string | null;
  max_uses: number | null;
  uses_count: number;
  is_active: boolean;
  created_at: string;
}

interface GroupInviteSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  groupName: string;
}

const EXPIRATION_OPTIONS = [
  { value: 'never', label: 'Nunca expira' },
  { value: '1h', label: '1 hora' },
  { value: '24h', label: '24 horas' },
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
];

const MAX_USES_OPTIONS = [
  { value: 'unlimited', label: 'Ilimitado' },
  { value: '1', label: '1 uso' },
  { value: '5', label: '5 usos' },
  { value: '10', label: '10 usos' },
  { value: '25', label: '25 usos' },
  { value: '50', label: '50 usos' },
  { value: '100', label: '100 usos' },
];

export function GroupInviteSheet({ 
  open, 
  onOpenChange, 
  conversationId, 
  groupName 
}: GroupInviteSheetProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [invites, setInvites] = useState<GroupInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [expiration, setExpiration] = useState('7d');
  const [maxUses, setMaxUses] = useState('unlimited');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (open && conversationId) {
      fetchInvites();
    }
  }, [open, conversationId]);

  const fetchInvites = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('group_invites')
      .select('*')
      .eq('conversation_id', conversationId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setInvites(data);
    }
    setLoading(false);
  };

  const calculateExpiresAt = (option: string): string | null => {
    if (option === 'never') return null;
    
    const now = new Date();
    switch (option) {
      case '1h':
        return new Date(now.getTime() + 60 * 60 * 1000).toISOString();
      case '24h':
        return new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
      case '7d':
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
      case '30d':
        return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
      default:
        return null;
    }
  };

  const generateCode = async (): Promise<string> => {
    const { data, error } = await supabase.rpc('generate_invite_code');
    if (error || !data) {
      // Fallback to client-side generation
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
      let result = '';
      for (let i = 0; i < 8; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    }
    return data;
  };

  const createInvite = async () => {
    if (!user) return;
    
    setCreating(true);
    try {
      const code = await generateCode();
      const expiresAt = calculateExpiresAt(expiration);
      const maxUsesValue = maxUses === 'unlimited' ? null : parseInt(maxUses);

      const { data, error } = await supabase
        .from('group_invites')
        .insert({
          conversation_id: conversationId,
          code,
          created_by: user.id,
          expires_at: expiresAt,
          max_uses: maxUsesValue,
        })
        .select()
        .single();

      if (error) {
        toast({
          title: 'Erro',
          description: 'Não foi possível criar o convite.',
          variant: 'destructive',
        });
      } else if (data) {
        setInvites((prev) => [data, ...prev]);
        setShowCreateForm(false);
        toast({
          title: 'Convite criado!',
          description: 'O link de convite foi gerado.',
        });
      }
    } finally {
      setCreating(false);
    }
  };

  const deleteInvite = async (inviteId: string) => {
    const { error } = await supabase
      .from('group_invites')
      .update({ is_active: false })
      .eq('id', inviteId);

    if (!error) {
      setInvites((prev) => prev.filter((i) => i.id !== inviteId));
      toast({
        title: 'Convite revogado',
        description: 'O link já não funciona.',
      });
    }
  };

  const copyLink = async (code: string, inviteId: string) => {
    const link = `${window.location.origin}${window.location.pathname.startsWith('/papos-app/') ? '/papos-app' : ''}/join/${code}`;
    await navigator.clipboard.writeText(link);
    setCopiedId(inviteId);
    setTimeout(() => setCopiedId(null), 2000);
    toast({
      title: 'Link copiado!',
      description: 'Partilha com quem quiseres.',
    });
  };

  const shareLink = async (code: string) => {
    const link = `${window.location.origin}${window.location.pathname.startsWith('/papos-app/') ? '/papos-app' : ''}/join/${code}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Junta-te ao grupo ${groupName}`,
          text: `Foste convidado para o grupo "${groupName}" no Yamilook!`,
          url: link,
        });
      } catch {
        // User cancelled or share failed
      }
    } else {
      copyLink(code, '');
    }
  };

  const getExpirationText = (expiresAt: string | null) => {
    if (!expiresAt) return 'Nunca expira';
    const date = new Date(expiresAt);
    if (date < new Date()) return 'Expirado';
    return `Expira ${formatDistanceToNow(date, { addSuffix: true, locale: pt })}`;
  };

  const isExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  const isMaxedOut = (invite: GroupInvite) => {
    return invite.max_uses !== null && invite.uses_count >= invite.max_uses;
  };

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      className="h-[85vh] rounded-t-3xl sm:max-w-lg"
      title={
        <span className="text-xl flex items-center gap-2">
          <Link2 className="w-5 h-5" />
          Convites por Link
        </span>
      }
    >
        <div className="space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Create new invite */}
          <AnimatePresence mode="wait">
            {showCreateForm ? (
              <motion.div
                key="form"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-secondary/50 rounded-xl p-4 space-y-4"
              >
                <div className="space-y-2">
                  <Label>Expiração</Label>
                  <Select value={expiration} onValueChange={setExpiration}>
                    <SelectTrigger className="h-12 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EXPIRATION_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Limite de usos</Label>
                  <Select value={maxUses} onValueChange={setMaxUses}>
                    <SelectTrigger className="h-12 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MAX_USES_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 h-12 rounded-xl"
                    onClick={() => setShowCreateForm(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    className="flex-1 h-12 rounded-xl"
                    onClick={createInvite}
                    disabled={creating}
                  >
                    {creating ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      'Criar Link'
                    )}
                  </Button>
                </div>
              </motion.div>
            ) : (
              <motion.div key="button">
                <Button
                  variant="outline"
                  className="w-full h-14 rounded-xl border-dashed gap-2"
                  onClick={() => setShowCreateForm(true)}
                >
                  <Plus className="w-5 h-5" />
                  Criar novo link de convite
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Existing invites */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : invites.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Link2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Sem links de convite activos</p>
              <p className="text-sm">Cria um para partilhar o grupo</p>
            </div>
          ) : (
            <div className="space-y-3">
              {invites.map((invite) => {
                const expired = isExpired(invite.expires_at);
                const maxed = isMaxedOut(invite);
                const inactive = expired || maxed;

                return (
                  <motion.div
                    key={invite.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`bg-card border border-border/50 rounded-xl p-4 ${
                      inactive ? 'opacity-60' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <code className="text-sm font-mono bg-secondary px-2 py-1 rounded">
                            {invite.code}
                          </code>
                          {inactive && (
                            <Badge variant="secondary" className="text-xs">
                              {expired ? 'Expirado' : 'Esgotado'}
                            </Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {getExpirationText(invite.expires_at)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {invite.uses_count}
                            {invite.max_uses ? ` / ${invite.max_uses}` : ''} usos
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        {!inactive && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="rounded-full"
                              onClick={() => shareLink(invite.code)}
                            >
                              <Share2 className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="rounded-full"
                              onClick={() => copyLink(invite.code, invite.id)}
                            >
                              {copiedId === invite.id ? (
                                <Check className="w-4 h-4 text-green-500" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </Button>
                          </>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="rounded-full text-destructive hover:text-destructive"
                          onClick={() => deleteInvite(invite.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
    </ResponsiveModal>
  );
}
