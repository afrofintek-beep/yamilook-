import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { AfricanReactionType } from '@/lib/reactions';

export interface RitmoUser {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
}

export interface Ritmo {
  id: string;
  user_id: string;
  video_url: string;
  caption: string | null;
  market: string | null;
  city: string | null;
  neighborhood: string | null;
  is_promoted: boolean;
  view_count: number;
  created_at: string;
  user?: RitmoUser;
  reaction_counts?: {
    sankofa: number;
    ubuntu: number;
    djembe: number;
    shango: number;
    eish: number;
  };
  my_reaction?: AfricanReactionType | null;
  comments_count?: number;
}

// Placeholder videos for testing
const PLACEHOLDER_VIDEOS = [
  'https://assets.mixkit.co/videos/preview/mixkit-woman-dancing-happily-at-a-party-4673-large.mp4',
  'https://assets.mixkit.co/videos/preview/mixkit-dj-playing-music-at-a-party-4677-large.mp4',
  'https://assets.mixkit.co/videos/preview/mixkit-friends-with-colored-smoke-702-large.mp4',
  'https://assets.mixkit.co/videos/preview/mixkit-portrait-of-a-fashion-woman-with-silver-makeup-39875-large.mp4',
  'https://assets.mixkit.co/videos/preview/mixkit-young-woman-waving-her-arms-facing-the-sea-at-sunset-4523-large.mp4',
];

export function useRitmos() {
  const { user } = useAuth();
  const [ritmos, setRitmos] = useState<Ritmo[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentCity, setCurrentCity] = useState<string | null>(null);
  const [currentMarket, setCurrentMarket] = useState<string | null>(null);
  // Único por instância para não colidir no mesmo tópico do canal realtime.
  const instanceIdRef = useRef(Math.random().toString(36).slice(2));

  // Convert signed URL to public URL
  const toPublicUrl = useCallback((url: string): string => {
    if (!url) return url;
    
    // If it's a signed URL, convert to public URL by removing the token
    if (url.includes('/object/sign/')) {
      // Extract bucket and path from signed URL
      // Format: .../storage/v1/object/sign/bucket/path?token=...
      const match = url.match(/\/object\/sign\/([^?]+)/);
      if (match) {
        const bucketAndPath = match[1];
        // Get the base Supabase URL
        const baseUrl = url.split('/storage/')[0];
        return `${baseUrl}/storage/v1/object/public/${bucketAndPath}`;
      }
    }
    return url;
  }, []);

  // Fetch ritmos with local-first priority
  const fetchRitmos = useCallback(async (city?: string, market?: string) => {
    setLoading(true);
    try {
      let query = supabase
        .from('ritmos')
        .select(`
          *,
          profiles:public_profiles!ritmos_user_id_fkey (id, display_name, username, avatar_url)
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      // Local-first: prioritize same market, then city
      if (market) {
        query = query.or(`market.eq.${market},city.eq.${city}`);
      } else if (city) {
        query = query.eq('city', city);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Enrich with reaction counts and user's reaction
      const enrichedRitmos = await Promise.all(
        (data || []).map(async (ritmo) => {
          // Get reaction counts
          const { data: countsData } = await supabase
            .rpc('get_ritmo_reaction_counts', { p_ritmo_id: ritmo.id });

          // Get user's reaction
          let myReaction: AfricanReactionType | null = null;
          if (user) {
            const { data: reactionData } = await supabase
              .from('ritmos_reactions')
              .select('reaction_type')
              .eq('ritmo_id', ritmo.id)
              .eq('user_id', user.id)
              .maybeSingle();
            myReaction = reactionData?.reaction_type as AfricanReactionType || null;
          }

          // Get comments count
          const { count: commentsCount } = await supabase
            .from('ritmos_comments')
            .select('*', { count: 'exact', head: true })
            .eq('ritmo_id', ritmo.id);

          return {
            ...ritmo,
            // Convert signed URLs to public URLs
            video_url: toPublicUrl(ritmo.video_url),
            user: ritmo.profiles as RitmoUser,
            reaction_counts: countsData || {
              sankofa: 0,
              ubuntu: 0,
              djembe: 0,
              shango: 0,
              eish: 0,
            },
            my_reaction: myReaction,
            comments_count: commentsCount || 0,
          };
        })
      );

      setRitmos(enrichedRitmos as unknown as Ritmo[]);
    } catch (error) {
      console.error('Error fetching ritmos:', error);
      toast.error('Failed to load Ritmos');
    } finally {
      setLoading(false);
    }
  }, [user, toPublicUrl]);

  // React to a ritmo (Djembe is default on tap)
  const reactToRitmo = useCallback(async (
    ritmoId: string, 
    reactionType: AfricanReactionType = 'djembe'
  ) => {
    if (!user) {
      toast.error('Please sign in to react');
      return;
    }

    try {
      // Check if user already reacted
      const { data: existing } = await supabase
        .from('ritmos_reactions')
        .select('id, reaction_type')
        .eq('ritmo_id', ritmoId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        if (existing.reaction_type === reactionType) {
          // Remove reaction if same type
          await supabase
            .from('ritmos_reactions')
            .delete()
            .eq('id', existing.id);
        } else {
          // Update to new reaction type
          await supabase
            .from('ritmos_reactions')
            .update({ reaction_type: reactionType })
            .eq('id', existing.id);
        }
      } else {
        // Insert new reaction
        await supabase
          .from('ritmos_reactions')
          .insert({
            ritmo_id: ritmoId,
            user_id: user.id,
            reaction_type: reactionType,
          });
      }

      // Update local state
      setRitmos(prev => prev.map(r => {
        if (r.id !== ritmoId) return r;
        
        const counts = { ...r.reaction_counts! };
        
        if (existing) {
          // Decrement old reaction
          counts[existing.reaction_type as AfricanReactionType] = Math.max(0, (counts[existing.reaction_type as AfricanReactionType] || 0) - 1);
          
          if (existing.reaction_type !== reactionType) {
            // Increment new reaction
            counts[reactionType] = (counts[reactionType] || 0) + 1;
          }
        } else {
          // Increment new reaction
          counts[reactionType] = (counts[reactionType] || 0) + 1;
        }

        return {
          ...r,
          reaction_counts: counts,
          my_reaction: existing?.reaction_type === reactionType ? null : reactionType,
        };
      }));
    } catch (error) {
      console.error('Error reacting to ritmo:', error);
      toast.error('Failed to react');
    }
  }, [user]);

  // Log a view
  const logView = useCallback(async (ritmoId: string) => {
    try {
      await supabase
        .from('ritmos_views')
        .insert({
          ritmo_id: ritmoId,
          user_id: user?.id || null,
        });
    } catch (error) {
      // Silently fail for view logging
      console.error('Error logging view:', error);
    }
  }, [user]);

  // Create a new ritmo
  const createRitmo = useCallback(async (
    videoUrl: string,
    caption?: string,
    location?: { city?: string; neighborhood?: string; market?: string }
  ) => {
    if (!user) {
      toast.error('Please sign in to post');
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('ritmos')
        .insert({
          user_id: user.id,
          video_url: videoUrl,
          caption: caption || null,
          city: location?.city || null,
          neighborhood: location?.neighborhood || null,
          market: location?.market || null,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Ritmo posted!');
      fetchRitmos(currentCity || undefined, currentMarket || undefined);
      return data;
    } catch (error) {
      console.error('Error creating ritmo:', error);
      toast.error('Failed to post Ritmo');
      return null;
    }
  }, [user, currentCity, currentMarket, fetchRitmos]);

  // Delete a ritmo (owner only)
  const deleteRitmo = useCallback(async (ritmoId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('ritmos')
        .delete()
        .eq('id', ritmoId)
        .eq('user_id', user.id);

      if (error) throw error;

      setRitmos(prev => prev.filter(r => r.id !== ritmoId));
      toast.success('Ritmo eliminado');
    } catch (error) {
      console.error('Error deleting ritmo:', error);
      toast.error('Falha ao eliminar Ritmo');
    }
  }, [user]);

  // Archive a ritmo (hide from feed - for any user)
  const archiveRitmo = useCallback(async (ritmoId: string) => {
    if (!user) return;

    try {
      // Store archived ritmo in localStorage (simple client-side hide)
      const archivedKey = `archived_ritmos_${user.id}`;
      const archived = JSON.parse(localStorage.getItem(archivedKey) || '[]');
      if (!archived.includes(ritmoId)) {
        archived.push(ritmoId);
        localStorage.setItem(archivedKey, JSON.stringify(archived));
      }

      // Remove from local state
      setRitmos(prev => prev.filter(r => r.id !== ritmoId));
      toast.success('Ritmo arquivado');
    } catch (error) {
      console.error('Error archiving ritmo:', error);
      toast.error('Falha ao arquivar Ritmo');
    }
  }, [user]);

  // Seed placeholder data for testing
  const seedPlaceholders = useCallback(async () => {
    if (!user) return;

    try {
      const cities = ['Luanda', 'Benguela', 'Huambo'];
      const neighborhoods = ['Maianga', 'Ingombota', 'Maculusso', 'Prenda'];

      for (let i = 0; i < PLACEHOLDER_VIDEOS.length; i++) {
        await supabase
          .from('ritmos')
          .insert({
            user_id: user.id,
            video_url: PLACEHOLDER_VIDEOS[i],
            caption: `Ritmo ${i + 1} 🪘`,
            city: cities[i % cities.length],
            neighborhood: neighborhoods[i % neighborhoods.length],
          });
      }

      toast.success('Placeholder Ritmos created!');
      fetchRitmos();
    } catch (error) {
      console.error('Error seeding placeholders:', error);
    }
  }, [user, fetchRitmos]);

  // Initial fetch
  useEffect(() => {
    fetchRitmos();
  }, [fetchRitmos]);

  // Set up realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`ritmos-changes-${instanceIdRef.current}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ritmos' },
        () => {
          fetchRitmos(currentCity || undefined, currentMarket || undefined);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchRitmos, currentCity, currentMarket]);

  return {
    ritmos,
    loading,
    currentCity,
    currentMarket,
    setCurrentCity,
    setCurrentMarket,
    fetchRitmos,
    reactToRitmo,
    logView,
    createRitmo,
    deleteRitmo,
    archiveRitmo,
    seedPlaceholders,
  };
}
