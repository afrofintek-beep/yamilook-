import { useAuth } from '@/hooks/useAuth';
import { genderCtx } from '@/lib/i18n-gender';
import { useState, useEffect, useRef, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { MapPin, Globe, Users, Circle, Lock, Loader2 } from 'lucide-react';
import type { PostWithUser } from '@/hooks/usePosts';
import { useKeyboardViewport } from '@/hooks/useKeyboardViewport';
import { PostContentTextarea } from './PostContentTextarea';

interface EditPostSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  post: PostWithUser;
  onSave: (updates: { content?: string; location?: string; privacy?: string }) => Promise<void>;
}

export function EditPostSheet({ open, onOpenChange, post, onSave }: EditPostSheetProps) {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const viewport = useKeyboardViewport(open);
  const fieldId = useId();
  const privacyOptions = [
    { value: 'everyone', icon: Globe, label: t('feed.publicAudience') },
    { value: 'contacts', icon: Users, label: t('privacy.friends') },
    { value: 'close_friends', icon: Circle, label: t('privacy.closeFriends', genderCtx(profile?.gender)) },
    { value: 'only_me', icon: Lock, label: t('privacy.onlyMe') },
  ];
  const [content, setContent] = useState(post.content || '');
  const [location, setLocation] = useState(post.location || '');
  const [privacy, setPrivacy] = useState(post.privacy);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const savingRef = useRef(false);
  const sessionPost = useRef<string | null>(null);
  const original = useRef({ content, location, privacy });
  const scrollRef = useRef<HTMLDivElement>(null);

  // Refresh a new session without overwriting typing on a background feed refresh.
  useEffect(() => {
    if (!open) {
      sessionPost.current = null;
      return;
    }
    if (sessionPost.current === post.id) return;
    sessionPost.current = post.id;
    original.current = { content: post.content || '', location: post.location || '', privacy: post.privacy };
    setContent(original.current.content);
    setLocation(original.current.location);
    setPrivacy(original.current.privacy);
    setSaveError(false);
    setConfirmClose(false);
  }, [open, post.id, post.content, post.location, post.privacy]);

  const dirty = content !== original.current.content || location !== original.current.location || privacy !== original.current.privacy;
  const canSave = dirty && Boolean(content.trim() || post.media_urls?.length);
  const requestClose = () => {
    if (savingRef.current) return;
    if (dirty) {
      setConfirmClose(true);
      if (scrollRef.current) scrollRef.current.scrollTop = 0;
    } else onOpenChange(false);
  };

  const handleSave = async () => {
    if (savingRef.current || !canSave) return;
    savingRef.current = true;
    setSaving(true);
    setSaveError(false);
    setConfirmClose(false);
    try {
      // Empty strings deliberately clear a removed caption or location.
      await onSave({ content, location, privacy });
      onOpenChange(false);
    } catch {
      setSaveError(true);
      if (scrollRef.current) scrollRef.current.scrollTop = 0;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={value => { if (!value) requestClose(); }}>
      <SheetContent
        side="bottom"
        hideCloseButton
        aria-describedby={undefined}
        style={{
          ...viewport.style,
          bottom: 'var(--group-viewport-bottom, 0px)',
          height: 'min(820px, calc(var(--group-viewport-height, 100dvh) * 0.96))',
          maxHeight: 'calc(var(--group-viewport-height, 100dvh) - env(safe-area-inset-top, 0px))',
        }}
        className="mx-auto flex w-full max-w-2xl flex-col gap-0 overflow-hidden rounded-t-2xl p-0"
      >
        <SheetHeader className="shrink-0 flex-row items-center justify-between gap-2 space-y-0 border-b px-3 py-2">
          <Button variant="ghost" size="sm" className="min-h-11 shrink-0" disabled={saving} onClick={requestClose}>
            {t('feed.cancel')}
          </Button>
          <SheetTitle className="min-w-0 flex-1 text-center text-sm sm:text-lg">{t('feed.editPost')}</SheetTitle>
          <Button size="sm" className="min-h-11 shrink-0 rounded-full" disabled={saving || !canSave} onClick={handleSave}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {saving ? t('common.saving') : t('common.save')}
          </Button>
        </SheetHeader>

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain" data-testid="edit-post-scroll">
          <div className="flex min-h-full flex-col gap-4 p-4" style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom, 0px))' }}>
            {saveError && <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm">{t('feed.editSaveError')}</p>}
            {confirmClose && (
              <div role="alert" className="space-y-3 rounded-xl border border-primary/40 bg-card p-3">
                <p className="font-medium">{t('feed.discardChangesTitle')}</p>
                <p className="text-sm text-muted-foreground">{t('feed.discardChangesDescription')}</p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" className="min-h-11" onClick={() => setConfirmClose(false)}>{t('feed.continueEditing')}</Button>
                  <Button variant="destructive" className="min-h-11" onClick={() => onOpenChange(false)}>{t('feed.discardDraft')}</Button>
                </div>
              </div>
            )}
            <label htmlFor={`${fieldId}-text`} className="text-sm font-medium">{t('feed.postText')}</label>
            <PostContentTextarea
              id={`${fieldId}-text`}
              value={content}
              disabled={saving}
              onChange={e => setContent(e.target.value)}
              placeholder={t('feed.whatsOnYourMind')}
              className="min-h-[180px] grow shrink-0 border-none bg-transparent p-0 shadow-none focus-visible:ring-0"
            />

            <div className="shrink-0 space-y-3 border-t pt-4">
              <div className="space-y-1.5">
                <label htmlFor={`${fieldId}-privacy`} className="text-sm font-medium">{t('status.whoCanSee')}</label>
                <Select value={privacy} disabled={saving} onValueChange={v => setPrivacy(v as typeof privacy)}>
                  <SelectTrigger id={`${fieldId}-privacy`} className="min-h-11 text-base"><SelectValue /></SelectTrigger>
                  <SelectContent className="z-[110]">
                    {privacyOptions.map(opt => (
                      <SelectItem key={opt.value} value={opt.value} className="min-h-11">
                        <div className="flex items-center gap-2"><opt.icon className="h-4 w-4" aria-hidden="true" /><span>{opt.label}</span></div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor={`${fieldId}-location`} className="flex items-center gap-2 text-sm font-medium"><MapPin className="h-4 w-4" aria-hidden="true" />{t('feed.addLocation')}</label>
                <Input id={`${fieldId}-location`} value={location} disabled={saving} onChange={e => setLocation(e.target.value)} placeholder={t('feed.addLocation')} className="min-h-11 text-base" />
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
