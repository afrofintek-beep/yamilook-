import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import YamilookLogo from "@/components/brand/YamilookLogo";
import { cn } from "@/lib/utils";
import { AFRICAN_REACTIONS, getReaction } from "@/lib/reactions";

const Index = () => {
  useUiLocale();
  const navigate = useNavigate();
  const [hoveredReaction, setHoveredReaction] = useState<string | null>(null);
  const [selectedReaction, setSelectedReaction] = useState<string | null>(null);

  const activeReaction = AFRICAN_REACTIONS.find(
    r => r.type === (hoveredReaction || selectedReaction)
  );

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 py-12 overflow-hidden relative">
      {/* Subtle background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-background to-background/95 pointer-events-none" />

      {/* Ambient glow - uses primary color */}
      <motion.div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-[0.03]"
        style={{ background: 'radial-gradient(circle, hsl(var(--primary)) 0%, transparent 70%)' }}
        animate={{ scale: [1, 1.1, 1], opacity: [0.03, 0.05, 0.03] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="relative z-10 flex flex-col items-center text-center max-w-lg mx-auto">
        {/* Logo - only wordmark, no tagline */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <YamilookLogo size="xl" showTagline={false} animate={false} />
        </motion.div>

        {/* Title - Main tagline */}
        <motion.h1
          className="mt-10 text-2xl md:text-3xl font-light text-foreground tracking-wide"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >{uiText("O mambo começa na banda.")}</motion.h1>

        {/* African Reactions Demo */}
        <motion.section
          className="mt-12 w-full"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          aria-label={uiText("African Reactions")}
        >
          <p className="text-xs text-muted-foreground mb-6 uppercase tracking-[0.2em] font-medium">{uiText("Reações Africanas")}</p>

          {/* Reaction buttons - ordered by visual hierarchy */}
          <div className="flex justify-center gap-4" role="group" aria-label={uiText("Reaction options")}>
            {AFRICAN_REACTIONS.map((reaction, index) => (
              <motion.button
                key={reaction.type}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: 0.5 + index * 0.08 }}
                className={cn(
                  "p-3 rounded-xl transition-all duration-200 text-3xl",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  "hover:scale-110 hover:bg-secondary/50",
                  selectedReaction === reaction.type && "bg-secondary scale-110"
                )}
                onMouseEnter={() => setHoveredReaction(reaction.type)}
                onMouseLeave={() => setHoveredReaction(null)}
                onClick={() => setSelectedReaction(
                  selectedReaction === reaction.type ? null : reaction.type
                )}
                aria-label={`${reaction.label}: ${reaction.meaning}`}
                aria-pressed={selectedReaction === reaction.type}
              >
                <span role="img" aria-hidden="true">{reaction.icon}</span>
              </motion.button>
            ))}
          </div>

          {/* Reaction details on hover/select */}
          <div className="h-24 mt-6 flex flex-col items-center justify-start">
            {activeReaction && (
              <motion.div
                key={activeReaction.type}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="text-center space-y-1"
              >
                <p className="font-semibold text-foreground text-lg">
                  {activeReaction.label}
                </p>
                <p className="text-sm text-muted-foreground max-w-xs">
                  {activeReaction.meaning}
                </p>
                <p className="text-xs text-muted-foreground/60 italic">
                  {activeReaction.emotionType}
                </p>
              </motion.div>
            )}
          </div>
        </motion.section>

        {/* CTA Buttons */}
        <motion.div
          className="mt-4 flex flex-col items-center gap-3"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.7 }}
        >
          <Button
            onClick={() => navigate("/login")}
            variant="outline"
            size="lg"
            className="px-10 py-6 text-base font-medium tracking-wide border-primary/40 text-foreground hover:bg-primary/10 hover:border-primary/60 transition-all duration-300"
          >{uiText("Entrar na tua comunidade")}</Button>
          <Button
            onClick={() => navigate("/apresentacao")}
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground text-xs tracking-widest uppercase"
          >{uiText("Ver apresentação")}</Button>
        </motion.div>

        {/* Footer text */}
        <motion.p
          className="mt-10 text-sm text-muted-foreground/70 font-light tracking-widest uppercase"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 1 }}
        >{uiText("O mambo começa na banda.")}</motion.p>
      </div>
    </div>
  );
};

export default Index;
