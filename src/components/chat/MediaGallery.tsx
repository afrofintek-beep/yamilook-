import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Image, Film, FileText, Link2, Download, X, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MediaPreview } from './MediaPreview';
import { supabase } from '@/integrations/supabase/client';

interface MediaItem {
  id: string;
  url: string;
  type: 'image' | 'video' | 'file' | 'link';
  name?: string;
  created_at: string;
  sender_name?: string;
}

interface MediaGalleryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
}

export function MediaGallery({ open, onOpenChange, conversationId }: MediaGalleryProps) {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [files, setFiles] = useState<MediaItem[]>([]);
  const [links, setLinks] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isSelecting, setIsSelecting] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<'image' | 'video'>('image');

  useEffect(() => {
    if (open && conversationId) {
      fetchMedia();
    }
  }, [open, conversationId]);

  const fetchMedia = async () => {
    setLoading(true);
    try {
      const { data: messages } = await supabase
        .from('visible_messages')
        .select('id, media_url, message_type, content, created_at, sender_id')
        .eq('conversation_id', conversationId)
        .not('media_url', 'is', null)
        .order('created_at', { ascending: false });

      const mediaItems: MediaItem[] = [];
      const fileItems: MediaItem[] = [];
      const linkItems: MediaItem[] = [];

      for (const msg of messages || []) {
        const { data: profile } = await supabase
          .from('public_profiles')
          .select('display_name')
          .eq('id', msg.sender_id)
          .maybeSingle();

        const item: MediaItem = {
          id: msg.id,
          url: msg.media_url!,
          type: msg.message_type as MediaItem['type'],
          name: msg.content || undefined,
          created_at: msg.created_at,
          sender_name: profile?.display_name,
        };

        if (msg.message_type === 'image' || msg.message_type === 'video') {
          mediaItems.push({ ...item, type: msg.message_type as 'image' | 'video' });
        } else if (msg.message_type === 'file') {
          fileItems.push({ ...item, type: 'file' });
        }
      }

      // Extract links from text messages
      const { data: textMessages } = await supabase
        .from('visible_messages')
        .select('id, content, created_at, sender_id')
        .eq('conversation_id', conversationId)
        .eq('message_type', 'text')
        .ilike('content', '%http%')
        .order('created_at', { ascending: false });

      const urlRegex = /(https?:\/\/[^\s]+)/g;
      for (const msg of textMessages || []) {
        const urls = msg.content?.match(urlRegex) || [];
        const { data: profile } = await supabase
          .from('public_profiles')
          .select('display_name')
          .eq('id', msg.sender_id)
          .maybeSingle();

        for (const url of urls) {
          linkItems.push({
            id: `${msg.id}-${url}`,
            url,
            type: 'link',
            created_at: msg.created_at,
            sender_name: profile?.display_name,
          });
        }
      }

      setMedia(mediaItems);
      setFiles(fileItems);
      setLinks(linkItems);
    } catch (err) {
      console.error('Error fetching media:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedItems(newSelected);
  };

  const downloadSelected = () => {
    selectedItems.forEach((id) => {
      const item = [...media, ...files, ...links].find((i) => i.id === id);
      if (item) {
        const link = document.createElement('a');
        link.href = item.url;
        link.download = item.name || 'download';
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    });
    setSelectedItems(new Set());
    setIsSelecting(false);
  };

  const groupByMonth = (items: MediaItem[]) => {
    const groups: Record<string, MediaItem[]> = {};
    items.forEach((item) => {
      const monthKey = format(new Date(item.created_at), 'MMMM yyyy');
      if (!groups[monthKey]) groups[monthKey] = [];
      groups[monthKey].push(item);
    });
    return groups;
  };

  const renderMediaGrid = (items: MediaItem[]) => {
    const grouped = groupByMonth(items);

    return (
      <div className="space-y-6">
        {Object.entries(grouped).map(([month, monthItems]) => (
          <div key={month}>
            <h3 className="text-sm font-medium text-muted-foreground mb-3">{month}</h3>
            <div className="grid grid-cols-3 gap-1">
              {monthItems.map((item) => (
                <div key={item.id} className="relative aspect-square group">
                  {isSelecting && (
                    <div className="absolute top-2 left-2 z-10">
                      <Checkbox
                        checked={selectedItems.has(item.id)}
                        onCheckedChange={() => toggleSelection(item.id)}
                      />
                    </div>
                  )}
                  <button
                    onClick={() => {
                      if (isSelecting) {
                        toggleSelection(item.id);
                      } else {
                        setPreviewUrl(item.url);
                        setPreviewType(item.type as 'image' | 'video');
                      }
                    }}
                    className="w-full h-full"
                  >
                    {item.type === 'image' ? (
                      <img
                        src={item.url}
                        alt=""
                        className="w-full h-full object-cover rounded"
                      />
                    ) : (
                      <div className="w-full h-full bg-secondary flex items-center justify-center rounded">
                        <Film className="w-8 h-8 text-muted-foreground" />
                      </div>
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderFilesList = (items: MediaItem[]) => {
    const grouped = groupByMonth(items);

    return (
      <div className="space-y-6">
        {Object.entries(grouped).map(([month, monthItems]) => (
          <div key={month}>
            <h3 className="text-sm font-medium text-muted-foreground mb-3">{month}</h3>
            <div className="space-y-2">
              {monthItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50 hover:bg-secondary/70 transition-colors"
                >
                  {isSelecting && (
                    <Checkbox
                      checked={selectedItems.has(item.id)}
                      onCheckedChange={() => toggleSelection(item.id)}
                    />
                  )}
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.name || 'Document'}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.sender_name} • {format(new Date(item.created_at), 'MMM d, h:mm a')}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" asChild>
                    <a href={item.url} download target="_blank" rel="noopener noreferrer">
                      <Download className="w-4 h-4" />
                    </a>
                  </Button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderLinksList = (items: MediaItem[]) => {
    const grouped = groupByMonth(items);

    return (
      <div className="space-y-6">
        {Object.entries(grouped).map(([month, monthItems]) => (
          <div key={month}>
            <h3 className="text-sm font-medium text-muted-foreground mb-3">{month}</h3>
            <div className="space-y-2">
              {monthItems.map((item) => (
                <a
                  key={item.id}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50 hover:bg-secondary/70 transition-colors"
                >
                  <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                    <Link2 className="w-5 h-5 text-accent" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate text-primary">{item.url}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.sender_name} • {format(new Date(item.created_at), 'MMM d, h:mm a')}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0">
          <SheetHeader className="px-4 pt-4 pb-2">
            <div className="flex items-center justify-between">
              <SheetTitle>Media, Files & Links</SheetTitle>
              {(media.length > 0 || files.length > 0) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (isSelecting) {
                      setSelectedItems(new Set());
                    }
                    setIsSelecting(!isSelecting);
                  }}
                >
                  {isSelecting ? 'Cancel' : 'Select'}
                </Button>
              )}
            </div>
          </SheetHeader>

          <Tabs defaultValue="media" className="w-full">
            <TabsList className="w-full justify-start px-4 bg-transparent border-b rounded-none">
              <TabsTrigger value="media" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
                <Image className="w-4 h-4 mr-2" />
                Media ({media.length})
              </TabsTrigger>
              <TabsTrigger value="files" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
                <FileText className="w-4 h-4 mr-2" />
                Files ({files.length})
              </TabsTrigger>
              <TabsTrigger value="links" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
                <Link2 className="w-4 h-4 mr-2" />
                Links ({links.length})
              </TabsTrigger>
            </TabsList>

            <ScrollArea className="h-[calc(100vh-12rem)]">
              <TabsContent value="media" className="p-4 mt-0">
                {loading ? (
                  <div className="grid grid-cols-3 gap-1">
                    {[...Array(9)].map((_, i) => (
                      <div key={i} className="aspect-square bg-secondary animate-pulse rounded" />
                    ))}
                  </div>
                ) : media.length === 0 ? (
                  <div className="text-center py-12">
                    <Image className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                    <p className="text-muted-foreground">No media shared yet</p>
                  </div>
                ) : (
                  renderMediaGrid(media)
                )}
              </TabsContent>

              <TabsContent value="files" className="p-4 mt-0">
                {loading ? (
                  <div className="space-y-2">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="h-16 bg-secondary animate-pulse rounded-xl" />
                    ))}
                  </div>
                ) : files.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                    <p className="text-muted-foreground">No files shared yet</p>
                  </div>
                ) : (
                  renderFilesList(files)
                )}
              </TabsContent>

              <TabsContent value="links" className="p-4 mt-0">
                {loading ? (
                  <div className="space-y-2">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="h-16 bg-secondary animate-pulse rounded-xl" />
                    ))}
                  </div>
                ) : links.length === 0 ? (
                  <div className="text-center py-12">
                    <Link2 className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                    <p className="text-muted-foreground">No links shared yet</p>
                  </div>
                ) : (
                  renderLinksList(links)
                )}
              </TabsContent>
            </ScrollArea>
          </Tabs>

          {/* Selection actions */}
          {isSelecting && selectedItems.size > 0 && (
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-background border-t flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {selectedItems.size} selected
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={downloadSelected}>
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Media preview */}
      {previewUrl && (
        <MediaPreview
          url={previewUrl}
          type={previewType}
          open={!!previewUrl}
          onClose={() => setPreviewUrl(null)}
        />
      )}
    </>
  );
}
