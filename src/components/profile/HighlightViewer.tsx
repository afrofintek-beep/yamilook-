import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, Plus, Trash2, Loader2 } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import type { Highlight, HighlightItem } from '@/hooks/useHighlights';

interface HighlightViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  highlight: Highlight | null;
  items: HighlightItem[];
  isOwner: boolean;
  onAddItem?: (file: File) => Promise<void>;
  onDeleteHighlight?: () => Promise<void>;
}

export function HighlightViewer({
  open,
  onOpenChange,
  highlight,
  items,
  isOwner,
  onAddItem,
  onDeleteHighlight,
}: HighlightViewerProps) {
  useUiLocale();
  const { t } = useTranslation();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const STORY_DURATION = 5000; // 5 seconds per item

  useEffect(() => {
    if (!open || items.length === 0) {
      setCurrentIndex(0);
      setProgress(0);
      return;
    }

    if (isPaused) return;

    const startTime = Date.now();

    const updateProgress = () => {
      const elapsed = Date.now() - startTime;
      const newProgress = Math.min((elapsed / STORY_DURATION) * 100, 100);
      setProgress(newProgress);

      if (newProgress >= 100) {
        if (currentIndex < items.length - 1) {
          setCurrentIndex(prev => prev + 1);
          setProgress(0);
        } else {
          onOpenChange(false);
        }
      }
    };

    timerRef.current = setInterval(updateProgress, 50);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [open, currentIndex, items.length, isPaused, onOpenChange]);

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setProgress(0);
    }
  };

  const handleNext = () => {
    if (currentIndex < items.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setProgress(0);
    } else {
      onOpenChange(false);
    }
  };

  const handleTouchStart = () => setIsPaused(true);
  const handleTouchEnd = () => setIsPaused(false);

  const handleAddFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onAddItem) return;

    setUploading(true);
    try {
      await onAddItem(file);
      toast.success(uiText("Adicionado ao destaque!"));
    } catch (error) {
      toast.error(uiText("Erro ao adicionar"));
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!onDeleteHighlight) return;

    try {
      await onDeleteHighlight();
      onOpenChange(false);
      toast.success(uiText("Destaque eliminado"));
    } catch (error) {
      toast.error(uiText("Erro ao eliminar"));
    }
  };

  if (!highlight) return null;

  const currentItem = items[currentIndex];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md h-[90vh] p-0 bg-black border-0 overflow-hidden" hideCloseButton>
        {/* Progress bars */}
        <div className="absolute top-0 left-0 right-0 z-20 flex gap-1 p-2">
          {items.map((_, index) => (
            <div key={index} className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all duration-100"
                style={{
                  width: index < currentIndex ? '100%' : index === currentIndex ? `${progress}%` : '0%',
                }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute top-4 left-0 right-0 z-20 flex items-center justify-between px-4 pt-2">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full overflow-hidden ring-2 ring-white/50">
              <img
                src={highlight.cover_url || '/placeholder.svg'}
                alt={highlight.title}
                className="w-full h-full object-cover"
              />
            </div>
            <span className="text-white font-medium text-sm">{highlight.title}</span>
          </div>
          <div className="flex items-center gap-2">
            {isOwner && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  onChange={handleAddFile}
                  className="hidden"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/20"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Plus className="w-5 h-5" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/20"
                  onClick={handleDelete}
                >
                  <Trash2 className="w-5 h-5" />
                </Button>
              </>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              onClick={() => onOpenChange(false)}
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div
          className="relative w-full h-full flex items-center justify-center"
          onMouseDown={handleTouchStart}
          onMouseUp={handleTouchEnd}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {items.length > 0 && currentItem ? (
            <AnimatePresence mode="wait">
              <motion.div
                key={currentItem.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="w-full h-full"
              >
                {currentItem.media_type === 'video' ? (
                  <video
                    src={currentItem.media_url}
                    className="w-full h-full object-contain"
                    autoPlay
                    muted
                    playsInline
                  />
                ) : (
                  <img
                    src={currentItem.media_url}
                    alt=""
                    className="w-full h-full object-contain"
                  />
                )}
                {currentItem.caption && (
                  <div className="absolute bottom-20 left-0 right-0 px-4">
                    <p className="text-white text-center text-sm bg-black/40 rounded-lg p-2">
                      {currentItem.caption}
                    </p>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          ) : (
            <div className="flex flex-col items-center gap-4 text-white/70">
              <p>{uiText("Sem conteúdo ainda")}</p>
              {isOwner && (
                <Button
                  variant="outline"
                  className="border-white/30 text-white hover:bg-white/20"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Plus className="w-4 h-4 mr-2" />{uiText("Adicionar")}</Button>
              )}
            </div>
          )}

          {/* Navigation areas */}
          {items.length > 1 && (
            <>
              <button
                className="absolute left-0 top-0 bottom-0 w-1/3 z-10"
                onClick={handlePrevious}
              />
              <button
                className="absolute right-0 top-0 bottom-0 w-1/3 z-10"
                onClick={handleNext}
              />
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
