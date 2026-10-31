import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  ArrowLeft, Loader2, ShieldAlert, Users, TrendingUp, Clock, Search, Crown, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';

interface Config {
  currency: string;
  pro_monthly: number;
  pro_annual: number;
  video_enabled: boolean;
  max_video_participants: number;
  video_minutes_cap: number | null;
}
interface Overview { active: number; expiring_7d: number; monthly_price: number; est_mrr: number; }
interface ProUser { id: string; display_name: string; username: string; plan_expires_at: string | null; }
interface Found { id: string; display_name: string; username: string; kyc_verified?: boolean; }

const fmtKz = (n: number) => `${n.toLocaleString('pt-PT')} Kz`;
const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export default function AdminBilling() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cfg, setCfg] = useState<Config | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [subs, setSubs] = useState<ProUser[]>([]);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Found[]>([]);
  const [searching, setSearching] = useState(false);
  const [months, setMonths] = useState(1);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate('/login');
  }, [authLoading, user, navigate]);
  useEffect(() => {
    if (!adminLoading && !isAdmin && user) { toast.error('Acesso negado. Apenas administradores.'); navigate('/'); }
  }, [adminLoading, isAdmin, user, navigate]);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: c }, { data: ov }, { data: ls }] = await Promise.all([
      supabase.from('billing_config').select('*').eq('id', 1).maybeSingle(),
      supabase.rpc('admin_billing_overview'),
      supabase.rpc('admin_list_pro_users'),
    ]);
    if (c) setCfg(c as Config);
    if (ov) setOverview(ov as unknown as Overview);
    setSubs((ls as ProUser[]) ?? []);
    setLoading(false);
  }, []);
  useEffect(() => { if (isAdmin) load(); }, [isAdmin, load]);

  const saveConfig = async () => {
    if (!cfg) return;
    setSaving(true);
    try {
      const { error } = await supabase.rpc('admin_set_billing_config', {
        p_pro_monthly: cfg.pro_monthly,
        p_pro_annual: cfg.pro_annual,
        p_video_enabled: cfg.video_enabled,
        p_max_video_participants: cfg.max_video_participants,
        p_video_minutes_cap: cfg.video_minutes_cap,
        p_currency: cfg.currency,
      });
      if (error) throw error;
      toast.success('Preço e limites guardados.');
      await load();
    } catch {
      toast.error('Não foi possível guardar.');
    } finally {
      setSaving(false);
    }
  };

  const search = async () => {
    const q = query.trim();
    if (q.length < 2) { toast.info('Escreve pelo menos 2 letras.'); return; }
    setSearching(true);
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, display_name, username, kyc_verified')
        .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
        .limit(8);
      setResults((data as Found[]) ?? []);
    } finally {
      setSearching(false);
    }
  };

  const grant = async (userId: string) => {
    setBusyId(userId);
    try {
      const { error } = await supabase.rpc('admin_set_user_plan', { p_user_id: userId, p_plan: 'pro', p_months: months });
      if (error) throw error;
      toast.success(`Pro concedido (${months} ${months === 1 ? 'mês' : 'meses'}).`);
      setResults([]); setQuery('');
      await load();
    } catch {
      toast.error('Não foi possível conceder o Pro.');
    } finally {
      setBusyId(null);
    }
  };

  const revoke = async (userId: string) => {
    setBusyId(userId);
    try {
      const { error } = await supabase.rpc('admin_set_user_plan', { p_user_id: userId, p_plan: 'free', p_months: 0 });
      if (error) throw error;
      toast.success('Pro retirado.');
      await load();
    } catch {
      toast.error('Não foi possível retirar.');
    } finally {
      setBusyId(null);
    }
  };

  if (authLoading || adminLoading || (isAdmin && loading)) {
    return <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }
  if (!isAdmin) return null;

  const toggleKyc = async (userId: string, verified: boolean) => {
    setBusyId(userId);
    try {
      const { error } = await supabase.rpc('admin_set_kyc_verified', { p_user: userId, p_verified: verified });
      if (error) throw error;
      toast.success(verified ? 'Identidade verificada (KYC).' : 'Verificação KYC retirada.');
      setResults((rs) => rs.map((r) => (r.id === userId ? { ...r, kyc_verified: verified } : r)));
    } catch {
      toast.error('Não foi possível atualizar o KYC.');
    } finally {
      setBusyId(null);
    }
  };

  const set = (patch: Partial<Config>) => setCfg((p) => (p ? { ...p, ...patch } : p));

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-sm border-b px-4 py-3 flex items-center gap-3 safe-top">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5" /></Button>
        <h1 className="text-lg font-semibold">Mokubico Pro — Faturação</h1>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-4 space-y-5">
        <Alert>
          <ShieldAlert className="h-4 w-4" />
          <AlertDescription className="text-sm">
            O preço e os limites do Pro são definidos aqui. Só o admin altera planos — o utilizador não se pode auto-promover.
          </AlertDescription>
        </Alert>

        {/* Visão geral */}
        <div className="grid grid-cols-3 gap-2">
          <Card className="border-none shadow-sm"><CardContent className="p-3 text-center">
            <Users className="h-4 w-4 mx-auto text-primary mb-1" />
            <div className="text-xl font-bold tabular-nums">{overview?.active ?? 0}</div>
            <div className="text-[11px] text-muted-foreground">Pro ativos</div>
          </CardContent></Card>
          <Card className="border-none shadow-sm"><CardContent className="p-3 text-center">
            <Clock className="h-4 w-4 mx-auto text-amber-500 mb-1" />
            <div className="text-xl font-bold tabular-nums">{overview?.expiring_7d ?? 0}</div>
            <div className="text-[11px] text-muted-foreground">Expiram &lt;7d</div>
          </CardContent></Card>
          <Card className="border-none shadow-sm"><CardContent className="p-3 text-center">
            <TrendingUp className="h-4 w-4 mx-auto text-emerald-500 mb-1" />
            <div className="text-base font-bold tabular-nums leading-7">{fmtKz(overview?.est_mrr ?? 0)}</div>
            <div className="text-[11px] text-muted-foreground">Receita/mês est.</div>
          </CardContent></Card>
        </div>

        {/* Preço & limites */}
        {cfg && (
          <Card className="border-none shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="text-base">Preço &amp; limites</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Mensal ({cfg.currency})</Label>
                  <Input type="number" inputMode="numeric" value={cfg.pro_monthly}
                    onChange={(e) => set({ pro_monthly: Number(e.target.value) })} className="h-11" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Anual ({cfg.currency})</Label>
                  <Input type="number" inputMode="numeric" value={cfg.pro_annual}
                    onChange={(e) => set({ pro_annual: Number(e.target.value) })} className="h-11" />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm">Vídeo em grupo</Label>
                  <p className="text-[11px] text-muted-foreground">O grande custo. Desliga para Pro áudio-primeiro.</p>
                </div>
                <Switch checked={cfg.video_enabled} onCheckedChange={(v) => set({ video_enabled: v })} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Máx. pessoas em vídeo</Label>
                  <Input type="number" inputMode="numeric" min={2} value={cfg.max_video_participants}
                    onChange={(e) => set({ max_video_participants: Number(e.target.value) })} className="h-11"
                    disabled={!cfg.video_enabled} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Teto vídeo min/mês</Label>
                  <Input type="number" inputMode="numeric" placeholder="ilimitado"
                    value={cfg.video_minutes_cap ?? ''}
                    onChange={(e) => set({ video_minutes_cap: e.target.value === '' ? null : Number(e.target.value) })}
                    className="h-11" disabled={!cfg.video_enabled} />
                </div>
              </div>

              <Button className="w-full h-11 rounded-xl" onClick={saveConfig} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar preço e limites'}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Conceder Pro */}
        <Card className="border-none shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-base">Conceder Pro</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              {[1, 3, 12].map((m) => (
                <button key={m} onClick={() => setMonths(m)}
                  className={`flex-1 h-9 rounded-lg text-sm font-medium border transition-colors ${
                    months === m ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary/50 border-border'}`}>
                  {m === 12 ? '1 ano' : `${m} ${m === 1 ? 'mês' : 'meses'}`}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <Input value={query} onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') search(); }}
                placeholder="Procurar por nome ou username" className="h-11" />
              <Button variant="secondary" className="h-11 px-4" onClick={search} disabled={searching}>
                {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </Button>
            </div>
            {results.map((r) => (
              <div key={r.id} className="flex items-center gap-2 p-2 rounded-lg bg-secondary/40">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate flex items-center gap-1">
                    {r.display_name}
                    {r.kyc_verified && <BadgeCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">@{r.username}</div>
                </div>
                <Button
                  size="sm"
                  variant={r.kyc_verified ? 'ghost' : 'outline'}
                  className="h-8"
                  disabled={busyId === r.id}
                  onClick={() => toggleKyc(r.id, !r.kyc_verified)}
                >
                  {busyId === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : (r.kyc_verified ? 'KYC ✓' : 'Verificar KYC')}
                </Button>
                <Button size="sm" className="h-8" onClick={() => grant(r.id)} disabled={busyId === r.id}>
                  {busyId === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Crown className="w-3.5 h-3.5 mr-1" /> Pro</>}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Subscritores atuais */}
        <Card className="border-none shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Subscritores Pro ({subs.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {subs.length === 0 && <p className="text-sm text-muted-foreground text-center py-3">Ainda sem subscritores.</p>}
            {subs.map((s) => (
              <div key={s.id} className="flex items-center gap-2 py-1.5 border-b border-border last:border-0">
                <Crown className="w-4 h-4 text-amber-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{s.display_name} <span className="text-muted-foreground font-normal">@{s.username}</span></div>
                  <div className="text-[11px] text-muted-foreground">expira {fmtDate(s.plan_expires_at)}</div>
                </div>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => revoke(s.id)} disabled={busyId === s.id}>
                  {busyId === s.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <Button variant="outline" onClick={() => navigate('/admin/mentors')}>Gestão de Mentores</Button>
      </main>
    </div>
  );
}
