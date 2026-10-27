import { genderCtx } from '@/lib/i18n-gender';
import React, { useState, useCallback } from 'react';
import { VISIBILITY_OPTIONS } from '@/lib/visibility-options';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  User,
  Users,
  Bell,
  Lock,
  Palette,
  HelpCircle,
  Info,
  LogOut,
  Moon,
  Sun,
  Smartphone,
  MessageSquare,
  Database,
  Globe,
  Volume2,
  Vibrate,
  Clock,
  Download,
  Eye,
  Shield,
  Key,
  UserX,
  Trash2,
  Keyboard,
  Image as ImageIcon,
  CloudUpload,
  Share2,
  Star,
  Heart,
  FileText,
  Zap,
  Wifi,
  BellOff,
  BellRing,
  Check,
  Megaphone,
  Phone,
  Archive,
  Calendar,
  MapPin,
  type LucideIcon,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { useSettings } from '@/hooks/useSettings';
import { useAdvertising } from '@/hooks/useAdvertising';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { applyTheme, type ThemePref } from '@/lib/theme';
import { languages } from '@/i18n';
import { InviteSheet } from '@/components/settings/InviteSheet';
import { supabase } from '@/integrations/supabase/client';
import { ChangePasswordSheet } from '@/components/settings/ChangePasswordSheet';
import { ConnectedDevices } from '@/components/settings/ConnectedDevices';
import { ChatWallpaperSheet } from '@/components/settings/ChatWallpaperSheet';
import { ArchivedChatsSheet } from '@/components/settings/ArchivedChatsSheet';
import { TwoFactorSheet } from '@/components/settings/TwoFactorSheet';
import { BlockedUsersSheet } from '@/components/settings/BlockedUsersSheet';
import { useMessageNotification } from '@/hooks/useMessageNotification';
import { SOUND_LABELS, type SoundName } from '@/lib/notification-sounds';
import { BackupManager } from '@/components/settings/BackupManager';

// Helper function to get flag emoji for language codes
const getLanguageFlag = (code: string): string => {
  const flags: Record<string, string> = {
    pt: '🇦🇴',
    'pt-banda': '🔥',
    en: '🇬🇧',
    fr: '🇫🇷',
    ar: '🇸🇦',
    sw: '🇹🇿',
    am: '🇪🇹',
    ln: '🇨🇩',
    kmb: '🇦🇴',
    umb: '🇦🇴',
    kg: '🇨🇩',
    cjk: '🇦🇴',
  };
  return flags[code] || '🌍';
};

export default function Settings() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { user, profile, signOut, updateProfile } = useAuth();
  const { settings, updateSettings } = useSettings();
  const { toast } = useToast();
  const { businessProfile } = useAdvertising();
  const { notify, playNotificationSound, triggerVibration } = useMessageNotification();
  const { isAdmin } = useAdmin();
  const isVibrationSupported = typeof navigator !== 'undefined' && 'vibrate' in navigator;
  const [signingOut, setSigningOut] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [storageOpen, setStorageOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [chatWallpaperOpen, setChatWallpaperOpen] = useState(false);
  const [archivedChatsOpen, setArchivedChatsOpen] = useState(false);
  const [twoFactorOpen, setTwoFactorOpen] = useState(false);
  const [devicesOpen, setDevicesOpen] = useState(false);
  const [blockedUsersOpen, setBlockedUsersOpen] = useState(false);

  const testNotification = useCallback(() => {
    const soundSetting = (settings?.notification_sound || 'default') as SoundName;
    const soundType = Object.keys(SOUND_LABELS).includes(soundSetting) ? soundSetting : 'default';
    playNotificationSound(soundType as SoundName);
    if (settings?.vibration_enabled) {
      if (isVibrationSupported) {
        triggerVibration('message');
        toast({ title: '🔔 Notificação de teste enviada', description: 'Se ouviste o som e sentiste a vibração, está a funcionar!' });
      } else {
        toast({ title: '🔔 Som de notificação enviado', description: 'A vibração não é suportada neste dispositivo (iOS).' });
      }
    } else {
      toast({ title: '🔔 Notificação de teste enviada', description: 'Se ouviste o som, está a funcionar!' });
    }
  }, [settings, playNotificationSound, triggerVibration, toast, isVibrationSupported]);

  const handleLanguageChange = async (langCode: string) => {
    i18n.changeLanguage(langCode);
    const { error } = await updateSettings({ language: langCode });
    if (!error) {
      toast({ title: t('settings.languageUpdated') || 'Language updated' });
    }
    // Handle RTL for Arabic
    const lang = languages.find(l => l.code === langCode);
    if (lang?.rtl) {
      document.documentElement.dir = 'rtl';
    } else {
      document.documentElement.dir = 'ltr';
    }
  };

  const handleSignOut = async () => {
    if (signingOut) return;

    setSigningOut(true);
    try {
      await signOut();
      navigate('/login', { replace: true });
    } catch (error) {
      console.error('Sign out error:', error);
      toast({
        title: t('settings.logOut') || 'Logout',
        description: t('errors.generic') || 'Não foi possível terminar a sessão. Tenta novamente.',
        variant: 'destructive',
      });
    } finally {
      setSigningOut(false);
    }
  };

  const handleThemeChange = async (theme: string) => {
    applyTheme(theme as ThemePref); // apply immediately (also persists to localStorage)
    const { error } = await updateSettings({ theme });
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: t('settings.themeUpdated', 'Tema atualizado') });
    }
  };

  const handleToggleSetting = async (key: keyof typeof settings, value: boolean) => {
    if (!settings) return;
    const { error } = await updateSettings({ [key]: value });
    if (!error) {
      toast({ title: 'Setting updated' });
    }
  };

  const handlePrivacyToggle = async (key: string, value: boolean) => {
    const { error } = await updateProfile({ [key]: value });
    if (!error) {
      toast({ title: 'Privacy setting updated' });
    }
  };

  const SettingItem = React.forwardRef<
    HTMLButtonElement,
    {
      icon: LucideIcon;
      label: string;
      description?: string;
      onClick?: () => void;
      rightElement?: React.ReactNode;
      danger?: boolean;
      badge?: string;
      delay?: number;
    }
  >(({
    icon: Icon,
    label,
    description,
    onClick,
    rightElement,
    danger,
    badge,
    delay = 0,
  }, ref) => {
    // Check if there's a rightElement with interactive controls
    const hasInteractiveRightElement = rightElement !== undefined;
    
    const content = (
      <>
        <div
          className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
            danger ? "bg-destructive/10" : "bg-secondary"
          )}
        >
          <Icon className={cn("w-5 h-5", danger ? "text-destructive" : "text-foreground")} />
        </div>

        <div className="min-w-0 overflow-hidden pr-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-medium truncate min-w-0">{label}</span>
            {badge && (
              <Badge variant="secondary" className="text-xs px-1.5 py-0 shrink-0">
                {badge}
              </Badge>
            )}
          </div>
          {description && <span className="text-sm text-muted-foreground block truncate">{description}</span>}
        </div>

        {(rightElement || onClick) && (
          <div className="shrink-0 flex items-center gap-2">
            {rightElement}
            {onClick && <ChevronRight className="w-5 h-5 text-muted-foreground" />}
          </div>
        )}
      </>
    );

    // Use button for clickable items without interactive right elements
    // Use div for items with interactive right elements (to avoid nested buttons)
    if (onClick && !hasInteractiveRightElement) {
      return (
        <motion.button
          ref={ref}
          type="button"
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay }}
          onClick={onClick}
          className={cn(
            "w-full grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3.5 hover:bg-secondary/50 transition-all text-left active:scale-[0.99] touch-manipulation",
            danger && "text-destructive"
          )}
        >
          {content}
        </motion.button>
      );
    }

    // For items with interactive right elements or no onClick
    return (
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay }}
        className={cn(
          "w-full grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3.5 hover:bg-secondary/50 transition-all text-left",
          danger && "text-destructive",
          onClick && "cursor-pointer active:scale-[0.99] touch-manipulation"
        )}
        onClick={onClick}
        role={onClick ? "button" : undefined}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={(e) => {
          if (!onClick) return;
          if (e.key === 'Enter' || e.key === ' ') onClick();
        }}
      >
        {content}
      </motion.div>
    );
  });
  SettingItem.displayName = 'SettingItem';

  const SectionHeader = ({ title, delay = 0 }: { title: string; delay?: number }) => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay }}
      className="px-4 py-2.5 bg-secondary/30"
    >
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</span>
    </motion.div>
  );


  return (
    <div className="h-screen-safe overflow-hidden pb-[env(safe-area-inset-bottom,0px)] bg-background flex flex-col">
      {/* Header */}
      <header className="shrink-0 relative z-50 bg-background/95 backdrop-blur-sm border-b border-border/50 safe-top">
        <div className="flex items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" className="rounded-full shrink-0" onClick={() => navigate(-1)}>
            <ChevronLeft className="w-6 h-6" />
          </Button>
          <h1 className="text-xl font-bold">{t('settings.title')}</h1>
        </div>
      </header>

      {/* Content */}
      <ScrollArea className="min-h-0 flex-1 [&_[data-radix-scroll-area-viewport]]:overscroll-y-contain">
        <div className="pb-8">
          {/* Profile Section */}
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => navigate('/profile')}
            className="w-full flex items-center gap-4 px-4 py-5 hover:bg-secondary/50 transition-colors active:scale-[0.99]"
          >
            <div className="relative shrink-0">
              <Avatar className="w-16 h-16 border-2 border-primary/20">
                <AvatarImage src={profile?.avatar_url || ''} />
                <AvatarFallback className="bg-gradient-primary text-white text-xl">
                  {profile?.display_name?.[0]?.toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
            </div>
            <div className="flex-1 min-w-0 text-left">
              <span className="font-semibold text-lg block truncate">{profile?.display_name || 'User'}</span>
              <span className="text-muted-foreground block truncate">
                {profile?.status_message || t('profile.editProfile')}
              </span>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
          </motion.button>

          <Separator />

          {/* Quick Actions */}
          <div className="p-4 grid grid-cols-2 gap-3">
            {[
              { id: 'backup', icon: CloudUpload, label: t('settings.backup'), color: 'text-blue-500', onClick: () => setStorageOpen(true) },
              { id: 'invite', icon: Share2, label: t('settings.invite'), color: 'text-green-500', onClick: () => setInviteOpen(true) },
            ].map((action, index) => (
              <motion.button
                key={action.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
                onClick={action.onClick}
                className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-secondary/50 hover:bg-secondary transition-colors"
              >
                <action.icon className={cn("w-6 h-6", action.color)} />
                <span className="text-xs font-medium text-center">{action.label}</span>
              </motion.button>
            ))}
          </div>

          <Separator />

          <Button variant="ghost" className="w-full justify-start gap-3 px-4 h-14 rounded-none" onClick={() => navigate('/install')}>
            <Smartphone className="w-5 h-5" />
            Instalar Yamilook · modo aplicação
            <ChevronRight className="w-4 h-4 ml-auto" />
          </Button>

          {/* Appearance */}
          <SectionHeader title={t('settings.appearance')} delay={0.1} />
          <SettingItem
            icon={settings?.theme === 'dark' ? Moon : settings?.theme === 'light' ? Sun : Smartphone}
            label={t('settings.theme')}
            description={settings?.theme === 'system' ? t('settings.themeSystem') : settings?.theme === 'dark' ? t('settings.themeDark') : t('settings.themeLight')}
            delay={0.12}
            rightElement={
              <div className="flex gap-1 shrink-0">
                {['light', 'dark', 'system'].map((theme) => (
                  <Button
                    key={theme}
                    size="sm"
                    variant={settings?.theme === theme ? 'default' : 'ghost'}
                    className={cn(
                      "w-8 h-8 p-0 rounded-lg",
                      settings?.theme === theme && "bg-primary text-primary-foreground"
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleThemeChange(theme);
                    }}
                  >
                    {theme === 'light' && <Sun className="w-4 h-4" />}
                    {theme === 'dark' && <Moon className="w-4 h-4" />}
                    {theme === 'system' && <Smartphone className="w-4 h-4" />}
                  </Button>
                ))}
              </div>
            }
          />
          <SettingItem
            icon={Globe}
            label={t('settings.language')}
            description={languages.find(l => l.code === (settings?.language || i18n.language))?.nativeName || 'Português'}
            delay={0.14}
            rightElement={
              <Select 
                value={settings?.language || i18n.language || 'pt'} 
                onValueChange={handleLanguageChange}
              >
                <SelectTrigger className="w-20 h-8 rounded-lg border-border bg-card px-2 text-sm [&>svg]:hidden">
                  <div className="flex items-center gap-1">
                    <span className="text-sm">{getLanguageFlag(settings?.language || i18n.language || 'pt')}</span>
                    <span className="text-xs font-semibold">
                      {(settings?.language || i18n.language || 'pt').toUpperCase()}
                    </span>
                  </div>
                </SelectTrigger>
                <SelectContent className="max-h-[320px] z-[100] bg-popover border border-border shadow-lg">
                  <div className="p-2 border-b border-border mb-1">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {t('settings.selectLanguage', 'Selecionar idioma')}
                    </span>
                  </div>
                  {languages.map((lang) => (
                    <SelectItem 
                      key={lang.code} 
                      value={lang.code}
                      className="py-2.5 px-3 cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{getLanguageFlag(lang.code)}</span>
                        <div className="flex flex-col">
                          <span className={cn("font-medium", lang.rtl && 'font-arabic')}>
                            {lang.nativeName}
                          </span>
                          {lang.name !== lang.nativeName && (
                            <span className="text-xs text-muted-foreground">{lang.name}</span>
                          )}
                        </div>
                        {(settings?.language || i18n.language) === lang.code && (
                          <Check className="w-4 h-4 text-primary ml-auto" />
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            }
          />

          <Separator />

          {/* Notifications */}
          <SectionHeader title={t('settings.notifications')} delay={0.16} />
          <SettingItem
            icon={Bell}
            label={t('settings.notificationSettings')}
            description={t('settings.soundsVibration')}
            delay={0.18}
            onClick={() => setNotificationsOpen(true)}
          />

          <Separator />

          {/* Privacy & Security */}
          <SectionHeader title={t('settings.privacy')} delay={0.2} />
          <SettingItem
            icon={Lock}
            label={t('settings.privacySettings')}
            description={t('settings.onlineStatusReadReceipts')}
            delay={0.22}
            onClick={() => setPrivacyOpen(true)}
          />
          <SettingItem
            icon={Shield}
            label={t('settings.twoFactorAuth')}
            description={profile?.two_factor_enabled ? t('settings.enabled') : t('settings.notEnabled')}
            badge={profile?.two_factor_enabled ? 'On' : undefined}
            delay={0.24}
            onClick={() => setTwoFactorOpen(true)}
          />
          <SettingItem
            icon={Smartphone}
            label="Dispositivos ligados"
            description="Gerir acessos à YAMILOOK e à KOSOLOLA"
            delay={0.25}
            onClick={() => setDevicesOpen(true)}
          />
          <SettingItem
            icon={Key}
            label={t('settings.changePassword')}
            delay={0.26}
            onClick={() => setChangePasswordOpen(true)}
          />

          <Separator />

          {/* Chats */}
          <SectionHeader title={t('settings.chats')} delay={0.28} />
          <SettingItem
            icon={ImageIcon}
            label={t('settings.chatWallpaper')}
            description={t('settings.customizeChatBackground')}
            delay={0.3}
            onClick={() => setChatWallpaperOpen(true)}
          />
          <SettingItem
            icon={Archive}
            label="Conversas Arquivadas"
            description="Ver e restaurar conversas arquivadas"
            delay={0.31}
            onClick={() => setArchivedChatsOpen(true)}
          />
          <SettingItem
            icon={Keyboard}
            label={t('settings.enterToSend')}
            description={t('settings.pressEnterToSend')}
            delay={0.32}
            rightElement={
              <Switch
                checked={settings?.enter_to_send ?? true}
                onCheckedChange={(v) => handleToggleSetting('enter_to_send', v)}
              />
            }
          />

          <Separator />

          {/* Storage & Data */}
          <SectionHeader title={t('settings.storage')} delay={0.34} />
          <SettingItem
            icon={Database}
            label={t('settings.storageUsage')}
            description="Consultar utilização real (apenas ficheiros atribuídos)"
            delay={0.36}
            onClick={() => setStorageOpen(true)}
          />
          <SettingItem
            icon={Download}
            label={t('settings.autoDownloadMedia')}
            description={settings?.auto_download_media === 'wifi' ? t('settings.wifiOnly') : settings?.auto_download_media}
            delay={0.38}
            rightElement={
              <Select
                value={settings?.auto_download_media || 'wifi'}
                onValueChange={(v) => updateSettings({ auto_download_media: v })}
              >
                <SelectTrigger className="w-28 h-9 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="always">{t('settings.always')}</SelectItem>
                  <SelectItem value="wifi">{t('settings.wifiOnly')}</SelectItem>
                  <SelectItem value="never">{t('common.no')}</SelectItem>
                </SelectContent>
              </Select>
            }
          />
          <SettingItem
            icon={Zap}
            label={t('settings.dataSaverMode')}
            description={t('settings.reduceDataUsage')}
            delay={0.4}
            rightElement={
              <Switch
                checked={settings?.data_saver_mode ?? false}
                onCheckedChange={(v) => handleToggleSetting('data_saver_mode', v)}
              />
            }
          />

          <Separator />

          {/* Advertising */}
          <SectionHeader title={t('settings.advertising') || 'Publicidade'} delay={0.41} />
          <SettingItem
            icon={Megaphone}
            label={t('settings.advertisingSettings') || 'Publicidade'}
            description={
              businessProfile 
                ? t('settings.manageAds') || 'Gerir anúncios e créditos'
                : t('settings.promoteYourBusiness') || 'Promova o seu negócio'
            }
            delay={0.42}
            onClick={() => navigate('/advertising')}
            badge={businessProfile ? `${businessProfile.credit_balance || 0} créditos` : undefined}
            rightElement={
              !businessProfile ? (
                <Badge variant="default" className="bg-primary text-primary-foreground">
                  {t('common.activate') || 'Ativar'}
                </Badge>
              ) : undefined
            }
          />

          <Separator />

          {/* Help & About */}
          <SectionHeader title={t('settings.help')} delay={0.44} />
          <SettingItem
            icon={HelpCircle}
            label={t('settings.helpCenter')}
            delay={0.44}
            onClick={() => navigate('/help')}
          />
          <SettingItem
            icon={FileText}
            label={t('settings.termsOfService')}
            delay={0.46}
            onClick={() => navigate('/terms')}
          />
          <SettingItem
            icon={Info}
            label={t('settings.aboutYamilook')}
            description={`${t('settings.version')} 1.0.0`}
            delay={0.48}
            onClick={() => setAboutOpen(true)}
          />

          {/* Admin Panel - Only visible for admins */}
          {isAdmin && (
            <>
              <Separator />
              <SectionHeader title="Administração" delay={0.49} />
              <SettingItem
                icon={Shield}
                label="Painel de Admin"
                description="Gerir dados e utilizadores"
                delay={0.5}
                onClick={() => navigate('/admin')}
              />
            </>
          )}

          <Separator />

          {/* Account Actions */}
          <SectionHeader title={t('settings.account')} delay={0.5} />
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <SettingItem
                icon={LogOut}
                label={t('settings.logOut')}
                danger
                delay={0.52}
                onClick={() => {}}
              />
            </AlertDialogTrigger>
            <AlertDialogContent className="rounded-2xl">
              <AlertDialogHeader>
                <AlertDialogTitle>{t('settings.logOutConfirm')}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t('settings.logOutDescription')}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="rounded-xl">{t('common.cancel')}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleSignOut}
                  disabled={signingOut}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl"
                >
                  {signingOut ? t('settings.loggingOut') : t('settings.logOut')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <SettingItem
                icon={Trash2}
                label={t('settings.deleteAccount')}
                danger
                delay={0.54}
                onClick={() => {}}
              />
            </AlertDialogTrigger>
            <AlertDialogContent className="rounded-2xl">
              <AlertDialogHeader>
                <AlertDialogTitle>{t('settings.deleteAccountConfirm')}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t('settings.deleteAccountDescription')}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="rounded-xl">{t('common.cancel')}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    const body = encodeURIComponent(
                      `Peço a eliminação permanente da minha conta Yamilook.\n\nUser ID: ${user?.id ?? ''}\nEmail: ${user?.email ?? ''}`,
                    );
                    window.location.href =
                      `mailto:contacto@afrofintek.com?subject=Pedido%20de%20elimina%C3%A7%C3%A3o%20de%20conta&body=${body}`;
                    toast({
                      title: 'Pedido de eliminação iniciado',
                      description: 'Abrimos o teu email para confirmares o pedido ao suporte.',
                    });
                  }}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl"
                >
                  {t('settings.deleteAccount')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* App Version Footer */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="text-center py-8 text-muted-foreground text-sm"
          >
            <p>Yamilook Messenger</p>
            <p className="text-xs mt-1">{t('settings.version')} 1.0.0 • {t('settings.madeWith')}</p>
          </motion.div>
        </div>
      </ScrollArea>

      {/* Notifications Sheet */}
      <Sheet open={notificationsOpen} onOpenChange={setNotificationsOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md h-screen-safe flex flex-col overflow-hidden p-0 pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)]">
          <SheetHeader className="shrink-0 p-4 pr-16 border-b">
            <SheetTitle>{t('settings.notifications')}</SheetTitle>
          </SheetHeader>
          <ScrollArea className="min-h-0 flex-1 [&_[data-radix-scroll-area-viewport]]:overscroll-y-contain">
            <div className="p-4 space-y-4">
              {/* Message Notifications */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground px-1">{t('settings.messageNotifications')}</h4>
                <SettingItem
                  icon={BellRing}
                  label={t('settings.messageNotifications')}
                  rightElement={
                    <Switch
                      checked={settings?.notifications_enabled ?? true}
                      onCheckedChange={(v) => handleToggleSetting('notifications_enabled', v)}
                    />
                  }
                />
                <SettingItem
                  icon={Volume2}
                  label={t('settings.notificationSound')}
                  rightElement={
                    <Select
                      value={settings?.notification_sound || 'default'}
                      onValueChange={(v) => {
                        updateSettings({ notification_sound: v });
                        // Preview the selected sound immediately
                        if (v !== 'none') playNotificationSound(v as SoundName);
                      }}
                    >
                      <SelectTrigger className="w-32 h-9 rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="z-[9999] bg-background border shadow-lg"
                        position="popper" side="bottom" sideOffset={4}>
                        {(Object.entries(SOUND_LABELS) as [SoundName, string][]).map(([key, label]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  }
                />
                <SettingItem
                  icon={Vibrate}
                  label={t('settings.vibration')}
                  rightElement={
                    <Switch
                      checked={isVibrationSupported && (settings?.vibration_enabled ?? true)}
                      disabled={!isVibrationSupported}
                      onCheckedChange={(v) => handleToggleSetting('vibration_enabled', v)}
                    />
                  }
                />
                <div className="px-1 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full rounded-xl gap-2"
                    onClick={() => {
                      testNotification();
                    }}
                  >
                    <Bell className="h-4 w-4" />
                    Testar Notificação
                  </Button>
                </div>
              </div>

              <Separator />

              {/* Call/Ringtone Settings */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground px-1">{t('settings.callSettings') || 'Chamadas'}</h4>
                <SettingItem
                  icon={Phone}
                  label={t('settings.ringtoneEnabled') || 'Toque de chamada'}
                  description={t('settings.playRingtone') || 'Reproduzir som ao receber chamadas'}
                  rightElement={
                    <Switch
                      checked={settings?.ringtone_enabled ?? true}
                      onCheckedChange={(v) => handleToggleSetting('ringtone_enabled', v)}
                    />
                  }
                />
                
                {settings?.ringtone_enabled && (
                  <>
                    <SettingItem
                      icon={Volume2}
                      label={t('settings.ringtoneVolume') || 'Volume do toque'}
                      rightElement={
                        <div className="w-24">
                          <Slider
                            value={[settings?.ringtone_volume ?? 0.5]}
                            min={0}
                            max={1}
                            step={0.1}
                            onValueChange={([v]) => updateSettings({ ringtone_volume: v })}
                          />
                        </div>
                      }
                    />
                    <SettingItem
                      icon={BellRing}
                      label={t('settings.ringtonePattern') || 'Padrão do toque'}
                      rightElement={
                        <Select 
                          value={settings?.ringtone_pattern || 'default'} 
                          onValueChange={(v) => updateSettings({ ringtone_pattern: v })}
                        >
                          <SelectTrigger className="w-28 h-9 rounded-xl">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="default">{t('settings.patternDefault') || 'Padrão'}</SelectItem>
                            <SelectItem value="classic">{t('settings.patternClassic') || 'Clássico'}</SelectItem>
                            <SelectItem value="modern">{t('settings.patternModern') || 'Moderno'}</SelectItem>
                            <SelectItem value="gentle">{t('settings.patternGentle') || 'Suave'}</SelectItem>
                            <SelectItem value="urgent">{t('settings.patternUrgent') || 'Urgente'}</SelectItem>
                            <SelectItem value="silent">{t('settings.patternSilent') || 'Silencioso'}</SelectItem>
                          </SelectContent>
                        </Select>
                      }
                    />
                  </>
                )}
                
                <SettingItem
                  icon={Vibrate}
                  label={t('settings.callVibration') || 'Vibração nas chamadas'}
                  description={t('settings.vibrateOnCalls') || 'Vibrar ao receber chamadas'}
                  rightElement={
                    <Switch
                      checked={settings?.call_vibration_enabled ?? true}
                      onCheckedChange={(v) => handleToggleSetting('call_vibration_enabled', v)}
                    />
                  }
                />
              </div>

              <Separator />

              {/* Quiet Hours */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground px-4">{t('settings.quietHours')}</h4>
                <SettingItem
                  icon={BellOff}
                  label={t('settings.enableQuietHours')}
                  description={t('settings.muteNotifications')}
                  rightElement={
                    <Switch
                      checked={settings?.quiet_hours_enabled ?? false}
                      onCheckedChange={(v) => handleToggleSetting('quiet_hours_enabled', v)}
                    />
                  }
                />
                {settings?.quiet_hours_enabled && (
                  <div className="px-4 py-2 space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">{t('settings.start')}</span>
                      <span className="text-sm font-medium">10:00 PM</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">{t('settings.end')}</span>
                      <span className="text-sm font-medium">7:00 AM</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Privacy Sheet */}
      <Sheet open={privacyOpen} onOpenChange={setPrivacyOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md h-screen-safe flex flex-col overflow-hidden p-0 pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)]">
          <SheetHeader className="shrink-0 p-4 pr-16 border-b">
            <SheetTitle>{t('settings.privacy')}</SheetTitle>
          </SheetHeader>
          <ScrollArea className="min-h-0 flex-1 [&_[data-radix-scroll-area-viewport]]:overscroll-y-contain">
            <div className="space-y-2 pt-2">
              <SettingItem
                icon={Eye}
                label={t('settings.showOnlineStatus')}
                description={t('settings.letOthersSeeOnline')}
                rightElement={
                  <Switch
                    checked={profile?.show_online_status ?? true}
                    onCheckedChange={(v) => handlePrivacyToggle('show_online_status', v)}
                  />
                }
              />
              <SettingItem
                icon={Clock}
                label={t('settings.showLastSeen')}
                description={t('settings.letOthersSeeLastActive')}
                rightElement={
                  <Switch
                    checked={profile?.show_last_seen ?? true}
                    onCheckedChange={(v) => handlePrivacyToggle('show_last_seen', v)}
                  />
                }
              />
              <SettingItem
                icon={MessageSquare}
                label={t('settings.readReceipts')}
                description={t('settings.showWhenReadMessages')}
                rightElement={
                  <Switch
                    checked={profile?.show_read_receipts ?? true}
                    onCheckedChange={(v) => handlePrivacyToggle('show_read_receipts', v)}
                  />
                }
              />

              <Separator className="my-4" />

              {/* Banda Visibility */}
              <div className="px-4 pb-2">
                <p className="text-sm font-semibold text-foreground">{t('settings.bandaIdentityTitle')}</p>
                <p className="text-xs text-muted-foreground">{t('settings.bandaIdentityDesc')}</p>
              </div>

              <div className="px-4 pb-4">
                <Select
                  value={settings?.show_banda ?? 'everyone'}
                  onValueChange={(v) => updateSettings({ show_banda: v })}
                >
                  <SelectTrigger className="w-full">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-primary" />
                      <SelectValue />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {VISIBILITY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.emoji} {t(opt.labelKey, genderCtx(profile?.gender))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator className="my-4" />

              {/* Journey Visibility Section */}
              <div className="px-4 pb-2">
                <p className="text-sm font-semibold text-foreground">{t('settings.journeyTitle')}</p>
                <p className="text-xs text-muted-foreground">{t('settings.journeyDesc')}</p>
              </div>

              <div className="px-4 pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{t('settings.journeyWhoCanSee')}</p>
                    <p className="text-xs text-muted-foreground">{t('settings.journeyWhoCanSeeDesc')}</p>
                  </div>
                  <Select
                    value={settings?.journey_visibility || 'everyone'}
                    onValueChange={(value) => updateSettings({ journey_visibility: value })}
                  >
                    <SelectTrigger className="w-[140px] h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VISIBILITY_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.emoji} {t(opt.labelKey, genderCtx(profile?.gender))}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <SettingItem
                icon={Users}
                label={t('settings.journeyFriends')}
                description={t('settings.journeyFriendsDesc')}
                rightElement={
                  <Switch
                    checked={settings?.show_journey_friends ?? true}
                    onCheckedChange={(v) => handleToggleSetting('show_journey_friends', v)}
                  />
                }
              />
              <SettingItem
                icon={ImageIcon}
                label={t('settings.journeyPosts')}
                description={t('settings.journeyPostsDesc')}
                rightElement={
                  <Switch
                    checked={settings?.show_journey_posts ?? true}
                    onCheckedChange={(v) => handleToggleSetting('show_journey_posts', v)}
                  />
                }
              />
              <SettingItem
                icon={Calendar}
                label={t('settings.journeyMomambos')}
                description={t('settings.journeyMomambosDesc')}
                rightElement={
                  <Switch
                    checked={settings?.show_journey_momambos ?? true}
                    onCheckedChange={(v) => handleToggleSetting('show_journey_momambos', v)}
                  />
                }
              />
              <SettingItem
                icon={MessageSquare}
                label={t('settings.journeyMessages')}
                description={t('settings.journeyMessagesDesc')}
                rightElement={
                  <Switch
                    checked={settings?.show_journey_messages ?? true}
                    onCheckedChange={(v) => handleToggleSetting('show_journey_messages', v)}
                  />
                }
              />
              <SettingItem
                icon={Phone}
                label={t('settings.journeyCalls')}
                description={t('settings.journeyCallsDesc')}
                rightElement={
                  <Switch
                    checked={settings?.show_journey_calls ?? true}
                    onCheckedChange={(v) => handleToggleSetting('show_journey_calls', v)}
                  />
                }
              />
              <SettingItem
                icon={Heart}
                label={t('settings.journeyReactions')}
                description={t('settings.journeyReactionsDesc')}
                rightElement={
                  <Switch
                    checked={settings?.show_journey_reactions ?? true}
                    onCheckedChange={(v) => handleToggleSetting('show_journey_reactions', v)}
                  />
                }
              />

              <Separator className="my-4" />

              <SettingItem
                icon={UserX}
                label={t('settings.blockedUsers')}
                description={t('settings.manageBlocked')}
                onClick={() => setBlockedUsersOpen(true)}
              />
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Secure, user-scoped backup manager shared with KOSOLOLA */}
      <Sheet open={storageOpen} onOpenChange={setStorageOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md h-screen-safe flex flex-col overflow-hidden p-0 pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)]">
          <SheetHeader className="shrink-0 p-4 pr-16 border-b">
            <SheetTitle>{t('settings.storageBackup')}</SheetTitle>
          </SheetHeader>
          <ScrollArea className="min-h-0 flex-1">
            <div className="p-4"><BackupManager /></div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* About Sheet */}
      <Sheet open={aboutOpen} onOpenChange={setAboutOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md h-screen-safe flex flex-col overflow-hidden p-0 pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)]">
          <SheetHeader className="shrink-0 p-4 pr-16 border-b">
            <SheetTitle>{t('settings.aboutYamilook')}</SheetTitle>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-6 text-center">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-24 h-24 rounded-3xl bg-gradient-primary mx-auto mb-4 flex items-center justify-center"
            >
              <MessageSquare className="w-12 h-12 text-white" />
            </motion.div>
            <h2 className="text-2xl font-bold mb-1">Yamilook</h2>
            <p className="text-muted-foreground mb-6">{t('settings.version')} 1.0.0</p>
            
            <div className="space-y-3 text-left">
              <Button
                variant="outline" className="w-full rounded-xl justify-between"
                onClick={() => { setAboutOpen(false); setInviteOpen(true); }}
              >
                {t('settings.shareApp')}
                <Share2 className="w-4 h-4" />
              </Button>
              <Button variant="outline" className="w-full rounded-xl justify-between" onClick={() => navigate('/privacy')}>
                {t('settings.privacyPolicy')}
                <FileText className="w-4 h-4" />
              </Button>
              <Button variant="outline" className="w-full rounded-xl justify-between" onClick={() => navigate('/terms')}>
                {t('settings.termsOfService')}
                <FileText className="w-4 h-4" />
              </Button>
            </div>

            <p className="text-xs text-muted-foreground mt-8">
              © 2025 Yamilook. All rights reserved.
            </p>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={devicesOpen} onOpenChange={setDevicesOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto pt-[env(safe-area-inset-top,0px)]">
          <SheetHeader className="mb-4 pr-8"><SheetTitle>Segurança da conta</SheetTitle></SheetHeader>
          {devicesOpen && <ConnectedDevices />}
        </SheetContent>
      </Sheet>

      {/* Change Password Sheet */}
      <ChangePasswordSheet 
        open={changePasswordOpen} 
        onOpenChange={setChangePasswordOpen} 
      />

      {/* Chat Wallpaper Sheet */}
      <ChatWallpaperSheet
        open={chatWallpaperOpen}
        onOpenChange={setChatWallpaperOpen}
      />

      {/* Archived Chats Sheet */}
      <ArchivedChatsSheet
        open={archivedChatsOpen}
        onOpenChange={setArchivedChatsOpen}
      />

      {/* Two-factor auth (TOTP via Supabase MFA) */}
      <TwoFactorSheet open={twoFactorOpen} onOpenChange={setTwoFactorOpen} />

      <InviteSheet isAdmin={isAdmin} open={inviteOpen} onOpenChange={setInviteOpen} />

      {/* Blocked users management */}
      <BlockedUsersSheet open={blockedUsersOpen} onOpenChange={setBlockedUsersOpen} />
    </div>
  );
}
