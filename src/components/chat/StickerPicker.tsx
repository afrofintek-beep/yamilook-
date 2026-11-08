import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, X, Clock, Star, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface Sticker {
  id: string;
  url: string;
  name: string | null;
  emoji: string | null;
}

interface StickerPack {
  id: string;
  name: string;
  description: string | null;
  cover_url: string | null;
  stickers: Sticker[];
}

interface StickerPickerProps {
  onSelect: (stickerUrl: string) => void;
  onClose: () => void;
}

export function StickerPicker({ onSelect, onClose }: StickerPickerProps) {
  useUiLocale();
  const { user } = useAuth();
  const [packs, setPacks] = useState<StickerPack[]>([]);
  const [favorites, setFavorites] = useState<Sticker[]>([]);
  const [recents, setRecents] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('stickers');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchStickers();
  }, [user]);

  const fetchStickers = async () => {
    try {
      // Fetch packs with stickers
      const { data: packsData } = await supabase
        .from('sticker_packs')
        .select('*')
        .order('created_at');

      const { data: stickersData } = await supabase
        .from('stickers')
        .select('*')
        .order('display_order');

      // Group stickers by pack
      const packsWithStickers = (packsData || []).map((pack) => ({
        ...pack,
        stickers: (stickersData || []).filter((s) => s.pack_id === pack.id),
      }));

      setPacks(packsWithStickers);

      // Fetch user favorites
      if (user) {
        const { data: favData } = await supabase
          .from('user_sticker_favorites')
          .select('sticker_id')
          .eq('user_id', user.id);

        const favStickerIds = (favData || []).map((f) => f.sticker_id);
        const favStickers = (stickersData || []).filter((s) => favStickerIds.includes(s.id));
        setFavorites(favStickers);
      }

      // Load recents from localStorage
      const storedRecents = localStorage.getItem('recentStickers');
      if (storedRecents) {
        setRecents(JSON.parse(storedRecents));
      }
    } catch (err) {
      console.error('Error fetching stickers:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (stickerUrl: string) => {
    // Add to recents
    const newRecents = [stickerUrl, ...recents.filter((r) => r !== stickerUrl)].slice(0, 20);
    setRecents(newRecents);
    localStorage.setItem('recentStickers', JSON.stringify(newRecents));

    onSelect(stickerUrl);
  };

  const toggleFavorite = async (sticker: Sticker) => {
    if (!user) return;

    const isFavorite = favorites.some((f) => f.id === sticker.id);

    if (isFavorite) {
      await supabase
        .from('user_sticker_favorites')
        .delete()
        .eq('user_id', user.id)
        .eq('sticker_id', sticker.id);
      setFavorites(favorites.filter((f) => f.id !== sticker.id));
    } else {
      await supabase
        .from('user_sticker_favorites')
        .insert({ user_id: user.id, sticker_id: sticker.id });
      setFavorites([...favorites, sticker]);
    }
  };

  const filteredPacks = searchQuery
    ? packs.map((pack) => ({
        ...pack,
        stickers: pack.stickers.filter(
          (s) =>
            s.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.emoji?.includes(searchQuery)
        ),
      })).filter((pack) => pack.stickers.length > 0)
    : packs;

  const StickerGrid = ({ stickers }: { stickers: Sticker[] }) => (
    <div className="grid grid-cols-4 gap-2">
      {stickers.map((sticker) => (
        <motion.button
          key={sticker.id}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => handleSelect(sticker.url)}
          className="aspect-square p-2 rounded-xl hover:bg-secondary transition-colors relative group"
        >
          <img src={sticker.url} alt={sticker.name || ''} className="w-full h-full object-contain" />
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleFavorite(sticker);
            }}
            className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Star
              className={`w-4 h-4 ${
                favorites.some((f) => f.id === sticker.id)
                  ? 'fill-warning text-warning'
                  : 'text-muted-foreground'
              }`}
            />
          </button>
        </motion.button>
      ))}
    </div>
  );

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
            placeholder={uiText("Search stickers...")}
            className="pl-9 h-9"
          />
        </div>
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full justify-start h-auto p-1 bg-secondary/30">
          <TabsTrigger value="stickers" className="text-xs px-3">{uiText("Stickers")}</TabsTrigger>
          <TabsTrigger value="favorites" className="text-xs px-3">
            <Star className="w-3 h-3 mr-1" />{uiText(" Favorites")}</TabsTrigger>
          <TabsTrigger value="recents" className="text-xs px-3">
            <Clock className="w-3 h-3 mr-1" />{uiText(" Recent")}</TabsTrigger>
        </TabsList>

        <div className="overflow-y-auto" style={{ maxHeight: '250px' }}>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <TabsContent value="stickers" className="p-3 m-0 space-y-4">
                {filteredPacks.map((pack) => (
                  <div key={pack.id}>
                    <h4 className="text-sm font-medium mb-2">{pack.name}</h4>
                    <StickerGrid stickers={pack.stickers} />
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="favorites" className="p-3 m-0">
                {favorites.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8 text-sm">{uiText("No favorite stickers yet")}</p>
                ) : (
                  <StickerGrid stickers={favorites} />
                )}
              </TabsContent>

              <TabsContent value="recents" className="p-3 m-0">
                {recents.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8 text-sm">{uiText("No recent stickers")}</p>
                ) : (
                  <div className="grid grid-cols-4 gap-2">
                    {recents.map((url, i) => (
                      <motion.button
                        key={i}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleSelect(url)}
                        className="aspect-square p-2 rounded-xl hover:bg-secondary transition-colors"
                      >
                        <img src={url} alt="" className="w-full h-full object-contain" />
                      </motion.button>
                    ))}
                  </div>
                )}
              </TabsContent>
            </>
          )}
        </div>
      </Tabs>
    </motion.div>
  );
}
