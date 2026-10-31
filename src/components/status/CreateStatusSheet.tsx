import { useAuth } from '@/hooks/useAuth';
import { genderCtx } from '@/lib/i18n-gender';
import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Camera, 
  Image, 
  Type, 
  Palette, 
  Music, 
  Sticker,
  Lock,
  Users,
  Globe,
  Circle,
  Send,
  Play,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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
import { useStatus } from '@/hooks/useStatus';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface CreateStatusSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const backgroundOptions = [
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
  'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  '#1a1a2e',
  '#16213e',
  '#0f3460',
  '#e94560',
];

// Privacy options are built inside the component using i18n

type StatusType = 'text' | 'photo' | 'video';

export function CreateStatusSheet({ open, onOpenChange }: CreateStatusSheetProps) {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const privacyOptions = [
    { value: 'everyone', label: t('privacy.everyone', 'Wis'), icon: Globe },
    { value: 'contacts', label: t('privacy.friends', 'Kambas'), icon: Users },
    { value: 'close_friends', label: t('privacy.closeFriends', { defaultValue: 'Bradas', ...genderCtx(profile?.gender) }), icon: Circle },
    { value: 'only_me', label: t('privacy.onlyMe', 'Só Eu'), icon: Lock },
  ];
  const { createStatus } = useStatus();
  const { toast } = useToast();
  
  const [statusType, setStatusType] = useState<StatusType | null>(null);
  const [textContent, setTextContent] = useState('');
  const [selectedBackground, setSelectedBackground] = useState(backgroundOptions[0]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [privacy, setPrivacy] = useState<'everyone' | 'contacts' | 'close_friends' | 'only_me'>('contacts');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: 'photo' | 'video') => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setStatusType(type);

    const reader = new FileReader();
    reader.onloadend = () => {
      setFilePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!statusType) return;

    if (statusType === 'text' && !textContent.trim()) {
      toast({
        title: t('status.contentRequired'),
        description: t('status.enterText'),
        variant: 'destructive',
      });
      return;
    }

    if ((statusType === 'photo' || statusType === 'video') && !selectedFile) {
      toast({
        title: t('status.mediaRequired'),
        description: t('status.selectMedia'),
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const created = await createStatus(statusType, {
        content: statusType === 'text' ? textContent : undefined,
        mediaFile: selectedFile || undefined,
        background: statusType === 'text' ? selectedBackground : undefined,
        caption: caption || undefined,
        privacy,
      });

      if (!created?.id) throw new Error('Status was not saved');

      toast({
        title: t('status.statusPosted'),
        description: t('status.statusShared'),
      });

      // Reset form
      setStatusType(null);
      setTextContent('');
      setSelectedFile(null);
      setFilePreview(null);
      setCaption('');
      setPrivacy('contacts');
      onOpenChange(false);
    } catch (error) {
      toast({
        title: t('status.failedToPost'),
        description: t('status.errorPosting'),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetToTypeSelection = () => {
    setStatusType(null);
    setTextContent('');
    setSelectedFile(null);
    setFilePreview(null);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="flex h-[90dvh] max-h-[calc(100dvh-env(safe-area-inset-top,0px))] flex-col gap-0 overflow-hidden rounded-t-3xl p-0">
        {statusType && <SheetTitle className="sr-only">{t('status.createStatus')}</SheetTitle>}
        <AnimatePresence mode="wait">
          {!statusType ? (
            <motion.div
              key="type-selection"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex min-h-0 flex-1 flex-col overflow-y-auto"
            >
              <SheetHeader className="p-4 border-b">
                <SheetTitle>{t('status.createStatus')}</SheetTitle>
              </SheetHeader>
              
              <div className="flex-1 p-6 space-y-4">
                <p className="text-muted-foreground text-center mb-8">
                  {t('status.whatToShare')}
                </p>
                
                <div className="grid grid-cols-3 gap-2">
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => cameraInputRef.current?.click()}
                    className="flex flex-col items-center gap-3 min-w-0 px-2 py-6 rounded-2xl bg-gradient-primary text-white"
                  >
                    <Camera className="w-8 h-8" />
                    <span className="font-medium">{t('status.camera')}</span>
                  </motion.button>
                  
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-col items-center gap-3 min-w-0 px-2 py-6 rounded-2xl bg-secondary"
                  >
                    <Image className="w-8 h-8" />
                    <span className="font-medium">{t('status.gallery')}</span>
                  </motion.button>
                  
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setStatusType('text')}
                    className="flex flex-col items-center gap-3 min-w-0 px-2 py-6 rounded-2xl bg-secondary"
                  >
                    <Type className="w-8 h-8" />
                    <span className="font-medium">{t('status.text')}</span>
                  </motion.button>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const type = file.type.startsWith('video') ? 'video' : 'photo';
                      handleFileSelect(e, type);
                    }
                  }}
                />
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => handleFileSelect(e, 'photo')}
                />
              </div>
            </motion.div>
          ) : statusType === 'text' ? (
            <motion.div
              key="text-editor"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="flex min-h-0 flex-1 flex-col overflow-y-auto"
            >
              {/* Preview */}
              <div 
                className="flex-1 flex items-center justify-center p-8 relative"
                style={{ background: selectedBackground }}
              >
                <Textarea
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  placeholder={t('status.typeStatus')}
                  className="bg-transparent border-none text-white text-2xl font-bold text-center resize-none focus-visible:ring-0 placeholder:text-white/50"
                  rows={4}
                  maxLength={250}
                />
                
                {/* Character count */}
                <span className="absolute bottom-4 right-4 text-white/50 text-sm">
                  {textContent.length}/250
                </span>
              </div>

              {/* Background picker */}
              <div className="p-4 border-t bg-background">
                <Label className="text-sm text-muted-foreground mb-2 block">{t('status.background')}</Label>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {backgroundOptions.map((bg, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedBackground(bg)}
                      className={cn(
                        "w-10 h-10 rounded-full flex-shrink-0 border-2 transition-all",
                        selectedBackground === bg ? "border-primary scale-110" : "border-transparent"
                      )}
                      style={{ background: bg }}
                    />
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="shrink-0 p-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] border-t bg-background space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Label className="text-sm">{t('status.whoCanSee')}</Label>
                  <Select value={privacy} onValueChange={(v) => setPrivacy(v as typeof privacy)}>
                    <SelectTrigger className="h-11 w-full min-[400px]:w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper" className="z-[9999]" sideOffset={4}>
                      <SelectItem value="everyone">
                        <div className="flex items-center gap-2">
                          <Globe className="w-4 h-4" />
                          {t('status.everyone')}
                        </div>
                      </SelectItem>
                      <SelectItem value="contacts">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          {t('status.myContacts')}
                        </div>
                      </SelectItem>
                      <SelectItem value="close_friends">
                        <div className="flex items-center gap-2">
                          <Circle className="w-4 h-4" />
                          {t('social.closeFriendsGroup', genderCtx(profile?.gender))}
                        </div>
                      </SelectItem>
                      <SelectItem value="only_me">
                        <div className="flex items-center gap-2">
                          <Lock className="w-4 h-4" />
                          {t('status.onlyMe')}
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 rounded-xl"
                    onClick={resetToTypeSelection}
                  >
                    {t('common.back')}
                  </Button>
                  <Button
                    className="flex-1 rounded-xl bg-gradient-primary text-white"
                    onClick={handleSubmit}
                    disabled={isSubmitting || !textContent.trim()}
                  >
                    {isSubmitting ? t('status.posting') : t('status.postStatus')}
                  </Button>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="media-editor"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
            >
              {/* Preview */}
              <div className="flex-1 min-h-0 bg-black relative flex items-center justify-center overflow-hidden">
                {statusType === 'photo' ? (
                  <img 
                    src={filePreview || ''} 
                    alt="Preview" 
                    className="h-full w-full min-h-0 object-contain"
                  />
                ) : (
                  <video
                    src={filePreview || ''}
                    className="h-full w-full min-h-0 object-contain"
                    controls
                    playsInline
                    autoPlay
                    muted
                  />
                )}

                {/* Close button */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-4 left-4 text-white hover:bg-white/20 z-10"
                  onClick={resetToTypeSelection}
                  aria-label="Escolher outra foto ou vídeo"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {/* Caption & settings - fixed at bottom */}
              <div className="max-h-[45%] shrink-0 overflow-y-auto p-4 border-t bg-background space-y-3">
                <Input
                  placeholder={t('status.addCaption')}
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  className="rounded-xl"
                />

                <div className="flex flex-wrap items-center gap-3">
                  <Label className="text-sm">{t('status.whoCanSee')}</Label>
                  <Select value={privacy} onValueChange={(v) => setPrivacy(v as typeof privacy)}>
                    <SelectTrigger className="h-11 w-full min-[400px]:w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper" className="z-[9999]" sideOffset={4}>
                      <SelectItem value="everyone">
                        <div className="flex items-center gap-2">
                          <Globe className="w-4 h-4" />
                          {t('status.everyone')}
                        </div>
                      </SelectItem>
                      <SelectItem value="contacts">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          {t('status.myContacts')}
                        </div>
                      </SelectItem>
                      <SelectItem value="close_friends">
                        <div className="flex items-center gap-2">
                          <Circle className="w-4 h-4" />
                          {t('social.closeFriendsGroup', genderCtx(profile?.gender))}
                        </div>
                      </SelectItem>
                      <SelectItem value="only_me">
                        <div className="flex items-center gap-2">
                          <Lock className="w-4 h-4" />
                          {t('status.onlyMe')}
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

              </div>
              <div className="shrink-0 border-t bg-background px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
                <Button
                  className="h-12 w-full rounded-xl bg-gradient-primary text-white"
                  onClick={handleSubmit}
                  disabled={isSubmitting || !selectedFile}
                >
                  {isSubmitting ? t('status.posting') : t('status.postStatus')}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </SheetContent>
    </Sheet>
  );
}
