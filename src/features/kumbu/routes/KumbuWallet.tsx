import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowLeft, HelpCircle, History, Trophy, Sparkles, ChevronRight, Banknote, Coins } from 'lucide-react';
import KumbuBalanceCard from '../components/KumbuBalanceCard';
import KumbuHowToEarn from '../components/KumbuHowToEarn';
import { BuyKumbuSheet } from '../components/BuyKumbuSheet';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

export default function KumbuWallet() {
  useUiLocale();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showHelp, setShowHelp] = useState(false);
  const [buyOpen, setBuyOpen] = useState(false);
  const [isCreator, setIsCreator] = useState(false);

  // Approved creators withdraw (payout); everyone else sees the apply CTA.
  useEffect(() => {
    if (!user) return;
    supabase
      .from('creator_applications')
      .select('status')
      .eq('user_id', user.id)
      .eq('status', 'approved')
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setIsCreator(!!data));
  }, [user]);

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-30 glass-nav safe-top">
        <div className="flex items-center gap-3 px-4 py-2.5">
          <Button variant="ghost" size="icon" className="rounded-xl h-9 w-9" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4.5 w-4.5" />
          </Button>
          <h1 className="text-base font-bold flex-1 tracking-tight">{uiText("Carteira Kumbu")}</h1>
          <Button variant="ghost" size="icon" className="rounded-xl h-9 w-9" onClick={() => navigate('/kumbu/history')}>
            <History className="h-4.5 w-4.5" />
          </Button>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-5 space-y-4">
        <KumbuBalanceCard />

        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => setBuyOpen(true)}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 text-white font-semibold shadow-sm"
        >
          <Coins className="h-5 w-5" />{uiText(" Comprar Kumbu")}</motion.button>

        <div className="flex gap-2">
          <motion.button
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-card border border-border/30 text-[13px] font-medium text-foreground/80 transition-colors hover:bg-card/80"
            whileTap={{ scale: 0.97 }}
            onClick={() => setShowHelp(true)}
          >
            <HelpCircle className="h-4 w-4 text-muted-foreground/50" />{uiText("Como ganhar?")}</motion.button>
          <motion.button
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-card border border-border/30 text-[13px] font-medium text-foreground/80 transition-colors hover:bg-card/80"
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate('/ranking')}
          >
            <Trophy className="h-4 w-4 text-[#C9A23F]" />{uiText("Ranking")}</motion.button>
        </div>

        {/* Approved creators → payouts; otherwise → the monetization apply CTA. */}
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => navigate(isCreator ? '/payouts' : '/creator/apply')}
          className="w-full flex items-center gap-3 p-4 rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 to-primary/5 text-left transition-colors hover:from-primary/15"
        >
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
            {isCreator ? <Banknote className="h-5 w-5 text-primary" /> : <Sparkles className="h-5 w-5 text-primary" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm text-foreground">
              {isCreator ? uiText("Levantar Kumbu (Payout)") : uiText("Tornar-me criador")}
            </div>
            <div className="text-xs text-muted-foreground">
              {isCreator
                ? uiText("Converte os teus Kumbu em dinheiro")
                : uiText("Monetiza o que crias — converte Kumbu em dinheiro")}
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        </motion.button>

        <p className="text-[11px] text-muted-foreground/40 text-center leading-relaxed px-4 pt-2">
          {uiText('Mokubico é convivência. Academia é crescimento. Kumbu é valor.')}
        </p>
      </main>

      <KumbuHowToEarn open={showHelp} onOpenChange={setShowHelp} />
      <BuyKumbuSheet open={buyOpen} onOpenChange={setBuyOpen} />
    </div>
  );
}
