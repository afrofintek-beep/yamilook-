import { useState, useEffect } from 'react';
import { Timer, Clock, Eye } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';

interface DisappearingMessagesSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
}

const DURATION_OPTIONS = [
  { value: null, label: 'Off', description: 'Messages won\'t disappear' },
  { value: '24h', label: '24 hours', description: 'Messages disappear after 24 hours' },
  { value: '7d', label: '7 days', description: 'Messages disappear after 7 days' },
  { value: '90d', label: '90 days', description: 'Messages disappear after 90 days' },
];

export function DisappearingMessagesSheet({
  open,
  onOpenChange,
  conversationId,
}: DisappearingMessagesSheetProps) {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [selectedDuration, setSelectedDuration] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && conversationId) {
      fetchCurrentDuration();
    }
  }, [open, conversationId]);

  const fetchCurrentDuration = async () => {
    const { data } = await supabase
      .from('conversations')
      .select('disappearing_messages_duration')
      .eq('id', conversationId)
      .single();

    if (data) {
      setSelectedDuration(data.disappearing_messages_duration);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    
    const { data, error } = await supabase
      .from('conversations')
      .update({ disappearing_messages_duration: selectedDuration })
      .eq('id', conversationId)
      .select('id, disappearing_messages_duration')
      .single();

    if (error || !data || data.disappearing_messages_duration !== selectedDuration) {
      toast({ title: 'Não foi possível guardar', description: error?.message || 'A duração não foi confirmada. Tenta novamente.', variant: 'destructive' });
    } else {
      toast({ title: selectedDuration ? 'Disappearing messages enabled' : 'Disappearing messages disabled' });
      onOpenChange(false);
    }
    
    setSaving(false);
  };

  const body = (
    <>
      <RadioGroup
          value={selectedDuration || 'off'}
          onValueChange={(v) => setSelectedDuration(v === 'off' ? null : v)}
          className="space-y-3"
        >
          {DURATION_OPTIONS.map((option) => (
            <div
              key={option.value || 'off'}
              className={`flex items-center space-x-3 p-4 rounded-xl border transition-colors ${
                (selectedDuration || 'off') === (option.value || 'off')
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:bg-secondary/50'
              }`}
            >
              <RadioGroupItem
                value={option.value || 'off'}
                id={option.value || 'off'}
              />
              <div className="flex-1">
                <Label
                  htmlFor={option.value || 'off'}
                  className="font-medium cursor-pointer"
                >
                  {option.label}
                </Label>
                <p className="text-sm text-muted-foreground">{option.description}</p>
              </div>
              {option.value && (
                <Clock className="w-5 h-5 text-muted-foreground" />
              )}
            </div>
          ))}
        </RadioGroup>

        <div className="mt-6 p-4 rounded-xl bg-secondary/50">
          <div className="flex items-center gap-3">
            <Eye className="w-5 h-5 text-muted-foreground" />
            <div className="flex-1">
              <p className="font-medium text-sm">View Once Media</p>
              <p className="text-xs text-muted-foreground">
                Photos and videos can only be viewed once
              </p>
            </div>
          </div>
        </div>

      <div className="flex gap-3 mt-6">
        <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button
          className="flex-1 bg-gradient-primary text-white"
          onClick={handleSave}
          disabled={saving}
        >
          Save
        </Button>
      </div>
    </>
  );

  const title = (
    <span className="flex items-center gap-2">
      <Timer className="w-5 h-5 text-primary" />
      Disappearing Messages
    </span>
  );
  const description = 'Aplica-se apenas às mensagens enviadas depois de guardar. O prazo conta a partir do envio; as mensagens anteriores mantêm-se. A opção mínima é 24 horas.';

  // WhatsApp/Instagram pattern: compact centered dialog on desktop, bottom sheet
  // on mobile.
  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="h-auto max-h-[88vh] overflow-y-auto rounded-t-3xl">
          <SheetHeader className="mb-6">
            <SheetTitle>{title}</SheetTitle>
            <SheetDescription>{description}</SheetDescription>
          </SheetHeader>
          {body}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader className="mb-2">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  );
}
