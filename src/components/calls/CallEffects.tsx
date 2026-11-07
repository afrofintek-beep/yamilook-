import { uiText, useUiLocale } from '@/i18n/ui-copy';
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Sparkles, Sun, Moon, Palette, Volume2, Mic } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import type { TablesUpdate } from '@/integrations/supabase/types';
import { useAuth } from '@/hooks/useAuth';
import { useActiveCallRequired } from './ActiveCallProvider';
import type { ColorFilter, FaceFilter } from '@/lib/virtualBackground';

interface CallSettings {
  beautyMode: boolean;
  lowLightBoost: boolean;
  colorCorrection: boolean;
  colorFilter: string | null;
  noiseSuppression: boolean;
  echoCancellation: boolean;
  voiceEnhancement: boolean;
  touchUpLevel: number;
}

interface CallEffectsProps {
  onClose: () => void;
}

const COLOR_FILTERS = [
  { id: 'none', name: 'None', preview: 'bg-gradient-to-br from-gray-400 to-gray-600' },
  { id: 'warm', name: 'Warm', preview: 'bg-gradient-to-br from-orange-400 to-red-500' },
  { id: 'cool', name: 'Cool', preview: 'bg-gradient-to-br from-blue-400 to-cyan-500' },
  { id: 'vintage', name: 'Vintage', preview: 'bg-gradient-to-br from-amber-300 to-yellow-600' },
  { id: 'bw', name: 'B&W', preview: 'bg-gradient-to-br from-gray-800 to-gray-400' },
  { id: 'vivid', name: 'Vivid', preview: 'bg-gradient-to-br from-pink-400 to-purple-600' },
];

const FACE_FILTERS = [
  { id: 'none', name: 'None', emoji: '😊' },
  { id: 'glasses', name: 'Glasses', emoji: '🤓' },
  { id: 'hat', name: 'Party Hat', emoji: '🎉' },
  { id: 'cat', name: 'Cat', emoji: '😺' },
  { id: 'dog', name: 'Dog', emoji: '🐶' },
  { id: 'bunny', name: 'Bunny', emoji: '🐰' },
];

const FACE_MAP: Record<string, FaceFilter> = {
  none: 'none', glasses: 'glasses', hat: 'partyhat', cat: 'cat', dog: 'dog', bunny: 'bunny',
};

export function CallEffects({ onClose }: CallEffectsProps) {
  useUiLocale();
  const { user } = useAuth();
  const { setCallEffects, setAudioProcessing } = useActiveCallRequired();
  const [settings, setSettings] = useState<CallSettings>({
    beautyMode: false,
    lowLightBoost: false,
    colorCorrection: true,
    colorFilter: null,
    noiseSuppression: true,
    echoCancellation: true,
    voiceEnhancement: false,
    touchUpLevel: 50,
  });
  const [selectedFaceFilter, setSelectedFaceFilter] = useState('none');

  useEffect(() => {
    loadSettings();
  }, [user]);

  const loadSettings = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('user_call_settings')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (data) {
      setSettings({
        beautyMode: data.beauty_mode_enabled,
        lowLightBoost: data.low_light_enhancement,
        colorCorrection: true,
        colorFilter: null,
        noiseSuppression: data.noise_suppression_enabled,
        echoCancellation: data.echo_cancellation_enabled,
        voiceEnhancement: false,
        touchUpLevel: 50,
      });
    }
  };

  const updateSetting = async <K extends keyof CallSettings>(
    key: K,
    value: CallSettings[K]
  ) => {
    setSettings(prev => ({ ...prev, [key]: value }));

    // Apply live to the call (video effects on the canvas, audio via constraints).
    if (key === 'beautyMode') setCallEffects({ beauty: Boolean(value) });
    else if (key === 'touchUpLevel') setCallEffects({ touchUp: Number(value) });
    else if (key === 'lowLightBoost') setCallEffects({ lowLight: Boolean(value) });
    else if (key === 'colorCorrection') setCallEffects({ autoColor: Boolean(value) });
    else if (key === 'colorFilter') setCallEffects({ colorFilter: (value as ColorFilter | null) ?? 'none' });
    else if (key === 'noiseSuppression') setAudioProcessing({ noiseSuppression: Boolean(value) });
    else if (key === 'echoCancellation') setAudioProcessing({ echoCancellation: Boolean(value) });
    else if (key === 'voiceEnhancement') setAudioProcessing({ autoGainControl: Boolean(value) });

    if (!user) return;

    // Map to database columns
    const dbUpdates: TablesUpdate<'user_call_settings'> = {};
    if (key === 'beautyMode') dbUpdates.beauty_mode_enabled = Boolean(value);
    if (key === 'lowLightBoost') dbUpdates.low_light_enhancement = Boolean(value);
    if (key === 'noiseSuppression') dbUpdates.noise_suppression_enabled = Boolean(value);
    if (key === 'echoCancellation') dbUpdates.echo_cancellation_enabled = Boolean(value);

    if (Object.keys(dbUpdates).length > 0) {
      await supabase
        .from('user_call_settings')
        .upsert({
          user_id: user.id,
          ...dbUpdates,
        }, { onConflict: 'user_id' });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 300 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 300 }}
      className="absolute right-0 top-0 bottom-0 w-80 bg-background/95 backdrop-blur-lg border-l z-40 overflow-y-auto"
    >
      <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-background/95 backdrop-blur-lg">
        <h3 className="font-semibold">{uiText("Call Effects")}</h3>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="p-4 space-y-6">
        {/* Video Enhancements */}
        <div className="space-y-4">
          <h4 className="font-medium flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />{uiText("Video Enhancements")}</h4>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="beauty-mode" className="flex-1">
                <span className="block">{uiText("Beauty Mode")}</span>
                <span className="text-xs text-muted-foreground">{uiText("Smooth skin and enhance appearance")}</span>
              </Label>
              <Switch
                id="beauty-mode"
                checked={settings.beautyMode}
                onCheckedChange={(checked) => updateSetting('beautyMode', checked)}
              />
            </div>

            {settings.beautyMode && (
              <div className="pl-4 space-y-2">
                <Label className="text-sm">{uiText("Touch Up Level")}</Label>
                <Slider
                  value={[settings.touchUpLevel]}
                  onValueChange={([val]) => updateSetting('touchUpLevel', val)}
                  max={100}
                  step={10}
                />
              </div>
            )}

            <div className="flex items-center justify-between">
              <Label htmlFor="low-light" className="flex-1">
                <span className="block flex items-center gap-2">
                  <Moon className="h-3 w-3" />{uiText("Low Light Boost")}</span>
                <span className="text-xs text-muted-foreground">{uiText("AI enhancement for dark environments")}</span>
              </Label>
              <Switch
                id="low-light"
                checked={settings.lowLightBoost}
                onCheckedChange={(checked) => updateSetting('lowLightBoost', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="color-correction" className="flex-1">
                <span className="block flex items-center gap-2">
                  <Sun className="h-3 w-3" />{uiText("Auto Color Correction")}</span>
                <span className="text-xs text-muted-foreground">{uiText("Auto white balance adjustment")}</span>
              </Label>
              <Switch
                id="color-correction"
                checked={settings.colorCorrection}
                onCheckedChange={(checked) => updateSetting('colorCorrection', checked)}
              />
            </div>
          </div>
        </div>

        {/* Color Filters */}
        <div className="space-y-3">
          <h4 className="font-medium flex items-center gap-2">
            <Palette className="h-4 w-4 text-primary" />{uiText("Color Filters")}</h4>

          <div className="grid grid-cols-3 gap-2">
            {COLOR_FILTERS.map((filter) => (
              <button
                key={filter.id}
                onClick={() => updateSetting('colorFilter', filter.id === 'none' ? null : filter.id)}
                className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                  (settings.colorFilter === filter.id || (filter.id === 'none' && !settings.colorFilter))
                    ? 'border-primary ring-2 ring-primary/50'
                    : 'border-muted hover:border-muted-foreground/50'
                }`}
              >
                <div className={`w-full h-full ${filter.preview}`} />
                <span className="absolute bottom-1 left-1 right-1 text-[10px] text-white font-medium truncate">
                  {filter.name}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Face Filters */}
        <div className="space-y-3">
          <h4 className="font-medium">{uiText("Face Filters")}</h4>

          <div className="grid grid-cols-3 gap-2">
            {FACE_FILTERS.map((filter) => (
              <button
                key={filter.id}
                onClick={() => { setSelectedFaceFilter(filter.id); setCallEffects({ faceFilter: FACE_MAP[filter.id] ?? 'none' }); }}
                className={`p-3 rounded-lg border-2 transition-all text-center ${
                  selectedFaceFilter === filter.id
                    ? 'border-primary bg-primary/10'
                    : 'border-muted hover:border-muted-foreground/50'
                }`}
              >
                <span className="text-2xl block mb-1">{filter.emoji}</span>
                <span className="text-xs">{filter.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Audio Settings */}
        <div className="space-y-4">
          <h4 className="font-medium flex items-center gap-2">
            <Volume2 className="h-4 w-4 text-primary" />{uiText("Audio Settings")}</h4>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="noise-suppression" className="flex-1">
                <span className="block">{uiText("Noise Suppression")}</span>
                <span className="text-xs text-muted-foreground">{uiText("AI-powered noise cancellation")}</span>
              </Label>
              <Switch
                id="noise-suppression"
                checked={settings.noiseSuppression}
                onCheckedChange={(checked) => updateSetting('noiseSuppression', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="echo-cancel" className="flex-1">
                <span className="block">{uiText("Echo Cancellation")}</span>
                <span className="text-xs text-muted-foreground">{uiText("Prevent audio feedback")}</span>
              </Label>
              <Switch
                id="echo-cancel"
                checked={settings.echoCancellation}
                onCheckedChange={(checked) => updateSetting('echoCancellation', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="voice-enhance" className="flex-1">
                <span className="block flex items-center gap-2">
                  <Mic className="h-3 w-3" />{uiText("Voice Enhancement")}</span>
                <span className="text-xs text-muted-foreground">{uiText("Clearer voice audio")}</span>
              </Label>
              <Switch
                id="voice-enhance"
                checked={settings.voiceEnhancement}
                onCheckedChange={(checked) => updateSetting('voiceEnhancement', checked)}
              />
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
