import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare,
  Mail,
  Mic,
  Star,
  CheckCircle,
  Clock,
  X,
  ChevronDown,
  ChevronUp,
  DollarSign
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Voz } from '@/hooks/usePalco';
import { formatDistanceToNow } from '@/i18n/ui-date';
import { pt } from 'date-fns/locale';

interface VozesPanelProps {
  vozes: Voz[];
  isGuide: boolean;
  onConfirmPayment?: (vozId: string) => void;
  onMarkAnswered?: (vozId: string) => void;
  confirmingId?: string | null;
  answeringId?: string | null;
  isCompact?: boolean;
}

const typeConfig = {
  email: { icon: Mail, label: 'Email', color: 'text-blue-500', bg: 'bg-blue-500/10' },
  live: { icon: Mic, get label() { return uiText("Live"); }, color: 'text-green-500', bg: 'bg-green-500/10' },
  highlight: { icon: Star, get label() { return uiText("Destaque"); }, color: 'text-palco-accent', bg: 'bg-palco-accent/10' },
};

const statusConfig: Record<string, { label: string; color: string; bg?: string; border?: string }> = {
  pending: { get label() { return uiText("Pendente"); }, color: 'text-orange-500', border: 'border-orange-500' },
  paid: { get label() { return uiText("Pago"); }, color: 'text-green-500', bg: 'bg-green-500' },
  queued: { get label() { return uiText("Na Fila"); }, color: 'text-palco-accent', border: 'border-palco-accent' },
  answered: { get label() { return uiText("Respondido"); }, color: 'text-gray-500', bg: 'bg-gray-500' },
  refunded: { get label() { return uiText("Reembolsado"); }, color: 'text-red-500', border: 'border-red-500' },
};

export function VozesPanel({
  vozes,
  isGuide,
  onConfirmPayment,
  onMarkAnswered,
  confirmingId,
  answeringId,
  isCompact = false,
}: VozesPanelProps) {
  useUiLocale();
  const [expanded, setExpanded] = useState(true);

  // Group vozes by status priority for guides
  const paidVozes = vozes.filter(v => v.status === 'paid');
  const queuedVozes = vozes.filter(v => v.status === 'queued');
  const pendingVozes = vozes.filter(v => v.status === 'pending');
  const answeredVozes = vozes.filter(v => v.status === 'answered');

  // For live view, show queue first
  const orderedVozes = isCompact
    ? [...queuedVozes, ...paidVozes].slice(0, 5)
    : [...queuedVozes, ...paidVozes, ...pendingVozes, ...answeredVozes];

  if (vozes.length === 0) {
    return (
      <div className={cn(
        "flex flex-col items-center justify-center text-center",
        isCompact ? "py-4" : "py-8"
      )}>
        <MessageSquare className="w-8 h-8 text-palco-accent/40 mb-2" />
        <p className="text-sm text-palco-text-secondary">{uiText("Nenhuma voz recebida ainda")}</p>
      </div>
    );
  }

  if (isCompact) {
    return (
      <div className="space-y-2">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between px-2 py-1"
        >
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-palco-accent" />
            <span className="text-xs font-medium text-white">{uiText("Vozes ({{value1}})", { value1: (paidVozes.length + queuedVozes.length) })}</span>
          </div>
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-white/60" />
          ) : (
            <ChevronUp className="w-4 h-4 text-white/60" />
          )}
        </button>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="space-y-1 overflow-hidden"
            >
              {orderedVozes.map((voz) => (
                <CompactVozCard
                  key={voz.id}
                  voz={voz}
                  isGuide={isGuide}
                  onMarkAnswered={onMarkAnswered}
                  isAnswering={answeringId === voz.id}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Pending (needs payment confirmation) */}
      {isGuide && pendingVozes.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-orange-500 mb-2 flex items-center gap-1">
            <Clock className="w-3 h-3" />{uiText("Aguardando Confirmação ({{value1}})", { value1: (pendingVozes.length) ?? "" })}</h4>
          <div className="space-y-2">
            {pendingVozes.map((voz) => (
              <FullVozCard
                key={voz.id}
                voz={voz}
                isGuide={isGuide}
                onConfirmPayment={onConfirmPayment}
                isConfirming={confirmingId === voz.id}
              />
            ))}
          </div>
        </div>
      )}

      {/* Paid/Queued (ready to answer) */}
      {(paidVozes.length > 0 || queuedVozes.length > 0) && (
        <div>
          <h4 className="text-xs font-medium text-green-500 mb-2 flex items-center gap-1">
            <CheckCircle className="w-3 h-3" />{uiText("Prontas para Responder ({{value1}})", { value1: (paidVozes.length + queuedVozes.length) })}</h4>
          <div className="space-y-2">
            {[...queuedVozes, ...paidVozes].map((voz) => (
              <FullVozCard
                key={voz.id}
                voz={voz}
                isGuide={isGuide}
                onMarkAnswered={onMarkAnswered}
                isAnswering={answeringId === voz.id}
              />
            ))}
          </div>
        </div>
      )}

      {/* Answered */}
      {answeredVozes.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-palco-text-secondary mb-2">{uiText("Respondidas ({{value1}})", { value1: (answeredVozes.length) ?? "" })}</h4>
          <div className="space-y-2">
            {answeredVozes.slice(0, 5).map((voz) => (
              <FullVozCard key={voz.id} voz={voz} isGuide={isGuide} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CompactVozCard({
  voz,
  isGuide,
  onMarkAnswered,
  isAnswering
}: {
  voz: Voz;
  isGuide: boolean;
  onMarkAnswered?: (id: string) => void;
  isAnswering?: boolean;
}) {
  useUiLocale();
  const config = typeConfig[voz.voice_type];
  const status = statusConfig[voz.status];
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="bg-black/40 backdrop-blur-sm rounded-lg p-2 flex items-center gap-2"
    >
      <div className={cn("w-6 h-6 rounded-full flex items-center justify-center", config.bg)}>
        <Icon className={cn("w-3 h-3", config.color)} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-xs text-white truncate">
          {voz.custom_text || uiText("Pergunta não especificada")}
        </p>
      </div>

      {isGuide && (voz.status === 'paid' || voz.status === 'queued') && onMarkAnswered && (
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-2 text-[10px] text-green-400 hover:text-green-300"
          onClick={() => onMarkAnswered(voz.id)}
          disabled={isAnswering}
        >
          {isAnswering ? '...' : uiText("Responder")}
        </Button>
      )}
    </motion.div>
  );
}

function FullVozCard({
  voz,
  isGuide,
  onConfirmPayment,
  onMarkAnswered,
  isConfirming,
  isAnswering
}: {
  voz: Voz;
  isGuide: boolean;
  onConfirmPayment?: (id: string) => void;
  onMarkAnswered?: (id: string) => void;
  isConfirming?: boolean;
  isAnswering?: boolean;
}) {
  useUiLocale();
  const config = typeConfig[voz.voice_type];
  const status = statusConfig[voz.status];
  const Icon = config.icon;

  return (
    <div className="bg-palco-surface rounded-[14px] border border-palco-border p-3">
      <div className="flex items-start gap-3">
        <div className={cn("w-10 h-10 rounded-full flex items-center justify-center shrink-0", config.bg)}>
          <Icon className={cn("w-5 h-5", config.color)} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-xs text-palco-text-secondary">
              {formatDistanceToNow(new Date(voz.created_at), { locale: pt, addSuffix: true })}
            </span>
            <Badge
              variant={status.bg ? 'default' : 'outline'}
              className={cn(
                "text-[10px]",
                status.bg ? `${status.bg} text-white` : `${status.color} ${status.border}`
              )}
            >
              {status.label}
            </Badge>
          </div>

          <p className="text-sm text-palco-text line-clamp-2 mb-2">
            {voz.custom_text || uiText("Pergunta não especificada")}
          </p>

          {voz.amount_paid && (
            <div className="flex items-center gap-1 text-xs text-palco-text-secondary">
              <DollarSign className="w-3 h-3" />
              ${voz.amount_paid} ({voz.currency})
            </div>
          )}

          {/* Guide Actions */}
          {isGuide && (
            <div className="flex items-center gap-2 mt-2">
              {voz.status === 'pending' && onConfirmPayment && (
                <Button
                  size="sm"
                  className="bg-green-500 hover:bg-green-600 text-white h-7 px-3 text-xs rounded-full"
                  onClick={() => onConfirmPayment(voz.id)}
                  disabled={isConfirming}
                >
                  <CheckCircle className="w-3 h-3 mr-1" />
                  {isConfirming ? uiText("Confirmando...") : uiText("Confirmar Pagamento")}
                </Button>
              )}

              {(voz.status === 'paid' || voz.status === 'queued') && onMarkAnswered && (
                <Button
                  size="sm"
                  className="bg-palco-accent hover:bg-palco-accent/90 text-white h-7 px-3 text-xs rounded-full"
                  onClick={() => onMarkAnswered(voz.id)}
                  disabled={isAnswering}
                >
                  <Mic className="w-3 h-3 mr-1" />
                  {isAnswering ? uiText("Marcando...") : uiText("Marcar Respondida")}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
