import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MessageCircle, Loader2, Users } from 'lucide-react';
import { ResponsiveModal } from '@/components/ui/responsive-modal';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useContacts } from '@/hooks/useContacts';
import { useConversations } from '@/hooks/useChat';
import { useToast } from '@/hooks/use-toast';
import { CreateGroupSheet } from './CreateGroupSheet';

interface NewChatSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewChatSheet({ open, onOpenChange }: NewChatSheetProps) {
  useUiLocale();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { contacts, loading: contactsLoading } = useContacts();
  const { createConversation } = useConversations();

  const [searchQuery, setSearchQuery] = useState('');
  const [creating, setCreating] = useState<string | null>(null);
  const [groupSheetOpen, setGroupSheetOpen] = useState(false);

  const filteredContacts = contacts.filter((contact) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      contact.nickname?.toLowerCase().includes(query) ||
      contact.profile?.display_name.toLowerCase().includes(query) ||
      contact.profile?.username.toLowerCase().includes(query)
    );
  });

  const handleSelectContact = async (contactUserId: string) => {
    setCreating(contactUserId);
    const { data, error } = await createConversation([contactUserId]);
    setCreating(null);

    if (error) {
      toast({
        title: uiText("Error"),
        description: error.message,
        variant: 'destructive',
      });
    } else if (data) {
      onOpenChange(false);
      navigate(`/chat/${data.id}`);
    }
  };

  return (
    <>
      <ResponsiveModal
        open={open}
        onOpenChange={onOpenChange}
        className="h-[85vh] rounded-t-3xl sm:max-w-lg"
        title={<span className="text-xl font-semibold">{uiText("New Chat")}</span>}
      >
          <div className="space-y-4">
            {/* Create Group Button */}
            <button
              onClick={() => {
                setGroupSheetOpen(true);
                onOpenChange(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-3 bg-secondary/50 hover:bg-secondary rounded-xl transition-colors text-left"
            >
              <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center">
                <Users className="w-6 h-6 text-primary-foreground" />
              </div>
              <div className="flex-1">
                <span className="font-semibold block">{uiText("Novo Grupo")}</span>
                <span className="text-sm text-muted-foreground">{uiText("Até 256 membros")}</span>
              </div>
            </button>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={uiText("Search contacts...")}
                className="pl-10 h-12 rounded-xl"
              />
            </div>

            <div className="max-h-[60vh] overflow-y-auto -mx-4">
              {contactsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : filteredContacts.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  {searchQuery ? (
                    <p>{uiText("No contacts found")}</p>
                  ) : (
                    <>
                      <MessageCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>{uiText("No contacts yet")}</p>
                      <p className="text-sm">{uiText("Add contacts to start chatting")}</p>
                    </>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-border/30">
                  {filteredContacts.map((contact) => {
                    const displayName =
                      contact.nickname || contact.profile?.display_name || 'Unknown';
                    const initials = displayName
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .toUpperCase()
                      .slice(0, 2);

                    return (
                      <button
                        key={contact.id}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors text-left disabled:opacity-50"
                        onClick={() => handleSelectContact(contact.contact_user_id)}
                        disabled={creating === contact.contact_user_id}
                      >
                        <div className="relative">
                          <Avatar className="w-12 h-12">
                            <AvatarImage src={contact.profile?.avatar_url || ''} />
                            <AvatarFallback className="bg-gradient-primary text-white">
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                          {contact.profile?.is_online && (
                            <span className="absolute bottom-0 right-0 w-3.5 h-3.5 status-online rounded-full border-2 border-background" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="font-semibold truncate block">
                            {displayName}
                          </span>
                          <span className="text-sm text-muted-foreground truncate block">
                            @{contact.profile?.username || uiText("unknown")}
                          </span>
                        </div>
                        {creating === contact.contact_user_id ? (
                          <Loader2 className="w-5 h-5 animate-spin text-primary" />
                        ) : (
                          <MessageCircle className="w-5 h-5 text-muted-foreground" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
      </ResponsiveModal>

      <CreateGroupSheet open={groupSheetOpen} onOpenChange={setGroupSheetOpen} />
    </>
  );
}
