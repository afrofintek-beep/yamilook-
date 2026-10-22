import { isRecentlyOnline } from '@/lib/online-presence';
import { usePresenceClock } from '@/hooks/usePresenceClock';
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { 
  Users, 
  MessageSquare, 
  FileText, 
  Database, 
  RefreshCw, 
  Trash2, 
  Shield, 
  Activity,
  ArrowLeft,
  Loader2,
  UserPlus,
  Clock,
  Search,
  ShieldCheck,
  ShieldOff,
  MoreVertical,
  Ban,
  CheckCircle,
  FileCheck,
  Coins,
  Award,
  Wallet,
  ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
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
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { TopicPostManager } from '@/components/admin/TopicPostManager';
import { TopicSuggestionsManager } from '@/components/admin/TopicSuggestionsManager';
import { LiveSessionsManager } from '@/components/admin/LiveSessionsManager';
import { MvpCandidatesManager } from '@/components/admin/MvpCandidatesManager';

interface Stats {
  users: number;
  posts: number;
  conversations: number;
  messages: number;
  statuses: number;
  contacts: number;
}

interface UserProfile {
  id: string;
  display_name: string;
  username: string;
  email: string | null;
  avatar_url: string | null;
  is_online: boolean | null;
  last_seen: string | null;
  created_at: string;
  account_status: string | null;
}

interface UserWithRole extends UserProfile {
  isAdmin: boolean;
  isModerator: boolean;
}

export default function Admin() {
  const presenceNow = usePresenceClock();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  
  const [stats, setStats] = useState<Stats>({ users: 0, posts: 0, conversations: 0, messages: 0, statuses: 0, contacts: 0 });
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserWithRole[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [clearingData, setClearingData] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    action: () => Promise<void>;
  }>({ open: false, title: '', description: '', action: async () => {} });

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!adminLoading && !isAdmin && user) {
      toast.error('Acesso negado. Apenas administradores.');
      navigate('/');
    }
  }, [isAdmin, adminLoading, user, navigate]);

  useEffect(() => {
    if (isAdmin) {
      fetchStats();
      fetchUsersWithRoles();
    }
  }, [isAdmin]);

  // Filter users based on search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredUsers(users);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredUsers(
        users.filter(
          (u) =>
            u.display_name.toLowerCase().includes(query) ||
            u.username.toLowerCase().includes(query) ||
            u.email?.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, users]);

  const fetchStats = async () => {
    setLoadingStats(true);
    try {
      const [usersRes, postsRes, convsRes, msgsRes, statusRes, contactsRes] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('posts').select('*', { count: 'exact', head: true }),
        supabase.from('conversations').select('*', { count: 'exact', head: true }),
        supabase.from('messages').select('*', { count: 'exact', head: true }),
        supabase.from('statuses').select('*', { count: 'exact', head: true }),
        supabase.from('contacts').select('*', { count: 'exact', head: true }),
      ]);

      setStats({
        users: usersRes.count || 0,
        posts: postsRes.count || 0,
        conversations: convsRes.count || 0,
        messages: msgsRes.count || 0,
        statuses: statusRes.count || 0,
        contacts: contactsRes.count || 0,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    const channel = supabase.channel(`admin-presence-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, (payload) => {
        const profile = payload.new as UserProfile;
        setUsers(previous => previous.map(existing => existing.id === profile.id
          ? { ...existing, is_online: profile.is_online, last_seen: profile.last_seen } : existing));
      }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [isAdmin]);

  const fetchUsersWithRoles = async () => {
    setLoadingUsers(true);
    try {
      // Get all users
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, display_name, username, email, avatar_url, is_online, last_seen, created_at, account_status')
        .order('created_at', { ascending: false })
        .limit(100);

      if (profilesError) throw profilesError;

      // Get all admin roles
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('role', ['admin', 'moderator']);

      if (rolesError) throw rolesError;

      const adminUserIds = new Set(roles?.filter(r => r.role === 'admin').map((r) => r.user_id) || []);
      const modUserIds = new Set(roles?.filter(r => r.role === 'moderator').map((r) => r.user_id) || []);

      const usersWithRoles: UserWithRole[] = (profiles || []).map((profile) => ({
        ...profile,
        isAdmin: adminUserIds.has(profile.id),
        isModerator: modUserIds.has(profile.id),
      }));

      setUsers(usersWithRoles);
      setFilteredUsers(usersWithRoles);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Erro ao carregar utilizadores');
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleToggleAdmin = async (targetUser: UserWithRole) => {
    if (targetUser.id === user?.id) {
      toast.error('Não podes remover o teu próprio acesso de admin');
      return;
    }

    const action = targetUser.isAdmin ? 'remover admin de' : 'tornar admin';
    
    setConfirmDialog({
      open: true,
      title: targetUser.isAdmin ? 'Remover Admin' : 'Tornar Admin',
      description: `Tens a certeza que queres ${action} ${targetUser.display_name}?`,
      action: async () => {
        setActionLoading(targetUser.id);
        try {
          if (targetUser.isAdmin) {
            // Remove admin role
            const { error } = await supabase
              .from('user_roles')
              .delete()
              .eq('user_id', targetUser.id)
              .eq('role', 'admin');

            if (error) throw error;
            toast.success(`Admin removido de ${targetUser.display_name}`);
          } else {
            // Add admin role
            const { error } = await supabase
              .from('user_roles')
              .insert({ user_id: targetUser.id, role: 'admin' });

            if (error) throw error;
            toast.success(`${targetUser.display_name} é agora admin`);
          }

          // Refresh users
          await fetchUsersWithRoles();
        } catch (error) {
          console.error('Error toggling admin:', error);
          toast.error('Erro ao atualizar permissões');
        } finally {
          setActionLoading(null);
        }
      },
    });
  };

  const handleToggleModerator = async (targetUser: UserWithRole) => {
    const action = targetUser.isModerator ? 'remover moderador de' : 'tornar moderador';
    
    setConfirmDialog({
      open: true,
      title: targetUser.isModerator ? 'Remover Moderador' : 'Tornar Moderador',
      description: `Tens a certeza que queres ${action} ${targetUser.display_name}?`,
      action: async () => {
        setActionLoading(targetUser.id);
        try {
          if (targetUser.isModerator) {
            const { error } = await supabase
              .from('user_roles')
              .delete()
              .eq('user_id', targetUser.id)
              .eq('role', 'moderator');
            if (error) throw error;
            toast.success(`Moderador removido de ${targetUser.display_name}`);
          } else {
            const { error } = await supabase
              .from('user_roles')
              .insert({ user_id: targetUser.id, role: 'moderator' });
            if (error) throw error;
            toast.success(`${targetUser.display_name} é agora moderador`);
          }
          await fetchUsersWithRoles();
        } catch (error) {
          console.error('Error toggling moderator:', error);
          toast.error('Erro ao atualizar permissões');
        } finally {
          setActionLoading(null);
        }
      },
    });
  };

  const handleSeedData = async () => {
    setSeeding(true);
    try {
      const response = await supabase.functions.invoke('seed-test-users');
      
      if (response.error) {
        throw new Error(response.error.message);
      }

      const results = response.data?.results;
      toast.success('Dados de teste criados!', {
        description: `${results?.posts || 0} posts, ${results?.messages || 0} mensagens, ${results?.conversations || 0} conversas`
      });
      
      fetchStats();
      fetchUsersWithRoles();
    } catch (error) {
      console.error('Seed error:', error);
      toast.error('Erro ao criar dados de teste');
    } finally {
      setSeeding(false);
    }
  };

  const handleClearTestData = async () => {
    if (!confirm('Tens a certeza que queres apagar TODOS os dados de teste? Esta ação é irreversível.')) {
      return;
    }

    setClearingData(true);
    try {
      const { data: testUsers } = await supabase
        .from('profiles')
        .select('id')
        .like('email', '%@yamilook.test');

      if (testUsers && testUsers.length > 0) {
        const userIds = testUsers.map(u => u.id);

        await supabase.from('status_views').delete().in('viewer_id', userIds);
        await supabase.from('statuses').delete().in('user_id', userIds);
        await supabase.from('post_comments').delete().in('user_id', userIds);
        await supabase.from('post_likes').delete().in('user_id', userIds);
        await supabase.from('posts').delete().in('user_id', userIds);
        await supabase.from('messages').delete().in('sender_id', userIds);
        await supabase.from('conversation_participants').delete().in('user_id', userIds);
        await supabase.from('contacts').delete().in('user_id', userIds);

        toast.success('Dados de teste apagados!');
        fetchStats();
        fetchUsersWithRoles();
      } else {
        toast.info('Não há dados de teste para apagar');
      }
    } catch (error) {
      console.error('Clear error:', error);
      toast.error('Erro ao apagar dados de teste');
    } finally {
      setClearingData(false);
    }
  };

  if (authLoading || adminLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  const statCards = [
    { label: 'Utilizadores', value: stats.users, icon: Users, color: 'text-blue-500' },
    { label: 'Posts', value: stats.posts, icon: FileText, color: 'text-green-500' },
    { label: 'Conversas', value: stats.conversations, icon: MessageSquare, color: 'text-purple-500' },
    { label: 'Mensagens', value: stats.messages, icon: MessageSquare, color: 'text-orange-500' },
    { label: 'Statuses', value: stats.statuses, icon: Clock, color: 'text-pink-500' },
    { label: 'Links', value: stats.contacts, icon: UserPlus, color: 'text-cyan-500' },
  ];

  const adminCount = users.filter((u) => u.isAdmin).length;
  const moderatorCount = users.filter((u) => u.isModerator).length;
  const onlineCount = users.filter((u) => isRecentlyOnline(u.is_online, u.last_seen, presenceNow)).length;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-lg border-b border-border safe-top">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              size="icon" 
              onClick={() => {
                // Try to go back, fallback to home if no history
                if (window.history.length > 1) {
                  navigate(-1);
                } else {
                  navigate('/');
                }
              }}
              className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              <h1 className="text-lg font-bold">Painel de Admin</h1>
            </div>
          </div>
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
            Admin
          </Badge>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Stats Grid */}
        <motion.div 
          className="grid grid-cols-2 md:grid-cols-3 gap-3"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {statCards.map((stat) => (
            <Card key={stat.label} className="relative overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold">
                      {loadingStats ? '...' : stat.value}
                    </p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                  <stat.icon className={`w-8 h-8 ${stat.color} opacity-50`} />
                </div>
              </CardContent>
            </Card>
          ))}
        </motion.div>

        {/* Sub-painéis de gestão */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Gestão
            </CardTitle>
            <CardDescription>
              Candidaturas, monetização, certificações e pagamentos
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              { label: 'Candidaturas de criador', icon: FileCheck, to: '/admin/applications' },
              { label: 'Monetização', icon: Coins, to: '/admin/monetization' },
              { label: 'Certificações AFROLOC', icon: Award, to: '/admin/afroloc-certifications' },
              { label: 'Pagamentos (payouts)', icon: Wallet, to: '/admin/payouts' },
            ].map((item) => (
              <Button
                key={item.to}
                variant="outline"
                className="w-full justify-between gap-2"
                onClick={() => navigate(item.to)}
              >
                <span className="flex items-center gap-2">
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </span>
                <ChevronRight className="w-4 h-4 opacity-50" />
              </Button>
            ))}
          </CardContent>
        </Card>

        {/* Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              Dados de Teste
            </CardTitle>
            <CardDescription>
              Gerir dados de teste para desenvolvimento
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              onClick={handleSeedData}
              disabled={seeding}
              className="w-full gap-2"
            >
              {seeding ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              {seeding ? 'A criar...' : 'Criar/Atualizar Dados de Teste'}
            </Button>
            <Button
              variant="destructive"
              onClick={handleClearTestData}
              disabled={clearingData}
              className="w-full gap-2"
            >
              {clearingData ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              {clearingData ? 'A apagar...' : 'Apagar Dados de Teste'}
            </Button>
          </CardContent>
        </Card>

        {/* MVP Candidates Manager */}
        <MvpCandidatesManager />

        {/* Live Sessions Manager */}
        <LiveSessionsManager />

        {/* Topic Suggestions Manager */}
        <TopicSuggestionsManager />

        {/* Topic Post Manager */}
        <TopicPostManager />

        {/* Users Tab */}
        <Tabs defaultValue="users">
          <TabsList className="w-full">
            <TabsTrigger value="users" className="flex-1 gap-2">
              <Users className="w-4 h-4" />
              Utilizadores
            </TabsTrigger>
            <TabsTrigger value="activity" className="flex-1 gap-2">
              <Activity className="w-4 h-4" />
              Atividade
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="mt-4 space-y-4">
            {/* Quick Stats */}
            <div className="grid grid-cols-4 gap-2">
              <Card className="p-3 text-center">
                <p className="text-lg font-bold">{users.length}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </Card>
              <Card className="p-3 text-center">
                <p className="text-lg font-bold text-primary">{adminCount}</p>
                <p className="text-xs text-muted-foreground">Admins</p>
              </Card>
              <Card className="p-3 text-center">
                <p className="text-lg font-bold text-orange-500">{moderatorCount}</p>
                <p className="text-xs text-muted-foreground">Mods</p>
              </Card>
              <Card className="p-3 text-center">
                <p className="text-lg font-bold text-green-500">{onlineCount}</p>
                <p className="text-xs text-muted-foreground">Online</p>
              </Card>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar utilizadores..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Users List */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Gestão de Utilizadores</CardTitle>
                <CardDescription>{filteredUsers.length} utilizadores encontrados</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {loadingUsers ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="divide-y divide-border max-h-[400px] overflow-y-auto">
                    {filteredUsers.map((profile) => (
                      <div key={profile.id} className="flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors">
                        <div className="relative">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={profile.avatar_url || undefined} />
                            <AvatarFallback>
                              {profile.display_name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          {isRecentlyOnline(profile.is_online, profile.last_seen, presenceNow) && (
                            <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-background" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium truncate">{profile.display_name}</p>
                            {profile.isAdmin && (
                              <Badge variant="default" className="text-xs px-1.5 py-0">
                                <ShieldCheck className="w-3 h-3 mr-1" />
                                Admin
                              </Badge>
                            )}
                            {profile.isModerator && !profile.isAdmin && (
                              <Badge variant="outline" className="text-xs px-1.5 py-0 border-orange-500/30 text-orange-600">
                                <Shield className="w-3 h-3 mr-1" />
                                Mod
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground truncate">
                            @{profile.username}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-right mr-2">
                            <p className="text-xs text-muted-foreground">
                              {new Date(profile.created_at).toLocaleDateString('pt')}
                            </p>
                            {profile.email?.includes('@yamilook.test') && (
                              <Badge variant="secondary" className="text-xs mt-1">
                                Teste
                              </Badge>
                            )}
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8"
                                disabled={actionLoading === profile.id}
                              >
                                {actionLoading === profile.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <MoreVertical className="w-4 h-4" />
                                )}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => handleToggleAdmin(profile)}
                                disabled={profile.id === user?.id}
                              >
                                {profile.isAdmin ? (
                                  <>
                                    <ShieldOff className="w-4 h-4 mr-2" />
                                    Remover Admin
                                  </>
                                ) : (
                                  <>
                                    <ShieldCheck className="w-4 h-4 mr-2" />
                                    Tornar Admin
                                  </>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleToggleModerator(profile)}
                              >
                                {profile.isModerator ? (
                                  <>
                                    <ShieldOff className="w-4 h-4 mr-2" />
                                    Remover Moderador
                                  </>
                                ) : (
                                  <>
                                    <Shield className="w-4 h-4 mr-2" />
                                    Tornar Moderador
                                  </>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => navigate(`/profile/${profile.id}`)}
                              >
                                <Users className="w-4 h-4 mr-2" />
                                Ver Perfil
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activity" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Atividade Recente</CardTitle>
                <CardDescription>Últimas ações no sistema</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Logs de atividade em breve...</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog((prev) => ({ ...prev, open }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmDialog.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                await confirmDialog.action();
                setConfirmDialog((prev) => ({ ...prev, open: false }));
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
