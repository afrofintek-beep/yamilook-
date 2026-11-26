import { useEffect, useRef, useCallback } from 'react';
import { useSettings } from './useSettings';
import { getSharedAudioContext } from '@/lib/audio-context';

type RingtoneNote = readonly [frequency: number, startMs: number, endMs: number];

type RingtonePattern = {
  ringDuration: number;
  silenceDuration: number;
  vibrationInterval?: number;
} & ({
  frequencies: readonly number[];
} | {
  notes: readonly RingtoneNote[];
  waveform: OscillatorType;
  attackMs: number;
  releaseMs: number;
  level: number;
});

const RINGTONE_PATTERNS = {
  waiting: { frequencies: [440], ringDuration: 300, silenceDuration: 8000 },
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
    notes: [
      [523.25, 0, 185],
      [659.25, 190, 365],
      [783.99, 372, 555],
      [1046.50, 590, 850],
      [783.99, 900, 1270],
    ],
    waveform: 'triangle',
    attackMs: 14,
    releaseMs: 100,
    level: 0.7,
    ringDuration: 1270,
    silenceDuration: 1430,
    vibrationInterval: 1000,
  },
  gentle: {
    notes: [
      [440, 0, 450],
      [659.25, 500, 940],
      [554.37, 995, 1580],
    ],
    waveform: 'sine',
    attackMs: 70,
    releaseMs: 260,
    level: 0.5,
    ringDuration: 1580,
    silenceDuration: 2120,
    vibrationInterval: 3700,
  },
  urgent: {
    notes: [
      [587.33, 0, 125],
      [880, 135, 280],
      [739.99, 290, 455],
      [987.77, 555, 715],
      [880, 725, 1040],
    ],
    waveform: 'triangle',
    attackMs: 10,
    releaseMs: 55,
    level: 0.9,
    ringDuration: 1040,
    silenceDuration: 1060,
    vibrationInterval: 600,
  },
  silent: {
    frequencies: [],
    ringDuration: 0,
    silenceDuration: 3000,
  },
} satisfies Record<string, RingtonePattern>;

function getRingtonePattern(pattern: keyof typeof RINGTONE_PATTERNS): RingtonePattern {
  return RINGTONE_PATTERNS[pattern] || RINGTONE_PATTERNS.default;
}

// Vibration patterns for different ringtone styles
const VIBRATION_PATTERNS = {
  waiting: [],
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
  waiting?: boolean;
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
  const generationRef = useRef(0);
  const pendingRingRef = useRef<number | null>(null);
  const ringTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Get effective settings (options override settings from database)
  const getEffectiveSettings = useCallback(() => {
    return {
      volume: Math.min(options?.waiting ? 0.12 : 1, options?.volume ?? settings?.ringtone_volume ?? 0.5),
      pattern: (options?.waiting && settings?.ringtone_pattern !== 'silent' ? 'waiting' : options?.pattern ?? settings?.ringtone_pattern ?? 'default') as keyof typeof RINGTONE_PATTERNS,
      vibrationEnabled: options?.waiting ? false : options?.vibrationEnabled ?? settings?.call_vibration_enabled ?? true,
      ringtoneEnabled: options?.ringtoneEnabled ?? settings?.ringtone_enabled ?? true,
    };
  }, [options?.waiting, options?.volume, options?.pattern, options?.vibrationEnabled, options?.ringtoneEnabled,
    settings?.ringtone_volume, settings?.ringtone_pattern, settings?.call_vibration_enabled, settings?.ringtone_enabled]);

  // Use the shared (pre-unlocked) AudioContext
  const initAudioContext = useCallback(() => {
    // Always use the singleton so we benefit from the gesture-unlock done at app level
    audioContextRef.current = getSharedAudioContext();
    return audioContextRef.current;
  }, []);

  // Create a ring sound
  const createRing = useCallback(async () => {
    const generation = generationRef.current;
    if (!isPlayingRef.current || pendingRingRef.current === generation || gainNodeRef.current) return;
    const effectiveSettings = getEffectiveSettings();
    
    if (!effectiveSettings.ringtoneEnabled) return;
    
    const patternConfig = getRingtonePattern(effectiveSettings.pattern);
    
    if ('frequencies' in patternConfig && patternConfig.frequencies.length === 0) return;
    
    let audioContext: AudioContext;
    try { audioContext = initAudioContext(); } catch { return; }
    if (!audioContext || audioContext.state === 'closed') return;

    // CRITICAL: await resume so oscillators start in an active context
    // Without this, oscillators created while context is 'suspended' produce no sound
    if (audioContext.state !== 'running') {
      pendingRingRef.current = generation;
      try {
        await audioContext.resume();
      } catch {
        return;
      } finally {
        if (pendingRingRef.current === generation) pendingRingRef.current = null;
      }
    }
    // An answer/decline or a new preview may have happened while resume awaited a gesture.
    if (!isPlayingRef.current || generation !== generationRef.current || audioContext.state !== 'running') return;

    // Create gain node for volume control
    const gainNode = audioContext.createGain();
    gainNode.connect(audioContext.destination);
    gainNode.gain.value = effectiveSettings.volume;
    gainNodeRef.current = gainNode;

    const ringStart = audioContext.currentTime;
    const ringEnd = ringStart + patternConfig.ringDuration / 1000;
    let oscillators: OscillatorNode[];

    if ('notes' in patternConfig) {
      const oscillator = audioContext.createOscillator();
      oscillator.type = patternConfig.waveform;
      oscillators = [oscillator];
      const peak = effectiveSettings.volume * patternConfig.level;

      for (const [frequency, startMs, endMs] of patternConfig.notes) {
        const start = ringStart + startMs / 1000;
        oscillator.frequency.setValueAtTime(frequency, start);
        gainNode.gain.setValueAtTime(0, start);
        gainNode.gain.linearRampToValueAtTime(peak, ringStart + (startMs + patternConfig.attackMs) / 1000);
        gainNode.gain.setValueAtTime(peak, ringStart + (endMs - patternConfig.releaseMs) / 1000);
        gainNode.gain.linearRampToValueAtTime(0, ringStart + endMs / 1000);
      }
    } else {
      oscillators = patternConfig.frequencies.map((frequency) => {
        const oscillator = audioContext.createOscillator();
        oscillator.type = 'sine';
        oscillator.frequency.value = frequency;
        return oscillator;
      });
      gainNode.gain.setValueAtTime(0, ringStart);
      gainNode.gain.linearRampToValueAtTime(effectiveSettings.volume, ringStart + 0.1);
      gainNode.gain.setValueAtTime(effectiveSettings.volume, ringEnd - 0.1);
      gainNode.gain.linearRampToValueAtTime(0, ringEnd);
    }

    oscillatorsRef.current = oscillators;
    for (const oscillator of oscillators) {
      oscillator.connect(gainNode);
      oscillator.start(ringStart);
      oscillator.stop(ringEnd);
    }

    // Stop oscillators after ring duration
    ringTimeoutRef.current = setTimeout(() => {
      oscillators.forEach((osc) => {
        try {
          osc.disconnect();
        } catch {
          // Ignore if already stopped
        }
      });
      gainNode.disconnect();
      if (generation === generationRef.current) {
        oscillatorsRef.current = [];
        gainNodeRef.current = null;
        ringTimeoutRef.current = null;
      }
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

    const patternConfig = getRingtonePattern(effectiveSettings.pattern);
    const totalCycle = patternConfig.vibrationInterval ?? (patternConfig.ringDuration + patternConfig.silenceDuration);
    
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
    generationRef.current += 1;

    // Play audio immediately (if enabled)
    if (effectiveSettings.ringtoneEnabled) {
      void createRing();
    }

    // Start vibration (if enabled)
    if (effectiveSettings.vibrationEnabled) {
      startVibration();
    }

    // Set up interval for repeated rings
    const patternConfig = getRingtonePattern(effectiveSettings.pattern);
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
    generationRef.current += 1;
    if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
    ringTimeoutRef.current = null;

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
        gainNodeRef.current.disconnect();
      } catch {
        // Ignore if context is closed
      }
    }
    gainNodeRef.current = null;
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
export function useRingtonePreview(options?: RingtoneOptions) {
  const { startRingtone, stopRingtone } = useRingtone(options);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopPreview = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    stopRingtone();
  }, [stopRingtone]);
  useEffect(() => stopPreview, [stopPreview]);
  
  const playPreview = useCallback((durationMs: number = 2000) => {
    stopPreview();
    startRingtone();
    timeoutRef.current = setTimeout(stopPreview, durationMs);
  }, [startRingtone, stopPreview]);

  return { playPreview, stopRingtone: stopPreview };
}
