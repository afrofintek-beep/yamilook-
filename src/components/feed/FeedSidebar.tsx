import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { useNavigate } from 'react-router-dom';
import { Radio, ChevronRight, Users } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { ActiveStream } from '@/hooks/useActiveStreams';

/**
 * Desktop-only right rail for the feed. Fills the space next to the centered
 * column with on-brand Yamilook content: a branded Kumbu cover (entry point to
 * the wallet, no balance exposed) and the bandas that are live right now.
 */
export function FeedSidebar({ activeStreams }: { activeStreams: ActiveStream[] }) {
  useUiLocale();
  const navigate = useNavigate();

  return (
    <div className="sticky top-4 space-y-4">
      {/* Kumbu — branded cover, not a balance readout */}
      <button
        onClick={() => navigate('/kumbu')}
        aria-label={uiText("Abrir a carteira Kumbu")}
        className="group relative block w-full overflow-hidden rounded-2xl bg-gradient-primary p-5 text-left text-white shadow-md transition-transform hover:scale-[1.02]"
      >
        {/* soft glow + oversized coin motif */}
        <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/15 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-3 -right-1 select-none text-7xl leading-none opacity-20 rotate-12">🪙</div>
        <div className="relative">
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/75">Yamilook</div>
          <div className="mt-0.5 text-3xl font-extrabold tracking-tight drop-shadow-sm">{uiText("KUMBU")}</div>
          <div className="mt-1 text-xs text-white/85">{uiText("Kumbu é valor")}</div>
          <div className="mt-3 inline-flex items-center gap-1 text-xs font-semibold">{uiText("Abrir a tua carteira")}<ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </div>
        </div>
      </button>

      {/* Bandas ao vivo — clickable red cover, coherent with the live branding */}
      <button
        onClick={() => navigate('/live')}
        aria-label={uiText("Ver as bandas ao vivo")}
        className="group relative block w-full overflow-hidden rounded-2xl bg-gradient-to-br from-red-500 via-red-600 to-red-700 p-5 text-left text-white shadow-md transition-transform hover:scale-[1.02]"
      >
        {/* soft glow + oversized radio motif */}
        <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/20 blur-2xl" />
        <Radio className="pointer-events-none absolute -bottom-4 -right-3 h-24 w-24 opacity-10 rotate-12" />
        <div className="relative">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/85">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
            </span>{uiText("Ao vivo")}</div>
          <div className="mt-0.5 text-2xl font-extrabold tracking-tight drop-shadow-sm">{uiText("Bandas ao vivo")}</div>

          {activeStreams.length === 0 ? (
            <div className="mt-1 text-xs text-white/85">{uiText("Ninguém ao vivo agora. Sê o primeiro a abrir a tua banda!")}</div>
          ) : (
            <div className="mt-3 space-y-2">
              {activeStreams.slice(0, 3).map((s) => (
                <div key={s.id} className="flex items-center gap-2.5">
                  <Avatar className="h-8 w-8 ring-2 ring-white/40 shrink-0">
                    <AvatarImage src={s.host.avatar_url ?? undefined} />
                    <AvatarFallback className="text-red-700 bg-white text-xs">
                      {(s.host.display_name ?? '?').charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{s.host.display_name}</div>
                    <div className="text-[11px] text-white/80 truncate flex items-center gap-1">
                      <Users className="w-3 h-3 shrink-0" />
                      {s.viewer_count} · {s.title}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-3 inline-flex items-center gap-1 text-xs font-semibold">
            {activeStreams.length > 0 ? uiText("Entrar na live") : uiText("Abrir a minha banda")}
            <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </div>
        </div>
      </button>

      <p className="text-[10px] text-muted-foreground/50 px-1">{uiText("Yamilook · a vida na tua banda")}</p>
    </div>
  );
}
