import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Star,
  Loader2,
  Download,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ProfilePhoto {
  id: string;
  photo_url: string;
  is_primary: boolean;
  display_order: number;
}

interface ProfilePhotosGalleryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  photos: ProfilePhoto[];
  avatarUrl: string | null;
  isOwnProfile: boolean;
  selectedIndex: number;
  onPhotosUpdate: () => void;
}

export function ProfilePhotosGallery({
  open,
  onOpenChange,
  photos,
  avatarUrl,
  isOwnProfile,
  selectedIndex,
  onPhotosUpdate,
}: ProfilePhotosGalleryProps) {
  useUiLocale();
  const { user, refreshProfile } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(selectedIndex);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Combine avatar with photos
  const allPhotos = avatarUrl
    ? [{ id: 'avatar', photo_url: avatarUrl, is_primary: true, display_order: -1 }, ...photos]
    : photos;

  const currentPhoto = allPhotos[currentIndex];

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : allPhotos.length - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < allPhotos.length - 1 ? prev + 1 : 0));
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/photo-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Add to profile_photos table
      const { error: insertError } = await supabase
        .from('profile_photos')
        .insert({
          user_id: user.id,
          photo_url: publicUrl,
          display_order: photos.length,
        });

      if (insertError) throw insertError;

      toast.success(uiText("Photo added!"));
      onPhotosUpdate();
    } catch (error) {
      toast.error(uiText("Failed to upload photo"));
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDelete = async () => {
    if (!currentPhoto || currentPhoto.id === 'avatar') return;

    setDeleting(true);
    try {
      const { error } = await supabase
        .from('profile_photos')
        .delete()
        .eq('id', currentPhoto.id);

      if (error) throw error;

      toast.success(uiText("Photo deleted"));

      // Adjust index if needed
      if (currentIndex >= allPhotos.length - 1) {
        setCurrentIndex(Math.max(0, allPhotos.length - 2));
      }

      onPhotosUpdate();
    } catch (error) {
      toast.error(uiText("Failed to delete photo"));
    } finally {
      setDeleting(false);
    }
  };

  const handleSetPrimary = async () => {
    if (!currentPhoto || currentPhoto.id === 'avatar' || !user) return;

    try {
      // Update avatar_url in profiles table
      const { error } = await supabase
        .from('profiles')
        .update({ avatar_url: currentPhoto.photo_url })
        .eq('id', user.id);

      if (error) throw error;

      toast.success(uiText("Profile photo updated!"));

      // Refresh global auth state so header/other components update
      await refreshProfile();

      onPhotosUpdate();
    } catch (error) {
      toast.error(uiText("Failed to set as profile photo"));
    }
  };

  const handleDownload = async () => {
    if (!currentPhoto) return;

    try {
      const response = await fetch(currentPhoto.photo_url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `photo-${Date.now()}.jpg`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      toast.error(uiText("Failed to download photo"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-full h-full p-0 bg-black border-0 gap-0" hideCloseButton>
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-gradient-to-b from-black/60 to-transparent">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full text-white hover:bg-white/20"
            onClick={() => onOpenChange(false)}
          >
            <X className="w-6 h-6" />
          </Button>
          <span className="text-white font-medium">
            {currentIndex + 1} / {allPhotos.length}
          </span>
          <div className="w-10" /> {/* Spacer for alignment */}
        </div>

        {/* Main Image */}
        <div className="flex-1 flex items-center justify-center relative">
          <AnimatePresence mode="wait">
            {currentPhoto && (
              <motion.img
                key={currentPhoto.id}
                src={currentPhoto.photo_url}
                alt=""
                className="max-w-full max-h-full object-contain"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
              />
            )}
          </AnimatePresence>

          {/* Navigation Arrows */}
          {allPhotos.length > 1 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full text-white bg-black/40 hover:bg-black/60"
                onClick={handlePrevious}
              >
                <ChevronLeft className="w-6 h-6" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full text-white bg-black/40 hover:bg-black/60"
                onClick={handleNext}
              >
                <ChevronRight className="w-6 h-6" />
              </Button>
            </>
          )}
        </div>

        {/* Thumbnails */}
        {allPhotos.length > 1 && (
          <div className="absolute bottom-24 left-0 right-0 flex justify-center gap-2 px-4 overflow-x-auto scrollbar-hide">
            {allPhotos.map((photo, index) => (
              <button
                key={photo.id}
                onClick={() => setCurrentIndex(index)}
                className={cn(
                  "w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 transition-all",
                  index === currentIndex
                    ? "ring-2 ring-white scale-110"
                    : "opacity-60 hover:opacity-100"
                )}
              >
                <img
                  src={photo.photo_url}
                  alt=""
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/60 to-transparent">
          <div className="flex justify-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full text-white hover:bg-white/20"
              onClick={handleDownload}
            >
              <Download className="w-5 h-5" />
            </Button>

            {isOwnProfile && (
              <>
                {currentPhoto?.id !== 'avatar' && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="rounded-full text-white hover:bg-white/20"
                      onClick={handleSetPrimary}
                    >
                      <Star className="w-5 h-5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="rounded-full text-white hover:bg-white/20"
                      onClick={handleDelete}
                      disabled={deleting}
                    >
                      {deleting ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Trash2 className="w-5 h-5" />
                      )}
                    </Button>
                  </>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full text-white hover:bg-white/20"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Plus className="w-5 h-5" />
                  )}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleUpload}
                />
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
