import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { useAuth } from '@/hooks/useAuth';
import { useState, useMemo, useRef, useEffect } from 'react';
import { useKeyboardViewport } from '@/hooks/useKeyboardViewport';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Users,
  Loader2,
  Camera,
  X,
  Check,
  ChevronRight,
  ImagePlus
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ResponsiveModal } from '@/components/ui/responsive-modal';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useContacts } from '@/hooks/useContacts';
import { useConversations } from '@/hooks/useChat';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface CreateGroupSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MAX_GROUP_MEMBERS = 255;

export function CreateGroupSheet({ open, onOpenChange }: CreateGroupSheetProps) {
  useUiLocale();
  const { style: viewportStyle, compact } = useKeyboardViewport(open);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { contacts, loading: contactsLoading } = useContacts();
  const { createConversation } = useConversations();

  const [step, setStep] = useState<'select' | 'details' | 'created'>('select');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [groupName, setGroupName] = useState('');
  const [groupPhoto, setGroupPhoto] = useState<File | null>(null);
  const [groupPhotoPreview, setGroupPhotoPreview] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const submitting = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [creationError, setCreationError] = useState<string | null>(null);
  const [createdConversationId, setCreatedConversationId] = useState<string | null>(null);

  useEffect(() => {
    if (step === 'created') headingRef.current?.focus();
  }, [step]);
  const filteredContacts = useMemo(() => {
    return contacts.filter((contact) => {
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      return (
        contact.nickname?.toLowerCase().includes(query) ||
        contact.profile?.display_name?.toLowerCase().includes(query) ||
        contact.profile?.username?.toLowerCase().includes(query)
      );
    });
  }, [contacts, searchQuery]);

  const selectedContactsList = useMemo(() => {
    return contacts.filter((c) => selectedContacts.has(c.contact_user_id));
  }, [contacts, selectedContacts]);

  const toggleContact = (contactUserId: string) => {
    setSelectedContacts((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(contactUserId)) {
        newSet.delete(contactUserId);
      } else {
        if (newSet.size >= MAX_GROUP_MEMBERS) {
          toast({
            title: uiText("Limite atingido"),
            description: `O grupo pode ter no máximo ${MAX_GROUP_MEMBERS + 1} membros.`,
            variant: 'destructive',
          });
          return prev;
        }
        newSet.add(contactUserId);
      }
      return newSet;
    });
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setCreationError('A foto deve ter no máximo 5MB. Escolhe uma imagem mais pequena.');
        return;
      }
      setCreationError(null);
      setGroupPhoto(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setGroupPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreateGroup = async () => {
    if (submitting.current || createdConversationId) return;
    if (!user) {
      setCreationError('A tua sessão terminou. Inicia sessão para criar o grupo.');
      return;
    }
    if (selectedContacts.size < 1) {
      setCreationError('Seleciona pelo menos 1 contacto para criar um grupo.');
      return;
    }

    if (!groupName.trim()) {
      setCreationError('O grupo precisa de um nome.');
      return;
    }

    submitting.current = true;
    setCreating(true);
    setCreationError(null);

    try {
      let avatarUrl: string | null = null;

      // Upload group photo if provided
      if (groupPhoto) {
        const fileExt = groupPhoto.name.split('.').pop();
        const fileName = `group-${Date.now()}.${fileExt}`;
        const filePath = `${user.id}/group-avatars/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, groupPhoto);

        if (uploadError) {
          setCreationError('Não foi possível enviar a fotografia. Tenta novamente ou escolhe outra imagem.');
          return;
        }
        const { data: urlData } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath);
        avatarUrl = urlData.publicUrl;
      }

      // Create group conversation
      const { data, error } = await createConversation(
        Array.from(selectedContacts),
        groupName.trim(),
        avatarUrl
      );

      if (error || !data) throw error || new Error(uiText("Resposta inválida"));
      setCreatedConversationId(data.id);
      // Keep completion inside the existing modal: a second dialog can sit
      // behind its overlay and leave the user unable to open their new group.
      setStep('created');
    } catch {
      setCreationError('Não foi possível concluir a criação do grupo. Verifica a ligação e tenta novamente.');
    } finally {
      submitting.current = false;
      setCreating(false);
    }
  };

  const resetAndClose = () => {
    if (submitting.current) return;
    setStep('select');
    setSearchQuery('');
    setSelectedContacts(new Set());
    setGroupName('');
    setGroupPhoto(null);
    setGroupPhotoPreview(null);
    setCreationError(null);
    setCreatedConversationId(null);
    onOpenChange(false);
  };

  const canProceed = selectedContacts.size >= 1;

  const handleOpenCreatedGroup = () => {
    const id = createdConversationId;
    resetAndClose();
    if (id) navigate(`/chat/${id}`);
  };

  return (
      <ResponsiveModal
        open={open}
        onOpenChange={resetAndClose}
        srTitle="Novo Grupo"
        padded={false}
        hideCloseButton
        style={viewportStyle}
        className="flex h-[min(90dvh,var(--group-viewport-height,100dvh))] max-h-[min(90dvh,var(--group-viewport-height,100dvh))] flex-col gap-0 overflow-hidden rounded-t-3xl pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)] sm:max-w-lg max-[767px]:bottom-[var(--group-viewport-bottom,0px)]"
      >
          <div className="flex shrink-0 items-center gap-2 border-b border-border/50 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top,0px))]">
            {step === 'details' && (
              <Button variant="ghost" size="icon" disabled={creating} aria-label={uiText("Voltar à seleção de contactos")} onClick={() => setStep('select')} className="h-11 w-11 shrink-0 rounded-full">
                <ChevronRight className="h-5 w-5 rotate-180" />
              </Button>
            )}
            <h2 ref={headingRef} tabIndex={-1} className="min-w-0 flex-1 text-lg font-semibold">{step === 'select' ? uiText("Novo Grupo") : step === 'created' ? uiText("Grupo criado") : uiText("Detalhes do Grupo")}</h2>
            {step === 'select' && <Badge variant="secondary" className="shrink-0 font-mono">{selectedContacts.size}/{MAX_GROUP_MEMBERS}</Badge>}
            <Button variant="ghost" disabled={creating} onClick={resetAndClose} className="h-11 shrink-0 gap-1 rounded-full px-2" aria-label={uiText("Fechar criação do grupo")}>
              <X className="h-4 w-4" /><span>{uiText("Fechar")}</span>
            </Button>
          </div>
          <AnimatePresence mode="wait">
            {step === 'select' ? (
              <motion.div
                key="select"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex min-h-0 flex-1 flex-col"
              >
                {/* Selected contacts preview */}
                <AnimatePresence>
                  {selectedContactsList.length > 0 && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="shrink-0 border-b border-border/50 overflow-hidden [@media(max-height:500px)]:hidden"
                    >
                      <div className="flex gap-2 p-3 overflow-x-auto">
                        {selectedContactsList.map((contact) => {
                          const displayName =
                            contact.nickname || contact.profile?.display_name || 'Contacto';
                          return (
                            <motion.div
                              key={contact.id}
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              exit={{ scale: 0 }}
                              className="flex flex-col items-center gap-1 min-w-[60px]"
                            >
                              <div className="relative">
                                <Avatar className="w-12 h-12">
                                  <AvatarImage src={contact.profile?.avatar_url || ''} />
                                  <AvatarFallback className="bg-gradient-primary text-white text-xs">
                                    {displayName.slice(0, 2).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <button
                                  aria-label={`Remover ${displayName}`}
                                  onClick={() => toggleContact(contact.contact_user_id)}
                                  className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                              <span className="text-xs text-muted-foreground truncate max-w-[60px]">
                                {displayName.split(' ')[0]}
                              </span>
                            </motion.div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Search */}
                <div className="shrink-0 px-4 py-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={uiText("Pesquisar contactos...")}
                      className="pl-10 h-12 rounded-xl text-base"
                    />
                  </div>
                </div>

                {/* Contacts list */}
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain" data-group-contact-list>
                  {contactsLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                  ) : filteredContacts.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      {searchQuery ? (
                        <p>{uiText("Nenhum contacto encontrado")}</p>
                      ) : (
                        <>
                          <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                          <p>{uiText("Sem contactos")}</p>
                          <p className="text-sm">{uiText("Adiciona contactos primeiro")}</p>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="divide-y divide-border/30">
                      {filteredContacts.map((contact) => {
                        const displayName =
                          contact.nickname || contact.profile?.display_name || 'Contacto';
                        const initials = displayName
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .toUpperCase()
                          .slice(0, 2);
                        const isSelected = selectedContacts.has(contact.contact_user_id);

                        return (
                          <button
                            key={contact.id}
                            aria-pressed={isSelected}
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors text-left"
                            onClick={() => toggleContact(contact.contact_user_id)}
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
                            <div
                              className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                                isSelected
                                  ? 'bg-primary border-primary'
                                  : 'border-muted-foreground/30'
                              }`}
                            >
                              {isSelected && (
                                <Check className="w-4 h-4 text-primary-foreground" />
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Next button */}
                <div className="shrink-0 border-t border-border/50 bg-background px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]">
                  <Button
                    onClick={() => setStep('details')}
                    disabled={!canProceed}
                    className="w-full h-12 rounded-xl gap-2"
                  >{uiText("Continuar · ")}{selectedContacts.size} {selectedContacts.size === 1 ? uiText("selecionado") : uiText("selecionados")}
                    <ChevronRight className="w-5 h-5" />
                  </Button>
                </div>
              </motion.div>
            ) : step === 'details' ? (
              <motion.div
                key="details"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="flex min-h-0 flex-1 flex-col"
              >
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 space-y-6">
                  {/* Group photo */}
                  <div className={compact ? "flex items-center gap-3" : "flex flex-col items-center gap-3"}>
                    <label className="relative cursor-pointer group">
                      <div className={`${compact ? "w-12 h-12" : "w-24 h-24"} rounded-full bg-secondary flex items-center justify-center overflow-hidden border-2 border-dashed border-muted-foreground/30 group-hover:border-primary transition-colors`}>
                        {groupPhotoPreview ? (
                          <img
                            src={groupPhotoPreview}
                            alt={uiText("Group")}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <ImagePlus className="w-8 h-8 text-muted-foreground group-hover:text-primary transition-colors" />
                        )}
                      </div>
                      <div className="absolute bottom-0 right-0 w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                        <Camera className="w-4 h-4 text-primary-foreground" />
                      </div>
                      <input
                        type="file"
                        aria-label={uiText("Foto do grupo")}
                        disabled={creating}
                        accept="image/*"
                        onChange={handlePhotoChange}
                        className="hidden"
                      />
                    </label>
                    <span className="text-sm text-muted-foreground">{uiText("Adicionar foto do grupo")}</span>
                  </div>

                  {/* Group name */}
                  <div className="space-y-2">
                    <label htmlFor="new-group-name" className="text-sm font-medium">{uiText("Nome do grupo")}</label>
                    <Input
                      id="new-group-name"
                      disabled={creating}
                      value={groupName}
                      onChange={(e) => setGroupName(e.target.value.slice(0, 100))}
                      placeholder={uiText("Ex: Família, Trabalho, Amigos...")}
                      className="h-12 rounded-xl text-base scroll-my-4"
                      maxLength={100}
                    />
                    <p className="text-xs text-muted-foreground text-right">
                      {groupName.length}/100
                    </p>
                  </div>

                  {/* Members summary */}
                  <div className={compact ? "hidden" : "bg-secondary/50 rounded-xl p-4 space-y-3"}>
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{uiText("Membros")}</span>
                      <Badge variant="secondary">{selectedContacts.size + 1}</Badge>
                    </div>
                    <div className="flex -space-x-2 overflow-hidden">
                      {selectedContactsList.slice(0, 8).map((contact) => (
                        <Avatar
                          key={contact.id}
                          className="w-10 h-10 border-2 border-background"
                        >
                          <AvatarImage src={contact.profile?.avatar_url || ''} />
                          <AvatarFallback className="bg-gradient-primary text-white text-xs">
                            {(contact.nickname || contact.profile?.display_name || 'U')
                              .slice(0, 2)
                              .toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                      {selectedContactsList.length > 8 && (
                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-xs font-medium border-2 border-background">
                          +{selectedContactsList.length - 8}
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{uiText("Tu e mais ")}{selectedContacts.size}{' '}
                      {selectedContacts.size === 1 ? uiText("pessoa") : uiText("pessoas")}
                    </p>
                  </div>
                </div>

                {/* Create button */}
                <div className="shrink-0 border-t border-border/50 bg-background px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]">
                  {creationError && (
                    <p role="alert" className="mb-3 max-h-24 overflow-y-auto text-sm text-destructive">
                      {creationError}
                    </p>
                  )}
                  <Button
                    onClick={handleCreateGroup}
                    disabled={creating || !!createdConversationId || !groupName.trim()}
                    className="w-full h-12 rounded-xl gap-2"
                  >
                    {creating ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />{uiText("A criar...")}</>
                    ) : (
                      <>
                        <Users className="w-5 h-5" />{uiText("Criar Grupo")}</>
                    )}
                  </Button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="created"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex min-h-0 flex-1 flex-col"
              >
                <div className="min-h-0 flex-1 overflow-y-auto p-6 text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Check className="h-8 w-8" aria-hidden="true" />
                  </div>
                  <p>{uiText("O grupo “")}{groupName.trim()}{uiText("” foi criado com ")}{selectedContacts.size + 1}{uiText(" membros.")}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{uiText("Já podes enviar mensagens e iniciar chamadas em grupo.")}</p>
                </div>
                <div className="shrink-0 border-t border-border/50 bg-background px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]">
                  <Button onClick={handleOpenCreatedGroup} className="w-full h-12 rounded-xl gap-2">{uiText("Abrir grupo")}<ChevronRight className="h-5 w-5" />
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
      </ResponsiveModal>
  );
}
