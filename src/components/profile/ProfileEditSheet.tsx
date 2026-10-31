import { genderCtx } from '@/lib/i18n-gender';
import { useState, useEffect } from 'react';
import { VISIBILITY_OPTIONS_SIMPLE } from '@/lib/visibility-options';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Camera, Loader2, Check, Palette, Users, Globe, Lock, MapPin, ChevronRight } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { BandaChangeSheet } from './BandaChangeSheet';

type PhotosVisibility = 'everyone' | 'friends' | 'nobody';

interface ProfileData {
  id: string;
  display_name: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say' | null;
  status_message: string | null;
  profile_theme_color: string;
  show_last_seen: boolean;
  show_online_status: boolean;
  show_read_receipts: boolean;
  show_typing_indicators: boolean;
  photos_visibility?: PhotosVisibility;
}

interface ProfileEditSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: ProfileData;
  onUpdate: () => void;
}

const themeColors = [
  '#6366f1', // Violet (default)
  '#ec4899', // Pink
  '#f43f5e', // Rose
  '#f97316', // Orange
  '#eab308', // Yellow
  '#22c55e', // Green
  '#14b8a6', // Teal
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
  '#8b5cf6', // Purple
];

const profileSchema = z.object({
  display_name: z.string().min(2, 'Name must be at least 2 characters'),
  username: z.string().min(3, 'Username must be at least 3 characters').max(20),
  bio: z.string().max(150, 'Bio must be less than 150 characters').optional(),
  status_message: z.string().max(100, 'Status must be less than 100 characters').optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export function ProfileEditSheet({ open, onOpenChange, profile, onUpdate }: ProfileEditSheetProps) {
  const { user, updateProfile, refreshProfile, profile: authProfile } = useAuth();
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [bandaOpen, setBandaOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url);
  const [themeColor, setThemeColor] = useState(profile.profile_theme_color || '#6366f1');
  const [photosVisibility, setPhotosVisibility] = useState<PhotosVisibility>(profile.photos_visibility || 'friends');
  const [gender, setGender] = useState<'male' | 'female' | 'other' | ''>(authProfile?.gender || '');
  const [privacySettings, setPrivacySettings] = useState({
    show_last_seen: profile.show_last_seen,
    show_online_status: profile.show_online_status,
    show_read_receipts: profile.show_read_receipts,
    show_typing_indicators: profile.show_typing_indicators,
  });

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      display_name: profile.display_name,
      username: profile.username,
      bio: profile.bio || '',
      status_message: profile.status_message || '',
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        display_name: profile.display_name,
        username: profile.username,
        bio: profile.bio || '',
        status_message: profile.status_message || '',
      });
      setAvatarUrl(profile.avatar_url);
      setThemeColor(profile.profile_theme_color || '#6366f1');
      setPhotosVisibility(profile.photos_visibility || 'friends');
      setPrivacySettings({
        show_last_seen: profile.show_last_seen,
        show_online_status: profile.show_online_status,
        show_read_receipts: profile.show_read_receipts,
        show_typing_indicators: profile.show_typing_indicators,
      });
    }
  }, [open, profile]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/avatar-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Update avatar URL in state
      setAvatarUrl(publicUrl);
      
      // Also update the database immediately so the photo is saved
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', profile.id);

      if (updateError) throw updateError;
      
      // Refresh profile so UI updates everywhere
      await refreshProfile();
      
      toast.success(t('profile.photoUpdated') || 'Photo updated!');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(t('profile.uploadFailed') || 'Failed to upload photo');
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = async (values: ProfileFormValues) => {
    setIsLoading(true);
    try {
      // Check username availability if changed
      if (values.username !== profile.username) {
        const { data: existing } = await supabase
          .from('public_profiles')
          .select('username')
          .eq('username', values.username.toLowerCase())
          .neq('id', profile.id)
          .single();

        if (existing) {
          form.setError('username', { message: 'Username is already taken' });
          setIsLoading(false);
          return;
        }
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: values.display_name,
          username: values.username.toLowerCase(),
          bio: values.bio || null,
          status_message: values.status_message || null,
          avatar_url: avatarUrl,
          profile_theme_color: themeColor,
          photos_visibility: photosVisibility,
          gender: gender || null,
          ...privacySettings,
        })
        .eq('id', profile.id);

      if (error) throw error;

      toast.success('Profile updated!');
      
      // Refresh global auth state so header/other components update
      await refreshProfile();
      
      onUpdate();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[90vh] rounded-t-3xl">
        <SheetHeader className="pb-4">
          <SheetTitle>Edit Profile</SheetTitle>
        </SheetHeader>

        <div className="overflow-y-auto h-[calc(100%-60px)] pb-8 -mx-6 px-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Avatar */}
              <div className="flex justify-center">
                <div className="relative">
                  <Avatar className="w-24 h-24 border-4 border-primary/20">
                    <AvatarImage src={avatarUrl || ''} />
                    <AvatarFallback
                      className="text-3xl text-white"
                      style={{ background: `linear-gradient(135deg, ${themeColor} 0%, ${themeColor}88 100%)` }}
                    >
                      {profile.display_name[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <label
                    htmlFor="avatar-edit"
                    className={cn(
                      "absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center cursor-pointer hover:bg-primary/90 transition-colors shadow-md",
                      uploading && "opacity-50 pointer-events-none"
                    )}
                  >
                    {uploading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Camera className="w-4 h-4" />
                    )}
                  </label>
                  <input
                    id="avatar-edit"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarUpload}
                    disabled={uploading}
                  />
                </div>
              </div>

              {/* Theme Color */}
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <Palette className="w-4 h-4" />
                  Profile Theme
                </Label>
                <div className="flex flex-wrap gap-3">
                  {themeColors.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setThemeColor(color)}
                      className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center transition-all",
                        themeColor === color && "ring-2 ring-offset-2 ring-primary"
                      )}
                      style={{ backgroundColor: color }}
                    >
                      {themeColor === color && (
                        <Check className="w-5 h-5 text-white" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Display Name */}
              <FormField
                control={form.control}
                name="display_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Display Name</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        className="h-12 rounded-xl bg-secondary/50 border-0"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Username */}
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        className="h-12 rounded-xl bg-secondary/50 border-0"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Status Message */}
              <FormField
                control={form.control}
                name="status_message"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="What's on your mind?"
                        className="h-12 rounded-xl bg-secondary/50 border-0"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Bio */}
              <FormField
                control={form.control}
                name="bio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bio</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Tell us about yourself..."
                        className="min-h-[100px] rounded-xl bg-secondary/50 border-0 resize-none"
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground text-right">
                      {(field.value || '').length}/150
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Género (define Bradas vs Sis na linguagem da banda) */}
              <div className="space-y-2">
                <Label>{t('profile.gender', 'Género')}</Label>
                <Select value={gender} onValueChange={(v) => setGender(v as typeof gender)}>
                  <SelectTrigger className="h-12 rounded-xl bg-secondary/50">
                    <SelectValue placeholder={t('profile.genderUnset', 'Não definido')} />
                  </SelectTrigger>
                  <SelectContent className="z-[9999] bg-popover border shadow-lg" position="popper" sideOffset={4}>
                    <SelectItem value="female">👩🏾 {t('profile.genderFemale', 'Feminino')}</SelectItem>
                    <SelectItem value="male">👨🏾 {t('profile.genderMale', 'Masculino')}</SelectItem>
                    <SelectItem value="other">🌟 {t('profile.genderOther', 'Outro')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Banda (neighborhood) */}
              <div className="space-y-2 pt-4 border-t">
                <Label className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" /> A minha banda
                </Label>
                <button
                  type="button"
                  onClick={() => setBandaOpen(true)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-secondary/50 text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {authProfile?.neighborhood || 'Definir a minha banda'}
                      {authProfile?.city ? ` · ${authProfile.city}` : ''}
                    </div>
                    <div className="text-xs text-muted-foreground">Mudaste-te? Atualiza aqui a tua vizinhança.</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </button>
              </div>

              {/* Privacy Settings */}
              <div className="space-y-4 pt-4 border-t">
                <h3 className="font-semibold">{t('settings.privacy') || 'Privacy'}</h3>
                
                {/* Photos Visibility */}
                <div className="space-y-2">
                  <Label>{t('profile.photosVisibility') || 'Who can see my photos'}</Label>
                  <Select value={photosVisibility} onValueChange={(v) => setPhotosVisibility(v as PhotosVisibility)}>
                    <SelectTrigger className="h-12 rounded-xl bg-secondary/50 border-2 border-primary/30">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent 
                      className="z-[9999] bg-popover border shadow-lg"
                      position="popper"
                      sideOffset={4}
                    >
                      {VISIBILITY_OPTIONS_SIMPLE.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          <div className="flex items-center gap-2">
                            <span>{opt.emoji}</span>
                            {t(opt.labelKey, genderCtx(profile?.gender))}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex items-center justify-between">
                  <Label htmlFor="show_online">{t('profile.showOnlineStatus') || 'Show Online Status'}</Label>
                  <Switch
                    id="show_online"
                    checked={privacySettings.show_online_status}
                    onCheckedChange={(checked) =>
                      setPrivacySettings((p) => ({ ...p, show_online_status: checked }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="show_last_seen">{t('profile.showLastSeen') || 'Show Last Seen'}</Label>
                  <Switch
                    id="show_last_seen"
                    checked={privacySettings.show_last_seen}
                    onCheckedChange={(checked) =>
                      setPrivacySettings((p) => ({ ...p, show_last_seen: checked }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="show_read">{t('profile.readReceipts') || 'Read Receipts'}</Label>
                  <Switch
                    id="show_read"
                    checked={privacySettings.show_read_receipts}
                    onCheckedChange={(checked) =>
                      setPrivacySettings((p) => ({ ...p, show_read_receipts: checked }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="show_typing">{t('profile.typingIndicators') || 'Typing Indicators'}</Label>
                  <Switch
                    id="show_typing"
                    checked={privacySettings.show_typing_indicators}
                    onCheckedChange={(checked) =>
                      setPrivacySettings((p) => ({ ...p, show_typing_indicators: checked }))
                    }
                  />
                </div>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full h-12 rounded-xl bg-gradient-primary text-white font-semibold"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </form>
          </Form>
        </div>

        <BandaChangeSheet
          open={bandaOpen}
          onOpenChange={setBandaOpen}
          current={{
            country_code: authProfile?.country_code ?? null,
            city: authProfile?.city ?? null,
            neighborhood: authProfile?.neighborhood ?? null,
          }}
          onChanged={async () => { await refreshProfile(); onUpdate(); }}
        />
      </SheetContent>
    </Sheet>
  );
}
