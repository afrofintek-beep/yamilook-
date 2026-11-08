import { uiText, useUiLocale } from '@/i18n/ui-copy';
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Upload, Check, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import type { BgMode } from '@/lib/virtualBackground';

interface VirtualBackground {
  id: string;
  name: string;
  type: 'blur' | 'image' | 'animated' | 'video';
  storage_path: string | null;
  blur_intensity: number | null;
  is_preset: boolean;
  is_premium: boolean;
}

interface VirtualBackgroundPickerProps {
  selectedBackground: string | null;
  onSelect: (backgroundId: string | null, mode: BgMode) => void;
  onClose: () => void;
}

// Map a virtual_backgrounds row to a processor mode.
function toMode(bg: VirtualBackground): BgMode {
  if (bg.type === 'blur') return { kind: 'blur', intensity: bg.blur_intensity ?? 5 };
  if (bg.type === 'image') return { kind: 'image', url: bg.storage_path ?? '' };
  return { kind: 'video', url: bg.storage_path ?? '' }; // animated | video
}

export function VirtualBackgroundPicker({
  selectedBackground,
  onSelect,
  onClose,
}: VirtualBackgroundPickerProps) {
  useUiLocale();
  const [backgrounds, setBackgrounds] = useState<VirtualBackground[]>([]);
  const [blurIntensity, setBlurIntensity] = useState(5);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBackgrounds();
  }, []);

  const fetchBackgrounds = async () => {
    const { data } = await supabase
      .from('virtual_backgrounds')
      .select('*')
      .order('is_preset', { ascending: false });

    if (data) {
      setBackgrounds(data as VirtualBackground[]);
    }
    setLoading(false);
  };

  const blurOptions = backgrounds.filter(b => b.type === 'blur');
  const imageOptions = backgrounds.filter(b => b.type === 'image');
  const animatedOptions = backgrounds.filter(b => b.type === 'animated' || b.type === 'video');

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // In a real app, upload to storage and create background record
    console.log('Uploading background:', file.name);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 300 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 300 }}
      className="absolute right-0 top-0 bottom-0 w-80 bg-background/95 backdrop-blur-lg border-l z-40"
    >
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-semibold">{uiText("Virtual Background")}</h3>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <Tabs defaultValue="blur" className="p-4">
        <TabsList className="w-full">
          <TabsTrigger value="blur" className="flex-1">{uiText("Blur")}</TabsTrigger>
          <TabsTrigger value="images" className="flex-1">{uiText("Images")}</TabsTrigger>
          <TabsTrigger value="effects" className="flex-1">{uiText("Effects")}</TabsTrigger>
        </TabsList>

        <TabsContent value="blur" className="mt-4 space-y-4">
          {/* No background option */}
          <button
            onClick={() => onSelect(null, { kind: 'none' })}
            className={cn(
              "w-full p-4 rounded-lg border-2 text-left transition-all",
              selectedBackground === null
                ? "border-primary bg-primary/10"
                : "border-muted hover:border-muted-foreground/50"
            )}
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                <X className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">{uiText("None")}</p>
                <p className="text-sm text-muted-foreground">{uiText("No background effect")}</p>
              </div>
              {selectedBackground === null && (
                <Check className="h-5 w-5 text-primary ml-auto" />
              )}
            </div>
          </button>

          {/* Blur options */}
          {blurOptions.map((bg) => (
            <button
              key={bg.id}
              onClick={() => onSelect(bg.id, toMode(bg))}
              className={cn(
                "w-full p-4 rounded-lg border-2 text-left transition-all",
                selectedBackground === bg.id
                  ? "border-primary bg-primary/10"
                  : "border-muted hover:border-muted-foreground/50"
              )}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-lg flex items-center justify-center"
                  style={{
                    background: `radial-gradient(circle, rgba(100,100,100,0.${bg.blur_intensity}) 0%, rgba(50,50,50,0.${bg.blur_intensity}) 100%)`,
                    backdropFilter: `blur(${bg.blur_intensity}px)`
                  }}
                />
                <div>
                  <p className="font-medium">{bg.name}</p>
                  <p className="text-sm text-muted-foreground">{uiText("Intensity: {{value1}}/10", { value1: (bg.blur_intensity) ?? "" })}</p>
                </div>
                {selectedBackground === bg.id && (
                  <Check className="h-5 w-5 text-primary ml-auto" />
                )}
              </div>
            </button>
          ))}

          {/* Custom blur intensity */}
          <div className="space-y-2 pt-4 border-t">
            <label className="text-sm font-medium">{uiText("Custom Blur Intensity")}</label>
            <Slider
              value={[blurIntensity]}
              onValueChange={([val]) => { setBlurIntensity(val); onSelect('custom-blur', { kind: 'blur', intensity: val }); }}
              max={10}
              min={1}
              step={1}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{uiText("Light")}</span>
              <span>{uiText("Heavy")}</span>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="images" className="mt-4 space-y-4">
          {/* Upload custom */}
          <label className="block w-full p-4 rounded-lg border-2 border-dashed border-muted hover:border-primary cursor-pointer transition-colors">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleUpload}
            />
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                <Upload className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">{uiText("Upload Image")}</p>
                <p className="text-sm text-muted-foreground">{uiText("Use your own photo")}</p>
              </div>
            </div>
          </label>

          {/* Preset images */}
          <div className="grid grid-cols-2 gap-2">
            {imageOptions.map((bg) => (
              <button
                key={bg.id}
                onClick={() => onSelect(bg.id, toMode(bg))}
                className={cn(
                  "relative aspect-video rounded-lg overflow-hidden border-2 transition-all",
                  selectedBackground === bg.id
                    ? "border-primary ring-2 ring-primary/50"
                    : "border-transparent hover:border-muted-foreground/50"
                )}
              >
                <div
                  className="w-full h-full bg-gradient-to-br from-muted to-muted-foreground/20"
                  style={{
                    backgroundImage: bg.storage_path ? `url(${bg.storage_path})` : undefined,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }}
                />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 p-1.5">
                  <p className="text-xs text-white truncate">{bg.name}</p>
                </div>
                {selectedBackground === bg.id && (
                  <div className="absolute top-1 right-1 p-1 rounded-full bg-primary">
                    <Check className="h-3 w-3 text-white" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="effects" className="mt-4 space-y-4">
          <div className="text-center py-8">
            <Sparkles className="h-12 w-12 text-primary mx-auto mb-3" />
            <h4 className="font-medium mb-1">{uiText("Premium Effects")}</h4>
            <p className="text-sm text-muted-foreground mb-4">{uiText("Animated and video backgrounds")}</p>

            <div className="grid grid-cols-2 gap-2">
              {animatedOptions.length > 0 ? (
                animatedOptions.map((bg) => (
                  <button
                    key={bg.id}
                    onClick={() => onSelect(bg.id, toMode(bg))}
                    disabled={bg.is_premium}
                    className={cn(
                      "relative aspect-video rounded-lg overflow-hidden border-2 transition-all",
                      bg.is_premium && "opacity-50",
                      selectedBackground === bg.id
                        ? "border-primary"
                        : "border-muted"
                    )}
                  >
                    <div className="w-full h-full bg-gradient-to-br from-primary/20 to-secondary/20" />
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 p-1.5">
                      <p className="text-xs text-white truncate">{bg.name}</p>
                    </div>
                    {bg.is_premium && (
                      <div className="absolute top-1 right-1 px-1.5 py-0.5 rounded bg-yellow-500 text-[10px] font-medium">{uiText("PRO")}</div>
                    )}
                  </button>
                ))
              ) : (
                <div className="col-span-2 text-sm text-muted-foreground">{uiText("Coming soon...")}</div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
