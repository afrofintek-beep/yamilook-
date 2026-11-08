import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UserPlus, Loader2, X } from 'lucide-react';
import { MokubicoInviteSheet, type InvitedUser } from './MokubicoInviteSheet';
import { useOpenConversa } from '../hooks/useMokubicoConversas';
import { SubscribeProSheet } from '@/components/mokubico/SubscribeProSheet';
import { Crown } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  space: string;
  spaceTitle: string;
}

/** Open a free Mokubico conversa: a title and an individually-chosen guest list. */
export function NewConversaSheet({ open, onOpenChange, space, spaceTitle }: Props) {
  useUiLocale();
  const navigate = useNavigate();
  const openConversa = useOpenConversa();
  const [title, setTitle] = useState('');
  const [guests, setGuests] = useState<InvitedUser[]>([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [proOpen, setProOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  // Quarto ("Só Nós") is intimate 1:1 — exactly one other person.
  const isQuarto = space === 'quarto';
  const isQuintal = space === 'quintal';
  const MAX_GUESTS = isQuarto ? 1 : 7; // host + guests (8 people cap, 2 for Quarto)

  const reset = () => { setTitle(''); setGuests([]); };

  const create = async () => {
    if (isQuarto && guests.length !== 1) {
      toast.info(uiText("No Quarto escolhes 1 pessoa (conversa só entre vocês)."));
      return;
    }
    setCreating(true);
    try {
      const { id, existing } = await openConversa({ space, title: title.trim(), guestIds: guests.map((g) => g.id) });
      reset();
      onOpenChange(false);
      if (existing) toast.info(uiText("Já tens uma conversa aberta — leva-te a ela."));
      navigate(`/mokubico/conversa/${id}`);
    } catch {
      toast.error(uiText("Não foi possível abrir a conversa."));
    } finally {
      setCreating(false);
    }
  };

  const onGuests = (chosen: InvitedUser[]) => {
    if (chosen.length > MAX_GUESTS) {
      toast.info(isQuarto ? 'O Quarto é só para 1 pessoa.' : `Máximo ${MAX_GUESTS} convidados (8 pessoas na conversa).`);
      setGuests(chosen.slice(0, MAX_GUESTS));
    } else {
      setGuests(chosen);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <SheetContent side="bottom" className="h-auto max-h-[85vh] overflow-y-auto rounded-t-3xl">
        <SheetHeader className="mb-4">
          <SheetTitle>{uiText("Abrir conversa em ")}{spaceTitle}</SheetTitle>
        </SheetHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="conversa-title" className="text-sm">{uiText("Sobre o quê?")}</Label>
            <Input
              id="conversa-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={uiText("Ex.: Papo de fim de tarde")}
              className="h-11"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm">{uiText("Quem entra")}</Label>
            <button
              type="button"
              onClick={() => setInviteOpen(true)}
              className="w-full flex items-center gap-3 p-3 rounded-xl border border-border bg-card text-left"
            >
              <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                <UserPlus className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">
                  {guests.length === 0 ? (isQuarto ? uiText("Escolher 1 pessoa") : uiText("Escolher pessoas")) : `${guests.length} ${guests.length === 1 ? 'pessoa' : 'pessoas'}`}
                </div>
                <div className="text-xs text-muted-foreground">
                  {isQuarto ? uiText("Conversa só entre vocês os dois") : uiText("Só quem escolheres pode entrar")}
                </div>
              </div>
            </button>
            {guests.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {guests.map((g) => (
                  <span key={g.id} className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs">
                    {g.name}
                    <button onClick={() => setGuests((p) => p.filter((x) => x.id !== g.id))}>
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {isQuintal && (
            <div className="bg-secondary/50 rounded-lg p-2.5 space-y-2">
              <p className="text-[11px] text-muted-foreground leading-relaxed">{uiText("🔒 No Quintal, a ")}<b>{uiText("voz e o vídeo")}</b>{uiText(" são ")}<b>{uiText("Pro")}</b>{uiText(". Sem Pro, a conversa é ")}<b>{uiText("só de texto")}</b>{uiText(" (sem limite de pessoas).")}</p>
              <button
                type="button"
                onClick={() => setProOpen(true)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600"
              >
                <Crown className="w-3.5 h-3.5" />{uiText(" Subir a Pro")}</button>
            </div>
          )}

          <Button className="w-full h-12 rounded-xl" onClick={create} disabled={creating}>
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : uiText("Abrir conversa")}
          </Button>
        </div>

        <MokubicoInviteSheet open={inviteOpen} onOpenChange={setInviteOpen} single={isQuarto} selected={guests} onConfirm={onGuests} />
        <SubscribeProSheet open={proOpen} onOpenChange={setProOpen} />
      </SheetContent>
    </Sheet>
  );
}
