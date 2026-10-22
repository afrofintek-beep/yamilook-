import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

export interface Roda {
  id: string;
  organizer_id: string;
  title: string;
  description: string | null;
  theme: string | null;
  cover_url: string | null;
  language: string | null;
  location: string | null;
  tags: string[] | null;
  visibility: string | null;
  status: string;
  phase: 'scheduled' | 'content' | 'qa' | 'ended';
  scheduled_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  qa_start_at: string | null;
  livekit_room_name: string | null;
  viewer_count: number;
  peak_viewers: number;
  total_palcos: number;
  total_voices: number;
  featured: boolean;
  created_at: string;
  updated_at: string;
  organizer?: {
    id: string;
    display_name: string;
    avatar_url: string | null;
    is_verified: boolean;
  };
}

export interface Palco {
  id: string;
  guide_id: string;
  roda_id: string | null;
  title: string;
  theme: string | null;
  description: string | null;
  cover_url: string | null;
  language: string;
  location: string | null;
  tags: string[];
  visibility: 'public' | 'private' | 'unlisted';
  status: 'draft' | 'scheduled' | 'live' | 'ended' | 'archived';
  presenter_title: string | null;
  max_voices_per_roda: number;
  allow_custom_voice_text: boolean;
  allow_ai_assist: boolean;
  min_price: number;
  total_voices: number;
  featured: boolean;
  created_at: string;
  updated_at: string;
  guide?: {
    id: string;
    display_name: string;
    avatar_url: string | null;
    is_verified: boolean;
  };
  roda?: Roda | null;
  voice_types?: VoiceType[];
}

export interface VoiceType {
  id: string;
  palco_id: string;
  voice_type: 'email' | 'live' | 'highlight';
  enabled: boolean;
  price: number;
  currency: string;
  delivery_description: string | null;
}

export interface Voz {
  id: string;
  roda_id: string;
  user_id: string;
  voice_type: 'email' | 'live' | 'highlight';
  custom_text: string | null;
  status: 'pending' | 'paid' | 'queued' | 'answered' | 'refunded';
  payment_ref: string | null;
  payment_method: string | null;
  amount_paid: number | null;
  currency: string;
  answered_at: string | null;
  answer_text: string | null;
  answer_audio_url: string | null;
  created_at: string;
  updated_at: string;
}

// ============= RODA HOOKS (Parent entity) =============

export function useRodasList(filters?: { status?: string; theme?: string }) {
  return useQuery({
    queryKey: ['rodas', filters],
    queryFn: async () => {
      let query = supabase
        .from('rodas')
        .select(`
          *,
          organizer:public_profiles!organizer_id(id, display_name, avatar_url, is_verified)
        `)
        .order('featured', { ascending: false })
        .order('created_at', { ascending: false });

      if (filters?.status) {
        query = query.eq('phase', filters.status);
      }
      if (filters?.theme) {
        query = query.eq('theme', filters.theme);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data as unknown as Roda[]) || [];
    },
  });
}

export function useRoda(rodaId: string | undefined) {
  return useQuery({
    queryKey: ['roda', rodaId],
    queryFn: async () => {
      if (!rodaId) return null;

      const { data, error } = await supabase
        .from('rodas')
        .select(`
          *,
          organizer:public_profiles!organizer_id(id, display_name, avatar_url, is_verified)
        `)
        .eq('id', rodaId)
        .maybeSingle();

      if (error) throw error;
      return data as unknown as Roda | null;
    },
    enabled: !!rodaId,
  });
}

export function useCreateRoda() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (roda: { title: string; description?: string; theme?: string; scheduled_at?: string; cover_url?: string; visibility?: string }) => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('rodas')
        .insert({
          organizer_id: user.id,
          title: roda.title,
          description: roda.description,
          theme: roda.theme,
          scheduled_at: roda.scheduled_at,
          cover_url: roda.cover_url,
          visibility: roda.visibility || 'public',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rodas'] });
      toast({ title: 'Roda criada com sucesso!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao criar roda', description: error.message, variant: 'destructive' });
    },
  });
}

export function useStartRoda() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (rodaId: string) => {
      const roomName = `roda-${rodaId}`;

      const { data, error } = await supabase
        .from('rodas')
        .update({
          phase: 'content',
          started_at: new Date().toISOString(),
          livekit_room_name: roomName,
        })
        .eq('id', rodaId)
        .select()
        .single();

      if (error) throw error;
      return data as unknown as Roda;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['rodas'] });
      queryClient.invalidateQueries({ queryKey: ['roda', data.id] });
      toast({ title: 'Roda iniciada!', description: 'A transmissão está ao vivo.' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao iniciar roda', description: error.message, variant: 'destructive' });
    },
  });
}

export function useStartQA() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (rodaId: string) => {
      const { data, error } = await supabase
        .from('rodas')
        .update({
          phase: 'qa',
          qa_start_at: new Date().toISOString(),
        })
        .eq('id', rodaId)
        .select()
        .single();

      if (error) throw error;
      return data as unknown as Roda;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['rodas'] });
      queryClient.invalidateQueries({ queryKey: ['roda', data.id] });
      toast({ title: 'Q&A iniciado!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao iniciar Q&A', description: error.message, variant: 'destructive' });
    },
  });
}

export function useEndRoda() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (rodaId: string) => {
      const { data, error } = await supabase
        .from('rodas')
        .update({
          phase: 'ended',
          ended_at: new Date().toISOString(),
        })
        .eq('id', rodaId)
        .select()
        .single();

      if (error) throw error;
      return data as unknown as Roda;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['rodas'] });
      queryClient.invalidateQueries({ queryKey: ['roda', data.id] });
      toast({ title: 'Roda terminada.' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao terminar roda', description: error.message, variant: 'destructive' });
    },
  });
}

// ============= PALCO HOOKS (Child entity, belongs to a Roda) =============

export function usePalcos(filters?: { status?: string; theme?: string; language?: string }) {
  return useQuery({
    queryKey: ['palcos', filters],
    queryFn: async () => {
      let query = supabase
        .from('palcos')
        .select(`
          *,
          guide:public_profiles!guide_id(id, display_name, avatar_url, is_verified),
          roda:rodas!roda_id(*)
        `)
        .eq('visibility', 'public')
        .order('featured', { ascending: false })
        .order('created_at', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.theme) {
        query = query.eq('theme', filters.theme);
      }
      if (filters?.language) {
        query = query.eq('language', filters.language);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as Palco[];
    },
  });
}

export function usePalco(palcoId: string | undefined) {
  return useQuery({
    queryKey: ['palco', palcoId],
    queryFn: async () => {
      if (!palcoId) return null;

      const { data: palco, error } = await supabase
        .from('palcos')
        .select(`
          *,
          guide:public_profiles!guide_id(id, display_name, avatar_url, is_verified),
          roda:rodas!roda_id(*)
        `)
        .eq('id', palcoId)
        .maybeSingle();

      if (error) throw error;
      if (!palco) return null;

      const { data: voiceTypes } = await supabase
        .from('palco_voice_types')
        .select('*')
        .eq('palco_id', palcoId);

      return {
        ...palco,
        voice_types: voiceTypes || [],
      } as unknown as Palco;
    },
    enabled: !!palcoId,
  });
}

export function usePalcosForRoda(rodaId: string | undefined) {
  return useQuery({
    queryKey: ['palcos-for-roda', rodaId],
    queryFn: async () => {
      if (!rodaId) return [];

      const { data, error } = await supabase
        .from('palcos')
        .select(`
          *,
          guide:public_profiles!guide_id(id, display_name, avatar_url, is_verified)
        `)
        .eq('roda_id', rodaId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as Palco[];
    },
    enabled: !!rodaId,
  });
}

export function useMyPalcos() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['my-palcos', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('palcos')
        .select(`
          *,
          roda:rodas!roda_id(*)
        `)
        .eq('guide_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as Palco[];
    },
    enabled: !!user,
  });
}

export function useCreatePalco() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (palco: Partial<Palco> & { title: string; roda_id?: string; space?: string | null }) => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('palcos')
        .insert({
          guide_id: user.id,
          roda_id: palco.roda_id || null,
          title: palco.title,
          theme: palco.theme,
          description: palco.description,
          cover_url: palco.cover_url,
          language: palco.language || 'PT',
          location: palco.location || 'Angola',
          tags: palco.tags || [],
          visibility: palco.visibility || 'public',
          presenter_title: palco.presenter_title,
          max_voices_per_roda: palco.max_voices_per_roda || 20,
          allow_custom_voice_text: palco.allow_custom_voice_text ?? true,
          allow_ai_assist: palco.allow_ai_assist ?? false,
          // MOKUBICO space this stage belongs to (quintal/sala/cozinha/quarto).
          // Null means the open Quintal by default.
          space: palco.space ?? null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-palcos'] });
      queryClient.invalidateQueries({ queryKey: ['palcos'] });
      queryClient.invalidateQueries({ queryKey: ['rodas'] });
      toast({ title: 'Palco criado com sucesso!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao criar palco', description: error.message, variant: 'destructive' });
    },
  });
}

export function useUpdatePalco() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Palco> & { id: string }) => {
      const { data, error } = await supabase
        .from('palcos')
        .update({
          title: updates.title,
          theme: updates.theme,
          description: updates.description,
          cover_url: updates.cover_url,
          language: updates.language,
          tags: updates.tags,
          visibility: updates.visibility,
          presenter_title: updates.presenter_title,
          allow_custom_voice_text: updates.allow_custom_voice_text,
          roda_id: updates.roda_id,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onMutate: async ({ id, ...updates }) => {
      // Cancel outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: ['palco', id] });
      await queryClient.cancelQueries({ queryKey: ['my-palcos'] });
      await queryClient.cancelQueries({ queryKey: ['palcos'] });

      // Snapshot previous values
      const prevPalco = queryClient.getQueryData(['palco', id]);
      const prevMyPalcos = queryClient.getQueryData(['my-palcos']);
      const prevPalcos = queryClient.getQueryData(['palcos']);

      // Optimistically update single palco cache
      queryClient.setQueryData(['palco', id], (old: Palco | undefined) =>
        old ? { ...old, ...updates } : old
      );

      // Optimistically update list caches
      const updateList = (old: Palco[] | undefined) =>
        Array.isArray(old)
          ? old.map((p) => (p.id === id ? { ...p, ...updates } : p))
          : old;
      queryClient.setQueryData(['my-palcos'], updateList);
      queryClient.setQueryData(['palcos'], updateList);

      return { prevPalco, prevMyPalcos, prevPalcos, id };
    },
    onError: (error, _vars, context) => {
      // Roll back on error
      if (context) {
        queryClient.setQueryData(['palco', context.id], context.prevPalco);
        queryClient.setQueryData(['my-palcos'], context.prevMyPalcos);
        queryClient.setQueryData(['palcos'], context.prevPalcos);
      }
      toast({ title: 'Erro ao atualizar palco', description: error.message, variant: 'destructive' });
    },
    onSettled: (_data, _error, variables) => {
      // Refetch in background to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['palco', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['my-palcos'] });
      queryClient.invalidateQueries({ queryKey: ['palcos'] });
    },
  });
}

// ============= VOZES HOOKS =============

export function useVozes(rodaId: string | undefined) {
  return useQuery({
    queryKey: ['vozes', rodaId],
    queryFn: async () => {
      if (!rodaId) return [];

      const { data, error } = await supabase
        .from('vozes')
        .select('*')
        .eq('roda_id', rodaId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Voz[];
    },
    enabled: !!rodaId,
  });
}

export function useSubmitVoz() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (voz: { roda_id: string; voice_type: 'email' | 'live' | 'highlight'; custom_text?: string }) => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('vozes')
        .insert({
          roda_id: voz.roda_id,
          user_id: user.id,
          voice_type: voz.voice_type,
          custom_text: voz.custom_text,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['vozes', variables.roda_id] });
      toast({ title: 'Voz enviada!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao enviar voz', description: error.message, variant: 'destructive' });
    },
  });
}

export function useConfirmVozPayment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ vozId, rodaId, amountPaid, currency, paymentMethod }: { vozId: string; rodaId: string; amountPaid?: number; currency?: string; paymentMethod?: string }) => {
      const { data, error } = await supabase
        .from('vozes')
        .update({
          status: 'paid',
          payment_method: paymentMethod ?? 'manual',
          ...(amountPaid !== undefined ? { amount_paid: amountPaid } : {}),
          ...(currency ? { currency } : {}),
        })
        .eq('id', vozId)
        .select()
        .single();

      if (error) throw error;
      return { ...data, rodaId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['vozes', data.rodaId] });
      toast({ title: 'Pagamento confirmado!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao confirmar pagamento', description: error.message, variant: 'destructive' });
    },
  });
}

export function useMarkVozAnswered() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ vozId, rodaId }: { vozId: string; rodaId: string }) => {
      const { data, error } = await supabase
        .from('vozes')
        .update({
          status: 'answered',
          answered_at: new Date().toISOString(),
        })
        .eq('id', vozId)
        .select()
        .single();

      if (error) throw error;
      return { ...data, rodaId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['vozes', data.rodaId] });
      toast({ title: 'Voz marcada como respondida!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao marcar voz', description: error.message, variant: 'destructive' });
    },
  });
}

export function useJoinRoda() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (rodaId: string) => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('roda_participants')
        .upsert({
          roda_id: rodaId,
          user_id: user.id,
          role: 'viewer',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, rodaId) => {
      queryClient.invalidateQueries({ queryKey: ['roda-participants', rodaId] });
    },
  });
}

// ============= PALCO REACTIONS =============

export function usePalcoReaction(palcoId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: myReaction = null } = useQuery({
    queryKey: ['palco-reaction', palcoId, user?.id],
    queryFn: async () => {
      if (!palcoId || !user) return null;
      const { data } = await supabase
        .from('palco_likes')
        .select('reaction_type')
        .eq('palco_id', palcoId)
        .eq('user_id', user.id)
        .maybeSingle();
      return (data?.reaction_type as string) || null;
    },
    enabled: !!palcoId && !!user,
  });

  const react = useMutation({
    mutationFn: async (reactionType: string) => {
      if (!palcoId || !user) throw new Error('Not authenticated');
      
      if (myReaction === reactionType) {
        const { error } = await supabase
          .from('palco_likes')
          .delete()
          .eq('palco_id', palcoId)
          .eq('user_id', user.id);
        if (error) throw error;
        return null;
      } else if (myReaction) {
        const { error } = await supabase
          .from('palco_likes')
          .update({ reaction_type: reactionType })
          .eq('palco_id', palcoId)
          .eq('user_id', user.id);
        if (error) throw error;
        return reactionType;
      } else {
        const { error } = await supabase
          .from('palco_likes')
          .insert({ palco_id: palcoId, user_id: user.id, reaction_type: reactionType });
        if (error) throw error;
        return reactionType;
      }
    },
    onMutate: async (reactionType: string) => {
      await queryClient.cancelQueries({ queryKey: ['palco-reaction', palcoId, user?.id] });
      const prev = queryClient.getQueryData(['palco-reaction', palcoId, user?.id]);
      queryClient.setQueryData(
        ['palco-reaction', palcoId, user?.id],
        myReaction === reactionType ? null : reactionType
      );
      return { prev };
    },
    onError: (_err, _vars, context) => {
      queryClient.setQueryData(['palco-reaction', palcoId, user?.id], context?.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['palco-reaction', palcoId, user?.id] });
    },
  });

  return { myReaction, react: react.mutate };
}
