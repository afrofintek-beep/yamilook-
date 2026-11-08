import { uiText } from '@/i18n/ui-copy';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface UserSettings {
  id: string;
  user_id: string;
  theme: string;
  language: string;
  font_size: string;
  notification_sound: string;
  vibration_enabled: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  auto_download_media: string;
  data_saver_mode: boolean;
  enter_to_send: boolean;
  media_visibility: boolean;
  chat_wallpaper: string | null;
  // Call/Ringtone settings
  ringtone_volume: number;
  ringtone_enabled: boolean;
  call_vibration_enabled: boolean;
  ringtone_pattern: string;
  // Notifications
  notifications_enabled: boolean;
  // Journey visibility settings
  show_journey_friends: boolean;
  show_journey_posts: boolean;
  show_journey_momambos: boolean;
  show_journey_messages: boolean;
  show_journey_calls: boolean;
  show_journey_reactions: boolean;
  // Journey visibility
  journey_visibility: string;
  // Banda privacy
  show_banda: string;
  created_at: string;
  updated_at: string;
}

export function useSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSettings = async () => {
    if (!user) {
      setSettings(null);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      setSettings(data);
    } catch (err) {
      console.error('Error fetching settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, [user]);

  const updateSettings = async (updates: Partial<UserSettings>) => {
    if (!user || !settings) return { error: new Error(uiText("No user or settings")) };

    const { error } = await supabase
      .from('user_settings')
      .update(updates)
      .eq('user_id', user.id);

    if (!error) {
      setSettings({ ...settings, ...updates });
    }

    return { error: error ? new Error(error.message) : null };
  };

  return {
    settings,
    loading,
    updateSettings,
    refresh: fetchSettings,
  };
}
