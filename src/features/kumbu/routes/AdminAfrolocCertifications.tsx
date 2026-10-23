import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, ShieldAlert, ShieldCheck, MapPin, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

type StatusFilter = 'pending' | 'certified' | 'rejected' | 'all';

interface CertRow {
  id: string;
  display_name: string;
  username: string;
  afroloc_code: string | null;
  afroloc_certification_status: string;
}

const BADGE_VARIANT: Record<string, 'default' | 'secondary' | 'destructive'> = {
  pending: 'secondary',
  certified: 'default',
  rejected: 'destructive',
  none: 'secondary',
};

export default function AdminAfrolocCertifications() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<StatusFilter>('pending');
  const [rows, setRows] = useState<CertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [declarations, setDeclarations] = useState<Record<string, {method:string;city:string;neighborhood:string}>>({});
  const [reviewed, setReviewed] = useState<Record<string,boolean>>({});
  const [acting, setActing] = useState<string | null>(null);

  const fetchRows = useCallback(async () => {
    let q = supabase
      .from('profiles')
      .select('id, display_name, username, afroloc_code, afroloc_certification_status')
      .order('updated_at', { ascending: false })
      .limit(100);
    if (filter === 'all') q = q.neq('afroloc_certification_status', 'none');
    else q = q.eq('afroloc_certification_status', filter);
    const { data } = await q;
    setRows((data as CertRow[]) ?? []);
    if (data?.length) {
      const {data:claims}=await supabase.from('residence_declarations' as never).select('user_id, method, city, neighborhood').in('user_id',data.map(p=>p.id));
      const map: Record<string,{method:string;city:string;neighborhood:string}> = {};
      for (const claim of (claims || []) as unknown as Array<{user_id:string;method:string;city:string;neighborhood:string}>) map[claim.user_id]=claim;
      setDeclarations(map);
    } else setDeclarations({});
    setReviewed({});
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    setLoading(true);
    fetchRows();
  }, [fetchRows]);

  const act = async (userId: string, certified: boolean) => {
    setActing(userId);
    const { data, error } = await supabase.rpc('set_afroloc_certification', {
      p_user_id: userId,
      p_certified: certified,
    });
    const res = (data ?? {}) as { success?: boolean; error?: string };
    if (error || !res.success) {
      toast.error(res.error === 'forbidden' ? 'Sem permissão (só autoridade/admin).' : 'Erro ao atualizar.');
    } else {
      toast.success(certified ? 'Endereço certificado.' : 'Pedido rejeitado.');
      fetchRows();
    }
    setActing(null);
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-sm border-b px-4 py-3 flex items-center gap-3 safe-top">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold">Certificações AFROLOC</h1>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-4 space-y-4">
        <Alert>
          <ShieldAlert className="h-4 w-4" />
          <AlertDescription className="text-sm">
            Autoridade/admin — confirma a ligação entre utilizador e endereço antes de certificar. Um código introduzido ou uma leitura GPS, por si só, não provam residência.
          </AlertDescription>
        </Alert>

        <Tabs value={filter} onValueChange={(v) => setFilter(v as StatusFilter)}>
          <TabsList className="w-full">
            <TabsTrigger value="pending" className="flex-1 text-xs">Pendentes</TabsTrigger>
            <TabsTrigger value="certified" className="flex-1 text-xs">Certificados</TabsTrigger>
            <TabsTrigger value="rejected" className="flex-1 text-xs">Rejeitados</TabsTrigger>
            <TabsTrigger value="all" className="flex-1 text-xs">Todos</TabsTrigger>
          </TabsList>
        </Tabs>

        {loading && <p className="text-sm text-muted-foreground text-center py-8">A carregar…</p>}

        {!loading && rows.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">Sem pedidos.</p>
        )}

        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id} className="border rounded-lg p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{r.display_name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">@{r.username}</p>
                </div>
                <Badge variant={BADGE_VARIANT[r.afroloc_certification_status] ?? 'secondary'} className="text-xs shrink-0">
                  {r.afroloc_certification_status}
                </Badge>
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span className="font-mono truncate">{r.afroloc_code ?? 'sem endereço'}</span>
              </div>

              {declarations[r.id] && <p className="text-xs text-muted-foreground">Banda declarada: {declarations[r.id].neighborhood}, {declarations[r.id].city}. Origem: {declarations[r.id].method === 'home' ? 'captura no endereço' : declarations[r.id].method === 'existing' ? 'código indicado pelo utilizador' : 'confirmação adiada'}.</p>}
              {r.afroloc_certification_status !== 'certified' && <label className="flex gap-2 text-xs"><input type="checkbox" checked={!!reviewed[r.id]} onChange={e=>setReviewed(p=>({...p,[r.id]:e.target.checked}))}/>Verifiquei a ligação do utilizador a este endereço e à Banda declarada.</label>}
              {r.afroloc_certification_status !== 'certified' && (
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    className="h-8 text-xs flex-1 gap-1"
                    disabled={acting === r.id || !r.afroloc_code || !reviewed[r.id]}
                    onClick={() => act(r.id, true)}
                  >
                    {acting === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3" />}
                    Certificar
                  </Button>
                  {r.afroloc_certification_status === 'pending' && (
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-8 text-xs flex-1"
                      disabled={acting === r.id}
                      onClick={() => act(r.id, false)}
                    >
                      Rejeitar
                    </Button>
                  )}
                </div>
              )}

              {r.afroloc_certification_status === 'certified' && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  disabled={acting === r.id}
                  onClick={() => act(r.id, false)}
                >
                  Revogar certificação
                </Button>
              )}
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
