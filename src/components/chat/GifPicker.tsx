import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Search, X, Loader2, TrendingUp } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

interface GifResult {
  id: string;
  url: string;
  preview: string;
  title: string;
}

interface GifPickerProps {
  onSelect: (gifUrl: string) => void;
  onClose: () => void;
}

export function GifPicker({ onSelect, onClose }: GifPickerProps) {
  useUiLocale();
  const [gifs, setGifs] = useState<GifResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fetchGifs = useCallback(async (action: 'trending' | 'search', query?: string) => {
    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        setError(uiText("Please log in to view GIFs"));
        setLoading(false);
        return;
      }

      const response = await supabase.functions.invoke('fetch-gifs', {
        body: { action, query },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to fetch GIFs');
      }

      const results: GifResult[] = response.data?.results || [];
      setGifs(results);
    } catch (err) {
      console.error('Error fetching GIFs:', err);
      setError(uiText("Failed to load GIFs. Please try again."));
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTrendingGifs = useCallback(() => {
    fetchGifs('trending');
  }, [fetchGifs]);

  const searchGifs = useCallback((query: string) => {
    if (!query.trim()) {
      fetchTrendingGifs();
      return;
    }
    fetchGifs('search', query);
  }, [fetchGifs, fetchTrendingGifs]);

  useEffect(() => {
    fetchTrendingGifs();
  }, [fetchTrendingGifs]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      searchGifs(searchQuery);
    }, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery, searchGifs]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="absolute bottom-full mb-2 left-0 right-0 mx-4 bg-card rounded-2xl shadow-lg border border-border overflow-hidden"
      style={{ maxHeight: '350px' }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 p-3 border-b border-border">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={uiText("Search GIFs...")}
            className="pl-9 h-9"
          />
        </div>
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Title */}
      <div className="px-3 py-2 flex items-center gap-2 text-sm text-muted-foreground">
        <TrendingUp className="w-4 h-4" />
        {searchQuery ? `Results for "${searchQuery}"` : uiText("Trending")}
      </div>

      {/* GIF Grid */}
      <div className="overflow-y-auto p-2" style={{ maxHeight: '270px' }}>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : gifs.length === 0 ? (
          <p className="text-center text-muted-foreground py-8 text-sm">{uiText("No GIFs found")}</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {gifs.map((gif) => (
              <motion.button
                key={gif.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onSelect(gif.url)}
                className="rounded-lg overflow-hidden bg-secondary/50 aspect-video"
              >
                <img
                  src={gif.preview}
                  alt={gif.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </motion.button>
            ))}
          </div>
        )}
      </div>

      {/* Powered by Tenor */}
      <div className="px-3 py-2 border-t border-border text-xs text-muted-foreground text-center">{uiText("Powered by Tenor")}</div>
    </motion.div>
  );
}
