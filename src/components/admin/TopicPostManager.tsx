import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { 
  Hash, 
  Search, 
  Plus, 
  Check, 
  Loader2,
  FileText,
  Image as ImageIcon,
  Video,
  PlusCircle,
  Pencil,
  Trash2,
  MoreHorizontal,
  TrendingUp,
  GripVertical
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { CreateTopicDialog } from './CreateTopicDialog';
import { EditTopicDialog } from './EditTopicDialog';

interface Topic {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  is_trending: boolean;
  display_order: number;
}

interface Post {
  id: string;
  content: string | null;
  type: string;
  created_at: string;
  user_id: string;
  profile?: {
    display_name: string;
    avatar_url: string | null;
  };
  topics: string[];
}

// Sortable Topic Item Component
function SortableTopicItem({ 
  topic, 
  postCount,
  getTopicName,
  onEdit,
  onDelete
}: { 
  topic: Topic;
  postCount: number;
  getTopicName: (topic: Topic) => string;
  onEdit: (topic: Topic) => void;
  onDelete: (topic: Topic) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: topic.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className={cn(
        "flex items-center gap-1",
        isDragging && "z-50"
      )}
    >
      <Badge 
        variant="outline"
        className="gap-1 pr-1 cursor-default"
      >
        <button
          className="cursor-grab hover:bg-secondary rounded p-0.5 -ml-1 touch-none"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="w-3 h-3 text-muted-foreground" />
        </button>
        {topic.image_url && (
          <img 
            src={topic.image_url} 
            alt="" 
            className="w-4 h-4 rounded object-cover" 
          />
        )}
        {topic.is_trending && (
          <TrendingUp className="w-3 h-3 text-primary" />
        )}
        <span>{getTopicName(topic)}</span>
        <span className="ml-1 text-muted-foreground">({postCount})</span>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-5 w-5 ml-1 hover:bg-secondary"
            >
              <MoreHorizontal className="w-3 h-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(topic)}>
              <Pencil className="w-4 h-4 mr-2" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => onDelete(topic)}
              className="text-destructive"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </Badge>
    </div>
  );
}

interface Post {
  id: string;
  content: string | null;
  type: string;
  created_at: string;
  user_id: string;
  profile?: {
    display_name: string;
    avatar_url: string | null;
  };
  topics: string[];
}

export function TopicPostManager() {
  const { t } = useTranslation();
  const [loadError, setLoadError] = useState(false);
  const [postCounts, setPostCounts] = useState<Record<string, number>>({});
  const [topics, setTopics] = useState<Topic[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingTopics, setLoadingTopics] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [createTopicOpen, setCreateTopicOpen] = useState(false);
  const [editTopicOpen, setEditTopicOpen] = useState(false);
  const [topicToEdit, setTopicToEdit] = useState<Topic | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [topicToDelete, setTopicToDelete] = useState<Topic | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    fetchTopics();
    fetchPosts();
    const refresh = () => { fetchTopics(); };
    window.addEventListener('admin-topics-changed', refresh);
    return () => window.removeEventListener('admin-topics-changed', refresh);
  }, []);

  const fetchTopics = async () => {
    try {
      const { data, error } = await supabase
        .from('discover_topics')
        .select('id, name, slug, description, image_url, is_trending, display_order')
        .order('display_order');

      if (error) throw error;
      const { data: counts, error: countError } = await supabase.rpc('admin_topic_counts');
      if (countError) throw countError;
      setPostCounts(Object.fromEntries((counts || []).map(c => [c.topic_id, Number(c.post_count)])));
      setTopics(data || []);
    } catch (error) {
      setLoadError(true);
      console.error('Error fetching topics:', error);
    } finally {
      setLoadingTopics(false);
    }
  };

  const fetchPosts = async () => {
    try {
      // Fetch posts with their profiles
      const { data: postsData, error: postsError } = await supabase
        .from('posts')
        .select(`
          id,
          content,
          type,
          created_at,
          user_id
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (postsError) throw postsError;

      // Fetch profiles for all posts
      const userIds = [...new Set((postsData || []).map(p => p.user_id))];
      const { data: profiles, error: profilesError } = await supabase
        .from('public_profiles')
        .select('id, display_name, avatar_url')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      // Fetch post_topics for all posts
      const postIds = (postsData || []).map(p => p.id);
      const { data: postTopics, error: topicsError } = await supabase
        .from('post_topics')
        .select('post_id, topic_id')
        .in('post_id', postIds);

      if (topicsError) throw topicsError;

      // Map topics to posts
      const topicsByPost = (postTopics || []).reduce((acc, pt) => {
        if (!acc[pt.post_id]) acc[pt.post_id] = [];
        acc[pt.post_id].push(pt.topic_id);
        return acc;
      }, {} as Record<string, string[]>);

      // Map profiles to posts
      const profilesMap = (profiles || []).reduce((acc, p) => {
        acc[p.id] = p;
        return acc;
      }, {} as Record<string, { display_name: string; avatar_url: string | null }>);

      const enrichedPosts: Post[] = (postsData || []).map(post => ({
        ...post,
        profile: profilesMap[post.user_id],
        topics: topicsByPost[post.id] || [],
      }));

      setPosts(enrichedPosts);
    } catch (error) {
      setLoadError(true);
      console.error('Error fetching posts:', error);
    } finally {
      setLoadingPosts(false);
    }
  };

  const filteredPosts = posts.filter(post => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      post.content?.toLowerCase().includes(query) ||
      post.profile?.display_name.toLowerCase().includes(query)
    );
  });

  const openEditDialog = (post: Post) => {
    setSelectedPost(post);
    setSelectedTopics(post.topics);
    setDialogOpen(true);
  };

  const toggleTopic = (topicId: string) => {
    setSelectedTopics(prev => 
      prev.includes(topicId)
        ? prev.filter(id => id !== topicId)
        : [...prev, topicId]
    );
  };

  const saveTopics = async () => {
    if (!selectedPost) return;

    setSaving(true);
    try {
      const { error } = await supabase.rpc('admin_topic_action', { p_action: 'assign', p_id: selectedPost.id, p_ids: selectedTopics });
      if (error) throw error;
      await fetchTopics();

      // Update local state
      setPosts(prev =>
        prev.map(p =>
          p.id === selectedPost.id ? { ...p, topics: selectedTopics } : p
        )
      );

      toast.success('Tópicos atualizados com sucesso!');
      setDialogOpen(false);
    } catch (error) {
      console.error('Error saving topics:', error);
      toast.error('Erro ao guardar tópicos');
    } finally {
      setSaving(false);
    }
  };

  const handleEditTopic = (topic: Topic) => {
    setTopicToEdit(topic);
    setEditTopicOpen(true);
  };

  const handleDeleteTopic = (topic: Topic) => {
    setTopicToDelete(topic);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteTopic = async () => {
    if (!topicToDelete) return;

    setDeleting(true);
    try {
      const { error } = await supabase.rpc('admin_topic_action', { p_action: 'delete', p_id: topicToDelete.id });
      if (error) throw error;

      toast.success('Tópico eliminado com sucesso!');
      setDeleteDialogOpen(false);
      setTopicToDelete(null);
      fetchTopics();
      fetchPosts(); // Refresh posts to update topic associations
    } catch (error) {
      console.error('Error deleting topic:', error);
      toast.error('Erro ao eliminar tópico');
    } finally {
      setDeleting(false);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    if (savingOrder) return;
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = topics.findIndex((t) => t.id === active.id);
      const newIndex = topics.findIndex((t) => t.id === over.id);

      const newTopics = arrayMove(topics, oldIndex, newIndex);
      setTopics(newTopics);

      // Save new order to database
      setSavingOrder(true);
      try {
        const { error } = await supabase.rpc('admin_topic_action', { p_action: 'reorder', p_ids: newTopics.map(t => t.id) });
        if (error) throw error;

        toast.success('Ordem dos tópicos atualizada!');
      } catch (error) {
        console.error('Error saving order:', error);
        toast.error('Erro ao guardar ordem');
        // Revert on error
        fetchTopics();
      } finally {
        setSavingOrder(false);
      }
    }
  };

  const getTopicById = (id: string) => topics.find(t => t.id === id);

  const getTopicName = (topic: Topic) => {
    const key = `topics.${topic.name}`;
    const translated = t(key);
    return translated !== key ? translated : topic.name;
  };

  const getPostTypeIcon = (type: string) => {
    switch (type) {
      case 'photo':
        return <ImageIcon className="w-4 h-4 text-green-500" />;
      case 'video':
        return <Video className="w-4 h-4 text-purple-500" />;
      default:
        return <FileText className="w-4 h-4 text-blue-500" />;
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Hash className="w-5 h-5" />
                Gestão de Tópicos em Posts
              </CardTitle>
              <CardDescription>
                Associar tópicos a posts para melhor descoberta
              </CardDescription>
            </div>
            <Button 
              onClick={() => setCreateTopicOpen(true)}
              className="gap-2"
            >
              <PlusCircle className="w-4 h-4" />
              Novo Tópico
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadError && <div role="alert">Não foi possível carregar todos os dados. <Button variant="outline" onClick={() => { setLoadError(false); fetchTopics(); fetchPosts(); }}>Tentar novamente</Button></div>}
          <p className="text-xs text-muted-foreground">São apresentados os 100 posts mais recentes. As contagens dos tópicos incluem todas as associações.</p>
          {/* Drag-and-drop Topics */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <GripVertical className="w-4 h-4" />
                Arrasta para reordenar os tópicos
              </p>
              {savingOrder && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  A guardar ordem...
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {loadingTopics ? (
                <div className="animate-pulse flex gap-2">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-8 w-28 bg-muted rounded-full" />
                  ))}
                </div>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={topics.map(t => t.id)}
                    strategy={horizontalListSortingStrategy}
                  >
                    {topics.map(topic => {
                      const count = postCounts[topic.id] ?? 0;
                      return (
                        <SortableTopicItem
                          key={topic.id}
                          topic={topic}
                          postCount={count}
                          getTopicName={getTopicName}
                          onEdit={handleEditTopic}
                          onDelete={handleDeleteTopic}
                        />
                      );
                    })}
                  </SortableContext>
                </DndContext>
              )}
            </div>
          </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar posts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Posts List */}
        <ScrollArea className="h-[400px]">
          {loadingPosts ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-2">
              {filteredPosts.map(post => (
                <motion.div
                  key={post.id}
                  className="p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => openEditDialog(post)}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                >
                  <div className="flex items-start gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={post.profile?.avatar_url || undefined} />
                      <AvatarFallback>
                        {post.profile?.display_name?.[0]?.toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm truncate">
                          {post.profile?.display_name || 'Utilizador'}
                        </span>
                        {getPostTypeIcon(post.type)}
                        <span className="text-xs text-muted-foreground ml-auto">
                          {new Date(post.created_at).toLocaleDateString('pt')}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {post.content || '(Sem texto)'}
                      </p>
                      {post.topics.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {post.topics.map(topicId => {
                            const topic = getTopicById(topicId);
                            if (!topic) return null;
                            return (
                              <Badge 
                                key={topicId}
                                variant="secondary"
                                className="text-xs gap-1 bg-primary/10 text-primary"
                              >
                                <span>{getTopicName(topic)}</span>
                              </Badge>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <Button variant="ghost" size="icon" className="shrink-0">
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </motion.div>
              ))}
              {!loadError && filteredPosts.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Nenhum post encontrado</p>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        {/* Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Editar Tópicos do Post</DialogTitle>
              <DialogDescription>
                Seleciona os tópicos para associar a este post
              </DialogDescription>
            </DialogHeader>
            
            {selectedPost && (
              <div className="space-y-4">
                {/* Post preview */}
                <div className="p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={selectedPost.profile?.avatar_url || undefined} />
                      <AvatarFallback>
                        {selectedPost.profile?.display_name?.[0]?.toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium text-sm">
                      {selectedPost.profile?.display_name || 'Utilizador'}
                    </span>
                    {getPostTypeIcon(selectedPost.type)}
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {selectedPost.content || '(Sem texto)'}
                  </p>
                </div>

                {/* Topics grid */}
                <div className="grid grid-cols-2 gap-2">
                  {topics.map(topic => {
                    const isSelected = selectedTopics.includes(topic.id);
                    return (
                      <button
                        key={topic.id}
                        className={cn(
                          "flex items-center gap-2 p-3 rounded-lg border transition-all",
                          isSelected
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border hover:bg-muted"
                        )}
                        onClick={() => toggleTopic(topic.id)}
                      >
                        {topic.image_url && (
                          <img src={topic.image_url} alt="" className="w-6 h-6 rounded object-cover" />
                        )}
                        <span className="text-sm font-medium flex-1 text-left">
                          {getTopicName(topic)}
                        </span>
                        {isSelected && <Check className="w-4 h-4" />}
                      </button>
                    );
                  })}
                </div>

                {/* Save button */}
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={saveTopics} disabled={saving}>
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        A guardar...
                      </>
                    ) : (
                      'Guardar Tópicos'
                    )}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>

    <CreateTopicDialog 
      open={createTopicOpen} 
      onOpenChange={setCreateTopicOpen}
      onTopicCreated={fetchTopics}
    />

    <EditTopicDialog
      open={editTopicOpen}
      onOpenChange={setEditTopicOpen}
      topic={topicToEdit}
      onTopicUpdated={fetchTopics}
    />

    <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Eliminar Tópico</AlertDialogTitle>
          <AlertDialogDescription>
            Tens a certeza que queres eliminar o tópico "{topicToDelete?.name}"? 
            Esta ação irá remover o tópico de todos os posts associados e não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction 
            onClick={confirmDeleteTopic}
            disabled={deleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                A eliminar...
              </>
            ) : (
              'Eliminar'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>
  );
}
