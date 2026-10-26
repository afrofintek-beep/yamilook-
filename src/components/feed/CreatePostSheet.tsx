import { genderCtx } from '@/lib/i18n-gender';
import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Image,
  Video,
  MapPin,
  Globe,
  Users,
  Circle,
  Lock,
  Smile,
  Scissors,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { usePosts } from '@/hooks/usePosts';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { AFRICAN_REACTIONS } from '@/lib/reactions';
import { TopicSelector } from './TopicSelector';
import { VideoEditor } from './VideoEditor';
import { supabase } from '@/integrations/supabase/client';
import { snapToGrid } from '@/lib/geo-privacy';

// African-inspired emoji set for Yamilook
const AFRICAN_EMOJIS = [
  // Yamilook Core Reactions
  ...AFRICAN_REACTIONS.map(r => r.icon),
  // African & Cultural Symbols
  '🌍', '🦁', '🐘', '🦒', '🦓', '🦍', '🐆', '🦏',
  '🌴', '🥁', '🎭', '✊🏿', '✊🏾', '✊🏽', '👑', '💎',
  '🔥', '⚡', '🌟', '✨', '💫', '🌙', '☀️', '🌈',
  // Hands & People (diverse skin tones)
  '👏🏿', '👏🏾', '🙏🏿', '🙏🏾', '💪🏿', '💪🏾', '🙌🏿', '🙌🏾',
  '👍🏿', '👍🏾', '❤️', '🧡', '💛', '💚', '💙', '💜',
  // Expressions
  '😊', '😄', '🥰', '😍', '🤩', '😎', '🥳', '😌',
  '🤔', '😏', '😤', '😢', '😭', '🙄', '😴', '🤗',
  // Food & Nature
  '🍉', '🥭', '🍌', '🥥', '🌺', '🌻', '🌸', '🍀',
];

interface CreatePostSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreatePostSheet({ open, onOpenChange }: CreatePostSheetProps) {
  const { t } = useTranslation();
  const { user, profile } = useAuth();
  const { createPost } = usePosts({ autoLoad: false });
  const { toast } = useToast();

  const privacyOptions = [
    { value: 'everyone', label: t('privacy.everyone'), icon: Globe },
    { value: 'contacts', label: t('privacy.friends'), icon: Users },
    { value: 'close_friends', label: t('privacy.closeFriends', genderCtx(profile?.gender)), icon: Circle },
    { value: 'only_me', label: t('privacy.onlyMe'), icon: Lock },
  ];
  
  const [content, setContent] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<string[]>([]);
  const [privacy, setPrivacy] = useState<'everyone' | 'contacts' | 'close_friends' | 'only_me'>('contacts');
  const [location, setLocation] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [editingVideoIndex, setEditingVideoIndex] = useState<number | null>(null);
  // Fechar o editor propaga um clique/foco para fora da Sheet DEPOIS de o
  // estado mudar; sem esta janela de guarda, a Sheet interpretava-o como
  // "interagiu fora" e fechava, perdendo o post inteiro.
  const editorGuardRef = useRef(false);
  const closeVideoEditor = () => {
    editorGuardRef.current = true;
    setEditingVideoIndex(null);
    setTimeout(() => { editorGuardRef.current = false; }, 500);
  };
  const handleGetLocation = async () => {
    if (!navigator.geolocation) {
      toast({
        title: t('feed.locationNotSupported'),
        description: t('feed.browserNoLocation'),
        variant: 'destructive',
      });
      return;
    }

    // Only use GPS if permission already granted — avoid popup
    try {
      if (navigator.permissions) {
        const perm = await navigator.permissions.query({ name: 'geolocation' });
        if (perm.state !== 'granted') {
          // Silently skip — don't show permission toast
          return;
        }
      }
    } catch { /* skip */ }

    setIsGettingLocation(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        // Snap to ~10m grid cell immediately — precise coords must never flow further
        const _cell = snapToGrid(position.coords.latitude, position.coords.longitude);
        const latitude = _cell.lat;
        const longitude = _cell.lng;
        try {
          // Use reverse geocoding to get location name
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=14&addressdetails=1`
          );
          const data = await response.json();
          
          // Build location string
          const address = data.address;
          const locationParts = [];
          
          if (address.suburb || address.neighbourhood || address.district) {
            locationParts.push(address.suburb || address.neighbourhood || address.district);
          }
          if (address.city || address.town || address.village || address.municipality) {
            locationParts.push(address.city || address.town || address.village || address.municipality);
          }
          if (address.country) {
            locationParts.push(address.country);
          }
          
          const locationName = locationParts.length > 0
            ? locationParts.slice(0, 2).join(', ')
            : 'Local marcado';
          
          setLocation(locationName);
          toast({
            title: t('feed.locationAdded'),
            description: locationName,
          });
        } catch (error) {
          console.error('Error getting location name:', error);
          setLocation('Local marcado');
        } finally {
          setIsGettingLocation(false);
        }
      },
      (error) => {
        setIsGettingLocation(false);
        let message = t('feed.locationError');
        switch (error.code) {
          case error.PERMISSION_DENIED:
            message = t('feed.locationDenied');
            break;
          case error.POSITION_UNAVAILABLE:
            message = t('feed.locationUnavailable');
            break;
          case error.TIMEOUT:
            message = t('feed.locationTimeout');
            break;
        }
        toast({
          title: t('feed.locationFailed'),
          description: message,
          variant: 'destructive',
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  const handleEmojiSelect = (emoji: string) => {
    setContent(prev => prev + emoji);
    setShowEmojiPicker(false);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + selectedFiles.length > 10) {
      toast({
        title: t('feed.tooManyFiles'),
        description: t('feed.maxFiles'),
        variant: 'destructive',
      });
      return;
    }

    setSelectedFiles(prev => [...prev, ...files]);

    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFilePreviews(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setFilePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!content.trim() && selectedFiles.length === 0) {
      toast({
        title: t('feed.emptyPost'),
        description: t('feed.addContent'),
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // AI content moderation check
      if (content.trim()) {
        try {
          const { data: moderationResult, error: moderationError } = await supabase.functions.invoke(
            'moderate-content',
            { body: { content: content.trim() } }
          );

          if (!moderationError && moderationResult && moderationResult.approved === false) {
            toast({
              title: '⚠️ Conteúdo não permitido',
              description: moderationResult.reason || 'O teu post viola as regras da comunidade. Por favor, revê o conteúdo.',
              variant: 'destructive',
            });
            setIsSubmitting(false);
            return;
          }
        } catch (modErr) {
          // Fail open: if moderation service is down, allow the post
          console.warn('Moderation check failed, allowing post:', modErr);
        }
      }

      const type = selectedFiles.length > 0 
        ? selectedFiles[0].type.startsWith('video') ? 'video' : 'photo'
        : 'text';

      const newPost = await createPost(type, {
        content: content || undefined,
        mediaFiles: selectedFiles.length > 0 ? selectedFiles : undefined,
        location: location || undefined,
        privacy,
      });

      // Associate topics with the post
      if (newPost && selectedTopics.length > 0) {
        await supabase
          .from('post_topics')
          .insert(
            selectedTopics.map(topicId => ({
              post_id: newPost.id,
              topic_id: topicId,
            }))
          );
      }

      toast({
        title: t('feed.posted'),
        description: t('feed.postShared'),
      });

      // Reset form
      setContent('');
      setSelectedFiles([]);
      setFilePreviews([]);
      setLocation('');
      setPrivacy('contacts');
      setSelectedTopics([]);
      onOpenChange(false);
    } catch (error) {
      toast({
        title: t('feed.failedToPost'),
        description: t('feed.errorPosting'),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const canPost = content.trim() || selectedFiles.length > 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[85vh] rounded-t-3xl p-0 bg-card"
        onInteractOutside={(e) => { if (editingVideoIndex !== null || editorGuardRef.current) e.preventDefault(); }}
        onPointerDownOutside={(e) => { if (editingVideoIndex !== null || editorGuardRef.current) e.preventDefault(); }}
        onEscapeKeyDown={(e) => { if (editingVideoIndex !== null || editorGuardRef.current) e.preventDefault(); }}
      >
        <SheetHeader className="p-4 border-b border-border flex-row items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            {t('feed.cancel')}
          </Button>
          <SheetTitle className="text-foreground">{t('feed.createPost')}</SheetTitle>
          <Button 
            size="sm" 
            className="bg-primary text-primary-foreground rounded-full px-4"
            disabled={!canPost || isSubmitting}
            onClick={handleSubmit}
          >
            {isSubmitting ? t('feed.posting') : t('feed.post')}
          </Button>
        </SheetHeader>

        <ScrollArea className="h-[calc(85vh-140px)]">
          <div className="p-4 space-y-4">
            {/* User info */}
            <div className="flex items-center gap-3">
              <Avatar className="w-10 h-10">
                <AvatarImage src={profile?.avatar_url || ''} />
                <AvatarFallback className="bg-muted text-foreground">
                  {profile?.display_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="font-medium text-sm text-foreground">
                  {profile?.display_name || t('feed.you')}
                </p>
                <Select value={privacy} onValueChange={(v) => setPrivacy(v as typeof privacy)}>
                  <SelectTrigger className="h-7 w-auto text-xs border border-primary/30 rounded-full px-2 gap-1 bg-transparent">
                    {(() => {
                      const selected = privacyOptions.find(o => o.value === privacy);
                      const Icon = selected?.icon || Globe;
                      return (
                        <div className="flex items-center gap-1.5">
                          <Icon className="w-3 h-3" />
                          <span>{selected?.label}</span>
                        </div>
                      );
                    })()}
                  </SelectTrigger>
                  <SelectContent className="bg-card border border-border z-[100] max-h-60 overflow-y-auto">
                    {privacyOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex items-center gap-2">
                          <option.icon className="w-3 h-3" />
                          {option.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Content input */}
            <Textarea
              placeholder={t('feed.createPlaceholder', 'O que se passa na tua banda?')}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[120px] resize-none border-none text-lg p-0 focus-visible:ring-0"
              autoFocus
            />

            {/* File previews */}
            <AnimatePresence>
              {filePreviews.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className={cn(
                    "grid gap-2",
                    filePreviews.length === 1 && "grid-cols-1",
                    filePreviews.length === 2 && "grid-cols-2",
                    filePreviews.length >= 3 && "grid-cols-3"
                  )}
                >
                  {filePreviews.map((preview, index) => (
                    <div key={index} className="relative aspect-square rounded-xl overflow-hidden">
                    {selectedFiles[index]?.type.startsWith('video') ? (
                        <div className="relative w-full h-full">
                          <video
                            src={`${preview}#t=0.1`}
                            className="w-full h-full object-cover"
                            preload="metadata"
                            playsInline
                          />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center">
                              <Video className="w-5 h-5 text-white" />
                            </div>
                          </div>
                          {/* Edit video button */}
                          <Button
                            variant="secondary"
                            size="sm"
                            className="absolute bottom-2 left-2 h-7 rounded-full bg-black/60 text-white border-0 text-[11px] gap-1 px-2.5 hover:bg-black/80"
                            onClick={(e) => { e.stopPropagation(); setEditingVideoIndex(index); }}
                          >
                            <Scissors className="w-3 h-3" /> Editar
                          </Button>
                        </div>
                      ) : (
                        <img
                          src={preview}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      )}
                      <Button
                        variant="secondary"
                        size="icon"
                        className="absolute top-2 right-2 w-6 h-6 rounded-full"
                        onClick={() => removeFile(index)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Location */}
            {location && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="w-4 h-4" />
                <span>{location}</span>
                <Button variant="ghost" size="icon" className="w-5 h-5" onClick={() => setLocation('')}>
                  <X className="w-3 h-3" />
                </Button>
              </div>
            )}

            {/* Topics selector */}
            <TopicSelector
              selectedTopics={selectedTopics}
              onTopicsChange={setSelectedTopics}
              maxTopics={3}
            />
          </div>
        </ScrollArea>

        {/* Bottom actions */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t bg-background safe-bottom">
          <div className="flex items-center gap-2" data-testid="post-action-buttons">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => fileInputRef.current?.click()}
            >
              <Image className="w-5 h-5 text-green-500" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => {
                const input = fileInputRef.current;
                if (input) {
                  input.accept = 'video/*';
                  input.click();
                  input.accept = 'image/*,video/*';
                }
              }}
            >
              <Video className="w-5 h-5 text-purple-500" />
            </Button>
            <Button 
              variant={location ? "default" : "ghost"}
              size="icon"
              onClick={handleGetLocation}
              disabled={isGettingLocation}
              className={location ? "bg-primary/20" : ""}
            >
              {isGettingLocation ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                >
                  <MapPin className="w-5 h-5 text-red-500" />
                </motion.div>
              ) : (
                <MapPin className="w-5 h-5 text-red-500" />
              )}
            </Button>
            <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Smile className="w-5 h-5 text-yellow-500" />
                </Button>
              </PopoverTrigger>
              <PopoverContent 
                className="w-72 p-2 bg-card border border-border z-[100]"
                side="top"
                align="start"
              >
                <ScrollArea className="h-48">
                  <div className="grid grid-cols-8 gap-1">
                    {AFRICAN_EMOJIS.map((emoji, index) => (
                      <button
                        key={index}
                        className="w-8 h-8 flex items-center justify-center text-xl hover:bg-muted rounded transition-colors"
                        onClick={() => handleEmojiSelect(emoji)}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </PopoverContent>
            </Popover>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />

            <div className="flex-1 text-right text-xs text-muted-foreground">
              {content.length}/2000
            </div>
          </div>
        </div>
      </SheetContent>

      {/* Video Editor Overlay */}
      {editingVideoIndex !== null && selectedFiles[editingVideoIndex] && (
        <VideoEditor
          file={selectedFiles[editingVideoIndex]}
          onSave={(editedFile) => {
            // Replace the file and preview
            setSelectedFiles(prev => prev.map((f, i) => i === editingVideoIndex ? editedFile : f));
            const reader = new FileReader();
            reader.onloadend = () => {
              setFilePreviews(prev => prev.map((p, i) => i === editingVideoIndex ? (reader.result as string) : p));
            };
            reader.readAsDataURL(editedFile);
            closeVideoEditor();
          }}
          onCancel={closeVideoEditor}
        />
      )}
    </Sheet>
  );
}
