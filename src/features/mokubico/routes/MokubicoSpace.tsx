import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { EmptyStateBack } from '@/components/common/EmptyStateBack';
import { ArrowLeft, Radio, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { NewConversaSheet } from '../components/NewConversaSheet';
import { SPACES, MOKUBICO_COPY } from '../copy';
import { useSpaceConversas } from '../hooks/useMokubicoConversas';
import BottomNav from '@/components/BottomNav';

export default function MokubicoSpace() {
  const { space } = useParams<{ space: string }>();
  const navigate = useNavigate();
  const [newOpen, setNewOpen] = useState(false);

  const config = SPACES.find((s) => s.key === space);
  const { data: conversas = [], isLoading } = useSpaceConversas(space ?? '');

  if (!config) {
    return <EmptyStateBack message="Espaço não encontrado." fallbackRoute="/mokubico" />;
  }

  const hasLive = conversas.length > 0;

  return (
    <div className="flex h-screen-safe overflow-hidden flex-col bg-background pb-[calc(11rem+env(safe-area-inset-bottom,0px))]">
      {/* Header */}
      <header className="relative shrink-0 z-30 bg-background/80 backdrop-blur-md border-b border-border/40 px-4 safe-top">
        <div className="flex items-center gap-3 h-14">
          <button onClick={() => navigate('/mokubico')} className="p-1 -ml-1">
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="text-lg">{config.emoji}</span>
            <h1 className="text-sm font-bold text-foreground truncate">{config.title}</h1>
            {hasLive && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0 rounded-full animate-pulse gap-1 shrink-0">
                <Radio className="h-2.5 w-2.5" />
                {MOKUBICO_COPY.liveBadge}
              </Badge>
            )}
          </div>
        </div>

        <div className="pb-3 -mt-1">
          <p className="text-xs text-muted-foreground">{config.description}</p>
          <p className="text-[10px] text-muted-foreground/70 tracking-wide mt-1">Acesso: {config.access}</p>
        </div>
      </header>

      {/* Conversas list */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-4 space-y-3">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-20 rounded-xl bg-muted/30 animate-pulse" />
            ))}
          </div>
        ) : conversas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
              <span className="text-2xl">{config.emoji}</span>
            </div>
            <p className="text-sm text-muted-foreground">{MOKUBICO_COPY.emptySpace}</p>
            <p className="text-xs text-muted-foreground/70">Abre a primeira conversa deste espaço.</p>
          </div>
        ) : (
          conversas.map((c) => (
            <button
              key={c.id}
              onClick={() => navigate(`/mokubico/conversa/${c.id}`)}
              className="w-full flex items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:bg-secondary/40"
            >
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Radio className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">{c.title}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {c.isHost ? 'A tua conversa' : c.hostName}
                </div>
              </div>
              <span className="shrink-0 rounded-full bg-primary/10 text-primary text-xs font-semibold px-3 py-1.5 flex items-center gap-1">
                <Users className="h-3 w-3" /> Entrar
              </span>
            </button>
          ))
        )}
      </div>

      {/* Fixed bottom CTA */}
      <div className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom,0px)+0.75rem)] left-0 right-0 z-40 p-4">
        <Button className="w-full rounded-full shadow-glow" onClick={() => setNewOpen(true)}>
          Abrir conversa
        </Button>
      </div>

      <NewConversaSheet open={newOpen} onOpenChange={setNewOpen} space={config.key} spaceTitle={config.title} />
      <BottomNav />
    </div>
  );
}
