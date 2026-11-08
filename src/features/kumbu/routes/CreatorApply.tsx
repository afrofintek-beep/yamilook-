import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Upload, Loader2, CheckCircle, XCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { AfrolocCertificationGate } from '../components/AfrolocCertificationGate';

type AppStatus = 'none' | 'pending' | 'approved' | 'rejected';

const STATUS_UI: Record<Exclude<AppStatus, 'none'>, { icon: React.ReactNode; label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
  pending: { icon: <Clock className="h-4 w-4" />, get label() { return uiText("Pendente"); }, variant: 'secondary' },
  approved: { icon: <CheckCircle className="h-4 w-4" />, get label() { return uiText("Aprovada"); }, variant: 'default' },
  rejected: { icon: <XCircle className="h-4 w-4" />, get label() { return uiText("Rejeitada"); }, variant: 'destructive' },
};

export default function CreatorApply() {
  useUiLocale();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [status, setStatus] = useState<AppStatus>('none');
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form
  const [fullName, setFullName] = useState(profile?.display_name ?? '');
  const [reason, setReason] = useState('');
  const [file, setFile] = useState<File | null>(null);

  // Check existing application
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('creator_applications')
        .select('status, rejection_reason')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) {
        setStatus(data.status as AppStatus);
        setRejectionReason(data.rejection_reason);
      }
      setLoading(false);
    })();
  }, [user]);

  const handleSubmit = async () => {
    if (!user || !fullName.trim()) return;
    if (!file) {
      toast.error(uiText("Anexa o teu documento de identificação."));
      return;
    }

    setSubmitting(true);
    try {
      // 1. Upload doc
      const ext = file.name.split('.').pop() ?? 'jpg';
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('creator-documents')
        .upload(path, file, { upsert: false });
      if (upErr) throw upErr;

      // 2. Insert application
      const { data: app, error: appErr } = await supabase
        .from('creator_applications')
        .insert({
          user_id: user.id,
          full_name: fullName.trim(),
          reason: reason.trim() || null,
          application_type: 'creator',
          document_url: path,
        })
        .select('id')
        .single();
      if (appErr) throw appErr;

      // 3. Insert verification doc record
      await supabase.from('creator_verification_docs').insert({
        application_id: app.id,
        user_id: user.id,
        storage_path: path,
        doc_type: 'bi',
      });

      setStatus("pending");
      toast.success(uiText("Candidatura submetida com sucesso."));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao submeter candidatura.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-sm border-b px-4 py-3 flex items-center gap-3 safe-top">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold">{uiText("Candidatura de Criador")}</h1>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-4 space-y-4">
        {loading && (
          <p className="text-sm text-muted-foreground text-center py-8">{uiText("A carregar…")}</p>
        )}

        {!loading && (
          <AfrolocCertificationGate action="te candidatares a criador">

        {/* Existing application status */}
        {status !== 'none' && (
          <Card className="border-none shadow-sm">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center gap-2">
                {STATUS_UI[status].icon}
                <span className="text-sm font-medium">{uiText("Estado da candidatura")}</span>
                <Badge variant={STATUS_UI[status].variant} className="ml-auto text-xs">
                  {STATUS_UI[status].label}
                </Badge>
              </div>
              {status === 'rejected' && rejectionReason && (
                <p className="text-xs text-muted-foreground">{rejectionReason}</p>
              )}
              {status === 'pending' && (
                <p className="text-xs text-muted-foreground">{uiText("A tua candidatura está a ser analisada. Receberás uma notificação quando for processada.")}</p>
              )}
              {status === 'approved' && (
                <p className="text-xs text-muted-foreground">{uiText('Parabéns! A tua conta de criador está ativa. Podes solicitar levantamentos.')} <button onClick={() => navigate('/payouts')} className="text-primary font-medium">{uiText('Levantamentos')}</button>
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Application form (only if no existing) */}
        {status === 'none' && (
          <Card className="border-none shadow-sm">
            <CardContent className="p-5 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="fullName" className="text-sm">{uiText("Nome completo")}</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder={uiText("Nome como consta no BI")}
                  maxLength={120}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="reason" className="text-sm">{uiText("Porquê queres ser criador? (opcional)")}</Label>
                <Textarea
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={uiText("Conta-nos a tua motivação…")}
                  maxLength={500}
                  rows={3}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm">{uiText("Documento de identificação (BI)")}</Label>
                <label className="flex items-center gap-2 px-3 py-2.5 border border-dashed rounded-lg cursor-pointer text-sm text-muted-foreground hover:border-primary/50 transition-colors">
                  <Upload className="h-4 w-4 shrink-0" />
                  <span className="truncate">{file ? file.name : uiText("Selecionar ficheiro…")}</span>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    className="sr-only"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                </label>
              </div>

              <Button
                className="w-full"
                disabled={!fullName.trim() || !file || submitting}
                onClick={handleSubmit}
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}{uiText("Submeter candidatura")}</Button>
            </CardContent>
          </Card>
        )}

          </AfrolocCertificationGate>
        )}
      </main>
    </div>
  );
}
