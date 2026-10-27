import { useState, useEffect, useCallback } from 'react';
import { Search, UserPlus, Loader2, MailPlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { InviteSheet } from '@/components/settings/InviteSheet';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

interface SearchResult {
  id: string;
  display_name: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
}

interface AddContactSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSearch: (query: string) => Promise<SearchResult[]>;
  onSendRequest: (userId: string, message?: string) => Promise<{ error: Error | null }>;
  existingContactIds: string[];
  pendingRequestIds: string[];
}

export function AddContactSheet({
  open,
  onOpenChange,
  onSearch,
  onSendRequest,
  existingContactIds,
  pendingRequestIds,
}: AddContactSheetProps) {
  const { toast } = useToast();
  const { i18n } = useTranslation();
  const pt = i18n.language.toLowerCase().startsWith('pt');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SearchResult | null>(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const performSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    const searchResults = await onSearch(searchQuery);
    setResults(searchResults);
    setLoading(false);
  }, [searchQuery, onSearch]);

  useEffect(() => {
    const debounce = setTimeout(performSearch, 300);
    return () => clearTimeout(debounce);
  }, [performSearch]);

  const handleSendRequest = async () => {
    if (!selectedUser) return;

    setSending(true);
    const { error } = await onSendRequest(selectedUser.id, message || undefined);
    setSending(false);

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Request sent',
        description: `Friend request sent to ${selectedUser.display_name}`,
      });
      setSelectedUser(null);
      setMessage('');
      setSearchQuery('');
      setResults([]);
      onOpenChange(false);
    }
  };

  const handleClose = () => {
    setSelectedUser(null);
    setMessage('');
    setSearchQuery('');
    setResults([]);
    onOpenChange(false);
  };

  const getStatus = (userId: string) => {
    if (existingContactIds.includes(userId)) return 'contact';
    if (pendingRequestIds.includes(userId)) return 'pending';
    return null;
  };

  const beginInvitation = () => { handleClose(); setInviteOpen(true); };

  return (
    <>
    <Sheet open={open} onOpenChange={(next) => { if (!next) handleClose(); }}>
      <SheetContent side="bottom" className="h-[85dvh] max-h-[calc(100dvh-env(safe-area-inset-top,0px))] rounded-t-3xl overflow-y-auto pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
        <SheetHeader className="mb-4">
          <SheetTitle className="text-xl">{pt ? 'Adicionar contacto' : 'Add contact'}</SheetTitle>
        </SheetHeader>

        {selectedUser ? (
          <div className="space-y-6">
            <div className="flex items-center gap-4 p-4 rounded-xl bg-secondary/50">
              <Avatar className="w-16 h-16">
                <AvatarImage src={selectedUser.avatar_url || ''} />
                <AvatarFallback className="bg-gradient-primary text-white text-xl">
                  {selectedUser.display_name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-semibold text-lg">{selectedUser.display_name}</h3>
                <p className="text-muted-foreground">@{selectedUser.username}</p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                {pt ? 'Mensagem (opcional)' : 'Add a message (optional)'}
              </label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Hey! I'd like to connect with you..."
                className="resize-none"
                rows={3}
              />
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setSelectedUser(null)}
              >
                {pt ? 'Voltar' : 'Back'}
              </Button>
              <Button
                className="flex-1 bg-gradient-primary text-white"
                onClick={handleSendRequest}
                disabled={sending}
              >
                {sending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <UserPlus className="w-4 h-4 mr-2" />
                )}
                {pt ? 'Enviar pedido' : 'Send request'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={pt ? 'Pesquisar por nome ou utilizador...' : 'Search by name or username...'}
                className="pl-10 h-12 rounded-xl"
              />
            </div>

            <div className="max-h-[55vh] overflow-y-auto -mx-4">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : results.length === 0 ? (
                searchQuery.trim() ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <p>{pt ? 'Nenhum utilizador encontrado' : 'No users found'}</p>
                    <p className="text-sm">{pt ? 'Tenta outra pesquisa ou convida a pessoa para a Yamilook.' : 'Try another search or invite the person to Yamilook.'}</p>
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>{pt ? 'Pesquisa utilizadores da Yamilook' : 'Search Yamilook users to add'}</p>
                  </div>
                )
              ) : (
                <div className="divide-y divide-border/30">
                  {results.map((user) => {
                    const status = getStatus(user.id);

                    return (
                      <button
                        key={user.id}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors text-left"
                        onClick={() => !status && setSelectedUser(user)}
                        disabled={!!status}
                      >
                        <Avatar className="w-12 h-12">
                          <AvatarImage src={user.avatar_url || ''} />
                          <AvatarFallback className="bg-gradient-accent text-white">
                            {user.display_name
                              .split(' ')
                              .map((n) => n[0])
                              .join('')
                              .toUpperCase()
                              .slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <span className="font-semibold truncate block">
                            {user.display_name}
                          </span>
                          <span className="text-sm text-muted-foreground truncate block">
                            @{user.username}
                          </span>
                        </div>
                        {status === 'contact' && (
                          <span className="text-xs px-2 py-1 rounded-full bg-success/10 text-success">
                            {pt ? 'Contacto' : 'Contact'}
                          </span>
                        )}
                        {status === 'pending' && (
                          <span className="text-xs px-2 py-1 rounded-full bg-warning/10 text-warning">
                            {pt ? 'Pendente' : 'Pending'}
                          </span>
                        )}
                        {!status && (
                          <UserPlus className="w-5 h-5 text-primary" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="border-t border-border/40 pt-4 space-y-2">
              <p className="text-sm text-muted-foreground">{pt ? 'A pessoa ainda não está na Yamilook?' : 'Not on Yamilook yet?'}</p>
              <Button variant="outline" className="w-full min-h-11 rounded-xl" onClick={beginInvitation}>
                <MailPlus className="w-4 h-4 mr-2" />
                {pt ? 'Convidar para a Yamilook' : 'Invite to Yamilook'}
              </Button>
              <p className="text-xs text-muted-foreground">{pt ? 'O convite utiliza o registo e as permissões já existentes.' : 'Invitations use existing registration and permissions.'}</p>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
    <InviteSheet open={inviteOpen} onOpenChange={setInviteOpen} />
    </>
  );
}
