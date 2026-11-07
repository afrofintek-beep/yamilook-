import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { useState, useEffect, useCallback } from 'react';
import {
  Loader2,
  Scale,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  User,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
import { useAppeals, Appeal } from '@/hooks/useAppeals';
import { formatDistanceToNow } from 'date-fns';
import { pt } from 'date-fns/locale';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  pending: { get label() { return uiText("Pendente"); }, color: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20', icon: Clock },
  under_review: { get label() { return uiText("Em análise"); }, color: 'bg-blue-500/10 text-blue-600 border-blue-500/20', icon: Eye },
  approved: { get label() { return uiText("Aprovada"); }, color: 'bg-green-500/10 text-green-600 border-green-500/20', icon: CheckCircle },
  rejected: { get label() { return uiText("Rejeitada"); }, color: 'bg-red-500/10 text-red-600 border-red-500/20', icon: XCircle },
};

const APPEAL_TYPE_LABELS: Record<string, string> = {
  strike: 'Strike',
  content_removal: 'Remoção de conteúdo',
  suspension: 'Suspensão',
  ban: 'Banimento',
};

export default function AppealsTab() {
  useUiLocale();
  const { fetchAppeals, reviewAppeal } = useAppeals();
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [reviewDialog, setReviewDialog] = useState<{
    open: boolean;
    appealId: string;
    decision: 'approved' | 'rejected';
  }>({ open: false, appealId: '', decision: 'approved' });
  const [reviewNote, setReviewNote] = useState('');

  const loadAppeals = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAppeals(filter);
      setAppeals(data);
    } catch (error) {
      console.error('Error loading appeals:', error);
    } finally {
      setLoading(false);
    }
  }, [fetchAppeals, filter]);

  useEffect(() => {
    loadAppeals();
  }, [loadAppeals]);

  const handleReview = async () => {
    if (!reviewNote.trim()) return;
    try {
      await reviewAppeal(reviewDialog.appealId, reviewDialog.decision, reviewNote);
      setReviewDialog({ open: false, appealId: '', decision: 'approved' });
      setReviewNote('');
      loadAppeals();
    } catch (error) {
      console.error('Error reviewing appeal:', error);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {['pending', 'under_review', 'approved', 'rejected', 'all'].map((f) => (
          <Button
            key={f}
            variant={filter === f ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(f)}
            className="flex-shrink-0"
          >
            {f === 'all' ? uiText("Todas") : STATUS_CONFIG[f]?.label || f}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : appeals.length === 0 ? (
        <Card className="p-8 text-center">
          <Scale className="w-12 h-12 mx-auto mb-3 text-blue-500/50" />
          <p className="text-muted-foreground">{uiText("Nenhuma apelação ")}{filter !== 'all' ? STATUS_CONFIG[filter]?.label.toLowerCase() : ''}</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {appeals.map((appeal) => {
            const statusCfg = STATUS_CONFIG[appeal.status] || STATUS_CONFIG.pending;
            const StatusIcon = statusCfg.icon;

            return (
              <Card key={appeal.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <Avatar className="w-9 h-9 flex-shrink-0">
                        <AvatarImage src={appeal.user_profile?.avatar_url || undefined} />
                        <AvatarFallback className="text-xs">
                          <User className="w-4 h-4" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-sm">
                            {appeal.user_profile?.display_name || uiText("Utilizador")}
                          </p>
                          <Badge variant="outline" className={statusCfg.color}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {statusCfg.label}
                          </Badge>
                        </div>
                        <Badge variant="secondary" className="text-xs mt-1">
                          {APPEAL_TYPE_LABELS[appeal.appeal_type] || appeal.appeal_type}
                        </Badge>
                        <p className="text-sm mt-2">{appeal.reason}</p>
                        {appeal.evidence_text && (
                          <p className="text-xs text-muted-foreground mt-1 italic">"{appeal.evidence_text}"</p>
                        )}
                        {appeal.resolution_note && (
                          <div className="mt-2 p-2 bg-muted/50 rounded text-xs">
                            <strong>{uiText("Resolução:")}</strong> {appeal.resolution_note}
                            {appeal.reviewer_profile && (
                              <span className="text-muted-foreground"> — {appeal.reviewer_profile.display_name}</span>
                            )}
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(appeal.created_at), { addSuffix: true, locale: pt })}
                        </p>
                      </div>
                    </div>

                    {appeal.status === 'pending' && (
                      <div className="flex gap-1 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-500/10"
                          onClick={() => setReviewDialog({ open: true, appealId: appeal.id, decision: 'approved' })}
                          title={uiText("Aprovar")}
                        >
                          <CheckCircle className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-500/10"
                          onClick={() => setReviewDialog({ open: true, appealId: appeal.id, decision: 'rejected' })}
                          title={uiText("Rejeitar")}
                        >
                          <XCircle className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Review Dialog */}
      <AlertDialog open={reviewDialog.open} onOpenChange={(open) => setReviewDialog(prev => ({ ...prev, open }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {reviewDialog.decision === 'approved' ? uiText("Aprovar apelação") : uiText("Rejeitar apelação")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {reviewDialog.decision === 'approved'
                ? uiText("Ao aprovar, o strike associado será automaticamente revogado.")
                : uiText("Ao rejeitar, o strike permanecerá ativo.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder={uiText("Nota de resolução...")}
            value={reviewNote}
            onChange={(e) => setReviewNote(e.target.value)}
            rows={3}
          />
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setReviewNote('')}>{uiText("Cancelar")}</AlertDialogCancel>
            <AlertDialogAction disabled={!reviewNote.trim()} onClick={handleReview}>
              {reviewDialog.decision === 'approved' ? uiText("Aprovar") : uiText("Rejeitar")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
