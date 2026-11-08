import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { useMemo, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useContacts } from '@/hooks/useContacts';
import { Check, Search, Users } from 'lucide-react';

export interface InvitedUser {
  id: string;
  name: string;
  avatar_url: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Quarto = single (exactly one). Cozinha = multiple guests. */
  single?: boolean;
  selected: InvitedUser[];
  onConfirm: (users: InvitedUser[]) => void;
}

/** Pick people to invite into a private MOKUBICO space (Quarto / Cozinha).
 *  Sources the user's contacts; single mode enforces one pick. */
export function MokubicoInviteSheet({ open, onOpenChange, single, selected, onConfirm }: Props) {
  useUiLocale();
  const { contacts, loading } = useContacts();
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<InvitedUser[]>(selected);

  // Re-seed local selection whenever the sheet is (re)opened.
  const seed = useMemo(() => selected.map((s) => s.id).join(','), [selected]);
  useMemo(() => setPicked(selected), [seed]); // eslint-disable-line react-hooks/exhaustive-deps

  const people = useMemo(() => {
    const q = query.trim().toLowerCase();
    return contacts
      .map((c) => c.profile)
      .filter((p): p is NonNullable<typeof p> => !!p?.id)
      .filter((p) => !q || (p.display_name ?? '').toLowerCase().includes(q) || (p.username ?? '').toLowerCase().includes(q));
  }, [contacts, query]);

  const isPicked = (id: string) => picked.some((p) => p.id === id);

  const toggle = (u: InvitedUser) => {
    if (single) {
      setPicked(isPicked(u.id) ? [] : [u]);
      return;
    }
    setPicked((prev) => (isPicked(u.id) ? prev.filter((p) => p.id !== u.id) : [...prev, u]));
  };

  const confirm = () => {
    onConfirm(picked);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[80vh] p-0 flex flex-col rounded-t-2xl">
        <SheetHeader className="p-4 border-b border-border">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Users className="w-4 h-4 text-primary" />
            {single ? uiText("Escolhe 1 pessoa") : uiText("Convidar pessoas")}
          </SheetTitle>
        </SheetHeader>

        <div className="p-4 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={uiText("Procurar contacto")}
              className="pl-9 h-11"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2">
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-8">{uiText("A carregar contactos…")}</p>
          ) : people.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {query ? uiText("Ninguém encontrado.") : uiText("Ainda não tens contactos para convidar.")}
            </p>
          ) : (
            people.map((p) => {
              const u: InvitedUser = { id: p.id, name: p.display_name ?? 'Anónimo', avatar_url: p.avatar_url ?? null };
              const on = isPicked(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggle(u)}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition-colors ${
                    on ? 'bg-primary/10' : 'hover:bg-muted/50'
                  }`}
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={p.avatar_url ?? undefined} />
                    <AvatarFallback>{(p.display_name ?? '?').charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{p.display_name ?? uiText("Anónimo")}</div>
                    {p.username && <div className="text-xs text-muted-foreground truncate">@{p.username}</div>}
                  </div>
                  <div
                    className={`h-5 w-5 rounded-full border flex items-center justify-center shrink-0 ${
                      on ? 'bg-primary border-primary' : 'border-border'
                    }`}
                  >
                    {on && <Check className="h-3 w-3 text-primary-foreground" />}
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="p-4 border-t border-border">
          <Button
            className="w-full h-12 rounded-xl"
            onClick={confirm}
            disabled={single && picked.length !== 1}
          >
            {single
              ? uiText("Confirmar pessoa")
              : picked.length > 0
                ? picked.length === 1 ? uiText('Convidar {{count}} pessoa', { count: picked.length }) : uiText('Convidar {{count}} pessoas', { count: picked.length })
                : uiText("Sem convidados")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
