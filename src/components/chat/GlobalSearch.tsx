import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { 
  Search, 
  X, 
  Calendar, 
  Image, 
  FileText, 
  User, 
  Star, 
  Pin,
  Mic,
  Clock,
  Filter
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';

interface SearchResult {
  id: string;
  content: string;
  message_type: string;
  created_at: string;
  conversation_id: string;
  conversation_name?: string;
  sender_name: string;
  sender_avatar?: string;
  is_starred?: boolean;
  is_pinned?: boolean;
}

interface SearchFilters {
  dateFrom?: Date;
  dateTo?: Date;
  messageType?: string;
  senderId?: string;
  starredOnly?: boolean;
  pinnedOnly?: boolean;
}

interface GlobalSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GlobalSearch({ open, onOpenChange }: GlobalSearchProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({});
  const [showFilters, setShowFilters] = useState(false);

  // Load recent searches
  useEffect(() => {
    const stored = localStorage.getItem('recentSearches');
    if (stored) {
      setRecentSearches(JSON.parse(stored));
    }
  }, []);

  const saveRecentSearch = (search: string) => {
    const updated = [search, ...recentSearches.filter((s) => s !== search)].slice(0, 10);
    setRecentSearches(updated);
    localStorage.setItem('recentSearches', JSON.stringify(updated));
  };

  const performSearch = useCallback(async () => {
    if (!user || !query.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    saveRecentSearch(query);

    try {
      // Get user's conversations
      const { data: participations } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user.id);

      const conversationIds = participations?.map((p) => p.conversation_id) || [];
      if (conversationIds.length === 0) {
        setResults([]);
        return;
      }

      // Build query
      let messagesQuery = supabase
        .from('messages')
        .select('*')
        .in('conversation_id', conversationIds)
        .ilike('content', `%${query}%`)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(50);

      // Apply filters
      if (filters.dateFrom) {
        messagesQuery = messagesQuery.gte('created_at', filters.dateFrom.toISOString());
      }
      if (filters.dateTo) {
        messagesQuery = messagesQuery.lte('created_at', filters.dateTo.toISOString());
      }
      if (filters.messageType) {
        messagesQuery = messagesQuery.eq('message_type', filters.messageType);
      }
      if (filters.senderId) {
        messagesQuery = messagesQuery.eq('sender_id', filters.senderId);
      }

      const { data: messages } = await messagesQuery;

      // Get starred/pinned if filtering
      let starredIds = new Set<string>();
      let pinnedIds = new Set<string>();

      if (filters.starredOnly || filters.pinnedOnly) {
        if (filters.starredOnly) {
          const { data: starred } = await supabase
            .from('starred_messages')
            .select('message_id')
            .eq('user_id', user.id);
          starredIds = new Set((starred || []).map((s) => s.message_id));
        }
        if (filters.pinnedOnly) {
          const { data: pinned } = await supabase
            .from('pinned_messages')
            .select('message_id')
            .in('conversation_id', conversationIds);
          pinnedIds = new Set((pinned || []).map((p) => p.message_id));
        }
      }

      // Enrich results
      const enrichedResults: SearchResult[] = [];

      for (const msg of messages || []) {
        if (filters.starredOnly && !starredIds.has(msg.id)) continue;
        if (filters.pinnedOnly && !pinnedIds.has(msg.id)) continue;

        const { data: profile } = await supabase
          .from('public_profiles')
          .select('display_name, avatar_url')
          .eq('id', msg.sender_id)
          .maybeSingle();

        const { data: conv } = await supabase
          .from('conversations')
          .select('name, type')
          .eq('id', msg.conversation_id)
          .maybeSingle();

        let conversationName = conv?.name;
        if (conv?.type === 'direct') {
          const { data: participants } = await supabase
            .from('conversation_participants')
            .select('user_id')
            .eq('conversation_id', msg.conversation_id)
            .neq('user_id', user.id)
            .limit(1);

          if (participants?.[0]) {
            const { data: otherProfile } = await supabase
              .from('public_profiles')
              .select('display_name')
              .eq('id', participants[0].user_id)
              .maybeSingle();
            conversationName = otherProfile?.display_name;
          }
        }

        enrichedResults.push({
          id: msg.id,
          content: msg.content || '',
          message_type: msg.message_type,
          created_at: msg.created_at,
          conversation_id: msg.conversation_id,
          conversation_name: conversationName || 'Chat',
          sender_name: profile?.display_name || 'Unknown',
          sender_avatar: profile?.avatar_url || undefined,
          is_starred: starredIds.has(msg.id),
          is_pinned: pinnedIds.has(msg.id),
        });
      }

      setResults(enrichedResults);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  }, [user, query, filters]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (query.length >= 2) {
        performSearch();
      }
    }, 300);
    return () => clearTimeout(debounce);
  }, [query, performSearch]);

  const handleResultClick = (result: SearchResult) => {
    onOpenChange(false);
    navigate(`/chat/${result.conversation_id}?highlight=${result.id}`);
  };

  const highlightMatch = (text: string) => {
    if (!query) return text;
    const regex = new RegExp(`(${query})`, 'gi');
    return text.split(regex).map((part, i) =>
      regex.test(part) ? (
        <mark key={i} className="bg-yellow-200 dark:bg-yellow-900 rounded px-0.5">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  const getMessageTypeIcon = (type: string) => {
    switch (type) {
      case 'image':
        return <Image className="w-4 h-4" />;
      case 'voice':
        return <Mic className="w-4 h-4" />;
      case 'file':
        return <FileText className="w-4 h-4" />;
      default:
        return null;
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="top" className="h-[90vh] rounded-b-3xl">
        <SheetHeader className="pb-4">
          <SheetTitle>Search Messages</SheetTitle>
        </SheetHeader>

        <div className="space-y-4">
          {/* Search input */}
          <div className="relative flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search messages..."
                className="pl-10 pr-10"
                autoFocus
              />
              {query && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                  onClick={() => setQuery('')}
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
            <Popover open={showFilters} onOpenChange={setShowFilters}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon" className={Object.keys(filters).length > 0 ? 'border-primary' : ''}>
                  <Filter className="w-4 h-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80" align="end">
                <div className="space-y-4">
                  <h4 className="font-medium">Filters</h4>

                  {/* Date range */}
                  <div className="space-y-2">
                    <label className="text-sm text-muted-foreground">Date range</label>
                    <div className="flex gap-2">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm" className="flex-1 justify-start">
                            <Calendar className="w-4 h-4 mr-2" />
                            {filters.dateFrom ? format(filters.dateFrom, 'MMM d') : 'From'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <CalendarPicker
                            mode="single"
                            selected={filters.dateFrom}
                            onSelect={(date) => setFilters({ ...filters, dateFrom: date })}
                          />
                        </PopoverContent>
                      </Popover>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm" className="flex-1 justify-start">
                            <Calendar className="w-4 h-4 mr-2" />
                            {filters.dateTo ? format(filters.dateTo, 'MMM d') : 'To'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <CalendarPicker
                            mode="single"
                            selected={filters.dateTo}
                            onSelect={(date) => setFilters({ ...filters, dateTo: date })}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  {/* Message type */}
                  <div className="space-y-2">
                    <label className="text-sm text-muted-foreground">Message type</label>
                    <div className="flex flex-wrap gap-2">
                      {['text', 'image', 'voice', 'file'].map((type) => (
                        <Button
                          key={type}
                          variant={filters.messageType === type ? 'default' : 'outline'}
                          size="sm"
                          onClick={() =>
                            setFilters({
                              ...filters,
                              messageType: filters.messageType === type ? undefined : type,
                            })
                          }
                        >
                          {type}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Special filters */}
                  <div className="flex gap-2">
                    <Button
                      variant={filters.starredOnly ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setFilters({ ...filters, starredOnly: !filters.starredOnly })}
                    >
                      <Star className="w-4 h-4 mr-1" />
                      Starred
                    </Button>
                    <Button
                      variant={filters.pinnedOnly ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setFilters({ ...filters, pinnedOnly: !filters.pinnedOnly })}
                    >
                      <Pin className="w-4 h-4 mr-1" />
                      Pinned
                    </Button>
                  </div>

                  {/* Clear filters */}
                  {Object.keys(filters).length > 0 && (
                    <Button variant="ghost" size="sm" className="w-full" onClick={() => setFilters({})}>
                      Clear all filters
                    </Button>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <ScrollArea className="h-[calc(90vh-12rem)]">
            {loading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex gap-3 p-3 rounded-xl bg-secondary/50 animate-pulse">
                    <div className="w-10 h-10 rounded-full bg-muted" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-32 bg-muted rounded" />
                      <div className="h-3 w-full bg-muted rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : query.length < 2 ? (
              <div className="space-y-4">
                {recentSearches.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-muted-foreground">Recent searches</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs"
                        onClick={() => {
                          setRecentSearches([]);
                          localStorage.removeItem('recentSearches');
                        }}
                      >
                        Clear
                      </Button>
                    </div>
                    <div className="space-y-1">
                      {recentSearches.map((search) => (
                        <button
                          key={search}
                          onClick={() => setQuery(search)}
                          className="flex items-center gap-2 w-full p-2 rounded-lg hover:bg-secondary/50 text-left"
                        >
                          <Clock className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm">{search}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : results.length === 0 ? (
              <div className="text-center py-12">
                <Search className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No messages found</p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground mb-3">
                  {results.length} result{results.length !== 1 ? 's' : ''}
                </p>
                {results.map((result) => (
                  <button
                    key={result.id}
                    onClick={() => handleResultClick(result)}
                    className="flex items-start gap-3 w-full p-3 rounded-xl hover:bg-secondary/50 text-left transition-colors"
                  >
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={result.sender_avatar} />
                      <AvatarFallback>{result.sender_name[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium truncate">{result.sender_name}</span>
                        {result.is_starred && <Star className="w-3 h-3 fill-warning text-warning" />}
                        {result.is_pinned && <Pin className="w-3 h-3 text-primary" />}
                        {getMessageTypeIcon(result.message_type)}
                      </div>
                      <p className="text-sm line-clamp-2">{highlightMatch(result.content)}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="text-[10px] h-5">
                          {result.conversation_name}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {format(new Date(result.created_at), 'MMM d, yyyy h:mm a')}
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
}
