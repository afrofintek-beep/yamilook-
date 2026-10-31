import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Send, 
  Paperclip, 
  Smile, 
  Mic, 
  X, 
  Image, 
  File, 
  MapPin,
  StopCircle,
  Sticker,
  Sparkles,
  Clock,
  Eye,
  EyeOff
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ReplyPreview } from './ReplyPreview';
import { StickerPicker } from './StickerPicker';
import { GifPicker } from './GifPicker';
import { EmojiPanel } from './EmojiPanel';
import { ScheduleMessageSheet } from './ScheduleMessageSheet';
import { ViewOnceToggle } from './ViewOnceMedia';
import { useVoiceRecorder, useMediaUpload } from '@/hooks/useMediaUpload';
import { chatMediaType } from '@/lib/chat-media';

interface EnhancedChatInputProps {
  onSend: (content: string, type?: string, mediaUrl?: string, replyToId?: string, duration?: number, isViewOnce?: boolean, thumbnailUrl?: string) => Promise<{ messageId?: string }>;
  onUpdateMediaUrl?: (messageId: string, newMediaUrl: string) => Promise<void>;
  onTyping: () => void;
  onSchedule?: (content: string, scheduledFor: Date, isRecurring: boolean, pattern?: string) => Promise<void>;
  replyTo?: {
    id: string;
    content: string | null;
    message_type: string;
    sender_profile?: {
      display_name: string;
      avatar_url: string | null;
    };
  } | null;
  onCancelReply?: () => void;
  disabled?: boolean;
  focusInput?: boolean;
  conversationId: string;
}

export function EnhancedChatInput({
  onSend,
  onUpdateMediaUrl,
  onTyping,
  onSchedule,
  replyTo,
  onCancelReply,
  disabled,
  focusInput,
  conversationId,
}: EnhancedChatInputProps) {
  const { t } = useTranslation();
  const [message, setMessage] = useState('');
  const [locating, setLocating] = useState(false);
  const locationRequest = useRef(0);
  useEffect(() => {
    setLocating(false);
    return () => { locationRequest.current += 1; };
  }, [conversationId]);
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const [sendError, setSendError] = useState('');
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [showEmojiMenu, setShowEmojiMenu] = useState(false);
  const [showScheduleSheet, setShowScheduleSheet] = useState(false);
  const [viewOnceEnabled, setViewOnceEnabled] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const { 
    isRecording, 
    recordingTime, 
    startRecording, 
    stopRecording, 
    cancelRecording, 
    uploadVoiceMessageAsync,
    clearRecording 
  } = useVoiceRecorder();
  const { uploading, uploadMedia } = useMediaUpload();

  useEffect(() => {
    if (focusInput && !disabled) textareaRef.current?.focus();
  }, [focusInput, disabled]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [message]);

  // Insert an emoji at the caret (or append) and keep focus in the textarea.
  const insertEmoji = (emoji: string) => {
    const el = textareaRef.current;
    const start = el?.selectionStart ?? message.length;
    const end = el?.selectionEnd ?? message.length;
    const next = message.slice(0, start) + emoji + message.slice(end);
    setMessage(next);
    setShowEmojiMenu(false);
    requestAnimationFrame(() => {
      if (el) {
        el.focus();
        const pos = start + emoji.length;
        el.setSelectionRange(pos, pos);
      }
    });
  };

  const handleSend = async () => {
    if (!message.trim() || sendingRef.current || disabled) return;
    const content = message.trim();
    sendingRef.current = true;
    setSending(true);
    setSendError('');
    try {
      const result = await onSend(content, 'text', undefined, replyTo?.id);
      if (!result.messageId) throw new Error('Envio não confirmado');
      // Preserve anything typed while the previous message was being delivered.
      setMessage(current => current.trim() === content ? '' : current);
      onCancelReply?.();
    } catch {
      setSendError('Mensagem não enviada. O texto foi mantido. Tenta novamente.');
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  const handleLocation = () => {
    if (disabled || locating || sendingRef.current) return;
    setSendError('');
    if (!navigator.geolocation) {
      setSendError('Este navegador não permite obter a localização.');
      return;
    }
    const request = ++locationRequest.current;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        if (request !== locationRequest.current) return;
        setLocating(false);
        const location = `📍 https://www.google.com/maps?q=${coords.latitude},${coords.longitude}`;
        setMessage(current => current ? `${current}\n${location}` : location);
        textareaRef.current?.focus();
      },
      (error) => {
        if (request !== locationRequest.current) return;
        setLocating(false);
        setSendError(error.code === 1
          ? 'Acesso à localização recusado. Permite a localização nas definições do navegador e tenta novamente.'
          : error.code === 3
            ? 'Demorou demasiado a obter a localização. Tenta novamente.'
            : 'Não foi possível obter a localização. Verifica se a localização está ativa e tenta novamente.');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    onTyping();
  };

  const handleVoiceRecord = async () => {
    if (isRecording) {
      // stopRecording now returns the blob directly - no race condition
      const recordingResult = await stopRecording();
      
      if (recordingResult) {
        const { blob, duration } = recordingResult;
        console.log('[Voice] Recording stopped, duration:', duration);
        
        // Create a local URL for optimistic display
        const localUrl = URL.createObjectURL(blob);
        
        // Send message immediately with local blob URL
        const result = await onSend('', 'voice', localUrl, replyTo?.id, duration);
        const messageId = result?.messageId;
        console.log('[Voice] Message created with id:', messageId);
        onCancelReply?.();
        
        if (!messageId) {
          console.error('[Voice] No messageId returned, cannot update media_url');
          clearRecording();
          return;
        }
        
        // Upload in background and update the message's media_url when complete
        uploadVoiceMessageAsync(
          blob,
          async (finalUrl) => {
            console.log('[Voice] Upload complete, updating message:', messageId, 'with URL:', finalUrl);
            if (onUpdateMediaUrl) {
              try {
                await onUpdateMediaUrl(messageId, finalUrl);
                console.log('[Voice] Message media_url updated successfully');
              } catch (err) {
                console.error('[Voice] Failed to update media_url:', err);
              }
            }
            // Revoke the local URL to free memory
            URL.revokeObjectURL(localUrl);
          },
          () => {
            console.error('[Voice] Upload failed for message:', messageId);
            URL.revokeObjectURL(localUrl);
          }
        );
        
        clearRecording();
      }
    } else {
      startRecording();
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'file') => {
    const file = e.target.files?.[0];
    if (!file || sendingRef.current || disabled) return;

    const input = e.target;
    sendingRef.current = true;
    setSending(true);
    setSendError('');
    try {
      const messageType = chatMediaType(file);
      const result = await uploadMedia(file, messageType === 'file' ? type : messageType, { videoPoster: messageType === 'video' });
      if (!result) throw new Error('Upload failed');
      const sent = await onSend(file.name, messageType, result.url, replyTo?.id, result.durationSeconds, viewOnceEnabled, result.thumbnailUrl);
      if (!sent.messageId) throw new Error('Delivery not confirmed');
      onCancelReply?.();
      setViewOnceEnabled(false);
    } catch {
      setSendError('Ficheiro não enviado. Seleciona-o novamente para tentar de novo.');
    } finally {
      sendingRef.current = false;
      setSending(false);
      input.value = '';
    }
  };

  const handleStickerSelect = async (stickerUrl: string) => {
    setShowStickerPicker(false);
    await onSend('', 'sticker', stickerUrl, replyTo?.id);
    onCancelReply?.();
  };

  const handleGifSelect = async (gifUrl: string) => {
    setShowGifPicker(false);
    await onSend('', 'gif', gifUrl, replyTo?.id);
    onCancelReply?.();
  };

  const handleSchedule = async (scheduledFor: Date, isRecurring: boolean, pattern?: string) => {
    if (!message.trim() || !onSchedule) return;
    await onSchedule(message.trim(), scheduledFor, isRecurring, pattern);
    setMessage('');
    setShowScheduleSheet(false);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Close pickers when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setShowStickerPicker(false);
      setShowGifPicker(false);
    };
    if (showStickerPicker || showGifPicker) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showStickerPicker, showGifPicker]);

  return (
    <div className="shrink-0 glass border-t border-border/50 safe-bottom relative">
      {locating && <p role="status" className="px-4 py-2 text-sm">A obter localização…</p>}
      {sendError && <p role="alert" className="px-4 py-2 text-sm text-destructive">{sendError}</p>}
      {/* Sticker Picker */}
      <AnimatePresence>
        {showStickerPicker && (
          <div onClick={(e) => e.stopPropagation()}>
            <StickerPicker
              onSelect={handleStickerSelect}
              onClose={() => setShowStickerPicker(false)}
            />
          </div>
        )}
      </AnimatePresence>

      {/* GIF Picker */}
      <AnimatePresence>
        {showGifPicker && (
          <div onClick={(e) => e.stopPropagation()}>
            <GifPicker
              onSelect={handleGifSelect}
              onClose={() => setShowGifPicker(false)}
            />
          </div>
        )}
      </AnimatePresence>

      {/* View Once Toggle for media */}
      <AnimatePresence>
        {viewOnceEnabled && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-3 py-2 bg-primary/10 border-b border-border/30"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <EyeOff className="w-4 h-4 text-primary" />
                <span>View once enabled - media will disappear after viewing</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewOnceEnabled(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {replyTo && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            <ReplyPreview message={replyTo} onCancel={onCancelReply} />
          </motion.div>
        )}
      </AnimatePresence>

      {isRecording ? (
        <div className="flex items-center gap-3 p-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-full text-destructive"
            onClick={cancelRecording}
          >
            <X className="w-5 h-5" />
          </Button>

          <div className="flex-1 flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-destructive animate-pulse" />
            <span className="font-mono text-lg">{formatTime(recordingTime)}</span>
            <span className="text-sm text-muted-foreground">Recording...</span>
          </div>

          <Button
            size="icon"
            className="h-12 w-12 rounded-full bg-gradient-primary text-white"
            onClick={handleVoiceRecord}
          >
            <StopCircle className="w-6 h-6" />
          </Button>
        </div>
      ) : (
        <div className="flex items-end gap-2 p-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 rounded-full flex-shrink-0"
                disabled={disabled || uploading}
              >
                <Paperclip className="w-5 h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuItem onClick={() => imageInputRef.current?.click()}>
                <Image className="w-4 h-4 mr-2" />
                Photo or Video
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                <File className="w-4 h-4 mr-2" />
                Document
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setShowGifPicker(true); setShowStickerPicker(false); }}>
                <Sparkles className="w-4 h-4 mr-2" />
                GIF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setShowStickerPicker(true); setShowGifPicker(false); }}>
                <Sticker className="w-4 h-4 mr-2" />
                Sticker
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setViewOnceEnabled(!viewOnceEnabled)}>
                {viewOnceEnabled ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
                {viewOnceEnabled ? 'View once ON' : 'View once'}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={handleLocation} disabled={disabled || locating || sending}>
                <MapPin className="w-4 h-4 mr-2" />
                Localização
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <input
            ref={imageInputRef}
            type="file"
            accept="image/*,video/*"
            aria-label="Escolher fotografia ou vídeo"
            className="hidden"
            onChange={(e) => handleFileSelect(e, 'image')}
          />
          <input
            ref={fileInputRef}
            type="file"
            aria-label="Escolher ficheiro"
            className="hidden"
            onChange={(e) => handleFileSelect(e, 'file')}
          />

          <div className="flex-1 min-w-0 relative">
            <Textarea
              ref={textareaRef}
              value={message}
              aria-label="Mensagem"
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder={t('chat.typeMessage')}
              className="min-h-[44px] max-h-[120px] py-3 pr-12 rounded-2xl resize-none bg-secondary/50 border-0 focus-visible:ring-1 focus-visible:ring-primary/50"
              disabled={disabled || uploading}
              rows={1}
            />
            <Popover open={showEmojiMenu} onOpenChange={setShowEmojiMenu}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 bottom-1.5 h-8 w-8 rounded-full"
                  disabled={disabled}
                >
                  <Smile className="w-5 h-5 text-muted-foreground" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-2" align="end">
                <div className="flex flex-col gap-2">
                  {/* Yamilook African-first emoji picker (+ "Outros") */}
                  <EmojiPanel onSelect={insertEmoji} />
                  <div className="h-px bg-border" />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setShowStickerPicker(true); setShowEmojiMenu(false); }}
                    className="justify-start"
                  >
                    <Sticker className="w-4 h-4 mr-2" />
                    Stickers
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setShowGifPicker(true); setShowEmojiMenu(false); }}
                    className="justify-start"
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    GIFs
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {message.trim() ? (
            <div className="flex items-center gap-1">
              {/* Schedule button */}
              {onSchedule && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 rounded-full flex-shrink-0"
                  onClick={() => setShowScheduleSheet(true)}
                  disabled={sending || disabled || uploading}
                >
                  <Clock className="w-5 h-5" />
                </Button>
              )}
              <Button
                size="icon"
                className="h-10 w-10 rounded-full bg-gradient-primary text-white flex-shrink-0"
                onClick={handleSend}
                disabled={sending || disabled || uploading}
                aria-label="Enviar mensagem"
              >
                <Send className="w-5 h-5" />
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-full flex-shrink-0"
              onClick={handleVoiceRecord}
              disabled={disabled || uploading}
            >
              <Mic className="w-5 h-5" />
            </Button>
          )}
        </div>
      )}

      {/* Schedule Message Sheet */}
      <ScheduleMessageSheet
        open={showScheduleSheet}
        onOpenChange={setShowScheduleSheet}
        message={message}
        onSchedule={handleSchedule}
      />
    </div>
  );
}
