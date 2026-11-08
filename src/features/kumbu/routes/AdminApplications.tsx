import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, ShieldAlert, ExternalLink, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from '@/i18n/ui-date';
import { pt } from 'date-fns/locale';

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected' | 'suspended';

const BADGE_VARIANT: Record<string, 'default' | 'secondary' | 'destructive'> = {
  pending: 'secondary',
  approved: 'default',
  rejected: 'destructive',
  suspended: 'destructive',
};

export default function AdminApplications() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<StatusFilter>('pending');
  const [apps, setApps] = useState<Tables<'creator_applications'>[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    let q = supabase
      .from('creator_applications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (filter !== 'all') q = q.eq('status', filter);
    const { data } = await q;
    setApps(data ?? []);
    setLoading(false);
  }, [filter]);

  useEffect(() => { setLoading(true); fetch(); }, [fetch]);

  const updateStatus = async (id: string, status: string) => {
    setActing(id);
    const { error } = await supabase
      .from('creator_applications')
      .update({ status, reviewed_at: new Date().toISOString() })
      .eq('id', id);
    if (error) toast.error(error.message);
    else { toast.success(`Candidatura ${status}.`); fetch(); }
    setActing(null);
  };

  const openDoc = (path: string) => {
    const { data } = supabase.storage.from('creator-documents').getPublicUrl(path);
    // For private buckets, use createSignedUrl instead
    supabase.storage.from('creator-documents').createSignedUrl(path, 300).then(({ data: signed }) => {
      if (signed?.signedUrl) window.open(signed.signedUrl, '_blank');
      else toast.error('Não foi possível abrir o documento.');
    });
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-sm border-b px-4 py-3 flex items-center gap-3 safe-top">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold">Candidaturas</h1>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-4 space-y-4">
        <Alert>
          <ShieldAlert className="h-4 w-4" />
          <AlertDescription className="text-sm">Admin only — acesso verificado por role.</AlertDescription>
        </Alert>

        <Tabs value={filter} onValueChange={(v) => setFilter(v as StatusFilter)}>
          <TabsList className="w-full">
            <TabsTrigger value="pending" className="flex-1 text-xs">Pendentes</TabsTrigger>
            <TabsTrigger value="approved" className="flex-1 text-xs">Aprovadas</TabsTrigger>
            <TabsTrigger value="rejected" className="flex-1 text-xs">Rejeitadas</TabsTrigger>
            <TabsTrigger value="all" className="flex-1 text-xs">Todas</TabsTrigger>
          </TabsList>
        </Tabs>

        {loading && <p className="text-sm text-muted-foreground text-center py-8">A carregar…</p>}

        {!loading && apps.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">Sem candidaturas.</p>
        )}

        <ul className="space-y-3">
          {apps.map((a) => (
            <li key={a.id} className="border rounded-lg p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{a.full_name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {format(new Date(a.created_at), "d MMM yyyy · HH:mm", { locale: pt })}
                  </p>
                </div>
                <Badge variant={BADGE_VARIANT[a.status] ?? 'secondary'} className="text-xs shrink-0">
                  {a.status}
                </Badge>
              </div>

              {a.reason && <p className="text-xs text-muted-foreground">{a.reason}</p>}

              {a.document_url && (
                <Button variant="ghost" size="sm" className="gap-1 text-xs h-7 px-2" onClick={() => openDoc(a.document_url)}>
                  <ExternalLink className="h-3 w-3" /> Ver documento
                </Button>
              )}

              {a.status === 'pending' && (
                <div className="flex gap-2 pt-1">
                  <Button size="sm" className="h-8 text-xs flex-1" disabled={acting === a.id} onClick={() => updateStatus(a.id, 'approved')}>
                    {acting === a.id && <Loader2 className="h-3 w-3 animate-spin" />} Aprovar
                  </Button>
                  <Button size="sm" variant="destructive" className="h-8 text-xs flex-1" disabled={acting === a.id} onClick={() => updateStatus(a.id, 'rejected')}>
                    Rejeitar
                  </Button>
                </div>
              )}

              {a.status === 'approved' && (
                <Button size="sm" variant="outline" className="h-8 text-xs" disabled={acting === a.id} onClick={() => updateStatus(a.id, 'suspended')}>
                  Suspender
                </Button>
              )}
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
