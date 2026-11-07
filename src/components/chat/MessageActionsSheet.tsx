import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Copy, FileText, Highlighter, Image as ImageIcon, Pin, Reply, Star, Tag, Trash2, Video, Forward, X, Mic } from 'lucide-react';
import { ResponsiveModal } from '@/components/ui/responsive-modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { AFRICAN_REACTIONS } from '@/lib/reactions';
import { mediaCaption } from '@/lib/chat-media';
import { useResolvedMediaUrl } from './MediaPreview';

const HIGHLIGHT_COLORS = [
  { name: 'yellow', swatch: 'bg-yellow-300' },
  { name: 'blue', swatch: 'bg-blue-400' },
  { name: 'green', swatch: 'bg-green-400' },
  { name: 'pink', swatch: 'bg-pink-400' },
  { name: 'orange', swatch: 'bg-orange-400' },
  { name: 'purple', swatch: 'bg-purple-400' },
];

const LABEL_SUGGESTIONS = ['Importante', 'Trabalho', 'Pessoal'];

// Reuse the conversation's private-media resolver: never display raw private
// Storage paths and never request a preview for a view-once attachment.
function AttachmentThumbnail({ type, url, posterUrl }: {
  type: string;
  url: string;
  posterUrl?: string | null;
}) {
  useUiLocale();
  const { resolvedUrl, onError, error } = useResolvedMediaUrl(type === 'image' ? url : '');
  const { resolvedUrl: poster, onError: onPosterError, error: posterError } = useResolvedMediaUrl(type === 'video' ? posterUrl || '' : '');
  const imageUrl = type === 'image' ? resolvedUrl : poster;
  const Icon = type === 'video' ? Video : type === 'image' ? ImageIcon : type === 'voice' ? Mic : FileText;
  return (
    <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-secondary flex items-center justify-center">
      {imageUrl && !error && !posterError ? (
        <img src={imageUrl} alt={type === 'video' ? uiText("Miniatura do vídeo") : uiText("Miniatura da fotografia")}
          loading="lazy" className="h-full w-full object-cover"
          onError={() => void (type === 'image' ? onError() : onPosterError())} />
      ) : (
        <Icon aria-hidden="true" className="h-6 w-6 text-muted-foreground" />
      )}
      {type === 'video' && <Video aria-hidden="true" className="absolute bottom-1 right-1 h-4 w-4 rounded bg-background/80 p-0.5" />}
    </div>
  );
}

interface MessageActionsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messageContent?: string;
  messageType?: string;
  mediaUrl?: string | null;
  thumbnailUrl?: string | null;
  isViewOnce?: boolean;
  durationSeconds?: number;
  senderName?: string;
  isOwn: boolean;
  isStarred: boolean;
  isPinned: boolean;
  highlight?: { color: string; label?: string };
  onReply: () => void;
  onCopy: () => void;
  onReact: (emoji: string) => void | Promise<void>;
  onStar: () => void | Promise<void>;
  onPin: () => void | Promise<void>;
  onForward?: () => void;
  onDelete?: () => void | Promise<void>;
  onDeleteForMe?: () => void | Promise<void>;
  onHighlight?: (color: string, label?: string) => void | Promise<void>;
  onRemoveHighlight?: () => void | Promise<void>;
}

export function MessageActionsSheet({
  open, onOpenChange, messageContent, messageType = 'text', mediaUrl,
  thumbnailUrl, durationSeconds, senderName, isViewOnce = false, isOwn, isStarred, isPinned,
  highlight, onReply, onCopy, onReact, onStar, onPin,
  onForward, onDelete, onDeleteForMe, onHighlight, onRemoveHighlight,
}: MessageActionsSheetProps) {
  useUiLocale();
  const { t } = useTranslation();
  const getMeaning = (type: string) => t(`kosolola.reactionMeanings.${type}`, { fallbackLng: 'pt' });
  const [selectedColor, setSelectedColor] = useState(highlight?.color || '');
  const [highlightLabel, setHighlightLabel] = useState(highlight?.label || '');
  const [showHighlightOptions, setShowHighlightOptions] = useState(false);
  const [showMeanings, setShowMeanings] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    if (!open) return;
    setSelectedColor(highlight?.color || '');
    setHighlightLabel(highlight?.label || '');
    setShowHighlightOptions(Boolean(highlight?.color));
    setShowMeanings(false);
    setActionError('');
    setConfirmDelete(false);
  }, [open, highlight?.color, highlight?.label]);

  const handleAction = async (action: () => void | Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setActionError('');
    try {
      await action();
      onOpenChange(false);
    } catch {
      setActionError('Não foi possível concluir. Tenta novamente.');
    } finally {
      setBusy(false);
    }
  };

  const previewText = messageType === 'image' || messageType === 'video'
    ? mediaCaption(messageContent || null, mediaUrl || null)
    : messageType === 'voice' ? undefined : messageContent;
  const attachment = ['image', 'video', 'file', 'voice'].includes(messageType);
  const attachmentName = messageType === 'image' ? 'Fotografia'
    : messageType === 'video' ? 'Vídeo'
    : messageType === 'voice' ? 'Mensagem de voz' : 'Ficheiro';

  const actionClass = 'h-11 min-w-0 justify-start gap-2 rounded-xl px-3 text-sm font-medium text-foreground hover:bg-secondary/80';

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}
      srTitle="Ações da mensagem" padded={false} hideCloseButton
      overlayClassName="bg-black/55"
      className="kosolola-message-actions max-h-[78dvh] overflow-y-auto rounded-t-3xl sm:max-w-[420px] sm:rounded-2xl">
      <div className="px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:pb-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">{uiText("Ações da mensagem")}</h2>
          <button type="button" onClick={() => onOpenChange(false)}
            aria-label={uiText("Fechar ações")} className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">{uiText("Reações")}</span>
          <button type="button" aria-expanded={showMeanings} onClick={() => setShowMeanings(v => !v)}
            className="min-h-9 rounded-md px-2 text-xs text-primary underline-offset-2 hover:underline">
            {showMeanings ? uiText("Ocultar significados") : uiText("O que significam?")}
          </button>
        </div>
        <div className="grid grid-cols-5 gap-1" role="group" aria-label={uiText("Reações africanas")}>
          {AFRICAN_REACTIONS.map(reaction => (
            <button key={reaction.type} type="button" disabled={busy}
              onClick={() => void handleAction(() => onReact(reaction.type))}
              aria-label={`${reaction.label}: ${getMeaning(reaction.type)}`}
              title={`${reaction.label}: ${getMeaning(reaction.type)}`}
              className="flex min-w-0 min-h-[62px] flex-col items-center justify-center gap-1 rounded-xl hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50">
              <span aria-hidden="true" className="text-[25px] leading-none">{reaction.icon}</span>
              <span className="max-w-full truncate px-0.5 text-[10px] text-foreground">{reaction.label.split(' ')[0]}</span>
            </button>
          ))}
        </div>
        {showMeanings && (
          <div className="mt-2 space-y-1 rounded-lg bg-secondary/60 p-2">
            {AFRICAN_REACTIONS.map(r => (
              <p key={r.type} className="text-xs text-foreground"><strong>{r.label}:</strong> {getMeaning(r.type)}</p>
            ))}
          </div>
        )}

        {(attachment || previewText) && (
          <div className="my-3 flex min-w-0 items-center gap-3 rounded-xl border border-border bg-secondary/40 p-2.5">
            {attachment && (isViewOnce
              ? <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary"><ImageIcon aria-hidden="true" className="h-6 w-6" /></div>
              : (mediaUrl || messageType === 'voice') ? <AttachmentThumbnail type={messageType} url={mediaUrl || ''} posterUrl={thumbnailUrl} />
              : <FileText aria-hidden="true" className="h-5 w-5 shrink-0" />)}
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs text-muted-foreground">{isOwn ? uiText("Tu") : senderName || uiText("Remetente")}</p>
              <p className="break-words text-sm text-foreground line-clamp-2">
                {isViewOnce ? uiText("Conteúdo de visualização única") : previewText || (attachment ? attachmentName : '')}
                {messageType === 'voice' && !isViewOnce && <span className="ml-2 text-muted-foreground">
                  {typeof durationSeconds === 'number' && Number.isFinite(durationSeconds) && durationSeconds >= 0
                    ? `${Math.floor(durationSeconds / 60)}:${String(Math.floor(durationSeconds % 60)).padStart(2, '0')}`
                    : uiText("Duração indisponível")}
                </span>}
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-1" role="group" aria-label={uiText("Ações rápidas")}>
          <Button variant="ghost" disabled={busy} className={actionClass} onClick={() => void handleAction(onReply)}>
            <Reply className="h-4 w-4 shrink-0" />{uiText("Responder")}</Button>
          {previewText && !isViewOnce && (
            <Button variant="ghost" disabled={busy} className={actionClass} onClick={() => void handleAction(onCopy)}>
              <Copy className="h-4 w-4 shrink-0" />{uiText("Copiar")}</Button>
          )}
          {onForward && <Button variant="ghost" disabled={busy} className={actionClass} onClick={() => void handleAction(onForward)}>
            <Forward className="h-4 w-4 shrink-0" />{uiText("Reencaminhar")}</Button>}
          <Button variant="ghost" disabled={busy} className={cn(actionClass, 'col-span-2')} title={uiText("Guarda a mensagem apenas nos teus favoritos")} onClick={() => void handleAction(onStar)}>
            <Star className={cn('h-4 w-4 shrink-0', isStarred && 'fill-amber-400 text-amber-500')} />
            {isStarred ? uiText("Retirar dos favoritos") : uiText("Marcar como favorita")}
          </Button>
          {isOwn && <Button variant="ghost" disabled={busy} className={actionClass} title={uiText("Fixa a mensagem no topo desta conversa")} onClick={() => void handleAction(onPin)}>
            <Pin className={cn('h-4 w-4 shrink-0', isPinned && 'fill-primary text-primary')} />
            {isPinned ? uiText("Desafixar") : uiText("Fixar na conversa")}
          </Button>}
        </div>

        {(onDeleteForMe || (isOwn && onDelete)) && (
          <div className="mt-2 border-t border-border pt-1">
            {!confirmDelete ? (
              <Button variant="ghost" disabled={busy} className="h-11 w-full justify-start gap-2 text-destructive hover:text-destructive"
                onClick={() => setConfirmDelete(true)}>
                <Trash2 className="h-4 w-4" />{uiText("Apagar mensagem")}</Button>
            ) : (
              <div role="group" aria-label={uiText("Confirmar eliminação")} className="space-y-1">
                <p className="px-3 text-xs text-muted-foreground">{uiText("Apagar só para ti mantém a mensagem para os outros participantes.")}</p>
                {onDeleteForMe && <Button variant="ghost" disabled={busy} className="h-11 w-full justify-start text-destructive"
                  onClick={() => void handleAction(onDeleteForMe)}>{uiText("Apagar só para mim")}</Button>}
                {isOwn && onDelete && <Button variant="ghost" disabled={busy} className="h-11 w-full justify-start text-destructive"
                  onClick={() => void handleAction(onDelete)}>{uiText("Apagar para todos")}</Button>}
                <Button variant="ghost" disabled={busy} className="h-11 w-full" onClick={() => setConfirmDelete(false)}>{uiText("Cancelar")}</Button>
              </div>
            )}
          </div>
        )}

        {onHighlight && (
          <div className="mt-3 border-t border-border pt-2">
            <button type="button" aria-expanded={showHighlightOptions}
              onClick={() => setShowHighlightOptions(v => !v)}
              className="flex min-h-11 w-full items-center gap-2 rounded-xl px-2 text-left text-sm font-medium text-foreground hover:bg-secondary">
              <Highlighter className="h-4 w-4" />
              <span className="flex-1">{uiText("Destaque com cor e etiqueta")}</span>
              <span className="text-xs text-muted-foreground">{showHighlightOptions ? uiText("Ocultar") : uiText("Escolher")}</span>
            </button>
            {showHighlightOptions && (
              <div className="space-y-2 px-1 pb-1 pt-2">
                <div className="flex flex-wrap items-center justify-between gap-1" role="group" aria-label={uiText("Cor do destaque")}>
                  {HIGHLIGHT_COLORS.map(c => (
                    <button key={c.name} type="button" aria-label={`Cor ${c.name}`}
                      aria-pressed={selectedColor === c.name} onClick={() => setSelectedColor(c.name)}
                      className={cn('flex h-11 w-11 items-center justify-center rounded-full focus-visible:ring-2 focus-visible:ring-ring', selectedColor === c.name && 'ring-2 ring-ring ring-offset-2 ring-offset-background')}>
                      <span className={cn('flex h-8 w-8 items-center justify-center rounded-full', c.swatch)}>
                        {selectedColor === c.name && <Check aria-hidden="true" className="h-5 w-5 text-gray-950" />}
                      </span>
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1" role="group" aria-label={uiText("Etiquetas sugeridas")}>
                  {LABEL_SUGGESTIONS.map(label => (
                    <button key={label} type="button" aria-pressed={highlightLabel === label}
                      onClick={() => setHighlightLabel(label)}
                      className={cn('min-h-9 rounded-full border border-border px-3 text-xs text-foreground hover:bg-secondary', highlightLabel === label && 'border-primary bg-primary/10')}>
                      {label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <Tag aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <Input aria-label={uiText("Etiqueta do destaque")} placeholder={uiText("Etiqueta personalizada (opcional)")}
                    maxLength={48} value={highlightLabel} onChange={e => setHighlightLabel(e.target.value)}
                    className="h-11 min-w-0 flex-1 text-base" />
                </div>
                <div className="flex items-center gap-2">
                  <Button disabled={!selectedColor || busy} className="h-11 flex-1" onClick={() => void handleAction(() => onHighlight(selectedColor, highlightLabel.trim() || undefined))}>{uiText("Guardar destaque")}</Button>
                  {highlight?.color && onRemoveHighlight && (
                    <Button variant="outline" disabled={busy} className="h-11" onClick={() => void handleAction(onRemoveHighlight)}>{uiText("Remover")}</Button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {actionError && <p role="alert" className="mt-2 text-xs text-destructive">{actionError}</p>}
      </div>
    </ResponsiveModal>
  );
}
