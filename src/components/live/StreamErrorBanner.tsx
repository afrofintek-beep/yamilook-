import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { motion } from 'framer-motion';
import { AlertTriangle, X, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StreamError } from '@/hooks/useLiveStream';

interface StreamErrorBannerProps {
  error: StreamError;
  onDismiss: () => void;
  onRetry?: () => void;
}

const errorMessages: Record<StreamError['code'], { icon: string; suggestion: string }> = {
  TOKEN_FAILED: {
    icon: '🔑',
    suggestion: 'Check your LiveKit API credentials in the backend settings.',
  },
  CONNECTION_FAILED: {
    icon: '🌐',
    suggestion: 'Verify your network connection and LiveKit server URL.',
  },
  TRACK_PUBLISH_FAILED: {
    icon: '📹',
    suggestion: 'Ensure camera and microphone permissions are granted.',
  },
  DATABASE_ERROR: {
    icon: '💾',
    suggestion: 'There was an issue saving your stream. Please try again.',
  },
  UNKNOWN: {
    icon: '⚠️',
    suggestion: 'An unexpected error occurred. Please try again.',
  },
};

export function StreamErrorBanner({ error, onDismiss, onRetry }: StreamErrorBannerProps) {
  useUiLocale();
  const errorInfo = errorMessages[error.code];

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 mx-4 mb-4"
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 text-2xl">{errorInfo.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            <h4 className="font-semibold text-destructive text-sm">
              {error.message}
            </h4>
          </div>
          {error.details && (
            <p className="text-xs text-muted-foreground mb-2">
              {error.details}
            </p>
          )}
          <p className="text-xs text-foreground/70">
            💡 {errorInfo.suggestion}
          </p>
          {onRetry && (
            <Button
              size="sm"
              variant="outline"
              className="mt-3 h-8 text-xs"
              onClick={onRetry}
            >
              <RefreshCw className="w-3 h-3 mr-1" />{uiText("Try Again")}</Button>
          )}
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="flex-shrink-0 h-6 w-6"
          onClick={onDismiss}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    </motion.div>
  );
}
