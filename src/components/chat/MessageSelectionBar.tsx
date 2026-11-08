import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { motion } from 'framer-motion';
import { X, Trash2, Forward, Copy, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MessageSelectionBarProps {
  selectedCount: number;
  onCancel: () => void;
  onDelete: () => void;
  onForward: () => void;
  onCopy: () => void;
  onStar: () => void;
  canDelete: boolean;
}

export function MessageSelectionBar({
  selectedCount,
  onCancel,
  onDelete,
  onForward,
  onCopy,
  onStar,
  canDelete,
}: MessageSelectionBarProps) {
  useUiLocale();
  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      className="fixed bottom-0 left-0 right-0 bg-background border-t border-border shadow-lg z-50 safe-bottom"
    >
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={onCancel}
          >
            <X className="w-5 h-5" />
          </Button>
          <span className="font-medium">
            {selectedCount} {selectedCount === 1 ? uiText("selecionada") : uiText("selecionadas")}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={onCopy}
            title={uiText("Copiar")}
          >
            <Copy className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={onStar}
            title={uiText("Estrelar")}
          >
            <Star className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={onForward}
            title={uiText("Reencaminhar")}
          >
            <Forward className="w-5 h-5" />
          </Button>
          {canDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full text-destructive hover:text-destructive"
              onClick={onDelete}
              title={uiText("Apagar")}
            >
              <Trash2 className="w-5 h-5" />
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
