import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Image, Palette, Sparkles, Upload, Trash2, ImagePlus } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { useSettings } from '@/hooks/useSettings';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { ImageCropDialog } from './ImageCropDialog';

interface ChatWallpaperSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CustomWallpaper {
  id: string;
  name: string;
  url: string;
}

const solidColors = [
  { id: 'default', color: 'hsl(var(--background))', name: 'Default' },
  { id: 'slate', color: '#1e293b', name: 'Slate' },
  { id: 'gray', color: '#374151', name: 'Gray' },
  { id: 'zinc', color: '#27272a', name: 'Zinc' },
  { id: 'neutral', color: '#262626', name: 'Neutral' },
  { id: 'stone', color: '#292524', name: 'Stone' },
  { id: 'red', color: '#7f1d1d', name: 'Red' },
  { id: 'orange', color: '#7c2d12', name: 'Orange' },
  { id: 'amber', color: '#78350f', name: 'Amber' },
  { id: 'yellow', color: '#713f12', name: 'Yellow' },
  { id: 'lime', color: '#365314', name: 'Lime' },
  { id: 'green', color: '#14532d', name: 'Green' },
  { id: 'emerald', color: '#064e3b', name: 'Emerald' },
  { id: 'teal', color: '#134e4a', name: 'Teal' },
  { id: 'cyan', color: '#164e63', name: 'Cyan' },
  { id: 'sky', color: '#0c4a6e', name: 'Sky' },
  { id: 'blue', color: '#1e3a8a', name: 'Blue' },
  { id: 'indigo', color: '#312e81', name: 'Indigo' },
  { id: 'violet', color: '#4c1d95', name: 'Violet' },
  { id: 'purple', color: '#581c87', name: 'Purple' },
  { id: 'fuchsia', color: '#701a75', name: 'Fuchsia' },
  { id: 'pink', color: '#831843', name: 'Pink' },
  { id: 'rose', color: '#881337', name: 'Rose' },
];

const gradients = [
  { id: 'gradient-sunset', gradient: 'linear-gradient(135deg, #f97316 0%, #ec4899 100%)', name: 'Sunset' },
  { id: 'gradient-ocean', gradient: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)', name: 'Ocean' },
  { id: 'gradient-forest', gradient: 'linear-gradient(135deg, #22c55e 0%, #14b8a6 100%)', name: 'Forest' },
  { id: 'gradient-lavender', gradient: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)', name: 'Lavender' },
  { id: 'gradient-midnight', gradient: 'linear-gradient(135deg, #1e3a8a 0%, #312e81 100%)', name: 'Midnight' },
  { id: 'gradient-aurora', gradient: 'linear-gradient(135deg, #10b981 0%, #8b5cf6 50%, #ec4899 100%)', name: 'Aurora' },
  { id: 'gradient-fire', gradient: 'linear-gradient(135deg, #ef4444 0%, #f97316 50%, #eab308 100%)', name: 'Fire' },
  { id: 'gradient-candy', gradient: 'linear-gradient(135deg, #ec4899 0%, #f472b6 50%, #fb7185 100%)', name: 'Candy' },
  { id: 'gradient-night', gradient: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)', name: 'Night' },
  { id: 'gradient-moss', gradient: 'linear-gradient(135deg, #064e3b 0%, #065f46 50%, #047857 100%)', name: 'Moss' },
  { id: 'gradient-berry', gradient: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 50%, #d946ef 100%)', name: 'Berry' },
  { id: 'gradient-steel', gradient: 'linear-gradient(135deg, #475569 0%, #64748b 50%, #94a3b8 100%)', name: 'Steel' },
];

const patterns = [
  { id: 'pattern-dots', pattern: 'radial-gradient(circle, hsl(var(--muted-foreground) / 0.15) 1px, transparent 1px)', size: '20px 20px', name: 'Dots' },
  { id: 'pattern-grid', pattern: 'linear-gradient(hsl(var(--muted-foreground) / 0.1) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--muted-foreground) / 0.1) 1px, transparent 1px)', size: '20px 20px', name: 'Grid' },
  { id: 'pattern-diagonal', pattern: 'repeating-linear-gradient(45deg, transparent, transparent 10px, hsl(var(--muted-foreground) / 0.05) 10px, hsl(var(--muted-foreground) / 0.05) 20px)', size: '100% 100%', name: 'Diagonal' },
  { id: 'pattern-zigzag', pattern: 'linear-gradient(135deg, hsl(var(--muted-foreground) / 0.1) 25%, transparent 25%), linear-gradient(225deg, hsl(var(--muted-foreground) / 0.1) 25%, transparent 25%), linear-gradient(45deg, hsl(var(--muted-foreground) / 0.1) 25%, transparent 25%), linear-gradient(315deg, hsl(var(--muted-foreground) / 0.1) 25%, transparent 25%)', size: '20px 20px', name: 'Zigzag' },
  { id: 'pattern-waves', pattern: 'radial-gradient(ellipse at 50% 0%, hsl(var(--muted-foreground) / 0.1) 50%, transparent 50%)', size: '40px 20px', name: 'Waves' },
  { id: 'pattern-triangles', pattern: 'linear-gradient(120deg, hsl(var(--muted-foreground) / 0.1) 33.33%, transparent 33.33%), linear-gradient(240deg, hsl(var(--muted-foreground) / 0.1) 33.33%, transparent 33.33%)', size: '40px 40px', name: 'Triangles' },
  { id: 'pattern-honeycomb', pattern: 'radial-gradient(circle farthest-side at 0% 50%, hsl(var(--background)) 47.5%, transparent 48%), radial-gradient(circle farthest-side at 100% 50%, hsl(var(--background)) 47.5%, transparent 48%), linear-gradient(hsl(var(--muted-foreground) / 0.1), hsl(var(--muted-foreground) / 0.1))', size: '30px 52px', name: 'Honeycomb' },
  { id: 'pattern-crosses', pattern: 'linear-gradient(hsl(var(--muted-foreground) / 0.1) 2px, transparent 2px), linear-gradient(90deg, hsl(var(--muted-foreground) / 0.1) 2px, transparent 2px)', size: '40px 40px', name: 'Crosses' },
];

export function ChatWallpaperSheet({ open, onOpenChange }: ChatWallpaperSheetProps) {
  useUiLocale();
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth();
  const { settings, updateSettings } = useSettings();
  const [selectedWallpaper, setSelectedWallpaper] = useState(settings?.chat_wallpaper || 'default');
  const [isApplying, setIsApplying] = useState(false);
  const [customWallpapers, setCustomWallpapers] = useState<CustomWallpaper[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Crop dialog state
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [originalFileName, setOriginalFileName] = useState<string>('');

  // Load custom wallpapers
  useEffect(() => {
    if (!user || !open) return;
    loadCustomWallpapers();
  }, [user, open]);

  const loadCustomWallpapers = async () => {
    if (!user) return;

    const { data, error } = await supabase.storage
      .from('chat-wallpapers')
      .list(user.id, { limit: 20 });

    if (error) {
      console.error('Error loading wallpapers:', error);
      return;
    }

    const wallpapers: CustomWallpaper[] = (data || [])
      .filter(file => file.name !== '.emptyFolderPlaceholder')
      .map(file => {
        const { data: urlData } = supabase.storage
          .from('chat-wallpapers')
          .getPublicUrl(`${user.id}/${file.name}`);

        return {
          id: `custom-${file.name}`,
          name: file.name.replace(/\.[^/.]+$/, ''),
          url: urlData.publicUrl,
        };
      });

    setCustomWallpapers(wallpapers);
  };

  const handleSelect = (id: string) => {
    setSelectedWallpaper(id);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: t('errors.invalidFileType', 'Tipo de ficheiro inválido'),
        description: t('errors.onlyImages', 'Apenas imagens são permitidas'),
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (max 10MB for cropping, will be compressed after)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: t('errors.fileTooLarge', 'Ficheiro demasiado grande'),
        description: t('errors.maxFileSize', 'O tamanho máximo é 10MB'),
        variant: 'destructive',
      });
      return;
    }

    // Create object URL for cropping
    const imageUrl = URL.createObjectURL(file);
    setImageToCrop(imageUrl);
    setOriginalFileName(file.name);
    setCropDialogOpen(true);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCropComplete = async (croppedBlob: Blob) => {
    if (!user) return;

    setIsUploading(true);
    try {
      const fileName = `${Date.now()}-${originalFileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('chat-wallpapers')
        .upload(filePath, croppedBlob, {
          contentType: 'image/jpeg',
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('chat-wallpapers')
        .getPublicUrl(filePath);

      const newWallpaper: CustomWallpaper = {
        id: `custom-${fileName}`,
        name: originalFileName.replace(/\.[^/.]+$/, ''),
        url: urlData.publicUrl,
      };

      setCustomWallpapers(prev => [newWallpaper, ...prev]);
      setSelectedWallpaper(newWallpaper.url);

      toast({
        title: t('settings.wallpaperUploaded', 'Imagem carregada'),
        description: t('settings.wallpaperUploadedDesc', 'A imagem foi adicionada às suas opções'),
      });
    } catch (error) {
      toast({
        title: t('errors.uploadFailed', 'Erro ao carregar'),
        description: error instanceof Error ? error.message : String(error),
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
      // Clean up object URL
      if (imageToCrop) {
        URL.revokeObjectURL(imageToCrop);
        setImageToCrop(null);
      }
    }
  };

  const handleDeleteCustomWallpaper = async (wallpaper: CustomWallpaper) => {
    if (!user) return;

    const fileName = wallpaper.id.replace('custom-', '');
    const filePath = `${user.id}/${fileName}`;

    const { error } = await supabase.storage
      .from('chat-wallpapers')
      .remove([filePath]);

    if (error) {
      toast({
        title: t('errors.deleteFailed', 'Erro ao eliminar'),
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    setCustomWallpapers(prev => prev.filter(w => w.id !== wallpaper.id));

    if (selectedWallpaper === wallpaper.url) {
      setSelectedWallpaper('default');
    }

    toast({
      title: t('settings.wallpaperDeleted', 'Imagem eliminada'),
    });
  };

  const handleApply = async () => {
    setIsApplying(true);
    try {
      const { error } = await updateSettings({ chat_wallpaper: selectedWallpaper });
      if (error) throw error;

      toast({
        title: t('settings.wallpaperApplied', 'Papel de parede aplicado'),
        description: t('settings.wallpaperAppliedDesc', 'O fundo do chat foi atualizado.'),
      });
      onOpenChange(false);
    } catch (error) {
      toast({
        title: t('errors.generic', 'Erro'),
        description: error instanceof Error ? error.message : String(error),
        variant: 'destructive',
      });
    } finally {
      setIsApplying(false);
    }
  };

  const getWallpaperStyle = (id: string): React.CSSProperties => {
    // Check if it's a URL (custom image)
    if (id.startsWith('http')) {
      return {
        backgroundImage: `url(${id})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      };
    }

    const solid = solidColors.find(c => c.id === id);
    if (solid) {
      return { backgroundColor: solid.color };
    }

    const gradient = gradients.find(g => g.id === id);
    if (gradient) {
      return { background: gradient.gradient };
    }

    const pattern = patterns.find(p => p.id === id);
    if (pattern) {
      return {
        backgroundColor: 'hsl(var(--background))',
        backgroundImage: pattern.pattern,
        backgroundSize: pattern.size,
      };
    }

    return {};
  };

  const ColorOption = ({ id, style, name, selected }: { id: string; style: React.CSSProperties; name: string; selected: boolean }) => (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={() => handleSelect(id)}
      className={cn(
        "relative w-full aspect-[3/4] rounded-xl overflow-hidden border-2 transition-all",
        selected ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-primary/50"
      )}
      style={style}
    >
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            className="absolute inset-0 flex items-center justify-center bg-primary/20"
          >
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
              <Check className="w-5 h-5 text-primary-foreground" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="absolute bottom-0 inset-x-0 p-2 bg-gradient-to-t from-black/60 to-transparent">
        <span className="text-xs font-medium text-white">{name}</span>
      </div>
    </motion.button>
  );

  const CustomWallpaperOption = ({ wallpaper, selected }: { wallpaper: CustomWallpaper; selected: boolean }) => (
    <div className="relative group">
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => handleSelect(wallpaper.url)}
        className={cn(
          "relative w-full aspect-[3/4] rounded-xl overflow-hidden border-2 transition-all",
          selected ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-primary/50"
        )}
        style={{
          backgroundImage: `url(${wallpaper.url})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <AnimatePresence>
          {selected && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute inset-0 flex items-center justify-center bg-primary/20"
            >
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                <Check className="w-5 h-5 text-primary-foreground" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="absolute bottom-0 inset-x-0 p-2 bg-gradient-to-t from-black/60 to-transparent">
          <span className="text-xs font-medium text-white truncate block">{wallpaper.name}</span>
        </div>
      </motion.button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          handleDeleteCustomWallpaper(wallpaper);
        }}
        className="absolute top-1 right-1 w-6 h-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[75dvh] max-h-[75dvh] rounded-t-3xl flex flex-col"
        style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))' }}
      >
        <SheetHeader className="pb-3 shrink-0">
          <SheetTitle className="flex items-center gap-2">
            <Image className="w-5 h-5" />
            {t('settings.chatWallpaper')}
          </SheetTitle>
        </SheetHeader>

        {/* Preview - reduced height for mobile */}
        <div
          className="relative h-24 sm:h-28 rounded-xl overflow-hidden mb-3 border border-border shrink-0"
          style={getWallpaperStyle(selectedWallpaper)}
        >
          <div className="absolute inset-0 flex flex-col justify-end p-2.5 gap-1.5">
            <div className="self-start max-w-[70%] bg-secondary/90 backdrop-blur-sm rounded-2xl rounded-bl-sm px-3 py-1.5">
              <p className="text-sm">{uiText("Hello! 👋")}</p>
            </div>
            <div className="self-end max-w-[70%] bg-primary text-primary-foreground rounded-2xl rounded-br-sm px-3 py-1.5">
              <p className="text-sm">{uiText("Hi there!")}</p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="colors" className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <TabsList className="w-full grid grid-cols-4 mb-3 shrink-0 h-10">
            <TabsTrigger value="colors" className="gap-1 text-xs px-1">
              <Palette className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">{t('settings.colors', 'Cores')}</span>
            </TabsTrigger>
            <TabsTrigger value="gradients" className="gap-1 text-xs px-1">
              <Sparkles className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">{t('settings.gradients', 'Grad.')}</span>
            </TabsTrigger>
            <TabsTrigger value="patterns" className="gap-1 text-xs px-1">
              <Image className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">{t('settings.patterns', 'Padrões')}</span>
            </TabsTrigger>
            <TabsTrigger value="custom" className="gap-1 text-xs px-1">
              <ImagePlus className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">{t('settings.custom', 'Minhas')}</span>
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 min-h-0">
            <TabsContent value="colors" className="mt-0">
              <div className="grid grid-cols-4 gap-3 pb-4">
                {solidColors.map((color) => (
                  <ColorOption
                    key={color.id}
                    id={color.id}
                    style={{ backgroundColor: color.color }}
                    name={color.name}
                    selected={selectedWallpaper === color.id}
                  />
                ))}
              </div>
            </TabsContent>

            <TabsContent value="gradients" className="mt-0">
              <div className="grid grid-cols-3 gap-3 pb-4">
                {gradients.map((gradient) => (
                  <ColorOption
                    key={gradient.id}
                    id={gradient.id}
                    style={{ background: gradient.gradient }}
                    name={gradient.name}
                    selected={selectedWallpaper === gradient.id}
                  />
                ))}
              </div>
            </TabsContent>

            <TabsContent value="patterns" className="mt-0">
              <div className="grid grid-cols-3 gap-3 pb-4">
                {patterns.map((pattern) => (
                  <ColorOption
                    key={pattern.id}
                    id={pattern.id}
                    style={{
                      backgroundColor: 'hsl(var(--secondary))',
                      backgroundImage: pattern.pattern,
                      backgroundSize: pattern.size,
                    }}
                    name={pattern.name}
                    selected={selectedWallpaper === pattern.id}
                  />
                ))}
              </div>
            </TabsContent>

            <TabsContent value="custom" className="mt-0">
              <div className="grid grid-cols-3 gap-3 pb-4">
                {/* Upload button */}
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="relative w-full aspect-[3/4] rounded-xl overflow-hidden border-2 border-dashed border-border hover:border-primary/50 transition-all flex flex-col items-center justify-center gap-2 bg-muted/30"
                >
                  {isUploading ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full"
                    />
                  ) : (
                    <>
                      <Upload className="w-8 h-8 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground text-center px-2">
                        {t('settings.uploadImage', 'Carregar imagem')}
                      </span>
                    </>
                  )}
                </motion.button>

                {/* Custom wallpapers */}
                {customWallpapers.map((wallpaper) => (
                  <CustomWallpaperOption
                    key={wallpaper.id}
                    wallpaper={wallpaper}
                    selected={selectedWallpaper === wallpaper.url}
                  />
                ))}
              </div>

              {customWallpapers.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <ImagePlus className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">{t('settings.noCustomWallpapers', 'Ainda não tens imagens personalizadas')}</p>
                  <p className="text-xs mt-1">{t('settings.uploadToAdd', 'Carrega uma imagem para começar')}</p>
                </div>
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Image crop dialog */}
        {imageToCrop && (
          <ImageCropDialog
            open={cropDialogOpen}
            onOpenChange={(open) => {
              setCropDialogOpen(open);
              if (!open && imageToCrop) {
                URL.revokeObjectURL(imageToCrop);
                setImageToCrop(null);
              }
            }}
            imageSrc={imageToCrop}
            onCropComplete={handleCropComplete}
          />
        )}

        {/* Apply Button - Always visible with iOS safe area */}
        <div className="pt-3 mt-auto border-t border-border shrink-0 bg-background">
          <Button
            onClick={handleApply}
            className="w-full h-11 sm:h-12 rounded-xl text-base font-semibold"
            disabled={isApplying || selectedWallpaper === settings?.chat_wallpaper}
          >
            {isApplying ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
              />
            ) : (
              t('settings.applyWallpaper', 'Aplicar Papel de Parede')
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// Export helper function to get wallpaper styles for use in chat components
export function getWallpaperStyles(wallpaperId: string | null | undefined): React.CSSProperties {
  if (!wallpaperId || wallpaperId === 'default') {
    return {};
  }

  // Check if it's a URL (custom image)
  if (wallpaperId.startsWith('http')) {
    return {
      backgroundImage: `url(${wallpaperId})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      backgroundAttachment: 'fixed',
    };
  }

  const solid = solidColors.find(c => c.id === wallpaperId);
  if (solid) {
    return { backgroundColor: solid.color };
  }

  const gradient = gradients.find(g => g.id === wallpaperId);
  if (gradient) {
    return { background: gradient.gradient };
  }

  const pattern = patterns.find(p => p.id === wallpaperId);
  if (pattern) {
    return {
      backgroundImage: pattern.pattern,
      backgroundSize: pattern.size,
    };
  }

  return {};
}
