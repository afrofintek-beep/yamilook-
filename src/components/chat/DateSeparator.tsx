import { isToday, isYesterday, isSameDay } from 'date-fns';
import { format } from '@/i18n/ui-date';
import { useTranslation } from 'react-i18next';

interface DateSeparatorProps {
  date: Date;
}

export function DateSeparator({ date }: DateSeparatorProps) {
  const { t } = useTranslation();

  const getDateLabel = (date: Date): string => {
    if (isToday(date)) {
      return t('chat.today') || 'Today';
    }
    if (isYesterday(date)) {
      return t('chat.yesterday') || 'Yesterday';
    }
    // Format as "Monday, January 20, 2025" or similar based on locale
    return format(date, 'EEEE, MMMM d, yyyy');
  };

  return (
    <div className="flex items-center justify-center py-3">
      <div className="px-4 py-1.5 rounded-full bg-muted/80 backdrop-blur-sm shadow-sm">
        <span className="text-xs font-medium text-muted-foreground">
          {getDateLabel(date)}
        </span>
      </div>
    </div>
  );
}

// Helper function to check if we should show a date separator before a message
export function shouldShowDateSeparator(
  currentMessageDate: Date,
  previousMessageDate: Date | null
): boolean {
  if (!previousMessageDate) {
    return true; // Always show for the first message
  }
  return !isSameDay(currentMessageDate, previousMessageDate);
}
