import { submitResidence } from '@/lib/residence';
import { useEffect, useMemo, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { MapPin, Loader2, ShieldCheck, Home, Clock, Flame, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { AFRICAN_LOCATIONS } from '@/lib/african-locations';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { snapToGrid } from '@/lib/geo-privacy';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  current: { country_code: string | null; city: string | null; neighborhood: string | null };
  onChanged: () => void;
}

interface Residency {
  status: 'none' | 'novo' | 'residente' | 'verificado';
  days?: number;
  activity?: number;
  present_days_14?: number;
  need_present?: number;
  next_change_at?: string;
  can_change_now?: boolean;
}

const RESIDENCY_BADGE: Record<string, { label: string; className: string; icon: typeof Home }> = {
  novo: { label: 'Novo na banda', className: 'bg-amber-500/15 text-amber-600', icon: Home },
  residente: { label: 'Membro com antiguidade', className: 'bg-sky-500/15 text-sky-600', icon: Home },
  verificado: { label: 'Presença regular', className: 'bg-emerald-500/15 text-emerald-600', icon: ShieldCheck },
};

/** "Mudei-me" — change the user's banda (neighborhood). One change per 60 days.
 *  Captures the new location so the AFROLOC code regenerates for the new place. */
export function BandaChangeSheet({ open, onOpenChange, current, onChanged }: Props) {
  const [country, setCountry] = useState(current.country_code || 'AO');
  const [city, setCity] = useState(current.city || '');
  const [neighborhood, setNeighborhood] = useState(current.neighborhood || '');
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [homeConfirmed, setHomeConfirmed] = useState(false);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [streak, setStreak] = useState<number | null>(null);
  const [residency, setResidency] = useState<Residency | null>(null);

  const loadResidency = () =>
    supabase.rpc('banda_residency', {}).then(({ data }) => setResidency((data as unknown as Residency) ?? null));

  useEffect(() => {
    if (!open) return;
    setCountry(current.country_code || 'AO');
    setCity(current.city || '');
    setNeighborhood(current.neighborhood || '');
    setGps(null);
    setHomeConfirmed(false);
    setGpsAccuracy(null);
    setStreak(null);
    loadResidency();
  }, [open, current]);

  const checkIn = async () => {
    setChecking(true);
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 10000 }),
      );
      const _cell = snapToGrid(pos.coords.latitude, pos.coords.longitude);
      const { data, error } = await supabase.rpc('podp_check_in', {
        p_lat: _cell.lat,
        p_lng: _cell.lng,
        p_accuracy: pos.coords.accuracy ?? null,
      });
      if (error) throw error;
      const r = data as { ok: boolean; reason?: string; present?: boolean; already?: boolean; streak?: number };
      if (!r.ok) {
        toast.error(r.reason === 'no_home' ? 'Define primeiro a tua banda.'
          : r.reason === 'low_accuracy' ? 'Sinal fraco — tenta ao ar livre.'
          : 'Não foi possível fazer check-in.');
        return;
      }
      if (!r.present) toast.error('Estás longe da tua banda — o check-in conta perto de casa.');
      else if (r.already) toast.info('Já fizeste check-in hoje. 👍🏾');
      else toast.success('Check-in feito! Presença registada. 🏡');
      if (typeof r.streak === 'number') setStreak(r.streak);
      await loadResidency();
    } catch {
      toast.error('Não foi possível confirmar a tua presença.');
    } finally {
      setChecking(false);
    }
  };

  const countryData = useMemo(() => AFRICAN_LOCATIONS.find((l) => l.countryCode === country), [country]);
  const cities = countryData?.cities ?? [];
  const neighborhoods = cities.find((c) => c.name === city)?.neighborhoods ?? [];

  const changingBanda = neighborhood.trim() !== (current.neighborhood || '').trim()
    || city.trim() !== (current.city || '').trim();
  const blockedByCooldown = changingBanda && residency?.can_change_now === false;
  const nextChange = residency?.next_change_at
    ? new Date(residency.next_change_at).toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' })
    : null;

  const useGps = async () => {
    if (!homeConfirmed) return;
    setLocating(true);
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 10000 }),
      );
      const _cell = snapToGrid(pos.coords.latitude, pos.coords.longitude);
      setGps({ lat: _cell.lat, lng: _cell.lng });
      setGpsAccuracy(pos.coords.accuracy);
      toast.success('Localização captada. A validação fica pendente.');
    } catch {
      toast.error('Não foi possível gerar o teu endereço AFROLOC.');
    } finally {
      setLocating(false);
    }
  };

  const save = async () => {
    if (!neighborhood || !city) {
      toast.info('Escolhe cidade e bairro.');
      return;
    }
    setSaving(true);
    try {
      await submitResidence(gps && homeConfirmed
        ? {method:'home',lat:gps.lat,lng:gps.lng,accuracy:gpsAccuracy || undefined}
        : {method:'away'},country,city,neighborhood);
      toast.success(changingBanda ? 'Mudaste de banda! 🏡' : 'Endereço AFROLOC atualizado.');
      onChanged();
      onOpenChange(false);
    } catch {
      toast.error('Não foi possível guardar. Verifica o prazo de mudança de Banda e tenta novamente.');
    } finally {
      setSaving(false);
    }
  };

  const badge = residency && residency.status !== 'none' ? RESIDENCY_BADGE[residency.status] : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-auto max-h-[88vh] overflow-y-auto rounded-t-3xl">
        <SheetHeader className="mb-4">
          <SheetTitle className="flex items-center gap-2"><MapPin className="w-5 h-5 text-primary" /> A minha banda</SheetTitle>
        </SheetHeader>

        <div className="space-y-4">
          {/* Current banda + residency */}
          <div className="rounded-2xl bg-secondary/50 p-4 space-y-2">
            <div className="text-sm text-muted-foreground">Banda atual</div>
            <div className="text-base font-semibold">
              {current.neighborhood || '—'}{current.city ? ` · ${current.city}` : ''}
            </div>
            {badge && (
              <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium', badge.className)}>
                <badge.icon className="w-3.5 h-3.5" /> {badge.label}
              </span>
            )}
            {residency && residency.status !== 'none' && residency.status !== 'verificado' && (
              <p className="text-[11px] text-muted-foreground">
                A antiguidade, a atividade e os check-ins mostram participação. A validação do endereço é um processo separado.
              </p>
            )}
          </div>

          {/* PoDP — prova de presença na banda por check-in */}
          {residency && residency.status !== 'none' && (
            <div className="rounded-2xl border border-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-primary" /> Presença na banda
                </div>
                {(streak ?? 0) > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs text-orange-600 font-medium">
                    <Flame className="w-3.5 h-3.5" /> {streak} {streak === 1 ? 'dia' : 'dias'}
                  </span>
                )}
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>Últimos 14 dias</span>
                  <span>{residency.present_days_14 ?? 0}/{residency.need_present ?? 8} dias</span>
                </div>
                <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${Math.min(100, ((residency.present_days_14 ?? 0) / (residency.need_present ?? 8)) * 100)}%` }}
                  />
                </div>
              </div>
              <Button
                type="button" variant="secondary"
                className="w-full h-11 rounded-xl"
                onClick={checkIn} disabled={checking}
              >
                {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4 mr-1" />}
                Estou na minha banda
              </Button>
              <p className="text-[11px] text-muted-foreground">
                Um check-in por dia, perto de casa, prova que vives mesmo aqui.
              </p>
            </div>
          )}

          {/* Cooldown notice */}
          {residency?.can_change_now === false && nextChange && (
            <div className="flex items-start gap-2 rounded-xl bg-amber-500/10 text-amber-700 p-3 text-xs">
              <Clock className="w-4 h-4 mt-0.5 shrink-0" />
              <span>Mudaste de banda há pouco. Podes voltar a mudar a partir de <b>{nextChange}</b>.</span>
            </div>
          )}

          {/* Mudei-me — new location */}
          <div className="space-y-3 pt-1">
            <Label className="text-sm font-medium">Mudei-me — para onde?</Label>

            <div className="grid grid-cols-1 gap-3">
              <Select value={country} onValueChange={(v) => { setCountry(v); setCity(''); setNeighborhood(''); }}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="País" /></SelectTrigger>
                <SelectContent className="z-[9999] max-h-64">
                  {AFRICAN_LOCATIONS.map((l) => (
                    <SelectItem key={l.countryCode} value={l.countryCode}>{l.country}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={city} onValueChange={(v) => { setCity(v); setNeighborhood(''); }}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Cidade" /></SelectTrigger>
                <SelectContent className="z-[9999] max-h-64">
                  {cities.map((c) => <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>

              <Select value={neighborhood} onValueChange={setNeighborhood} disabled={!city}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Bairro / banda" /></SelectTrigger>
                <SelectContent className="z-[9999] max-h-64">
                  {neighborhoods.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={homeConfirmed} onChange={e=>{setHomeConfirmed(e.target.checked);if(!e.target.checked)setGps(null);}}/>Estou agora no meu endereço de residência</label>
            <Button
              type="button" variant="outline"
              className={cn('w-full h-11 rounded-xl', gps && 'border-green-500 text-green-600')}
              onClick={useGps} disabled={locating || !homeConfirmed}
            >
              {locating ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4 mr-1" />}
              {gps ? 'Localização captada — validação pendente' : 'Captar localização do meu endereço'}
            </Button>
            <p className="text-[11px] text-muted-foreground">
              Isto gera a tua identidade digital territorial (endereço AFROLOC). Sem isso, usamos o centro do bairro escolhido.
            </p>
          </div>

          <Button
            className="w-full h-12 rounded-xl"
            onClick={save}
            disabled={saving || blockedByCooldown || !neighborhood || !city}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (changingBanda ? 'Confirmar mudança' : 'Guardar')}
          </Button>
          {blockedByCooldown && (
            <p className="text-[11px] text-center text-muted-foreground">Em período de espera até {nextChange}.</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
