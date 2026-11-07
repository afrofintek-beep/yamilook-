import { uiText, useUiLocale, uiLocale } from '@/i18n/ui-copy';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowLeft, MapPin } from 'lucide-react';
import { useUserBanda, useWeeklyRanking, useRankingHistory } from '../hooks/useRanking';
import Top10Card from '../components/Top10Card';
import WeeklyResultsEvent from '../components/WeeklyResultsEvent';

export default function RankingPage() {
  useUiLocale();
  const navigate = useNavigate();
  const { data: userBanda, isLoading: bandaLoading } = useUserBanda();
  const bandaId = userBanda?.banda_id;
  const bandaName = userBanda?.bandas?.name;

  const { data: ranking, isLoading: rankingLoading } = useWeeklyRanking(bandaId);
  const { data: history } = useRankingHistory(bandaId);

  const loading = bandaLoading || rankingLoading;

  const weekLabel = ranking
    ? `${new Date(ranking.weekStart).toLocaleDateString(uiLocale(), { day: 'numeric', month: 'short' })} – ${new Date(ranking.weekEnd).toLocaleDateString(uiLocale(), { day: 'numeric', month: 'short' })}`
    : undefined;

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-30 glass-nav safe-top">
        <div className="flex items-center gap-3 px-4 py-2.5">
          <Button variant="ghost" size="icon" className="rounded-xl h-9 w-9" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4.5 w-4.5" />
          </Button>
          <h1 className="text-base font-bold flex-1 tracking-tight">{uiText("Ranking")}</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-5 space-y-4">
        {!bandaLoading && !bandaId && (
          <motion.div
            className="flex items-center gap-3 p-4 rounded-xl bg-muted/40 border border-border/20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <MapPin className="h-4 w-4 text-muted-foreground/40 shrink-0" />
            <p className="text-[13px] text-muted-foreground/60">{uiText("Confirma o teu bairro nas definições para veres o ranking local.")}</p>
          </motion.div>
        )}

        {bandaName && (
          <div className="flex items-center gap-1.5 px-1">
            <MapPin className="h-3 w-3 text-muted-foreground/40" />
            <p className="text-[12px] text-muted-foreground/50 font-medium">{bandaName}</p>
          </div>
        )}

        {loading && (
          <div className="py-12 text-center">
            <div className="w-8 h-8 rounded-full bg-muted animate-pulse mx-auto mb-2" />
            <p className="text-[11px] text-muted-foreground/40">{uiText("A carregar…")}</p>
          </div>
        )}

        {ranking && (
          <WeeklyResultsEvent weekStart={ranking.weekStart} weekEnd={ranking.weekEnd} />
        )}

        {ranking && <Top10Card entries={ranking.entries} weekLabel={weekLabel} />}

        {history && history.length > 0 && (
          <motion.div
            className="rounded-2xl bg-card border border-border/30 overflow-hidden"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="px-5 pt-4 pb-2">
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/40">{uiText("Histórico")}</p>
            </div>
            <div className="px-5 pb-4 space-y-1.5">
              {history.map((h) => {
                const entries = typeof h.entries === 'string' ? JSON.parse(h.entries) : h.entries;
                const count = Array.isArray(entries) ? entries.length : 0;
                return (
                  <div key={h.id} className="flex justify-between text-[12px] py-1.5">
                    <span className="text-muted-foreground/50">
                      {new Date(h.week_start).toLocaleDateString(uiLocale(), { day: 'numeric', month: 'short' })}
                      {' – '}
                      {new Date(h.week_end).toLocaleDateString(uiLocale(), { day: 'numeric', month: 'short' })}
                    </span>
                    <span className="text-foreground/60 font-medium tabular-nums">{count}{uiText(" participantes")}</span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}
