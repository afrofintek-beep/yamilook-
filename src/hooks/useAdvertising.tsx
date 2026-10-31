import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

// Types - Updated for MVP (no radius targeting, privacy-preserving)
export interface BusinessProfile {
  id: string;
  user_id: string;
  business_name: string;
  business_category: string | null;
  description: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  neighborhood: string | null;
  latitude: number | null;
  longitude: number | null;
  default_market_id: string | null;
  is_verified: boolean;
  is_active: boolean;
  credit_balance: number;
  created_at: string;
  updated_at: string;
}

export interface Advertisement {
  id: string;
  business_id: string;
  ad_type: 'promoted_post' | 'business_profile' | 'sponsored_story';
  status: 'draft' | 'pending_review' | 'active' | 'paused' | 'completed' | 'rejected';
  post_id: string | null;
  title: string | null;
  description: string | null;
  media_url: string | null;
  call_to_action: string | null;
  cta_url: string | null;
  // Simplified targeting - market-based only
  target_market_id: string | null;
  target_city: string | null;
  target_neighborhood: string | null;
  target_age_min: number | null;
  target_age_max: number | null;
  target_gender: string[] | null;
  daily_budget: number;
  total_budget: number;
  spent_credits: number;
  cost_per_impression: number;
  cost_per_click: number;
  starts_at: string;
  ends_at: string | null;
  impressions: number;
  clicks: number;
  engagement_count: number;
  created_at: string;
  business?: Partial<BusinessProfile> | null;
}

export interface LocationMarket {
  id: string;
  country_code: string;
  city: string;
  neighborhood: string | null;
  display_name: string;
  latitude: number;
  longitude: number;
  is_active: boolean;
}

export interface CreditTransaction {
  id: string;
  business_id: string;
  transaction_type: 'purchase' | 'spend' | 'refund' | 'bonus' | 'adjustment';
  amount: number;
  balance_after: number;
  description: string | null;
  created_at: string;
}

export interface AdDailyStats {
  id: string;
  ad_id: string;
  stat_date: string;
  market_id: string | null;
  city: string | null;
  neighborhood: string | null;
  impressions: number;
  clicks: number;
  unique_viewers: number;
  credits_spent: number;
}

// Feed insertion rules
export const AD_FEED_RULES = {
  POSTS_BETWEEN_ADS: 8, // Insert 1 ad every 8-10 posts
  MAX_AD_PERCENTAGE: 0.12, // Max 10-12% of feed can be ads
  NEVER_CONSECUTIVE: true, // Never show two ads in a row
};

export function useAdvertising() {
  const { user } = useAuth();
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null);
  const [advertisements, setAdvertisements] = useState<Advertisement[]>([]);
  const [locationMarkets, setLocationMarkets] = useState<LocationMarket[]>([]);
  const [creditTransactions, setCreditTransactions] = useState<CreditTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch business profile
  const fetchBusinessProfile = useCallback(async () => {
    if (!user?.id) return null;
    
    const { data, error } = await supabase
      .from('business_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching business profile:', error);
    }
    
    if (data) {
      setBusinessProfile(data as BusinessProfile);
    }
    return data as BusinessProfile | null;
  }, [user?.id]);

  // Create business profile
  const createBusinessProfile = async (profile: Partial<BusinessProfile>) => {
    if (!user?.id) return null;
    
    const { data, error } = await supabase
      .from('business_profiles')
      .insert({
        user_id: user.id,
        business_name: profile.business_name || 'Meu Negócio',
        business_category: profile.business_category,
        description: profile.description,
        logo_url: profile.logo_url,
        phone: profile.phone,
        email: profile.email,
        website: profile.website,
        address: profile.address,
        city: profile.city,
        neighborhood: profile.neighborhood,
        latitude: profile.latitude,
        longitude: profile.longitude,
        default_market_id: profile.default_market_id,
        credit_balance: 500, // Free starter credits
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error creating business profile:', error);
      toast.error('Erro ao criar perfil de negócio');
      return null;
    }
    
    // Record bonus credits transaction
    if (data) {
      await supabase.from('credit_transactions').insert({
        business_id: data.id,
        transaction_type: 'bonus',
        amount: 500,
        balance_after: 500,
        description: 'Créditos de boas-vindas',
      });
    }
    
    setBusinessProfile(data as BusinessProfile);
    toast.success('Perfil de negócio criado com sucesso!');
    return data as BusinessProfile;
  };

  // Update business profile
  const updateBusinessProfile = async (updates: Partial<BusinessProfile>) => {
    if (!businessProfile?.id) return null;
    
    const { data, error } = await supabase
      .from('business_profiles')
      .update(updates)
      .eq('id', businessProfile.id)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating business profile:', error);
      toast.error('Erro ao atualizar perfil');
      return null;
    }
    
    setBusinessProfile(data as BusinessProfile);
    toast.success('Perfil atualizado!');
    return data as BusinessProfile;
  };

  // Fetch advertisements with business profile data
  const fetchAdvertisements = useCallback(async () => {
    if (!businessProfile?.id) return [];
    
    const { data, error } = await supabase
      .from('advertisements')
      .select(`
        *,
        business:business_profiles!advertisements_business_id_fkey(
          id,
          business_name,
          business_category,
          description,
          logo_url,
          cover_image_url,
          city,
          neighborhood,
          phone,
          website,
          is_verified
        )
      `)
      .eq('business_id', businessProfile.id)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching advertisements:', error);
      return [];
    }
    
    setAdvertisements((data || []) as Advertisement[]);
    return (data || []) as Advertisement[];
  }, [businessProfile?.id]);

  // Create advertisement - simplified targeting
  const createAdvertisement = async (ad: Partial<Advertisement>) => {
    if (!businessProfile?.id) {
      toast.error('Crie primeiro um perfil de negócio');
      return null;
    }
    
    // Get market details if market_id provided
    let marketCity = ad.target_city;
    let marketNeighborhood = ad.target_neighborhood;
    
    if (ad.target_market_id) {
      const market = locationMarkets.find(m => m.id === ad.target_market_id);
      if (market) {
        marketCity = market.city;
        marketNeighborhood = market.neighborhood;
      }
    }
    
    const { data, error } = await supabase
      .from('advertisements')
      .insert({
        business_id: businessProfile.id,
        ad_type: ad.ad_type || 'promoted_post',
        status: 'draft',
        post_id: ad.post_id,
        title: ad.title,
        description: ad.description,
        media_url: ad.media_url,
        call_to_action: ad.call_to_action,
        cta_url: ad.cta_url,
        target_market_id: ad.target_market_id || businessProfile.default_market_id,
        target_city: marketCity || businessProfile.city,
        target_neighborhood: marketNeighborhood || businessProfile.neighborhood,
        daily_budget: ad.daily_budget || 100,
        total_budget: ad.total_budget || 500,
        starts_at: ad.starts_at || new Date().toISOString(),
        ends_at: ad.ends_at,
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error creating advertisement:', error);
      toast.error('Erro ao criar anúncio');
      return null;
    }
    
    const newAd = data as Advertisement;
    setAdvertisements(prev => [newAd, ...prev]);
    toast.success('Anúncio criado!');
    return newAd;
  };

  // Update advertisement
  const updateAdvertisement = async (adId: string, updates: Partial<Advertisement>) => {
    const { business: _business, ...patch } = updates;
    const { data, error } = await supabase
      .from('advertisements')
      .update(patch)
      .eq('id', adId)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating advertisement:', error);
      toast.error('Erro ao atualizar anúncio');
      return null;
    }
    
    const updatedAd = data as Advertisement;
    setAdvertisements(prev => prev.map(a => a.id === adId ? updatedAd : a));
    return updatedAd;
  };

  // Submit advertisement for review
  const submitForReview = async (adId: string) => {
    if (!businessProfile) return null;
    
    const ad = advertisements.find(a => a.id === adId);
    if (!ad) return null;
    
    // Check if enough credits
    if (businessProfile.credit_balance < ad.total_budget) {
      toast.error('Créditos insuficientes');
      return null;
    }
    
    const result = await updateAdvertisement(adId, { status: 'pending_review' });
    if (result) {
      toast.success('Anúncio enviado para revisão!');
    }
    return result;
  };

  // Activate advertisement (for MVP, auto-approve)
  const activateAdvertisement = async (adId: string) => {
    if (!businessProfile) return null;
    
    const ad = advertisements.find(a => a.id === adId);
    if (!ad) return null;
    
    // Check if enough credits
    if (businessProfile.credit_balance < ad.total_budget) {
      toast.error('Créditos insuficientes');
      return null;
    }
    
    // Deduct credits from balance
    const newBalance = businessProfile.credit_balance - ad.total_budget;
    
    const { error: balanceError } = await supabase
      .from('business_profiles')
      .update({ credit_balance: newBalance })
      .eq('id', businessProfile.id);
    
    if (balanceError) {
      console.error('Error deducting credits:', balanceError);
      toast.error('Erro ao deduzir créditos');
      return null;
    }
    
    // Record transaction
    await supabase.from('credit_transactions').insert({
      business_id: businessProfile.id,
      transaction_type: 'spend',
      amount: -ad.total_budget,
      balance_after: newBalance,
      description: `Destaque: ${ad.title || 'Publicação'}`,
    });
    
    // Update local state
    setBusinessProfile(prev => prev ? { ...prev, credit_balance: newBalance } : null);
    
    const result = await updateAdvertisement(adId, { status: 'active' });
    if (result) {
      toast.success('Anúncio ativado!');
    }
    return result;
  };

  // Pause advertisement
  const pauseAdvertisement = async (adId: string) => {
    const result = await updateAdvertisement(adId, { status: 'paused' });
    if (result) {
      toast.info('Anúncio pausado');
    }
    return result;
  };

  // Delete advertisement
  const deleteAdvertisement = async (adId: string) => {
    const { error } = await supabase
      .from('advertisements')
      .delete()
      .eq('id', adId);
    
    if (error) {
      console.error('Error deleting advertisement:', error);
      toast.error('Erro ao eliminar anúncio');
      return false;
    }
    
    setAdvertisements(prev => prev.filter(a => a.id !== adId));
    toast.success('Anúncio eliminado');
    return true;
  };

  // Fetch location markets
  const fetchLocationMarkets = useCallback(async () => {
    const { data, error } = await supabase
      .from('location_markets')
      .select('*')
      .eq('is_active', true)
      .order('display_name');
    
    if (error) {
      console.error('Error fetching location markets:', error);
      return [];
    }
    
    setLocationMarkets((data || []) as LocationMarket[]);
    return (data || []) as LocationMarket[];
  }, []);

  // Find nearest market from coordinates
  const findNearestMarket = useCallback((lat: number, lng: number): LocationMarket | null => {
    if (locationMarkets.length === 0) return null;
    
    let nearestMarket: LocationMarket | null = null;
    let minDistance = Infinity;
    
    locationMarkets.forEach(market => {
      const distance = Math.sqrt(
        Math.pow(lat - market.latitude, 2) +
        Math.pow(lng - market.longitude, 2)
      );
      if (distance < minDistance) {
        minDistance = distance;
        nearestMarket = market;
      }
    });
    
    return nearestMarket;
  }, [locationMarkets]);

  // Fetch credit transactions
  const fetchCreditTransactions = useCallback(async () => {
    if (!businessProfile?.id) return [];
    
    const { data, error } = await supabase
      .from('credit_transactions')
      .select('*')
      .eq('business_id', businessProfile.id)
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (error) {
      console.error('Error fetching credit transactions:', error);
      return [];
    }
    
    setCreditTransactions((data || []) as CreditTransaction[]);
    return (data || []) as CreditTransaction[];
  }, [businessProfile?.id]);

  // Add credits (for testing/demo)
  const addCredits = async (amount: number, description = 'Créditos adicionados') => {
    if (!businessProfile?.id) return null;
    
    // Fetch current balance from database to avoid stale state issues
    const { data: currentProfile, error: fetchError } = await supabase
      .from('business_profiles')
      .select('credit_balance')
      .eq('id', businessProfile.id)
      .single();
    
    if (fetchError || !currentProfile) {
      console.error('Error fetching current balance:', fetchError);
      toast.error('Erro ao adicionar créditos');
      return null;
    }
    
    const currentBalance = currentProfile.credit_balance || 0;
    const newBalance = currentBalance + amount;
    
    // Update balance first
    const { data, error } = await supabase
      .from('business_profiles')
      .update({ credit_balance: newBalance })
      .eq('id', businessProfile.id)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating balance:', error);
      toast.error('Erro ao adicionar créditos');
      return null;
    }
    
    // Insert transaction record
    await supabase
      .from('credit_transactions')
      .insert({
        business_id: businessProfile.id,
        transaction_type: 'bonus',
        amount,
        balance_after: newBalance,
        description,
      });
    
    setBusinessProfile(data as BusinessProfile);
    toast.success(`+${amount} créditos adicionados!`);
    return data as BusinessProfile;
  };

  // Record impression - privacy-preserving (no user GPS)
  const recordImpression = async (adId: string, userMarket?: LocationMarket) => {
    if (!user?.id) return;
    
    await supabase.from('ad_impressions').insert({
      ad_id: adId,
      user_id: user.id,
      impression_type: 'view',
      market_id: userMarket?.id,
      city: userMarket?.city,
      neighborhood: userMarket?.neighborhood,
    });
  };

  // Record click
  const recordClick = async (adId: string, clickType = 'cta') => {
    if (!user?.id) return;
    
    await supabase.from('ad_clicks').insert({
      ad_id: adId,
      user_id: user.id,
      click_type: clickType,
    });
  };

  // Fetch active ads for feed (for consumers) - respecting feed rules
  const fetchActiveAdsForFeed = useCallback(async (userCity?: string, totalPosts: number = 50) => {
    // Calculate max ads based on feed rules
    const maxAds = Math.floor(totalPosts * AD_FEED_RULES.MAX_AD_PERCENTAGE);
    const limit = Math.max(1, Math.min(maxAds, Math.floor(totalPosts / AD_FEED_RULES.POSTS_BETWEEN_ADS)));
    
    let query = supabase
      .from('advertisements')
      .select(`
        *,
        business:business_profiles(*)
      `)
      .eq('status', 'active')
      .eq('ad_type', 'promoted_post')
      .lte('starts_at', new Date().toISOString());
    
    if (userCity) {
      query = query.eq('target_city', userCity);
    }
    
    const { data, error } = await query.limit(limit);
    
    if (error) {
      console.error('Error fetching active ads:', error);
      return [];
    }
    
    return (data || []) as (Advertisement & { business: BusinessProfile })[];
  }, []);

  // Fetch featured businesses (for Discover)
  const fetchFeaturedBusinesses = async (userCity?: string, limit = 6) => {
    const now = new Date().toISOString();
    
    // First try to get ads matching user city, then fallback to all active ads
    let query = supabase
      .from('advertisements')
      .select(`
        *,
        business:business_profiles(*)
      `)
      .eq('status', 'active')
      .eq('ad_type', 'business_profile')
      .lte('starts_at', now)
      .or(`ends_at.is.null,ends_at.gte.${now}`);
    
    if (userCity) {
      query = query.eq('target_city', userCity);
    }
    
    const initial = await query.limit(limit);
    let data = initial.data;
    const error = initial.error;
    
    if (error) {
      console.error('Error fetching featured businesses:', error);
      return [];
    }
    
    console.log('Fetched featured businesses:', data?.length || 0, 'for city:', userCity);
    
    // If no results for specific city, fetch all active business_profile ads
    if ((!data || data.length === 0) && userCity) {
      console.log('No businesses for city, fetching all...');
      const fallbackQuery = await supabase
        .from('advertisements')
        .select(`
          *,
          business:business_profiles(*)
        `)
        .eq('status', 'active')
        .eq('ad_type', 'business_profile')
        .lte('starts_at', now)
        .or(`ends_at.is.null,ends_at.gte.${now}`)
        .limit(limit);
      
      if (!fallbackQuery.error) {
        data = fallbackQuery.data;
        console.log('Fallback fetched:', data?.length || 0);
      }
    }
    
    return (data || []) as (Advertisement & { business: BusinessProfile })[];
  };

  // Helper: Interleave ads into feed respecting rules
  const interleaveAdsInFeed = useCallback(<T extends { id: string }>(
    posts: T[],
    ads: (Advertisement & { business: BusinessProfile })[]
  ): (T | (Advertisement & { business: BusinessProfile; isAd: true }))[] => {
    if (ads.length === 0) return posts;
    
    const result: (T | (Advertisement & { business: BusinessProfile; isAd: true }))[] = [];
    let adIndex = 0;
    let postsSinceLastAd = 0;
    
    // Calculate max ads allowed
    const maxAds = Math.floor(posts.length * AD_FEED_RULES.MAX_AD_PERCENTAGE);
    let adsInserted = 0;
    
    posts.forEach((post, index) => {
      result.push(post);
      postsSinceLastAd++;
      
      // Check if we should insert an ad
      if (
        postsSinceLastAd >= AD_FEED_RULES.POSTS_BETWEEN_ADS &&
        adIndex < ads.length &&
        adsInserted < maxAds
      ) {
        result.push({ ...ads[adIndex], isAd: true as const });
        adIndex++;
        adsInserted++;
        postsSinceLastAd = 0;
      }
    });
    
    return result;
  }, []);

  // Initial load
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([
        fetchBusinessProfile(),
        fetchLocationMarkets(),
      ]);
      setLoading(false);
    };
    
    if (user?.id) {
      init();
    }
  }, [user?.id, fetchBusinessProfile, fetchLocationMarkets]);

  // Load ads and transactions when business profile is available
  useEffect(() => {
    if (businessProfile?.id) {
      fetchAdvertisements();
      fetchCreditTransactions();
    }
  }, [businessProfile?.id, fetchAdvertisements, fetchCreditTransactions]);

  return {
    // State
    businessProfile,
    advertisements,
    locationMarkets,
    creditTransactions,
    loading,
    
    // Feed rules
    AD_FEED_RULES,
    
    // Business profile actions
    createBusinessProfile,
    updateBusinessProfile,
    fetchBusinessProfile,
    
    // Advertisement actions
    createAdvertisement,
    updateAdvertisement,
    submitForReview,
    activateAdvertisement,
    pauseAdvertisement,
    deleteAdvertisement,
    fetchAdvertisements,
    
    // Credits
    addCredits,
    fetchCreditTransactions,
    
    // Location
    findNearestMarket,
    
    // Consumer actions
    fetchActiveAdsForFeed,
    fetchFeaturedBusinesses,
    recordImpression,
    recordClick,
    interleaveAdsInFeed,
  };
}
