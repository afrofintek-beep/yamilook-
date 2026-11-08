import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowLeft, TrendingUp, TrendingDown, ArrowUpDown } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useKumbuHistory, type LedgerDirection } from '../hooks/useKumbuHistory';
import { ACTION_LABELS } from '../copy';
import { format } from '@/i18n/ui-date';
import { pt } from 'date-fns/locale';

export default function KumbuHistory() {
  useUiLocale();
  const navigate = useNavigate();
  const [dir, setDir] = useState<LedgerDirection>('all');
  const { data: ledger, isLoading } = useKumbuHistory(dir);

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-30 glass-nav safe-top">
        <div className="flex items-center gap-3 px-4 py-2.5">
          <Button variant="ghost" size="icon" className="rounded-xl h-9 w-9" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4.5 w-4.5" />
          </Button>
          <h1 className="text-base font-bold tracking-tight">{uiText("Histórico")}</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-5 space-y-4">
        <Tabs value={dir} onValueChange={(v) => setDir(v as LedgerDirection)}>
          <TabsList className="w-full bg-card border border-border/20 rounded-xl h-10">
            <TabsTrigger value="all" className="flex-1 text-[11px] rounded-lg gap-1">
              <ArrowUpDown className="w-3 h-3" />{uiText(" Tudo")}</TabsTrigger>
            <TabsTrigger value="credit" className="flex-1 text-[11px] rounded-lg gap-1">
              <TrendingUp className="w-3 h-3" />{uiText(" Créditos")}</TabsTrigger>
            <TabsTrigger value="debit" className="flex-1 text-[11px] rounded-lg gap-1">
              <TrendingDown className="w-3 h-3" />{uiText(" Débitos")}</TabsTrigger>
          </TabsList>
        </Tabs>

        {isLoading && (
          <div className="py-12 text-center">
            <div className="w-8 h-8 rounded-full bg-muted animate-pulse mx-auto mb-2" />
            <p className="text-[11px] text-muted-foreground/40">{uiText("A carregar…")}</p>
          </div>
        )}

        {!isLoading && (!ledger || ledger.length === 0) && (
          <div className="py-12 text-center">
            <p className="text-sm text-muted-foreground/40">{uiText("Sem movimentos registados.")}</p>
          </div>
        )}

        <div className="space-y-1">
          {(ledger ?? []).map((entry, i) => {
            const isCredit = entry.amount > 0;
            return (
              <motion.div
                key={entry.id}
                className="flex items-center justify-between py-3 px-3.5 rounded-xl bg-card border border-border/20"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.03 * Math.min(i, 15) }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    isCredit ? 'bg-emerald-500/10' : 'bg-destructive/10'
                  }`}>
                    {isCredit ? (
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <TrendingDown className="w-3.5 h-3.5 text-destructive" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-foreground/80 truncate">
                      {ACTION_LABELS[entry.action_type] ?? entry.action_type}
                    </p>
                    <p className="text-[10px] text-muted-foreground/40">
                      {format(new Date(entry.created_at), "d MMM yyyy · HH:mm", { locale: pt })}
                    </p>
                  </div>
                </div>
                <span
                  className={`text-sm font-bold tabular-nums shrink-0 ml-3 ${
                    isCredit ? 'text-emerald-500' : 'text-destructive/80'
                  }`}
                >
                  {isCredit ? '+' : ''}{entry.amount}
                </span>
              </motion.div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
