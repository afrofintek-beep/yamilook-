import { uiText, useUiLocale } from '@/i18n/ui-copy';
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, X, Languages, Type } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

interface Caption {
  id: string;
  speaker: string;
  text: string;
  timestamp: Date;
}

interface LiveCaptionsProps {
  callId: string;
}

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ru', name: 'Russian' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'ar', name: 'Arabic' },
  { code: 'hi', name: 'Hindi' },
];

export function LiveCaptions({ callId }: LiveCaptionsProps) {
  useUiLocale();
  const { user } = useAuth();
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [settings, setSettings] = useState({
    fontSize: 16,
    language: 'en',
    position: 'bottom' as 'top' | 'bottom',
    opacity: 80,
  });
  const [showSettings, setShowSettings] = useState(false);

  // Simulate receiving captions (in real app, this would come from speech-to-text service)
  useEffect(() => {
    // Demo captions for visualization
    const demoCaption = {
      id: crypto.randomUUID(),
      speaker: 'Demo Speaker',
      text: 'Live captions will appear here during the call...',
      timestamp: new Date(),
    };
    setCaptions([demoCaption]);
  }, []);

  // Load user caption settings
  useEffect(() => {
    if (!user) return;

    const loadSettings = async () => {
      const { data } = await supabase
        .from('user_call_settings')
        .select('captions_language, captions_font_size')
        .eq('user_id', user.id)
        .single();

      if (data) {
        setSettings(prev => ({
          ...prev,
          fontSize: data.captions_font_size || 16,
          language: data.captions_language || 'en',
        }));
      }
    };

    loadSettings();
  }, [user]);

  // Save settings
  const saveSettings = async () => {
    if (!user) return;

    await supabase
      .from('user_call_settings')
      .upsert({
        user_id: user.id,
        captions_language: settings.language,
        captions_font_size: settings.fontSize,
      }, { onConflict: 'user_id' });
  };

  // Remove old captions
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setCaptions(prev =>
        prev.filter(c => now.getTime() - c.timestamp.getTime() < 10000)
      );
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <>
      {/* Captions Display */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={cn(
          "absolute left-0 right-0 z-20 px-8",
          settings.position === 'bottom' ? 'bottom-36' : 'top-20'
        )}
      >
        <div
          className="max-w-3xl mx-auto rounded-lg px-4 py-3"
          style={{
            backgroundColor: `rgba(0, 0, 0, ${settings.opacity / 100})`,
          }}
        >
          <AnimatePresence mode="popLayout">
            {captions.map((caption) => (
              <motion.div
                key={caption.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-white"
                style={{ fontSize: settings.fontSize }}
              >
                <span className="text-primary font-medium mr-2">
                  {caption.speaker}:
                </span>
                <span>{caption.text}</span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Settings Button */}
        <Sheet open={showSettings} onOpenChange={setShowSettings}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="absolute -right-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-80">
            <SheetHeader>
              <SheetTitle>{uiText("Caption Settings")}</SheetTitle>
            </SheetHeader>

            <div className="space-y-6 pt-6">
              {/* Language */}
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Languages className="h-4 w-4" />{uiText("Language")}</label>
                <Select
                  value={settings.language}
                  onValueChange={(value) => {
                    setSettings(prev => ({ ...prev, language: value }));
                    saveSettings();
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((lang) => (
                      <SelectItem key={lang.code} value={lang.code}>
                        {lang.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Font Size */}
              <div className="space-y-3">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Type className="h-4 w-4" />{uiText("Font Size: ")}{settings.fontSize}{uiText("px")}</label>
                <Slider
                  value={[settings.fontSize]}
                  onValueChange={([val]) => {
                    setSettings(prev => ({ ...prev, fontSize: val }));
                  }}
                  onValueCommit={() => saveSettings()}
                  min={12}
                  max={32}
                  step={2}
                />
              </div>

              {/* Background Opacity */}
              <div className="space-y-3">
                <label className="text-sm font-medium">{uiText("Background Opacity: ")}{settings.opacity}%
                </label>
                <Slider
                  value={[settings.opacity]}
                  onValueChange={([val]) => {
                    setSettings(prev => ({ ...prev, opacity: val }));
                  }}
                  min={20}
                  max={100}
                  step={10}
                />
              </div>

              {/* Position */}
              <div className="space-y-2">
                <label className="text-sm font-medium">{uiText("Position")}</label>
                <div className="flex gap-2">
                  <Button
                    variant={settings.position === 'top' ? 'default' : 'outline'}
                    size="sm"
                    className="flex-1"
                    onClick={() => setSettings(prev => ({ ...prev, position: 'top' }))}
                  >{uiText("Top")}</Button>
                  <Button
                    variant={settings.position === 'bottom' ? 'default' : 'outline'}
                    size="sm"
                    className="flex-1"
                    onClick={() => setSettings(prev => ({ ...prev, position: 'bottom' }))}
                  >{uiText("Bottom")}</Button>
                </div>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </motion.div>
    </>
  );
}
