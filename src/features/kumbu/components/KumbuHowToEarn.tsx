import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EARN_ACTIONS, WEEKLY_REWARDS, DAILY_CAP } from '../copy';
import { Coins, Trophy, Info } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export default function KumbuHowToEarn({ open, onOpenChange }: Props) {
  useUiLocale();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-2xl border-border/30 bg-card p-0 overflow-hidden">
        {/* Header */}
        <div className="relative px-5 pt-6 pb-4">
          <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
          <DialogHeader className="relative">
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Coins className="w-4 h-4 text-primary" strokeWidth={1.8} />
              </div>
              <DialogTitle className="text-base font-bold">{uiText("Como ganhar Kumbu?")}</DialogTitle>
            </div>
            <p className="text-[11px] text-muted-foreground/50 uppercase tracking-widest font-medium">{uiText("Economia da Participação")}</p>
          </DialogHeader>
        </div>

        <div className="px-5 pb-6 space-y-5">
          {/* Base rewards */}
          <div>
            <p className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest mb-2.5">{uiText("Recompensas base")}</p>
            <div className="space-y-1.5">
              {EARN_ACTIONS.map((a, i) => (
                <motion.div
                  key={a.action}
                  className="flex items-center justify-between py-2 px-3 rounded-xl bg-muted/40"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 * i }}
                >
                  <span className="text-[13px] text-foreground/80 flex-1">{a.action}</span>
                  <span className="text-[13px] font-bold text-primary tabular-nums shrink-0 mr-2">
                    {a.kumbu}
                  </span>
                  <span className="text-[10px] text-muted-foreground/40 shrink-0 tabular-nums">
                    {a.limit}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Weekly Top 10 */}
          <div>
            <div className="flex items-center gap-1.5 mb-2.5">
              <Trophy className="w-3 h-3 text-[#C9A23F]" />
              <p className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest">{uiText("Top 10 semanal")}</p>
            </div>
            <div className="space-y-1">
              {WEEKLY_REWARDS.map((r) => (
                <div key={r.position} className="flex justify-between py-1.5 px-3 rounded-lg">
                  <span className="text-[13px] text-foreground/70">{r.position}</span>
                  <span className="text-[13px] font-bold text-[#C9A23F] tabular-nums">{r.kumbu}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Daily cap */}
          <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/30 border border-border/20">
            <Info className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
            <p className="text-[11px] text-muted-foreground/60">{uiText("Máximo diário: ")}<span className="font-semibold text-foreground/70">{DAILY_CAP} Kumbu</span>
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
