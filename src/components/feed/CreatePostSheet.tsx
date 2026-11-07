import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { genderCtx } from '@/lib/i18n-gender';
import { useState, useRef, useEffect } from 'react';
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
import { chatMediaType } from '@/lib/chat-media';
import { isHeicImage, preparePostImage } from '@/lib/post-image';
import { useKeyboardViewport } from '@/hooks/useKeyboardViewport';
import { clearPostDraft, loadPostDraft, savePostDraft } from '@/lib/post-draft';
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
  useUiLocale();
  const viewport = useKeyboardViewport(open);
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
  const [isPreparingFiles, setIsPreparingFiles] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [savingPost, setSavingPost] = useState(false);
  const [showDraftDialog, setShowDraftDialog] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const restoredDraftFor = useRef<string | null>(null);
  const uploadController = useRef<AbortController | null>(null);
  useEffect(() => () => uploadController.current?.abort(), []);
  const previewUrlsRef = useRef<string[]>([]);
  useEffect(() => () => {
    previewUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
    previewUrlsRef.current = [];
  }, []);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [editingVideoIndex, setEditingVideoIndex] = useState<number | null>(null);

  useEffect(() => {
    const userId = user?.id;
    if (!open || !userId || restoredDraftFor.current === userId) return;
    restoredDraftFor.current = userId;
    let current = true;
    void loadPostDraft(userId).then(draft => {
      if (!current || !draft) return;
      setContent(draft.content);
      setPrivacy(draft.privacy);
      setLocation(draft.location);
      setSelectedTopics(draft.selectedTopics);
      if (draft.files.length) {
        const previews = draft.files.map(file => URL.createObjectURL(file));
        previewUrlsRef.current.push(...previews);
        setSelectedFiles(draft.files);
        setFilePreviews(previews);
      }
      toast({
        title: t('feed.draftRestored', { defaultValue: 'Rascunho recuperado' }),
        description: draft.hadMedia && !draft.files.length
          ? t('feed.draftMediaReselect', { defaultValue: 'O texto foi recuperado. Seleciona novamente o vídeo.' })
          : t('feed.draftReady', { defaultValue: 'Podes continuar a editar e publicar.' }),
      });
    });
    return () => { current = false; };
  }, [open, t, toast, user?.id]);
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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.currentTarget.files || []);
    // Allow the same photo to be selected again after removal or an error.
    e.currentTarget.value = '';
    if (!files.length || isPreparingFiles || isSubmitting) return;
    if (files.length + selectedFiles.length > 10) {
      toast({
        title: t('feed.tooManyFiles'),
        description: t('feed.maxFiles'),
        variant: 'destructive',
      });
      return;
    }

    setSubmitError('');
    setIsPreparingFiles(true);
    try {
      // Decode HEIC before preview: the uploaded and displayed file must agree.
      const prepared = await Promise.all(files.map(file =>
        isHeicImage(file) ? preparePostImage(file) : file
      ));
      const previews = prepared.map(file => URL.createObjectURL(file));
      previewUrlsRef.current.push(...previews);
      setSelectedFiles(prev => [...prev, ...prepared]);
      setFilePreviews(prev => [...prev, ...previews]);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      setSubmitError(error instanceof Error && error.message ? error.message : t('feed.errorPosting'));
      toast({
        title: t('feed.failedToPost'),
        description: error instanceof Error ? error.message : t('feed.errorPosting'),
        variant: 'destructive',
      });
    } finally {
      setIsPreparingFiles(false);
    }
  };

  const removeFile = (index: number) => {
    const preview = filePreviews[index];
    if (preview) {
      URL.revokeObjectURL(preview);
      previewUrlsRef.current = previewUrlsRef.current.filter(url => url !== preview);
    }
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setFilePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const clearFiles = () => {
    previewUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
    previewUrlsRef.current = [];
    setSelectedFiles([]);
    setFilePreviews([]);
  };

  const resetComposer = () => {
    setContent('');
    clearFiles();
    setLocation('');
    setPrivacy('contacts');
    setSelectedTopics([]);
    setSubmitError('');
  };

  const requestCancel = () => {
    if (isSubmitting) uploadController.current?.abort();
    if (content.trim() || selectedFiles.length || location || selectedTopics.length) {
      setShowDraftDialog(true);
    } else {
      onOpenChange(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!user?.id || isSavingDraft) return;
    setIsSavingDraft(true);
    try {
      const result = await savePostDraft(user.id, {
        content,
        privacy,
        location,
        selectedTopics,
        files: selectedFiles,
      });
      setShowDraftDialog(false);
      onOpenChange(false);
      toast({
        title: t('feed.draftSaved', { defaultValue: 'Rascunho guardado' }),
        description: result.mediaSaved
          ? t('feed.draftSavedDescription', { defaultValue: 'Podes continuar esta publicação mais tarde.' })
          : t('feed.draftMediaNotSaved', { defaultValue: 'O texto foi guardado, mas terás de selecionar novamente o vídeo.' }),
      });
    } catch {
      setSubmitError(t('feed.draftSaveFailed', { defaultValue: 'Não foi possível guardar o rascunho neste dispositivo.' }));
      setShowDraftDialog(false);
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handleDiscardDraft = async () => {
    if (user?.id) await clearPostDraft(user.id);
    resetComposer();
    setShowDraftDialog(false);
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    if (isSubmitting || isPreparingFiles) return;
    if (!content.trim() && selectedFiles.length === 0) {
      toast({
        title: t('feed.emptyPost'),
        description: t('feed.addContent'),
        variant: 'destructive',
      });
      return;
    }

    setSubmitError('');
    const controller = new AbortController();
    uploadController.current = controller;
    setIsSubmitting(true);
    setUploadProgress(t('feed.posting'));

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
              title: uiText("⚠️ Conteúdo não permitido"),
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
        ? chatMediaType(selectedFiles[0]) === 'video' ? 'video' : 'photo'
        : 'text';

      controller.signal.throwIfAborted();
      const newPost = await createPost(type, {
        signal: controller.signal,
        content: content || undefined,
        mediaFiles: selectedFiles.length > 0 ? selectedFiles : undefined,
        location: location || undefined,
        privacy,
        onUploadProgress: (stage, current, total, percent) => {
          const video = selectedFiles[current - 1] && chatMediaType(selectedFiles[current - 1]) === 'video';
          if (stage === 'saving') {
            setSavingPost(true);
            setUploadProgress(t('feed.savingPost', { defaultValue: 'A guardar publicação…' }));
          } else if (stage === 'preparing') {
            setUploadProgress(t(video ? 'feed.preparingVideoUpload' : 'feed.preparingFile', {
              defaultValue: video ? 'A preparar vídeo para envio…' : 'A preparar ficheiro…',
            }) + (percent === undefined ? '' : ` ${percent}%`));
          } else {
            setUploadProgress(t(video ? 'feed.uploadingVideo' : 'feed.uploadingPhoto', {
              defaultValue: video ? 'A enviar vídeo {{current}}/{{total}}…' : 'A enviar fotografia {{current}}/{{total}}…',
              current,
              total,
            }) + (percent === undefined ? '' : ` ${percent}%`));
          }
        },
      });

      if (!newPost?.id) {
        throw new Error(t('feed.errorPosting'));
      }

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
      if (user?.id) await clearPostDraft(user.id);
      resetComposer();
      onOpenChange(false);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      setSubmitError(error instanceof Error && error.message ? error.message : t('feed.errorPosting'));
      toast({
        title: t('feed.failedToPost'),
        description: error instanceof Error && error.message ? error.message : t('feed.errorPosting'),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
      setSavingPost(false);
      uploadController.current = null;
      setUploadProgress('');
    }
  };

  const canPost = content.trim() || selectedFiles.length > 0;

  return (
    <Sheet open={open} onOpenChange={value => { if (!isSubmitting) onOpenChange(value); }}>
      <SheetContent
        side="bottom"
        hideCloseButton
        style={{
          ...viewport.style,
          bottom: 'var(--group-viewport-bottom, 0px)',
          height: 'min(640px, calc(var(--group-viewport-height, 100dvh) * 0.9))',
          maxHeight: 'calc(var(--group-viewport-height, 100dvh) - env(safe-area-inset-top, 0px))',
        }}
        className="rounded-t-3xl p-0 bg-card flex flex-col gap-0 overflow-hidden"
        onInteractOutside={(e) => { if (editingVideoIndex !== null || editorGuardRef.current) e.preventDefault(); }}
        onPointerDownOutside={(e) => { if (editingVideoIndex !== null || editorGuardRef.current) e.preventDefault(); }}
        onEscapeKeyDown={(e) => { if (editingVideoIndex !== null || editorGuardRef.current) e.preventDefault(); }}
      >
        <SheetHeader data-testid="muxi-publish-header" className="shrink-0 px-4 py-2 border-b border-border flex-row space-y-0 items-center justify-between gap-2">
          <Button variant="ghost" size="sm" className="shrink-0 min-h-11" disabled={savingPost} onClick={requestCancel}>
            {t('feed.cancel')}
          </Button>
          <SheetTitle className="min-w-0 flex-1 truncate text-center text-sm sm:text-lg text-foreground">{t('feed.createPost')}</SheetTitle>
          <Button
            data-testid="muxi-publish-button"
            size="sm"
            className="bg-primary text-primary-foreground rounded-full px-4 min-h-11 shrink-0"
            disabled={!canPost || isSubmitting || isPreparingFiles}
            onClick={handleSubmit}
          >
            {isSubmitting ? t('feed.posting') : isPreparingFiles ? t('feed.preparingMedia', { defaultValue: 'A preparar…' }) : t('feed.post')}
          </Button>
        </SheetHeader>
        {submitError && (
          <p role="alert" className="shrink-0 mx-4 mt-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-foreground">
            {submitError}
          </p>
        )}
        {(isPreparingFiles || isSubmitting) && (
          <p role="status" aria-live="polite" className="shrink-0 px-4 py-1 text-xs text-muted-foreground">
            {isPreparingFiles ? t('feed.preparingMedia', { defaultValue: 'A preparar fotografia…' }) : uploadProgress}
          </p>
        )}

        <div className="flex-1 min-h-0 w-full overflow-y-auto overscroll-contain">
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
              className="min-h-[76px] sm:min-h-[100px] resize-none border-none text-lg text-foreground placeholder:text-foreground/60 p-0 focus-visible:ring-0"
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
                    <div key={index} data-testid="muxi-photo-preview" className="relative h-[min(35vh,300px)] max-h-[35dvh] rounded-xl overflow-hidden bg-black/5">
                    {selectedFiles[index] && chatMediaType(selectedFiles[index]) === 'video' ? (
                        <div className="relative w-full h-full">
                          <video
                            src={`${preview}#t=0.1`}
                            className="w-full h-full object-contain"
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
                            <Scissors className="w-3 h-3" />{uiText(" Editar")}</Button>
                        </div>
                      ) : (
                        <img
                          src={preview}
                          alt=""
                          className="w-full h-full object-contain"
                        />
                      )}
                      <Button
                        variant="secondary"
                        size="icon"
                        className="absolute top-2 right-2 w-11 h-11 rounded-full bg-background/90"
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
        </div>

        {/* Bottom actions */}
        <div className="relative shrink-0 px-4 pt-2 border-t bg-background" style={{ paddingBottom: viewport.compact ? '8px' : 'max(8px, env(safe-area-inset-bottom, 0px))' }}>
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
            const previous = filePreviews[editingVideoIndex];
            if (previous) {
              URL.revokeObjectURL(previous);
              previewUrlsRef.current = previewUrlsRef.current.filter(url => url !== previous);
            }
            const preview = URL.createObjectURL(editedFile);
            previewUrlsRef.current.push(preview);
            setSelectedFiles(prev => prev.map((f, i) => i === editingVideoIndex ? editedFile : f));
            setFilePreviews(prev => prev.map((p, i) => i === editingVideoIndex ? preview : p));
            closeVideoEditor();
          }}
          onCancel={closeVideoEditor}
        />
      )}
      <AlertDialog open={showDraftDialog} onOpenChange={setShowDraftDialog}>
        <AlertDialogContent className="max-w-sm rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('feed.saveDraftQuestion', { defaultValue: 'Guardar como rascunho?' })}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('feed.saveDraftDescription', { defaultValue: 'Podes continuar esta publicação mais tarde sem perder o texto e as definições.' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:flex-col">
            <AlertDialogAction disabled={isSavingDraft} onClick={(event) => { event.preventDefault(); void handleSaveDraft(); }}>
              {isSavingDraft
                ? t('feed.savingDraft', { defaultValue: 'A guardar…' })
                : t('feed.saveDraft', { defaultValue: 'Guardar rascunho' })}
            </AlertDialogAction>
            <AlertDialogCancel disabled={isSavingDraft}>
              {t('feed.continueEditing', { defaultValue: 'Continuar a editar' })}
            </AlertDialogCancel>
            <Button variant="destructive" disabled={isSavingDraft} onClick={() => void handleDiscardDraft()}>
              {t('feed.discardDraft', { defaultValue: 'Descartar' })}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}
