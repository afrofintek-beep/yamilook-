import { useEffect, useRef, useCallback } from 'react';
import { useSettings } from './useSettings';
import { getSharedAudioContext } from '@/lib/audio-context';

// Ringtone patterns configuration
const RINGTONE_PATTERNS = {
  default: {
    frequencies: [440, 480], // Dual-tone
    ringDuration: 1000,
    silenceDuration: 2000,
  },
  classic: {
    frequencies: [400, 450],
    ringDuration: 800,
    silenceDuration: 1500,
  },
  modern: {
    frequencies: [523, 659], // C5 and E5
    ringDuration: 600,
    silenceDuration: 400,
  },
  gentle: {
    frequencies: [330, 392], // E4 and G4
    ringDuration: 1200,
    silenceDuration: 2500,
  },
  urgent: {
    frequencies: [587, 784], // D5 and G5
    ringDuration: 400,
    silenceDuration: 200,
  },
  silent: {
    frequencies: [],
    ringDuration: 0,
    silenceDuration: 3000,
  },
};

// Vibration patterns for different ringtone styles
const VIBRATION_PATTERNS = {
  default: [400, 200, 400, 2000],
  classic: [300, 150, 300, 1500],
  modern: [200, 100, 200, 100, 200, 400],
  gentle: [500, 300, 500, 2500],
  urgent: [150, 50, 150, 50, 150, 200],
  silent: [],
};

// Check if Vibration API is supported
const isVibrationSupported = (): boolean => {
  return 'vibrate' in navigator;
};

// Trigger vibration
const vibrate = (pattern: number | number[]): boolean => {
  if (isVibrationSupported() && pattern && (Array.isArray(pattern) ? pattern.length > 0 : pattern > 0)) {
    try {
      return navigator.vibrate(pattern);
    } catch (error) {
      console.warn('[Vibration] Error triggering vibration:', error);
      return false;
    }
  }
  return false;
};

// Stop vibration
const stopVibration = (): void => {
  if (isVibrationSupported()) {
    try {
      navigator.vibrate(0);
    } catch (error) {
      console.warn('[Vibration] Error stopping vibration:', error);
    }
  }
};

export interface RingtoneOptions {
  volume?: number;
  pattern?: keyof typeof RINGTONE_PATTERNS;
  vibrationEnabled?: boolean;
  ringtoneEnabled?: boolean;
}

export function useRingtone(options?: RingtoneOptions) {
  const { settings } = useSettings();
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorsRef = useRef<OscillatorNode[]>([]);
  const gainNodeRef = useRef<GainNode | null>(null);
  const isPlayingRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const vibrationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Get effective settings (options override settings from database)
  const getEffectiveSettings = useCallback(() => {
    return {
      volume: options?.volume ?? settings?.ringtone_volume ?? 0.5,
      pattern: (options?.pattern ?? settings?.ringtone_pattern ?? 'default') as keyof typeof RINGTONE_PATTERNS,
      vibrationEnabled: options?.vibrationEnabled ?? settings?.call_vibration_enabled ?? true,
      ringtoneEnabled: options?.ringtoneEnabled ?? settings?.ringtone_enabled ?? true,
    };
  }, [options, settings]);

  // Use the shared (pre-unlocked) AudioContext
  const initAudioContext = useCallback(() => {
    // Always use the singleton so we benefit from the gesture-unlock done at app level
    audioContextRef.current = getSharedAudioContext();
    return audioContextRef.current;
  }, []);

  // Create a ring sound
  const createRing = useCallback(async () => {
    const effectiveSettings = getEffectiveSettings();
    
    if (!effectiveSettings.ringtoneEnabled) return;
    
    const patternConfig = RINGTONE_PATTERNS[effectiveSettings.pattern] || RINGTONE_PATTERNS.default;
    
    if (patternConfig.frequencies.length === 0) return; // Silent pattern
    
    const audioContext = initAudioContext();
    if (!audioContext || audioContext.state === 'closed') return;

    // CRITICAL: await resume so oscillators start in an active context
    // Without this, oscillators created while context is 'suspended' produce no sound
    if (audioContext.state === 'suspended') {
      try {
        await audioContext.resume();
      } catch {
        // Non-fatal: browser may still block audio without a gesture
      }
    }

    // Create gain node for volume control
    const gainNode = audioContext.createGain();
    gainNode.connect(audioContext.destination);
    gainNode.gain.value = effectiveSettings.volume;
    gainNodeRef.current = gainNode;

    // Create oscillators for dual-tone
    const oscillators: OscillatorNode[] = [];
    patternConfig.frequencies.forEach((freq) => {
      const oscillator = audioContext.createOscillator();
      oscillator.type = 'sine';
      oscillator.frequency.value = freq;
      oscillator.connect(gainNode);
      oscillators.push(oscillator);
    });

    oscillatorsRef.current = oscillators;

    // Start oscillators
    oscillators.forEach((osc) => osc.start());

    // Fade in
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(effectiveSettings.volume, audioContext.currentTime + 0.1);

    // Schedule fade out and stop
    const ringEndTime = audioContext.currentTime + patternConfig.ringDuration / 1000;
    gainNode.gain.setValueAtTime(effectiveSettings.volume, ringEndTime - 0.1);
    gainNode.gain.linearRampToValueAtTime(0, ringEndTime);

    // Stop oscillators after ring duration
    setTimeout(() => {
      oscillators.forEach((osc) => {
        try {
          osc.stop();
          osc.disconnect();
        } catch {
          // Ignore if already stopped
        }
      });
      oscillatorsRef.current = [];
    }, patternConfig.ringDuration);
  }, [initAudioContext, getEffectiveSettings]);

  // Start vibration pattern
  const startVibration = useCallback(() => {
    const effectiveSettings = getEffectiveSettings();
    
    if (!effectiveSettings.vibrationEnabled) {
      console.log('[Vibration] Disabled by user settings');
      return;
    }
    
    if (!isVibrationSupported()) {
      console.log('[Vibration] Not supported on this device');
      return;
    }

    console.log('[Vibration] Starting vibration pattern');
    
    const vibrationPattern = VIBRATION_PATTERNS[effectiveSettings.pattern] || VIBRATION_PATTERNS.default;
    
    if (vibrationPattern.length === 0) return; // Silent pattern
    
    // Vibrate immediately
    vibrate(vibrationPattern);

    // Set up interval for repeated vibration (matches ring cycle)
    const patternConfig = RINGTONE_PATTERNS[effectiveSettings.pattern] || RINGTONE_PATTERNS.default;
    const totalCycle = patternConfig.ringDuration + patternConfig.silenceDuration;
    
    vibrationIntervalRef.current = setInterval(() => {
      if (isPlayingRef.current) {
        vibrate(vibrationPattern);
      }
    }, totalCycle);
  }, [getEffectiveSettings]);

  // Stop vibration
  const stopVibrationPattern = useCallback(() => {
    console.log('[Vibration] Stopping vibration');
    
    if (vibrationIntervalRef.current) {
      clearInterval(vibrationIntervalRef.current);
      vibrationIntervalRef.current = null;
    }
    
    stopVibration();
  }, []);

  // Start the ringtone loop
  const startRingtone = useCallback(() => {
    if (isPlayingRef.current) return;
    
    const effectiveSettings = getEffectiveSettings();
    
    console.log('[Ringtone] Starting ringtone', {
      pattern: effectiveSettings.pattern,
      volume: effectiveSettings.volume,
      vibration: effectiveSettings.vibrationEnabled,
      ringtone: effectiveSettings.ringtoneEnabled,
    });
    
    isPlayingRef.current = true;

    // Play audio immediately (if enabled)
    if (effectiveSettings.ringtoneEnabled) {
      void createRing();
    }

    // Start vibration (if enabled)
    if (effectiveSettings.vibrationEnabled) {
      startVibration();
    }

    // Set up interval for repeated rings
    const patternConfig = RINGTONE_PATTERNS[effectiveSettings.pattern] || RINGTONE_PATTERNS.default;
    const totalCycle = patternConfig.ringDuration + patternConfig.silenceDuration;
    
    intervalRef.current = setInterval(() => {
      if (isPlayingRef.current && effectiveSettings.ringtoneEnabled) {
        void createRing();
      }
    }, totalCycle);
  }, [createRing, startVibration, getEffectiveSettings]);

  // Stop the ringtone
  const stopRingtone = useCallback(() => {
    console.log('[Ringtone] Stopping ringtone and vibration');
    isPlayingRef.current = false;

    // Clear audio interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Stop vibration
    stopVibrationPattern();

    // Stop any playing oscillators
    oscillatorsRef.current.forEach((osc) => {
      try {
        osc.stop();
        osc.disconnect();
      } catch {
        // Ignore if already stopped
      }
    });
    oscillatorsRef.current = [];

    // Fade out gain
    if (gainNodeRef.current && audioContextRef.current) {
      try {
        gainNodeRef.current.gain.linearRampToValueAtTime(0, audioContextRef.current.currentTime + 0.1);
      } catch {
        // Ignore if context is closed
      }
    }
  }, [stopVibrationPattern]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRingtone();
      // Don't close the shared AudioContext — it's reused across the app
    };
  }, [stopRingtone]);

  return {
    startRingtone,
    stopRingtone,
    isPlaying: isPlayingRef.current,
    isVibrationSupported: isVibrationSupported(),
  };
}

// Test ringtone function for settings preview
export function useRingtonePreview() {
  const { startRingtone, stopRingtone } = useRingtone();
  
  const playPreview = useCallback((durationMs: number = 2000) => {
    startRingtone();
    setTimeout(() => {
      stopRingtone();
    }, durationMs);
  }, [startRingtone, stopRingtone]);

  return { playPreview, stopRingtone };
}
