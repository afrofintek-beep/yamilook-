import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Phone, PhoneOff, Video, User } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useRingtone } from '@/hooks/useRingtone';

interface IncomingCallOverlayProps {
  callId: string;
  callType: 'voice' | 'video';
  callerId: string;
  onAnswer: () => void;
  onDecline: () => void;
}

export function IncomingCallOverlay({
  callId,
  callType,
  callerId,
  onAnswer,
  onDecline,
}: IncomingCallOverlayProps) {
  const [caller, setCaller] = useState<{
    display_name: string;
    avatar_url: string | null;
  } | null>(null);
  const { t } = useTranslation();
  
  const { startRingtone, stopRingtone } = useRingtone();

  // Fetch caller info
  useEffect(() => {
    const fetchCaller = async () => {
      const { data } = await supabase
        .from('public_profiles')
        .select('display_name, avatar_url')
        .eq('id', callerId)
        .single();

      if (data) {
        setCaller(data);
      }
    };

    fetchCaller();
  }, [callerId]);

  // Start ringtone when component mounts
  useEffect(() => {
    startRingtone();
    
    return () => {
      stopRingtone();
    };
  }, [startRingtone, stopRingtone]);

  // Handle answer with ringtone stop
  const handleAnswer = useCallback(() => {
    stopRingtone();
    onAnswer();
  }, [stopRingtone, onAnswer]);

  // Handle decline with ringtone stop
  const handleDecline = useCallback(() => {
    stopRingtone();
    onDecline();
  }, [stopRingtone, onDecline]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -100 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -100 }}
        className="fixed inset-0 z-[100] bg-gradient-to-b from-background to-background/95 flex flex-col items-center justify-center"
      >
        {/* Animated rings */}
        <div className="relative mb-8">
          <motion.div
            animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute inset-0 rounded-full bg-primary/30"
            style={{ width: 200, height: 200, left: -50, top: -50 }}
          />
          <motion.div
            animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0, 0.3] }}
            transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
            className="absolute inset-0 rounded-full bg-primary/20"
            style={{ width: 180, height: 180, left: -40, top: -40 }}
          />
          <Avatar className="w-24 h-24 border-4 border-primary shadow-glow relative z-10">
            <AvatarImage src={caller?.avatar_url || ''} />
            <AvatarFallback className="bg-gradient-primary text-white text-3xl">
              {caller?.display_name?.[0]?.toUpperCase() || <User className="w-10 h-10" />}
            </AvatarFallback>
          </Avatar>
        </div>

        {/* Caller info */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-center mb-12"
        >
          <h2 className="text-2xl font-bold mb-2">
            {caller?.display_name || t('calls.unknownCaller')}
          </h2>
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            {callType === 'video' ? (
              <Video className="w-5 h-5" />
            ) : (
              <Phone className="w-5 h-5" />
            )}
            <span>{callType === 'video' ? t('calls.incomingVideoCall') : t('calls.incomingVoiceCall')}</span>
          </div>
        </motion.div>

        {/* Action buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="flex items-center gap-12"
        >
          {/* Decline button */}
          <motion.div
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="flex flex-col items-center gap-2"
          >
            <Button
              size="lg"
              variant="destructive"
              className="w-16 h-16 rounded-full shadow-lg"
              onClick={handleDecline}
            >
              <PhoneOff className="w-7 h-7" />
            </Button>
            <span className="text-sm text-muted-foreground">{t('calls.decline')}</span>
          </motion.div>

          {/* Answer button */}
          <motion.div
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="flex flex-col items-center gap-2"
          >
            <Button
              size="lg"
              className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-600 shadow-lg"
              onClick={handleAnswer}
            >
              {callType === 'video' ? (
                <Video className="w-7 h-7" />
              ) : (
                <Phone className="w-7 h-7" />
              )}
            </Button>
            <span className="text-sm text-muted-foreground">{t('calls.answer')}</span>
          </motion.div>
        </motion.div>

        {/* Slide to answer hint */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="absolute bottom-12 text-sm text-muted-foreground"
        >
          {t('calls.tapToAnswerOrDecline')}
        </motion.p>
      </motion.div>
    </AnimatePresence>
  );
}
