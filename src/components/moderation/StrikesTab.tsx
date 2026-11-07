import { uiText, useUiLocale, uiLocale } from '@/i18n/ui-copy';
import { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  Loader2,
  Shield,
  XCircle,
  ChevronDown,
  ChevronUp,
  Undo2,
  User,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
import { Textarea } from '@/components/ui/textarea';
import { useStrikes, Strike, VIOLATION_LABELS } from '@/hooks/useStrikes';
import { formatDistanceToNow } from 'date-fns';
import { pt } from 'date-fns/locale';

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-red-500/10 text-red-600 border-red-500/20',
  expired: 'bg-muted text-muted-foreground border-border',
  appealed: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  revoked: 'bg-green-500/10 text-green-600 border-green-500/20',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Ativo',
  expired: 'Expirado',
  appealed: 'Em apelação',
  revoked: 'Revogado',
};

export default function StrikesTab() {
  useUiLocale();
  const { fetchUserStrikes, revokeStrike } = useStrikes();
  const [strikes, setStrikes] = useState<Strike[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [revokeDialog, setRevokeDialog] = useState<{ open: boolean; strikeId: string }>({ open: false, strikeId: '' });
  const [revokeReason, setRevokeReason] = useState('');

  const loadStrikes = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchUserStrikes();
      setStrikes(data);
    } catch (error) {
      console.error('Error loading strikes:', error);
    } finally {
      setLoading(false);
    }
  }, [fetchUserStrikes]);

  useEffect(() => {
    loadStrikes();
  }, [loadStrikes]);

  const handleRevoke = async () => {
    if (!revokeReason.trim()) return;
    try {
      await revokeStrike(revokeDialog.strikeId, revokeReason);
      setRevokeDialog({ open: false, strikeId: '' });
      setRevokeReason('');
      loadStrikes();
    } catch (error) {
      console.error('Error revoking strike:', error);
    }
  };

  const filtered = strikes.filter(s => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.user_profile?.display_name?.toLowerCase().includes(q) ||
      s.user_profile?.username?.toLowerCase().includes(q) ||
      s.reason.toLowerCase().includes(q) ||
      VIOLATION_LABELS[s.violation_category]?.toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Input
        placeholder={uiText("Pesquisar strikes...")}
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="max-w-sm"
      />

      {filtered.length === 0 ? (
        <Card className="p-8 text-center">
          <Shield className="w-12 h-12 mx-auto mb-3 text-green-500/50" />
          <p className="text-muted-foreground">{uiText("Nenhum strike encontrado")}</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((strike) => (
            <Card key={strike.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <Avatar className="w-9 h-9 flex-shrink-0">
                      <AvatarImage src={strike.user_profile?.avatar_url || undefined} />
                      <AvatarFallback className="text-xs">
                        <User className="w-4 h-4" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm">
                          {strike.user_profile?.display_name || uiText("Utilizador")}
                        </p>
                        <span className="text-xs text-muted-foreground">@{strike.user_profile?.username}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge variant="outline" className={STATUS_COLORS[strike.status] || ''}>
                          {STATUS_LABELS[strike.status] || strike.status}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {VIOLATION_LABELS[strike.violation_category] || strike.violation_category}
                        </Badge>
                        <Badge variant="outline" className="text-xs">{uiText("Severidade ")}{strike.severity}/3
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{strike.reason}</p>
                      <p className="text-xs text-muted-foreground mt-1">{uiText("Emitido por ")}{strike.issuer_profile?.display_name || uiText("Sistema")} •{' '}
                        {formatDistanceToNow(new Date(strike.created_at), { addSuffix: true, locale: pt })}
                      </p>

                      {expandedId === strike.id && (
                        <div className="mt-3 p-3 bg-muted/50 rounded-lg text-xs space-y-1">
                          {strike.content_type && <p><strong>{uiText("Tipo de conteúdo:")}</strong> {strike.content_type}</p>}
                          {strike.expires_at && <p><strong>{uiText("Expira em:")}</strong> {new Date(strike.expires_at).toLocaleString(uiLocale())}</p>}
                          {strike.revoke_reason && <p><strong>{uiText("Motivo da revogação:")}</strong> {strike.revoke_reason}</p>}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    {strike.status === 'active' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setRevokeDialog({ open: true, strikeId: strike.id })}
                        title={uiText("Revogar strike")}
                      >
                        <Undo2 className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setExpandedId(expandedId === strike.id ? null : strike.id)}
                    >
                      {expandedId === strike.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Revoke Dialog */}
      <AlertDialog open={revokeDialog.open} onOpenChange={(open) => setRevokeDialog(prev => ({ ...prev, open }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{uiText("Revogar Strike")}</AlertDialogTitle>
            <AlertDialogDescription>{uiText("Tens a certeza que queres revogar este strike? Esta ação será registada no log de auditoria.")}</AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder={uiText("Motivo da revogação...")}
            value={revokeReason}
            onChange={(e) => setRevokeReason(e.target.value)}
            rows={3}
          />
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRevokeReason('')}>{uiText("Cancelar")}</AlertDialogCancel>
            <AlertDialogAction disabled={!revokeReason.trim()} onClick={handleRevoke}>{uiText("Revogar")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
