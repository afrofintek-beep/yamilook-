import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { useState } from 'react';
import { format, addDays, addHours, setHours, setMinutes } from 'date-fns';
import { Calendar, Clock, Repeat, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ResponsiveModal } from '@/components/ui/responsive-modal';
import { Switch } from '@/components/ui/switch';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface ScheduleMessageSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message: string;
  onSchedule: (scheduledFor: Date, isRecurring: boolean, pattern?: string) => Promise<void>;
}

export function ScheduleMessageSheet({
  open,
  onOpenChange,
  message,
  onSchedule,
}: ScheduleMessageSheetProps) {
  useUiLocale();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(addDays(new Date(), 1));
  const [selectedTime, setSelectedTime] = useState('09:00');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrencePattern, setRecurrencePattern] = useState<string>('daily');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const quickOptions = [
    { label: uiText("In 1 hour"), getDate: () => addHours(new Date(), 1) },
    { label: uiText("In 3 hours"), getDate: () => addHours(new Date(), 3) },
    { label: uiText("Tomorrow 9 AM"), getDate: () => setMinutes(setHours(addDays(new Date(), 1), 9), 0) },
    { label: uiText("Tomorrow 6 PM"), getDate: () => setMinutes(setHours(addDays(new Date(), 1), 18), 0) },
  ];

  const handleSchedule = async () => {
    if (!selectedDate) return;

    setIsSubmitting(true);
    try {
      const [hours, minutes] = selectedTime.split(':').map(Number);
      const scheduledFor = setMinutes(setHours(selectedDate, hours), minutes);

      await onSchedule(scheduledFor, isRecurring, isRecurring ? recurrencePattern : undefined);
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickOption = (getDate: () => Date) => {
    const date = getDate();
    setSelectedDate(date);
    setSelectedTime(format(date, 'HH:mm'));
  };

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      className="h-[85vh] rounded-t-3xl sm:max-w-lg"
      title={
        <span className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" />{uiText("Schedule Message")}</span>
      }
    >

        <div className="space-y-6 overflow-y-auto max-h-[calc(85vh-8rem)]">
          {/* Message preview */}
          <div className="p-3 rounded-xl bg-secondary/50 border border-border">
            <p className="text-sm text-muted-foreground mb-1">{uiText("Message to schedule:")}</p>
            <p className="text-sm">{message || uiText("No message content")}</p>
          </div>

          {/* Quick options */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">{uiText("Quick options")}</Label>
            <div className="grid grid-cols-2 gap-2">
              {quickOptions.map((option) => (
                <Button
                  key={option.label}
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickOption(option.getDate)}
                  className="justify-start"
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Date picker */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">{uiText("Select date")}</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !selectedDate && 'text-muted-foreground'
                  )}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, 'PPP') : uiText("Pick a date")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarPicker
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  disabled={(date) => date < new Date()}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Time picker */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">{uiText("Select time")}</Label>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <Input
                type="time"
                value={selectedTime}
                onChange={(e) => setSelectedTime(e.target.value)}
                className="flex-1"
              />
            </div>
          </div>

          {/* Recurring option */}
          <div className="space-y-4 p-4 rounded-xl bg-secondary/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Repeat className="w-4 h-4 text-muted-foreground" />
                <Label className="text-sm font-medium">{uiText("Recurring message")}</Label>
              </div>
              <Switch checked={isRecurring} onCheckedChange={setIsRecurring} />
            </div>

            {isRecurring && (
              <Select value={recurrencePattern} onValueChange={setRecurrencePattern}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">{uiText("Daily")}</SelectItem>
                  <SelectItem value="weekly">{uiText("Weekly")}</SelectItem>
                  <SelectItem value="monthly">{uiText("Monthly")}</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Schedule preview */}
          {selectedDate && (
            <div className="p-3 rounded-xl bg-primary/10 border border-primary/20">
              <p className="text-sm text-center">{uiText("Message will be sent on")}{' '}
                <strong>{format(selectedDate, 'EEEE, MMMM d, yyyy')}</strong>{uiText(" at")}{' '}
                <strong>{selectedTime}</strong>
                {isRecurring && (
                  <span className="block text-muted-foreground mt-1">{uiText("Repeating ")}{recurrencePattern}
                  </span>
                )}
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => onOpenChange(false)}
          >
            <X className="w-4 h-4 mr-2" />{uiText("Cancel")}</Button>
          <Button
            className="flex-1 bg-gradient-primary text-white"
            onClick={handleSchedule}
            disabled={!selectedDate || isSubmitting}
          >
            <Send className="w-4 h-4 mr-2" />{uiText("Schedule")}</Button>
        </div>
    </ResponsiveModal>
  );
}
