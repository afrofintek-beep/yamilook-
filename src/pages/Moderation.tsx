import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Shield,
  ArrowLeft,
  Loader2,
  Flag,
  Eye,
  EyeOff,
  UserX,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  History,
  BarChart3,
  MessageSquare,
  FileText,
  Users,
  Ban,
  MoreVertical,
  Scale,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const StrikesTab = lazy(() => import('@/components/moderation/StrikesTab'));
const AppealsTab = lazy(() => import('@/components/moderation/AppealsTab'));
const IssueStrikeSheet = lazy(() => import('@/components/moderation/IssueStrikeSheet'));
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/useAuth';
import { useModeration, ContentReport, ModerationAction, ModerationStats } from '@/hooks/useModeration';
import { formatDistanceToNow } from '@/i18n/ui-date';
import { pt } from 'date-fns/locale';

const CATEGORY_LABELS: Record<string, string> = {
  spam: 'Spam',
  harassment: 'Assédio',
  hate_speech: 'Discurso de ódio',
  nudity: 'Nudez',
  violence: 'Violência',
  misinformation: 'Desinformação',
  impersonation: 'Personificação',
  other: 'Outro',
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  pending: { get label() { return uiText("Pendente"); }, color: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20', icon: Clock },
  reviewing: { get label() { return uiText("Em revisão"); }, color: 'bg-blue-500/10 text-blue-600 border-blue-500/20', icon: Eye },
  resolved: { get label() { return uiText("Resolvida"); }, color: 'bg-green-500/10 text-green-600 border-green-500/20', icon: CheckCircle },
  dismissed: { get label() { return uiText("Descartada"); }, color: 'bg-muted text-muted-foreground border-border', icon: XCircle },
};

const ACTION_LABELS: Record<string, string> = {
  hide_post: 'Ocultou post',
  unhide_post: 'Restaurou post',
  delete_post: 'Eliminou post',
  hide_comment: 'Ocultou comentário',
  unhide_comment: 'Restaurou comentário',
  delete_comment: 'Eliminou comentário',
  warn_user: 'Avisou utilizador',
  suspend_user: 'Suspendeu utilizador',
  unsuspend_user: 'Removeu suspensão',
  ban_user: 'Baniu utilizador',
  unban_user: 'Removeu banimento',
  dismiss_report: 'Descartou denúncia',
  resolve_report: 'Resolveu denúncia',
};

export default function Moderation() {
  useUiLocale();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const {
    isModerator,
    loading: modLoading,
    fetchReports,
    fetchStats,
    fetchAuditLog,
    resolveReport,
    hidePost,
    hideComment,
    suspendUser,
    banUser,
  } = useModeration();

  const [stats, setStats] = useState<ModerationStats | null>(null);
  const [reports, setReports] = useState<ContentReport[]>([]);
  const [auditLog, setAuditLog] = useState<ModerationAction[]>([]);
  const [activeTab, setActiveTab] = useState('reports');
  const [reportFilter, setReportFilter] = useState<string>('pending');
  const [loadingData, setLoadingData] = useState(true);

  // Strike sheet
  const [issueStrikeSheet, setIssueStrikeSheet] = useState<{
    open: boolean;
    userId?: string;
    displayName?: string;
    reportId?: string;
    contentType?: string;
    contentId?: string;
  }>({ open: false });

  // Action dialog
  const [actionDialog, setActionDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    action: () => Promise<void>;
  }>({ open: false, title: '', description: '', action: async () => {} });

  // Reason input
  const [reasonInput, setReasonInput] = useState('');
  const [showReasonDialog, setShowReasonDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    type: string;
    report: ContentReport;
  } | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate('/login');
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!modLoading && !isModerator && user) {
      navigate('/');
    }
  }, [isModerator, modLoading, user, navigate]);

  const loadData = useCallback(async () => {
    setLoadingData(true);
    try {
      const [statsData, reportsData, logData] = await Promise.all([
        fetchStats(),
        fetchReports(reportFilter !== 'all' ? reportFilter : undefined),
        fetchAuditLog(),
      ]);
      setStats(statsData);
      setReports(reportsData);
      setAuditLog(logData);
    } catch (error) {
      console.error('Error loading moderation data:', error);
    } finally {
      setLoadingData(false);
    }
  }, [fetchStats, fetchReports, fetchAuditLog, reportFilter]);

  useEffect(() => {
    if (isModerator) loadData();
  }, [isModerator, loadData]);

  const handleReportAction = (type: string, report: ContentReport) => {
    setPendingAction({ type, report });
    setReasonInput('');

    if (type === 'dismiss') {
      setActionDialog({
        open: true,
        title: uiText("Descartar denúncia"),
        description: uiText("Tens a certeza que queres descartar esta denúncia?"),
        action: async () => {
          await resolveReport(report.id, 'dismissed', 'Descartada pelo moderador');
          loadData();
        },
      });
    } else {
      setShowReasonDialog(true);
    }
  };

  const executeAction = async () => {
    if (!pendingAction || !reasonInput.trim()) return;
    const { type, report } = pendingAction;

    try {
      switch (type) {
        case 'hide_post':
          await hidePost(report.target_id, reasonInput, report.id);
          await resolveReport(report.id, 'resolved', reasonInput);
          break;
        case 'hide_comment':
          await hideComment(report.target_id, reasonInput, report.id);
          await resolveReport(report.id, 'resolved', reasonInput);
          break;
        case 'suspend_24h':
          await suspendUser(report.target_id, 24, reasonInput, report.id);
          await resolveReport(report.id, 'resolved', reasonInput);
          break;
        case 'suspend_7d':
          await suspendUser(report.target_id, 168, reasonInput, report.id);
          await resolveReport(report.id, 'resolved', reasonInput);
          break;
        case 'ban':
          await banUser(report.target_id, reasonInput, report.id);
          await resolveReport(report.id, 'resolved', reasonInput);
          break;
      }
      loadData();
    } catch (error) {
      console.error('Error executing action:', error);
    } finally {
      setShowReasonDialog(false);
      setPendingAction(null);
      setReasonInput('');
    }
  };

  if (authLoading || modLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isModerator) return null;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-lg border-b border-border safe-top">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate(-1)}
              className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              <h1 className="text-lg font-bold">{uiText("Moderação")}</h1>
            </div>
          </div>
          <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500/20">{uiText("Moderador")}</Badge>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Stats */}
        {stats && (
          <motion.div
            className="grid grid-cols-2 md:grid-cols-3 gap-3"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="p-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-500" />
                <div>
                  <p className="text-xl font-bold">{stats.pending_reports}</p>
                  <p className="text-xs text-muted-foreground">{uiText("Pendentes")}</p>
                </div>
              </div>
            </Card>
            <Card className="p-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <div>
                  <p className="text-xl font-bold">{stats.resolved_today}</p>
                  <p className="text-xs text-muted-foreground">{uiText("Resolvidas hoje")}</p>
                </div>
              </div>
            </Card>
            <Card className="p-3">
              <div className="flex items-center gap-2">
                <EyeOff className="w-5 h-5 text-orange-500" />
                <div>
                  <p className="text-xl font-bold">{stats.hidden_posts}</p>
                  <p className="text-xs text-muted-foreground">{uiText("Posts ocultos")}</p>
                </div>
              </div>
            </Card>
            <Card className="p-3">
              <div className="flex items-center gap-2">
                <UserX className="w-5 h-5 text-red-500" />
                <div>
                  <p className="text-xl font-bold">{stats.suspended_users}</p>
                  <p className="text-xs text-muted-foreground">{uiText("Suspensos")}</p>
                </div>
              </div>
            </Card>
            <Card className="p-3">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-blue-500" />
                <div>
                  <p className="text-xl font-bold">{stats.total_actions}</p>
                  <p className="text-xs text-muted-foreground">{uiText("Ações total")}</p>
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full">
            <TabsTrigger value="reports" className="flex-1 gap-1">
              <Flag className="w-4 h-4" />{uiText("Denúncias")}</TabsTrigger>
            <TabsTrigger value="strikes" className="flex-1 gap-1">
              <Zap className="w-4 h-4" />{uiText("Strikes")}</TabsTrigger>
            <TabsTrigger value="appeals" className="flex-1 gap-1">
              <Scale className="w-4 h-4" />{uiText("Apelações")}</TabsTrigger>
            <TabsTrigger value="audit" className="flex-1 gap-1">
              <History className="w-4 h-4" />{uiText("Log")}</TabsTrigger>
          </TabsList>

          {/* Reports Tab */}
          <TabsContent value="reports" className="mt-4 space-y-3">
            {/* Filter */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              {['pending', 'reviewing', 'resolved', 'dismissed', 'all'].map((filter) => (
                <Button
                  key={filter}
                  variant={reportFilter === filter ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setReportFilter(filter)}
                  className="flex-shrink-0"
                >
                  {filter === 'all' ? uiText("Todas") : STATUS_CONFIG[filter]?.label || filter}
                </Button>
              ))}
            </div>

            {loadingData ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : reports.length === 0 ? (
              <Card className="p-8 text-center">
                <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-500/50" />
                <p className="text-muted-foreground">{uiText("Nenhuma denúncia {{value1}}", { value1: (reportFilter !== 'all' ? STATUS_CONFIG[reportFilter]?.label.toLowerCase() : '') ?? "" })}</p>
              </Card>
            ) : (
              <div className="space-y-3">
                {reports.map((report) => {
                  const statusCfg = STATUS_CONFIG[report.status] || STATUS_CONFIG.pending;
                  const StatusIcon = statusCfg.icon;

                  return (
                    <Card key={report.id} className="overflow-hidden">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <Avatar className="w-9 h-9 flex-shrink-0">
                              <AvatarImage src={report.reporter?.avatar_url || undefined} />
                              <AvatarFallback className="text-xs">
                                {report.reporter?.display_name?.[0]?.toUpperCase() || '?'}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-medium text-sm">
                                  {report.reporter?.display_name || uiText("Anónimo")}
                                </p>
                                <Badge variant="outline" className={statusCfg.color}>
                                  <StatusIcon className="w-3 h-3 mr-1" />
                                  {statusCfg.label}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                <Badge variant="secondary" className="text-xs">
                                  {report.target_type === 'post' ? <FileText className="w-3 h-3 mr-1" /> :
                                   report.target_type === 'comment' ? <MessageSquare className="w-3 h-3 mr-1" /> :
                                   <Users className="w-3 h-3 mr-1" />}
                                  {report.target_type === 'post' ? uiText("Post") : report.target_type === 'comment' ? uiText("Comentário") : uiText("Utilizador")}
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  {CATEGORY_LABELS[report.category] || report.category}
                                </Badge>
                              </div>
                              {report.description && (
                                <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                                  {report.description}
                                </p>
                              )}
                              <p className="text-xs text-muted-foreground mt-1">
                                {formatDistanceToNow(new Date(report.created_at), { addSuffix: true, locale: pt })}
                              </p>
                            </div>
                          </div>

                          {report.status === 'pending' && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {report.target_type === 'post' && (
                                  <DropdownMenuItem onClick={() => handleReportAction('hide_post', report)}>
                                    <EyeOff className="w-4 h-4 mr-2" />{uiText("Ocultar post")}</DropdownMenuItem>
                                )}
                                {report.target_type === 'comment' && (
                                  <DropdownMenuItem onClick={() => handleReportAction('hide_comment', report)}>
                                    <EyeOff className="w-4 h-4 mr-2" />{uiText("Ocultar comentário")}</DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => setIssueStrikeSheet({
                                  open: true,
                                  userId: report.target_id,
                                  reportId: report.id,
                                  contentType: report.target_type,
                                  contentId: report.target_id,
                                })}>
                                  <Zap className="w-4 h-4 mr-2" />{uiText("Emitir Strike")}</DropdownMenuItem>
                                {report.target_type === 'user' && (
                                  <>
                                    <DropdownMenuItem onClick={() => handleReportAction('suspend_24h', report)}>
                                      <Clock className="w-4 h-4 mr-2" />{uiText("Suspender 24h")}</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleReportAction('suspend_7d', report)}>
                                      <Clock className="w-4 h-4 mr-2" />{uiText("Suspender 7 dias")}</DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => handleReportAction('ban', report)}
                                      className="text-destructive"
                                    >
                                      <Ban className="w-4 h-4 mr-2" />{uiText("Banir utilizador")}</DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                  </>
                                )}
                                <DropdownMenuItem onClick={() => handleReportAction('dismiss', report)}>
                                  <XCircle className="w-4 h-4 mr-2" />{uiText("Descartar")}</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Strikes Tab */}
          <TabsContent value="strikes" className="mt-4">
            <Suspense fallback={<div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>}>
              <StrikesTab />
            </Suspense>
          </TabsContent>

          {/* Appeals Tab */}
          <TabsContent value="appeals" className="mt-4">
            <Suspense fallback={<div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>}>
              <AppealsTab />
            </Suspense>
          </TabsContent>

          {/* Audit Tab */}
          <TabsContent value="audit" className="mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <History className="w-4 h-4" />{uiText("Log de Auditoria")}</CardTitle>
                <CardDescription>{uiText("Todas as ações de moderação registadas")}</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {loadingData ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : auditLog.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <History className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p>{uiText("Nenhuma ação registada")}</p>
                  </div>
                ) : (
                  <ScrollArea className="max-h-[500px]">
                    <div className="divide-y divide-border">
                      {auditLog.map((action) => (
                        <div key={action.id} className="p-4 flex items-start gap-3">
                          <Avatar className="w-8 h-8 flex-shrink-0">
                            <AvatarImage src={action.moderator?.avatar_url || undefined} />
                            <AvatarFallback className="text-xs">
                              {action.moderator?.display_name?.[0]?.toUpperCase() || 'M'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm">
                              <span className="font-medium">{action.moderator?.display_name || uiText("Moderador")}</span>
                              {' '}
                              <span className="text-muted-foreground">{ACTION_LABELS[action.action_type] || action.action_type}</span>
                            </p>
                            {action.reason && (
                              <p className="text-xs text-muted-foreground mt-1">{uiText("Motivo: {{value1}}", { value1: (action.reason) ?? "" })}</p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              {formatDistanceToNow(new Date(action.created_at), { addSuffix: true, locale: pt })}
                            </p>
                          </div>
                          <Badge variant="secondary" className="text-xs flex-shrink-0">
                            {action.target_type}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Issue Strike Sheet */}
      <Suspense fallback={null}>
        <IssueStrikeSheet
          open={issueStrikeSheet.open}
          onOpenChange={(open) => setIssueStrikeSheet(prev => ({ ...prev, open }))}
          targetUserId={issueStrikeSheet.userId}
          reportId={issueStrikeSheet.reportId}
          contentType={issueStrikeSheet.contentType}
          contentId={issueStrikeSheet.contentId}
          onComplete={loadData}
        />
      </Suspense>

      {/* Confirm Dialog */}
      <AlertDialog open={actionDialog.open} onOpenChange={(open) => setActionDialog(prev => ({ ...prev, open }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{actionDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>{actionDialog.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{uiText("Cancelar")}</AlertDialogCancel>
            <AlertDialogAction onClick={async () => {
              await actionDialog.action();
              setActionDialog(prev => ({ ...prev, open: false }));
            }}>{uiText("Confirmar")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reason Dialog */}
      <AlertDialog open={showReasonDialog} onOpenChange={setShowReasonDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{uiText("Motivo da ação")}</AlertDialogTitle>
            <AlertDialogDescription>{uiText("Indica o motivo para esta ação de moderação. Este registo ficará no log de auditoria.")}</AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder={uiText("Descreve o motivo...")}
            value={reasonInput}
            onChange={(e) => setReasonInput(e.target.value)}
            rows={3}
          />
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setPendingAction(null);
              setReasonInput('');
            }}>{uiText("Cancelar")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={!reasonInput.trim()}
              onClick={executeAction}
            >{uiText("Confirmar ação")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
