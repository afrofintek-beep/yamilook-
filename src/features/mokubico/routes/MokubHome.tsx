import { SpaceCard } from '../components/SpaceCard';
import { LiveSummaryCard } from '../components/LiveSummaryCard';
import { MOKUBICO_COPY, SPACES } from '../copy';
import BottomNav from '@/components/BottomNav';
import { useLiveSpaces } from '../hooks/useMokubicoData';
import { motion } from 'framer-motion';

export default function MokubHome() {
  const { data: liveSpaces } = useLiveSpaces();
  const LIVE_SPACES = liveSpaces ?? new Set<string>();

  return (
    <div className="flex h-screen-safe overflow-hidden flex-col bg-background pb-[calc(5rem+env(safe-area-inset-bottom,0px)+1rem)]">
      {/* Header - glass morphism */}
      <header className="relative shrink-0 z-30 glass-nav px-4 safe-top">
        <div className="flex items-center gap-3 h-14">
          <motion.div 
            className="flex items-center gap-2.5"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <span className="text-lg">🏠</span>
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-foreground">{MOKUBICO_COPY.title}</h1>
              <p className="text-[10px] text-muted-foreground -mt-0.5">{MOKUBICO_COPY.subtitle}</p>
            </div>
          </motion.div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain space-y-6 px-4 pt-5">
        {/* Live summary */}
        <LiveSummaryCard />

        {/* Spaces grid - visual cards */}
        <section className="space-y-3">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="flex items-center justify-between"
          >
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {MOKUBICO_COPY.chooseSpace}
            </h2>
            <span className="text-[10px] text-muted-foreground/50">{SPACES.length} espaços</span>
          </motion.div>
          <div className="space-y-3">
            {SPACES.map((space, i) => (
              <SpaceCard
                key={space.key}
                space={space}
                isLive={LIVE_SPACES.has(space.key)}
                index={i}
              />
            ))}
          </div>
        </section>
      </div>

      <BottomNav />
    </div>
  );
}
