import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { fetchPublicProfilesBatched } from '@/lib/public-profile-batch';
import { isRecentlyOnline } from '@/lib/online-presence';
import { usePresenceClock } from './usePresenceClock';
import { useAuth } from './useAuth';

interface Contact {
  id: string;
  user_id: string;
  contact_user_id: string;
  nickname: string | null;
  is_favorite: boolean;
  is_blocked: boolean;
  created_at: string;
  updated_at: string;
  profile?: {
    id: string;
    display_name: string;
    username: string;
    avatar_url: string | null;
    bio: string | null;
    is_online: boolean;
    last_seen: string | null;
    status_message: string | null;
    gender: string | null;
  };
}

interface FriendRequest {
  id: string;
  sender_id: string;
  receiver_id: string;
  message: string | null;
  status: 'pending' | 'accepted' | 'rejected' | 'blocked';
  created_at: string;
  updated_at: string;
  sender_profile?: {
    id: string;
    display_name: string;
    username: string;
    avatar_url: string | null;
    bio: string | null;
  };
  receiver_profile?: {
    id: string;
    display_name: string;
    username: string;
    avatar_url: string | null;
    bio: string | null;
  };
}

export function useContacts() {
  const now = usePresenceClock();
  const { user } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase.channel(`contact-presence-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profile_presence' }, (payload) => {
        const profile = payload.new as { id: string; is_online: boolean; last_seen: string | null };
        setContacts(previous => previous.map(contact => contact.profile?.id === profile.id
          ? { ...contact, profile: { ...contact.profile, is_online: profile.is_online, last_seen: profile.last_seen } } : contact));
      }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [user?.id]);

  const fetchContacts = useCallback(async () => {
    if (!user) return;

    try {
      const { data: contactsData, error: contactsError } = await supabase
        .from('contacts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (contactsError) throw contactsError;

      if (!contactsData?.length) {
        setContacts([]);
        return;
      }

      // Batch fetch all profiles at once
      const contactUserIds = contactsData.map(c => c.contact_user_id);
      const { data: profiles } = await fetchPublicProfilesBatched(contactUserIds);

      const profileMap = new Map<string, Contact['profile']>(
        (profiles ?? [])
          .filter((p): p is typeof p & { id: string } => p.id !== null)
          .map((p) => [
            p.id,
            {
              id: p.id,
              display_name: p.display_name ?? '',
              username: p.username ?? '',
              avatar_url: p.avatar_url,
              bio: p.bio,
              is_online: p.is_online ?? false,
              last_seen: p.last_seen,
              status_message: p.status_message,
              gender: null,
            },
          ])
      );

      const contactsWithProfiles: Contact[] = contactsData.map(contact => ({
        ...contact,
        is_favorite: contact.is_favorite ?? false,
        is_blocked: contact.is_blocked ?? false,
        profile: profileMap.get(contact.contact_user_id) || undefined,
      }));

      setContacts(contactsWithProfiles);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [user]);

  const fetchFriendRequests = useCallback(async () => {
    if (!user) return;

    try {
      const { data: requestsData, error: requestsError } = await supabase
        .from('friend_requests')
        .select('*')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (requestsError) throw requestsError;

      if (!requestsData?.length) {
        setFriendRequests([]);
        return;
      }

      // Collect all unique user IDs
      const userIds = [...new Set(requestsData.flatMap(r => [r.sender_id, r.receiver_id]))];

      // Batch fetch all profiles
      const { data: profiles } = await fetchPublicProfilesBatched(userIds);

      const profileMap = new Map<string, FriendRequest['sender_profile']>(
        (profiles ?? [])
          .filter((p): p is typeof p & { id: string } => p.id !== null)
          .map((p) => [
            p.id,
            {
              id: p.id,
              display_name: p.display_name ?? '',
              username: p.username ?? '',
              avatar_url: p.avatar_url,
              bio: p.bio,
            },
          ])
      );

      const requestsWithProfiles: FriendRequest[] = requestsData.map(request => ({
        ...request,
        status: request.status as FriendRequest['status'],
        sender_profile: profileMap.get(request.sender_id) || undefined,
        receiver_profile: profileMap.get(request.receiver_id) || undefined,
      }));

      setFriendRequests(requestsWithProfiles);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [user]);

  const syncContactsFromAcceptedFriendRequests = useCallback(async () => {
    if (!user) return;

    const { data: accepted, error: acceptedError } = await supabase
      .from('friend_requests')
      .select('sender_id, receiver_id')
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .eq('status', 'accepted');

    if (acceptedError) {
      console.error('Failed to load accepted friend requests:', acceptedError);
      return;
    }

    const otherIds = Array.from(
      new Set(
        (accepted || []).map((r) => (r.sender_id === user.id ? r.receiver_id : r.sender_id))
      )
    ).filter(Boolean);

    if (!otherIds.length) return;

    // See which contacts already exist
    const { data: existingContacts, error: existingContactsError } = await supabase
      .from('contacts')
      .select('contact_user_id')
      .eq('user_id', user.id)
      .in('contact_user_id', otherIds);

    if (existingContactsError) {
      console.error('Failed to check existing contacts:', existingContactsError);
      return;
    }

    const existingSet = new Set((existingContacts || []).map((c) => c.contact_user_id));
    const missing = otherIds.filter((id) => !existingSet.has(id));

    if (!missing.length) return;

    const { error: upsertError } = await supabase
      .from('contacts')
      .upsert(
        missing.map((id) => ({ user_id: user.id, contact_user_id: id })),
        { onConflict: 'user_id,contact_user_id', ignoreDuplicates: true }
      );

    if (upsertError) {
      console.error('Failed to sync contacts from friendships:', upsertError);
    }
  }, [user]);

  const loadData = useCallback(async () => {
    setLoading(true);
    await syncContactsFromAcceptedFriendRequests();
    await Promise.all([fetchContacts(), fetchFriendRequests()]);
    setLoading(false);
  }, [fetchContacts, fetchFriendRequests, syncContactsFromAcceptedFriendRequests]);
  useEffect(() => {
    loadData();
  }, [loadData]);

  type FriendRequestLite = Pick<FriendRequest, 'id' | 'sender_id' | 'receiver_id' | 'status'>;

  const acceptFriendRequestInternal = async (request: FriendRequestLite) => {
    if (!user) return { error: new Error('Not authenticated') };

    if (request.receiver_id !== user.id) {
      return { error: new Error('Not authorized to accept this request') };
    }

    // First, add MY contact (current user -> sender) - this uses "Users can insert own contacts" policy
    const { error: myContactError } = await supabase.from('contacts').insert({
      user_id: user.id,
      contact_user_id: request.sender_id,
    });

    if (myContactError) return { error: new Error(myContactError.message) };

    // Then add the reciprocal contact (sender -> current user) - uses "Users can insert reciprocal contact on friend accept"
    const { error: reciprocalError } = await supabase.from('contacts').insert({
      user_id: request.sender_id,
      contact_user_id: user.id,
    });

    if (reciprocalError) {
      // Rollback: remove my contact if reciprocal failed
      await supabase
        .from('contacts')
        .delete()
        .eq('user_id', user.id)
        .eq('contact_user_id', request.sender_id);
      return { error: new Error(reciprocalError.message) };
    }

    // Update the request status AFTER contacts are created
    const { error: updateError } = await supabase
      .from('friend_requests')
      .update({ status: 'accepted' })
      .eq('id', request.id);

    if (updateError) {
      console.error('Failed to update friend request status:', updateError);
    }

    // If both users sent pending requests to each other, remove the redundant outgoing request
    await supabase
      .from('friend_requests')
      .delete()
      .eq('sender_id', user.id)
      .eq('receiver_id', request.sender_id)
      .eq('status', 'pending');

    await loadData();
    return { error: null };
  };

  const sendFriendRequest = async (receiverId: string, message?: string) => {
    if (!user) return { error: new Error('Not authenticated') };

    // Check if a request already exists between these users (either direction)
    const { data: existingRequests, error: existingError } = await supabase
      .from('friend_requests')
      .select('id, status, sender_id, receiver_id')
      .or(
        `and(sender_id.eq.${user.id},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${user.id})`
      )
      .in('status', ['pending', 'accepted']);

    if (existingError) {
      return { error: new Error(existingError.message) };
    }

    const outgoing = (existingRequests || []).find(
      (r) => r.sender_id === user.id && r.receiver_id === receiverId
    );
    const incoming = (existingRequests || []).find(
      (r) => r.sender_id === receiverId && r.receiver_id === user.id
    );

    if ((outgoing && outgoing.status === 'accepted') || (incoming && incoming.status === 'accepted')) {
      // Heal legacy data: if friendship exists but contact row wasn't created, create it now
      await syncContactsFromAcceptedFriendRequests();
      await fetchContacts();
      return { error: new Error('You are already friends with this user') };
    }

    // If the other user already sent you a request, accept it instead of creating a duplicate "cross" request
    if (incoming && incoming.status === 'pending') {
      return await acceptFriendRequestInternal(incoming as FriendRequestLite);
    }

    if (outgoing && outgoing.status === 'pending') {
      return { error: new Error('You already sent a friend request to this user') };
    }

    const { error } = await supabase.from('friend_requests').insert({
      sender_id: user.id,
      receiver_id: receiverId,
      message: message || null,
    });

    if (!error) {
      await fetchFriendRequests();
      return { error: null };
    }

    // Map unique constraint errors to a friendlier message
    if (String(error.message).includes('friend_requests_sender_id_receiver_id_key')) {
      await fetchFriendRequests();
      return { error: new Error('You already sent a friend request to this user') };
    }

    return { error: new Error(error.message) };
  };

  const acceptFriendRequest = async (requestId: string) => {
    if (!user) return { error: new Error('Not authenticated') };

    const request = friendRequests.find((r) => r.id === requestId);
    if (!request) return { error: new Error('Request not found') };

    return await acceptFriendRequestInternal(request);
  };

  const rejectFriendRequest = async (requestId: string) => {
    if (!user) return { error: new Error('Not authenticated') };

    const { error } = await supabase
      .from('friend_requests')
      .update({ status: 'rejected' })
      .eq('id', requestId);

    if (!error) {
      await fetchFriendRequests();
    }

    return { error: error ? new Error(error.message) : null };
  };

  const cancelFriendRequest = async (requestId: string) => {
    if (!user) return { error: new Error('Not authenticated') };

    const { error } = await supabase
      .from('friend_requests')
      .delete()
      .eq('id', requestId)
      .eq('sender_id', user.id);

    if (!error) {
      await fetchFriendRequests();
    }

    return { error: error ? new Error(error.message) : null };
  };

  const removeContact = async (contactId: string) => {
    if (!user) return { error: new Error('Not authenticated') };

    const contact = contacts.find((c) => c.id === contactId);
    if (!contact) return { error: new Error('Contact not found') };

    // Remove from both sides
    const { error } = await supabase
      .from('contacts')
      .delete()
      .or(`and(user_id.eq.${user.id},contact_user_id.eq.${contact.contact_user_id}),and(user_id.eq.${contact.contact_user_id},contact_user_id.eq.${user.id})`);

    if (!error) {
      await fetchContacts();
    }

    return { error: error ? new Error(error.message) : null };
  };

  const toggleFavorite = async (contactId: string) => {
    if (!user) return { error: new Error('Not authenticated') };

    const contact = contacts.find((c) => c.id === contactId);
    if (!contact) return { error: new Error('Contact not found') };

    const { error } = await supabase
      .from('contacts')
      .update({ is_favorite: !contact.is_favorite })
      .eq('id', contactId);

    if (!error) {
      await fetchContacts();
    }

    return { error: error ? new Error(error.message) : null };
  };

  const blockContact = async (contactId: string) => {
    if (!user) return { error: new Error('Not authenticated') };

    const contact = contacts.find((c) => c.id === contactId);
    if (!contact) return { error: new Error('Contact not found') };

    // Add to blocked_users table
    const { error: blockError } = await supabase.from('blocked_users').insert({
      blocker_id: user.id,
      blocked_id: contact.contact_user_id,
    });

    if (blockError) return { error: new Error(blockError.message) };

    // Update contact's is_blocked status
    const { error: updateError } = await supabase
      .from('contacts')
      .update({ is_blocked: true })
      .eq('id', contactId);

    if (!updateError) {
      await fetchContacts();
    }

    return { error: updateError ? new Error(updateError.message) : null };
  };

  const updateNickname = async (contactId: string, nickname: string) => {
    if (!user) return { error: new Error('Not authenticated') };

    const { error } = await supabase
      .from('contacts')
      .update({ nickname: nickname || null })
      .eq('id', contactId);

    if (!error) {
      await fetchContacts();
    }

    return { error: error ? new Error(error.message) : null };
  };

  const searchUsers = async (query: string) => {
    if (!user || !query.trim()) return [];

    const { data, error } = await supabase
      .from('public_profiles')
      .select('id, display_name, username, avatar_url, bio')
      .neq('id', user.id)
      .or(`display_name.ilike.%${query}%,username.ilike.%${query}%`)
      .limit(20);

    if (error) {
      console.error('Search error:', error);
      return [];
    }

    return data || [];
  };

  return {
    contacts: contacts.map(contact => contact.profile ? { ...contact, profile: { ...contact.profile, is_online: isRecentlyOnline(contact.profile.is_online, contact.profile.last_seen, now) } } : contact),
    friendRequests,
    loading,
    error,
    refresh: loadData,
    sendFriendRequest,
    acceptFriendRequest,
    rejectFriendRequest,
    cancelFriendRequest,
    removeContact,
    toggleFavorite,
    blockContact,
    updateNickname,
    searchUsers,
  };
}
