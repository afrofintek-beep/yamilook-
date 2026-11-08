import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Loader2, BadgeCheck, Crown, MapPin, ArrowRight } from 'lucide-react';
import { format } from '@/i18n/ui-date';
import { pt } from 'date-fns/locale';

// Public, unauthenticated profile page — the ecosystem deep-link target
// (e.g. Yamioo directory → this social profile). Data comes from the
// get_public_profile RPC (SECURITY DEFINER, curated public-safe fields only),
// so it works for visitors with no Yamilook session.
interface PublicProfileData {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
  status_message: string | null;
  afroloc_code: string | null;
  afroloc_certified: boolean;
  is_creator: boolean;
  founder_number: number | null;
  created_at: string;
}

export default function PublicProfile() {
  useUiLocale();
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<PublicProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10000);
    setLoading(true); setLoadError(false); setProfile(null);
    (async () => {
      try {
        const handle = username?.trim();
        if (!handle) return;
        const { data, error } = await supabase.rpc('get_public_profile', { p_username: handle }).abortSignal(controller.signal);
        if (error) throw error;
        if (active) setProfile((data as unknown as PublicProfileData) ?? null);
      } catch {
        if (active) setLoadError(true);
      } finally {
        window.clearTimeout(timeout);
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; controller.abort(); window.clearTimeout(timeout); };
  }, [username, attempt]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-6 text-center">
        <p role={loadError ? 'alert' : 'status'} className="text-sm text-muted-foreground">{loadError ? uiText("Não foi possível carregar o perfil. Verifica a ligação e tenta novamente.") : uiText("Perfil não encontrado.")}</p>
        {loadError && <Button onClick={() => setAttempt(value => value + 1)}>{uiText("Tentar novamente")}</Button>}
        <Button onClick={() => navigate('/')}>{uiText("Ir para o Yamilook")}</Button>
      </div>
    );
  }

  const initials = (profile.display_name || profile.username || '?')
    .split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="min-h-screen bg-background flex flex-col items-center px-4 py-10">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="rounded-3xl border border-border bg-card p-6 text-center shadow-sm">
          <div className="mx-auto mb-4 h-24 w-24 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center ring-2 ring-primary/20">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.display_name ?? ''} className="h-full w-full object-cover" />
            ) : (
              <span className="text-2xl font-bold text-primary">{initials}</span>
            )}
          </div>

          <h1 className="text-xl font-bold text-foreground text-balance">{profile.display_name}</h1>
          {profile.username && <p className="text-sm text-muted-foreground">@{profile.username}</p>}

          {/* Badges */}
          <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
            {profile.founder_number != null && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#C9A23F]/15 px-2.5 py-1 text-[11px] font-semibold text-[#C9A23F]">
                <Crown className="h-3 w-3" />{uiText(" Fundador #{{value1}}", { value1: (profile.founder_number) ?? "" })}</span>
            )}
            {profile.is_creator && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-1 text-[11px] font-semibold text-primary">
                <BadgeCheck className="h-3 w-3" />{uiText(" Criador Verificado")}</span>
            )}
            {profile.afroloc_certified && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-500">
                <MapPin className="h-3 w-3" />{uiText(" AFROLOC verificado")}</span>
            )}
          </div>

          {profile.bio && <p className="mt-4 text-sm text-foreground/80 leading-relaxed">{profile.bio}</p>}

          {profile.afroloc_code && (
            <div className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-mono text-xs text-muted-foreground">{profile.afroloc_code}</span>
            </div>
          )}

          <p className="mt-4 text-[11px] text-muted-foreground">{uiText("Membro desde {{value1}}", { value1: (format(new Date(profile.created_at), 'MMMM yyyy', { locale: pt })) ?? "" })}</p>
        </div>

        {/* CTA */}
        <Button className="mt-4 w-full h-12 rounded-xl gap-2" onClick={() => navigate('/login')}>{uiText("Ver no Yamilook ")}<ArrowRight className="h-4 w-4" />
        </Button>
        <p className="mt-3 text-center text-[11px] text-muted-foreground">{uiText("Yamilook · a rede social de Angola")}</p>
      </div>
    </div>
  );
}
