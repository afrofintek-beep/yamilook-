import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageSquare, Mail, Mic, Star, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { useRoda, usePalco } from '@/hooks/usePalco';

const voiceTypeConfig = {
  email: { icon: Mail, label: 'Email', color: 'bg-blue-100 text-blue-700' },
  live: { icon: Mic, get label() { return uiText("Ao Vivo"); }, color: 'bg-green-100 text-green-700' },
  highlight: { icon: Star, get label() { return uiText("Destaque"); }, color: 'bg-amber-100 text-amber-700' },
};

// Mock data - will be replaced with real data from API
const mockVozes = [
  { id: '1', question: 'Como começar um negócio em Angola sem capital inicial?', type: 'highlight' as const, price: 7, status: 'available' },
  { id: '2', question: 'Qual a melhor estratégia para networking profissional?', type: 'live' as const, price: 3, status: 'available' },
  { id: '3', question: 'Como equilibrar vida pessoal e carreira?', type: 'email' as const, price: 1, status: 'sold' },
  { id: '4', question: 'Dicas para apresentações de impacto?', type: 'live' as const, price: 3, status: 'available' },
  { id: '5', question: 'Como negociar salário numa entrevista?', type: 'email' as const, price: 1, status: 'available' },
  { id: '6', question: 'Qual o melhor momento para mudar de carreira?', type: 'highlight' as const, price: 7, status: 'available' },
];

export default function VoicePool() {
  useUiLocale();
  const { palcoId, rodaId } = useParams();
  const navigate = useNavigate();
  const [selectedType, setSelectedType] = useState<string>('all');

  const { data: roda } = useRoda(rodaId);
  const { data: palco } = usePalco(palcoId);

  const filteredVozes = selectedType === 'all'
    ? mockVozes
    : mockVozes.filter(v => v.type === selectedType);

  const groupedVozes = {
    available: filteredVozes.filter(v => v.status === 'available'),
    sold: filteredVozes.filter(v => v.status === 'sold'),
  };

  const handleSelectVoz = (vozId: string) => {
    navigate(`/palco/${palcoId}/roda/${rodaId}/voz/${vozId}`);
  };

  return (
    <div className="min-h-screen bg-palco-bg">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-palco-surface border-b border-palco-border px-4 py-3 safe-top">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="text-palco-text"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-palco-text">{uiText("Vozes")}</h1>
            {palco && (
              <p className="text-sm text-palco-text-secondary">{palco.title}</p>
            )}
          </div>
          <Button variant="ghost" size="icon" className="text-palco-text-secondary">
            <Filter className="w-5 h-5" />
          </Button>
        </div>
      </header>

      {/* Filter Tabs */}
      <div className="px-4 py-3 bg-palco-surface border-b border-palco-border">
        <Tabs value={selectedType} onValueChange={setSelectedType}>
          <TabsList className="w-full bg-palco-bg">
            <TabsTrigger value="all" className="flex-1">{uiText("Todas")}</TabsTrigger>
            <TabsTrigger value="email" className="flex-1">Email</TabsTrigger>
            <TabsTrigger value="live" className="flex-1">{uiText("Ao Vivo")}</TabsTrigger>
            <TabsTrigger value="highlight" className="flex-1">{uiText("Destaque")}</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Voice List */}
      <div className="p-4 space-y-6">
        {/* Available Voices */}
        {groupedVozes.available.length > 0 && (
          <section>
            <h2 className="text-sm font-medium text-palco-text-secondary mb-3">{uiText("Disponíveis (")}{groupedVozes.available.length})
            </h2>
            <div className="space-y-3">
              {groupedVozes.available.map((voz) => {
                const config = voiceTypeConfig[voz.type];
                const Icon = config.icon;

                return (
                  <button
                    key={voz.id}
                    onClick={() => handleSelectVoz(voz.id)}
                    className="w-full bg-palco-surface rounded-xl p-4 border border-palco-border hover:border-palco-accent transition-colors text-left"
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn("p-2 rounded-lg", config.color)}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="secondary" className={cn("text-xs", config.color)}>
                            {config.label}
                          </Badge>
                        </div>
                        <p className="text-sm text-palco-text line-clamp-2">
                          {voz.question}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-semibold text-palco-accent">
                          ${voz.price}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Sold Voices */}
        {groupedVozes.sold.length > 0 && (
          <section>
            <h2 className="text-sm font-medium text-palco-text-secondary mb-3">{uiText("Vendidas (")}{groupedVozes.sold.length})
            </h2>
            <div className="space-y-3">
              {groupedVozes.sold.map((voz) => {
                const config = voiceTypeConfig[voz.type];
                const Icon = config.icon;

                return (
                  <div
                    key={voz.id}
                    className="w-full bg-palco-surface/50 rounded-xl p-4 border border-palco-border opacity-60"
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn("p-2 rounded-lg bg-muted")}>
                        <Icon className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="secondary" className="text-xs bg-muted text-muted-foreground">
                            {config.label}
                          </Badge>
                          <Badge variant="outline" className="text-xs">{uiText("Vendida")}</Badge>
                        </div>
                        <p className="text-sm text-palco-text-secondary line-clamp-2">
                          {voz.question}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-semibold text-muted-foreground line-through">
                          ${voz.price}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Empty State */}
        {filteredVozes.length === 0 && (
          <div className="text-center py-12">
            <MessageSquare className="w-12 h-12 text-palco-text-secondary mx-auto mb-4" />
            <h3 className="text-lg font-medium text-palco-text mb-2">{uiText("Nenhuma Voz encontrada")}</h3>
            <p className="text-sm text-palco-text-secondary">{uiText("Não há vozes disponíveis com este filtro.")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
