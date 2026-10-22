import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Camera,
  Check,
  Crown,
  Loader2,
  MoreVertical,
  Pencil,
  Search,
  Shield,
  UserMinus,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useContacts } from '@/hooks/useContacts';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Participant {
  id: string;
  user_id: string;
  role: 'admin' | 'member';
  profile: {
    id: string;
    display_name: string;
    username: string;
    avatar_url: string | null;
  };
}

interface GroupAdminSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  groupName: string;
  groupAvatarUrl: string | null;
  onGroupUpdated: () => void;
}

export function GroupAdminSheet({
  open,
  onOpenChange,
  conversationId,
  groupName,
  groupAvatarUrl,
  onGroupUpdated,
}: GroupAdminSheetProps) {
  const { user } = useAuth();
  const { contacts } = useContacts();
  const { toast } = useToast();

  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // Edit mode states
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState(groupName);
  const [savingName, setSavingName] = useState(false);

  // Photo upload
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Add member
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [addingMember, setAddingMember] = useState<string | null>(null);

  // Confirm dialog
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    action: () => Promise<void>;
  } | null>(null);

  useEffect(() => {
    if (open && conversationId) {
      fetchParticipants();
      checkAdminStatus();
    }
  }, [open, conversationId]);

  useEffect(() => {
    setNewName(groupName);
  }, [groupName]);

  const fetchParticipants = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('conversation_participants')
        .select('id, user_id, role')
        .eq('conversation_id', conversationId);

      if (error) throw error;

      const { data: profiles, error: profileError } = await supabase
        .from('public_profiles').select('id, display_name, username, avatar_url')
        .in('id', (data ?? []).map(participant => participant.user_id));
      if (profileError) throw profileError;
      const profileMap = new Map((profiles ?? []).map(profile => [profile.id, profile]));
      const mapped = (data ?? []).map(participant => ({
        id: participant.id,
        user_id: participant.user_id,
        role: participant.role as 'admin' | 'member',
        profile: profileMap.get(participant.user_id) ?? { id: participant.user_id, display_name: 'Utilizador', username: '', avatar_url: null },
      }));

      // Sort: admins first, then alphabetically
      mapped.sort((a, b) => {
        if (a.role === 'admin' && b.role !== 'admin') return -1;
        if (a.role !== 'admin' && b.role === 'admin') return 1;
        return (a.profile.display_name ?? '').localeCompare(b.profile.display_name ?? '');
      });

      setParticipants(mapped);
    } catch (err) {
      console.error('Error fetching participants:', err);
    } finally {
      setLoading(false);
    }
  };

  const checkAdminStatus = async () => {
    if (!user) return;
    const { data } = await supabase.rpc('is_group_admin', {
      _user_id: user.id,
      _conversation_id: conversationId,
    });
    setIsAdmin(data === true);
  };

  const handleUpdateName = async () => {
    if (!newName.trim()) return;
    setSavingName(true);
    try {
      const { data, error } = await supabase.rpc('update_group_info', {
        _conversation_id: conversationId,
        _name: newName.trim(),
      });

      if (error) throw error;
      const result = data as { success: boolean; error?: string };
      if (!result.success) {
        toast({ title: 'Erro', description: result.error, variant: 'destructive' });
        return;
      }

      toast({ title: 'Nome do grupo atualizado' });
      setEditingName(false);
      onGroupUpdated();
    } catch (err) {
      toast({ title: 'Erro', description: err instanceof Error ? err.message : String(err), variant: 'destructive' });
    } finally {
      setSavingName(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Ficheiro muito grande', description: 'Máximo 5MB', variant: 'destructive' });
      return;
    }

    setUploadingPhoto(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `group-${conversationId}-${Date.now()}.${fileExt}`;
      const filePath = `group-avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);

      const { data, error } = await supabase.rpc('update_group_info', {
        _conversation_id: conversationId,
        _avatar_url: urlData.publicUrl,
      });

      if (error) throw error;
      const result = data as { success: boolean; error?: string };
      if (!result.success) {
        toast({ title: 'Erro', description: result.error, variant: 'destructive' });
        return;
      }

      toast({ title: 'Foto do grupo atualizada' });
      onGroupUpdated();
    } catch (err) {
      toast({ title: 'Erro', description: err instanceof Error ? err.message : String(err), variant: 'destructive' });
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleAddMember = async (userId: string) => {
    setAddingMember(userId);
    try {
      const { data, error } = await supabase.rpc('add_group_member', {
        _conversation_id: conversationId,
        _user_id: userId,
      });

      if (error) throw error;
      const result = data as { success: boolean; error?: string };
      if (!result.success) {
        toast({ title: 'Erro', description: result.error, variant: 'destructive' });
        return;
      }

      toast({ title: 'Membro adicionado' });
      fetchParticipants();
      onGroupUpdated();
    } catch (err) {
      toast({ title: 'Erro', description: err instanceof Error ? err.message : String(err), variant: 'destructive' });
    } finally {
      setAddingMember(null);
    }
  };

  const handleRemoveMember = async (userId: string, displayName: string) => {
    setConfirmDialog({
      open: true,
      title: 'Remover membro',
      description: `Tens a certeza que queres remover ${displayName} do grupo?`,
      action: async () => {
        try {
          const { data, error } = await supabase.rpc('remove_group_member', {
            _conversation_id: conversationId,
            _user_id: userId,
          });

          if (error) throw error;
          const result = data as { success: boolean; error?: string };
          if (!result.success) {
            toast({ title: 'Erro', description: result.error, variant: 'destructive' });
            return;
          }

          toast({ title: 'Membro removido' });
          fetchParticipants();
          onGroupUpdated();
        } catch (err) {
          toast({ title: 'Erro', description: err instanceof Error ? err.message : String(err), variant: 'destructive' });
        }
      },
    });
  };

  const handleSetRole = async (userId: string, role: 'admin' | 'member', displayName: string) => {
    const action = role === 'admin' ? 'promover a admin' : 'remover como admin';
    setConfirmDialog({
      open: true,
      title: role === 'admin' ? 'Promover a admin' : 'Remover admin',
      description: `Tens a certeza que queres ${action} ${displayName}?`,
      action: async () => {
        try {
          const { data, error } = await supabase.rpc('set_member_role', {
            _conversation_id: conversationId,
            _user_id: userId,
            _role: role,
          });

          if (error) throw error;
          const result = data as { success: boolean; error?: string };
          if (!result.success) {
            toast({ title: 'Erro', description: result.error, variant: 'destructive' });
            return;
          }

          toast({ title: role === 'admin' ? 'Membro promovido a admin' : 'Admin removido' });
          fetchParticipants();
        } catch (err) {
          toast({ title: 'Erro', description: err instanceof Error ? err.message : String(err), variant: 'destructive' });
        }
      },
    });
  };

  // Filter contacts not in group for add member
  const participantIds = new Set(participants.map((p) => p.user_id));
  const availableContacts = contacts.filter(
    (c) => !participantIds.has(c.contact_user_id) && 
           (c.profile?.display_name?.toLowerCase().includes(memberSearch.toLowerCase()) ||
            c.profile?.username?.toLowerCase().includes(memberSearch.toLowerCase()))
  );

  const memberCount = participants.length;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0">
          <SheetHeader className="p-4 border-b border-border">
            <SheetTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Administrar Grupo
            </SheetTitle>
          </SheetHeader>

          <ScrollArea className="h-[calc(100vh-80px)]">
            <div className="p-4 space-y-6">
              {/* Group Photo */}
              <div className="flex flex-col items-center gap-4">
                <div className="relative">
                  <Avatar className="w-24 h-24">
                    <AvatarImage src={groupAvatarUrl || undefined} />
                    <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                      {groupName?.slice(0, 2).toUpperCase() || 'GP'}
                    </AvatarFallback>
                  </Avatar>
                  {isAdmin && (
                    <label className="absolute bottom-0 right-0 p-2 bg-primary rounded-full cursor-pointer hover:bg-primary/90 transition-colors">
                      {uploadingPhoto ? (
                        <Loader2 className="w-4 h-4 text-primary-foreground animate-spin" />
                      ) : (
                        <Camera className="w-4 h-4 text-primary-foreground" />
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handlePhotoUpload}
                        disabled={uploadingPhoto}
                      />
                    </label>
                  )}
                </div>

                {/* Group Name */}
                {editingName ? (
                  <div className="flex items-center gap-2 w-full max-w-xs">
                    <Input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="text-center"
                      maxLength={100}
                      autoFocus
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={handleUpdateName}
                      disabled={savingName || !newName.trim()}
                    >
                      {savingName ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        setEditingName(false);
                        setNewName(groupName);
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-semibold">{groupName}</h2>
                    {isAdmin && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => setEditingName(true)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                )}

                <p className="text-sm text-muted-foreground">
                  {memberCount} {memberCount === 1 ? 'membro' : 'membros'}
                </p>
              </div>

              {/* Add Member Button */}
              {isAdmin && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setAddMemberOpen(true)}
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  Adicionar Membro
                </Button>
              )}

              {/* Members List */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground px-1">
                  Membros
                </h3>

                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="space-y-1">
                    {participants.map((participant) => (
                      <motion.div
                        key={participant.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="w-10 h-10">
                            <AvatarImage src={participant.profile.avatar_url || undefined} />
                            <AvatarFallback className="bg-primary/10 text-primary">
                              {participant.profile.display_name.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                {participant.profile.display_name}
                                {participant.user_id === user?.id && ' (Tu)'}
                              </span>
                              {participant.role === 'admin' && (
                                <Badge variant="secondary" className="text-xs gap-1">
                                  <Crown className="w-3 h-3" />
                                  Admin
                                </Badge>
                              )}
                            </div>
                            <span className="text-sm text-muted-foreground">
                              @{participant.profile.username}
                            </span>
                          </div>
                        </div>

                        {isAdmin && participant.user_id !== user?.id && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {participant.role === 'member' ? (
                                <DropdownMenuItem
                                  onClick={() =>
                                    handleSetRole(
                                      participant.user_id,
                                      'admin',
                                      participant.profile.display_name
                                    )
                                  }
                                >
                                  <Shield className="w-4 h-4 mr-2" />
                                  Promover a Admin
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  onClick={() =>
                                    handleSetRole(
                                      participant.user_id,
                                      'member',
                                      participant.profile.display_name
                                    )
                                  }
                                >
                                  <Shield className="w-4 h-4 mr-2" />
                                  Remover Admin
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() =>
                                  handleRemoveMember(
                                    participant.user_id,
                                    participant.profile.display_name
                                  )
                                }
                              >
                                <UserMinus className="w-4 h-4 mr-2" />
                                Remover do Grupo
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Add Member Sheet */}
      <Sheet open={addMemberOpen} onOpenChange={setAddMemberOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0">
          <SheetHeader className="p-4 border-b border-border">
            <SheetTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5" />
              Adicionar Membro
            </SheetTitle>
          </SheetHeader>

          <div className="p-4">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar Links..."
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                className="pl-10"
              />
            </div>

            <ScrollArea className="h-[calc(100vh-200px)]">
              <div className="space-y-1">
                {availableContacts.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    {memberSearch ? 'Nenhum Link encontrado' : 'Todos os Links já estão no grupo'}
                  </p>
                ) : (
                  availableContacts.map((contact) => (
                    <motion.div
                      key={contact.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="w-10 h-10">
                          <AvatarImage src={contact.profile?.avatar_url || undefined} />
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {contact.profile?.display_name?.slice(0, 2).toUpperCase() || '??'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <span className="font-medium">{contact.profile?.display_name}</span>
                          <p className="text-sm text-muted-foreground">
                            @{contact.profile?.username}
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleAddMember(contact.contact_user_id)}
                        disabled={addingMember === contact.contact_user_id}
                      >
                        {addingMember === contact.contact_user_id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <UserPlus className="w-4 h-4" />
                        )}
                      </Button>
                    </motion.div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </SheetContent>
      </Sheet>

      {/* Confirmation Dialog */}
      <AlertDialog
        open={confirmDialog?.open}
        onOpenChange={(open) => !open && setConfirmDialog(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDialog?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmDialog?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                confirmDialog?.action();
                setConfirmDialog(null);
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
