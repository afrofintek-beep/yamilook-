import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Image as ImageIcon, Loader2 } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

interface CreateHighlightSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateHighlight: (title: string, coverFile?: File) => Promise<void>;
}

export function CreateHighlightSheet({
  open,
  onOpenChange,
  onCreateHighlight,
}: CreateHighlightSheetProps) {
  useUiLocale();
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCoverFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setCoverPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreate = async () => {
    if (!title.trim()) {
      toast.error(uiText("Título é obrigatório"));
      return;
    }

    setLoading(true);
    try {
      await onCreateHighlight(title.trim(), coverFile || undefined);
      toast.success(uiText("Momambo criado!"));
      onOpenChange(false);
      resetForm();
    } catch (error) {
      console.error('Error creating momambo:', error);
      toast.error(uiText("Erro ao criar Momambo"));
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setCoverFile(null);
    setCoverPreview(null);
  };

  const handleClose = () => {
    onOpenChange(false);
    resetForm();
  };

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl">
        <SheetHeader className="pb-4">
          <SheetTitle className="text-center">{uiText("Criar Momambo")}</SheetTitle>
        </SheetHeader>

        <div className="space-y-6 px-2">
          {/* Cover image selector */}
          <div className="flex flex-col items-center">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="relative w-28 h-28 rounded-full overflow-hidden bg-muted/60 border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 transition-colors flex items-center justify-center group"
            >
              <AnimatePresence mode="wait">
                {coverPreview ? (
                  <motion.img
                    key="preview"
                    src={coverPreview}
                    alt={uiText("Cover preview")}
                    className="w-full h-full object-cover"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  />
                ) : (
                  <motion.div
                    key="placeholder"
                    className="flex flex-col items-center gap-1 text-muted-foreground"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <ImageIcon className="w-8 h-8" />
                    <span className="text-xs">{uiText("Capa")}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Plus className="w-6 h-6 text-white" />
              </div>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />

            <p className="text-xs text-muted-foreground mt-2">{uiText("Toque para adicionar capa (opcional)")}</p>
          </div>

          {/* Title input */}
          <div className="space-y-2">
            <Label htmlFor="momambo-title">{uiText("Nome do Momambo")}</Label>
            <Input
              id="momambo-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={uiText("Ex: Viagens, Família, Projetos...")}
              className="h-12 rounded-xl"
              maxLength={30}
            />
            <p className="text-xs text-muted-foreground text-right">
              {title.length}/30
            </p>
          </div>

          {/* Create button */}
          <Button
            onClick={handleCreate}
            disabled={loading || !title.trim()}
            className="w-full h-12 rounded-xl font-semibold"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              uiText("Criar Momambo")
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
