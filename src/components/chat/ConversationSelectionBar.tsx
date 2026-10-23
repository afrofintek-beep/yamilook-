import { motion } from 'framer-motion';
import { X, Archive, Pin, BellOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ConversationSelectionBarProps {
  selectedCount: number;
  onCancel: () => void;
  onArchive: () => void;
  onPin: () => void;
  onMute: () => void;
}

export function ConversationSelectionBar({
  selectedCount,
  onCancel,
  onArchive,
  onPin,
  onMute,
}: ConversationSelectionBarProps) {
  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] left-0 right-0 bg-background border-t border-border shadow-lg z-[60]"
    >
      <div className="flex items-center justify-between px-2 py-3 max-w-md mx-auto gap-1">
        <div className="flex items-center gap-1 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={onCancel}
            aria-label="Cancelar seleção"
          >
            <X className="w-5 h-5" />
          </Button>
          <span className="font-medium text-sm truncate">
            {selectedCount} {selectedCount === 1 ? 'selecionada' : 'selecionadas'}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={onPin}
            title="Fixar" aria-label="Fixar conversas"
          >
            <Pin className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={onMute}
            title="Silenciar" aria-label="Silenciar conversas"
          >
            <BellOff className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={onArchive}
            title="Arquivar" aria-label="Arquivar conversas"
          >
            <Archive className="w-5 h-5" />
          </Button>

        </div>
      </div>
    </motion.div>
  );
}
