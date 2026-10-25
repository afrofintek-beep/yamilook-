import { useState } from 'react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Calendar as CalendarIcon, Clock, Video, Phone, Users, Repeat, X } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useContacts } from '@/hooks/useContacts';
import { useCalls } from '@/hooks/useCalls';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface ScheduleCallSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const timeSlots = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
  '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
  '18:00', '18:30', '19:00', '19:30', '20:00', '20:30',
];

const durationOptions = [
  { value: '15', label: '15 minutos' },
  { value: '30', label: '30 minutos' },
  { value: '45', label: '45 minutos' },
  { value: '60', label: '1 hora' },
  { value: '90', label: '1 hora e 30 minutos' },
  { value: '120', label: '2 horas' },
];

const recurrenceOptions = [
  { value: 'none', label: 'Não se repete' },
  { value: 'daily', label: 'Diariamente' },
  { value: 'weekly', label: 'Semanalmente' },
  { value: 'biweekly', label: 'A cada 2 semanas' },
  { value: 'monthly', label: 'Mensalmente' },
];

export function ScheduleCallSheet({ open, onOpenChange }: ScheduleCallSheetProps) {
  const { contacts } = useContacts();
  const { scheduleCall } = useCalls();
  const { toast } = useToast();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [time, setTime] = useState('10:00');
  const [duration, setDuration] = useState('60');
  const [callType, setCallType] = useState<'voice' | 'video'>('video');
  const [waitingRoom, setWaitingRoom] = useState(true);
  const [recurrence, setRecurrence] = useState('none');
  const [selectedInvitees, setSelectedInvitees] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleInvitee = (userId: string) => {
    setSelectedInvitees(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast({
        title: 'Título obrigatório',
        description: 'Introduz um título para a chamada',
        variant: 'destructive',
      });
      return;
    }

    if (!date) {
      toast({
        title: 'Data obrigatória',
        description: 'Seleciona uma data para a chamada',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const [hours, minutes] = time.split(':').map(Number);
      const scheduledDate = new Date(date);
      scheduledDate.setHours(hours, minutes, 0, 0);

      await scheduleCall(title, scheduledDate, callType, {
        description: description || undefined,
        durationMinutes: parseInt(duration),
        isRecurring: recurrence !== 'none',
        recurrencePattern: recurrence !== 'none' ? recurrence : undefined,
        waitingRoomEnabled: waitingRoom,
        invitees: selectedInvitees,
      });

      toast({
        title: 'Chamada agendada',
        description: `Chamada de ${callType === 'video' ? 'vídeo' : 'voz'} agendada para ${format(scheduledDate, 'dd/MM/yyyy HH:mm', { locale: pt })}`,
      });

      // Reset form
      setTitle('');
      setDescription('');
      setDate(new Date());
      setTime('10:00');
      setDuration('60');
      setCallType('video');
      setWaitingRoom(true);
      setRecurrence('none');
      setSelectedInvitees([]);
      onOpenChange(false);
    } catch (error) {
      toast({
        title: 'Não foi possível agendar',
        description: 'Ocorreu um erro ao agendar a chamada. Tenta novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="flex h-[90dvh] max-h-[calc(100dvh-env(safe-area-inset-top,0px))] flex-col gap-3 overflow-hidden rounded-t-3xl px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom,0px))] sm:px-6">
        <SheetHeader className="shrink-0">
          <SheetTitle className="text-xl">Agendar chamada</SheetTitle>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-1 pb-4">
          <div className="space-y-6">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Título *</Label>
              <Input
                id="title"
                placeholder="Reunião semanal da equipa"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                placeholder="Adiciona uma descrição..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            {/* Call Type */}
            <div className="space-y-2">
              <Label>Tipo de chamada</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={callType === 'video' ? 'default' : 'outline'}
                  className={cn(
                    "flex-1 rounded-xl",
                    callType === 'video' && "bg-gradient-primary text-white"
                  )}
                  onClick={() => setCallType('video')}
                >
                  <Video className="w-4 h-4 mr-2" />
                  Vídeo
                </Button>
                <Button
                  type="button"
                  variant={callType === 'voice' ? 'default' : 'outline'}
                  className={cn(
                    "flex-1 rounded-xl",
                    callType === 'voice' && "bg-gradient-primary text-white"
                  )}
                  onClick={() => setCallType('voice')}
                >
                  <Phone className="w-4 h-4 mr-2" />
                  Voz
                </Button>
              </div>
            </div>

            {/* Date & Time */}
            <div className="grid grid-cols-1 gap-4 min-[400px]:grid-cols-2">
              <div className="space-y-2">
                <Label>Data *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="h-11 w-full min-w-0 justify-start rounded-xl text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                      <span className="truncate">{date ? format(date, 'dd/MM/yyyy', { locale: pt }) : 'Seleciona a data'}</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      locale={pt}
                      selected={date}
                      onSelect={setDate}
                      disabled={(date) => date < new Date()}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Hora *</Label>
                <Select value={time} onValueChange={setTime}>
                  <SelectTrigger className="h-11 min-w-0 rounded-xl">
                    <Clock className="mr-2 h-4 w-4" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {timeSlots.map((slot) => (
                      <SelectItem key={slot} value={slot}>
                        {slot}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Duration */}
            <div className="space-y-2">
              <Label>Duração</Label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger className="h-11 min-w-0 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {durationOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Recurrence */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Repeat className="w-4 h-4" />
                Repetição
              </Label>
              <Select value={recurrence} onValueChange={setRecurrence}>
                <SelectTrigger className="h-11 min-w-0 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {recurrenceOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Waiting Room */}
            <div className="flex items-center justify-between gap-3 p-4 rounded-xl bg-secondary/50">
              <div>
                <p className="font-medium">Sala de espera</p>
                <p className="text-sm text-muted-foreground">
                  Os participantes aguardam até os admitires
                </p>
              </div>
              <Switch
                checked={waitingRoom}
                onCheckedChange={setWaitingRoom}
              />
            </div>

            {/* Invite Participants */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                Convidar participantes
              </Label>

              {/* Selected invitees */}
              {selectedInvitees.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {selectedInvitees.map((userId) => {
                    const contact = contacts.find(c => c.contact_user_id === userId);
                    return (
                      <Badge
                        key={userId}
                        variant="secondary"
                        className="pr-1 rounded-full"
                      >
                        {contact?.profile?.display_name || 'Sem nome'}
                        <button
                          type="button"
                          aria-label="Remover participante"
                          onClick={() => toggleInvitee(userId)}
                          className="ml-1 flex h-11 w-11 items-center justify-center rounded-full hover:bg-muted"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    );
                  })}
                </div>
              )}

              {/* Contact list */}
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {contacts.map((contact) => {
                  const isSelected = selectedInvitees.includes(contact.contact_user_id);
                  return (
                    <motion.button
                      key={contact.id}
                      type="button"
                      whileTap={{ scale: 0.98 }}
                      onClick={() => toggleInvitee(contact.contact_user_id)}
                      className={cn(
                        "w-full flex items-center gap-3 p-3 rounded-xl transition-colors",
                        isSelected ? "bg-primary/10 border border-primary/30" : "bg-secondary/50 hover:bg-secondary"
                      )}
                    >
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={contact.profile?.avatar_url || ''} />
                        <AvatarFallback className="bg-gradient-primary text-white">
                          {contact.profile?.display_name?.[0]?.toUpperCase() || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 text-left">
                        <p className="font-medium">
                          {contact.nickname || contact.profile?.display_name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          @{contact.profile?.username}
                        </p>
                      </div>
                      <div className={cn(
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                        isSelected ? "bg-primary border-primary" : "border-muted-foreground"
                      )}>
                        {isSelected && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="w-2 h-2 bg-white rounded-full"
                          />
                        )}
                      </div>
                    </motion.button>
                  );
                })}

                {contacts.length === 0 && (
                  <p className="text-center text-muted-foreground py-4">
                    Não há contactos para convidar
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="shrink-0 border-t bg-background pt-3">
          <Button
            className="w-full rounded-xl bg-gradient-primary text-white h-12"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'A agendar...' : 'Agendar chamada'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
