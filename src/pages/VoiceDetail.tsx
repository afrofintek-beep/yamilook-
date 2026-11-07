import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Mail, Mic, Star, Clock, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { usePalco } from '@/hooks/usePalco';

const voiceTypeConfig = {
  email: {
    icon: Mail,
    label: 'Email',
    color: 'bg-blue-100 text-blue-700',
    delivery: 'Email (24-72h)'
  },
  live: {
    icon: Mic,
    get label() { return uiText("Ao Vivo"); },
    color: 'bg-green-100 text-green-700',
    delivery: 'Ao vivo na Roda'
  },
  highlight: {
    icon: Star,
    get label() { return uiText("Destaque"); },
    color: 'bg-amber-100 text-amber-700',
    delivery: 'Destaque + resposta aprofundada'
  },
};

// Mock data - will be replaced with real data
const mockVoz: {
  id: string;
  question: string;
  type: 'email' | 'live' | 'highlight';
  price: number;
  status: string;
} = {
  id: '1',
  question: 'Como começar um negócio em Angola sem capital inicial?',
  type: 'highlight',
  price: 7,
  status: 'available',
};

export default function VoiceDetail() {
  useUiLocale();
  const { palcoId, rodaId, vozId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [customText, setCustomText] = useState('');

  const { data: palco } = usePalco(palcoId);

  const voz = mockVoz; // Will be fetched from API
  const config = voiceTypeConfig[voz.type];
  const Icon = config.icon;

  const allowCustomText = palco?.allow_custom_voice_text ?? true;

  const handleBuyVoice = () => {
    navigate(`/palco/${palcoId}/roda/${rodaId}/checkout?vozId=${vozId}&customText=${encodeURIComponent(customText)}`);
  };

  return (
    <div className="min-h-screen bg-palco-bg flex flex-col">
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
            <h1 className="text-lg font-semibold text-palco-text">{uiText("Detalhe da Voz")}</h1>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 p-4 space-y-4">
        {/* Voice Card */}
        <Card className="border-palco-border bg-palco-surface">
          <CardContent className="p-4">
            <div className="flex items-start gap-3 mb-4">
              <div className={cn("p-3 rounded-xl", config.color)}>
                <Icon className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <Badge variant="secondary" className={cn("mb-2", config.color)}>
                  {config.label}
                </Badge>
                <h2 className="text-lg font-medium text-palco-text">
                  {voz.question}
                </h2>
              </div>
            </div>

            {/* Details */}
            <div className="space-y-3 pt-4 border-t border-palco-border">
              <div className="flex items-center justify-between">
                <span className="text-sm text-palco-text-secondary">{uiText("Tipo")}</span>
                <span className="text-sm font-medium text-palco-text">{config.label}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-palco-text-secondary">{uiText("Entrega")}</span>
                <div className="flex items-center gap-1.5 text-sm font-medium text-palco-text">
                  <Clock className="w-4 h-4 text-palco-text-secondary" />
                  {config.delivery}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-palco-text-secondary">{uiText("Preço")}</span>
                <span className="text-xl font-bold text-palco-accent">${voz.price}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Custom Text Editor */}
        {allowCustomText && (
          <Card className="border-palco-border bg-palco-surface">
            <CardContent className="p-4">
              <Label htmlFor="customText" className="text-sm font-medium text-palco-text mb-2 block">{uiText("Queres ajustar a tua Voz? (opcional)")}</Label>
              <Textarea
                id="customText"
                placeholder={uiText("Escreve uma versão mais clara ou detalhada da tua pergunta...")}
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                className="min-h-[100px] bg-palco-bg border-palco-border text-palco-text placeholder:text-palco-text-secondary resize-none"
                maxLength={500}
              />
              <p className="text-xs text-palco-text-secondary mt-2 text-right">
                {customText.length}/500
              </p>
            </CardContent>
          </Card>
        )}

        {/* What's Included */}
        <Card className="border-palco-border bg-palco-surface">
          <CardContent className="p-4">
            <h3 className="text-sm font-medium text-palco-text mb-3">{uiText("O que inclui")}</h3>
            <ul className="space-y-2">
              <li className="flex items-center gap-2 text-sm text-palco-text-secondary">
                <CheckCircle className="w-4 h-4 text-green-500" />{uiText("Resposta personalizada do ")}{t('palco.guide')}
              </li>
              <li className="flex items-center gap-2 text-sm text-palco-text-secondary">
                <CheckCircle className="w-4 h-4 text-green-500" />
                {voz.type === 'highlight' ? uiText("Prioridade máxima na fila") : uiText("Posição na fila de perguntas")}
              </li>
              {voz.type === 'live' ? (
                <li className="flex items-center gap-2 text-sm text-palco-text-secondary">
                  <CheckCircle className="w-4 h-4 text-green-500" />{uiText("Interação ao vivo durante a Roda")}</li>
              ) : voz.type === 'highlight' ? (
                <li className="flex items-center gap-2 text-sm text-palco-text-secondary">
                  <CheckCircle className="w-4 h-4 text-green-500" />{uiText("Resposta aprofundada e detalhada")}</li>
              ) : null}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <div className="sticky bottom-0 bg-palco-surface border-t border-palco-border p-4 space-y-3">
        <Button
          onClick={handleBuyVoice}
          className="w-full bg-palco-accent hover:bg-palco-accent/90 text-white rounded-full h-12 text-base font-medium"
        >{uiText("Comprar Voz - $")}{voz.price}
        </Button>
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="w-full text-palco-text-secondary"
        >{uiText("Voltar")}</Button>
      </div>
    </div>
  );
}
