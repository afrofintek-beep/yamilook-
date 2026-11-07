import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { QRCodeSVG } from 'qrcode.react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Share2, Download, Copy, MapPin } from 'lucide-react';
import { toast } from 'sonner';

interface ProfileData {
  id: string;
  display_name: string;
  username: string;
  avatar_url: string | null;
  profile_theme_color: string;
  bandaName?: string | null;
}

interface ProfileQRCodeProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: ProfileData;
}

export function ProfileQRCode({ open, onOpenChange, profile }: ProfileQRCodeProps) {
  useUiLocale();
  const profileUrl = `${window.location.origin}/profile/${profile.id}`;
  const themeColor = profile.profile_theme_color || '#6366f1';

  const handleCopy = async () => {
    await navigator.clipboard.writeText(profileUrl);
    toast.success(uiText("Link copied to clipboard!"));
  };

  const handleShare = async () => {
    const isInIframe = (() => {
      try {
        return window.self !== window.top;
      } catch {
        return true;
      }
    })();

    const canNativeShare = Boolean(navigator.share) && window.isSecureContext && !isInIframe;

    if (canNativeShare) {
      try {
        await navigator.share({
          title: `${profile.display_name} on Yamilook`,
          text: `Add me on Yamilook! @${profile.username}`,
          url: profileUrl,
        });
        onOpenChange(false);
        return;
      } catch (error) {
        // If native share fails, fall back to copy
      }
    }

    // Fallback: copy and close with clear feedback
    await navigator.clipboard.writeText(profileUrl);
    toast.success(uiText("Link do perfil copiado!"));
    onOpenChange(false);
  };

  const handleDownload = () => {
    const svg = document.getElementById('profile-qr-code');
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    // Use window.Image to avoid any potential name shadowing/minification issues.
    const img = new window.Image();

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);

      const pngUrl = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.href = pngUrl;
      downloadLink.download = `yamilook-${profile.username}-qr.png`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">{uiText("Share Profile")}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center py-6">
          {/* Profile Info */}
          <Avatar className="w-20 h-20 mb-4 border-4 border-primary/20">
            <AvatarImage src={profile.avatar_url || ''} />
            <AvatarFallback
              className="text-2xl text-white"
              style={{ background: `linear-gradient(135deg, ${themeColor} 0%, ${themeColor}88 100%)` }}
            >
              {profile.display_name[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <h3 className="text-lg font-bold">{profile.display_name}</h3>
          <p className="text-muted-foreground">@{profile.username}</p>
          {profile.bandaName && (
            <div className="flex items-center gap-1 mt-1">
              <MapPin className="w-3 h-3 text-primary" />
              <span className="text-xs font-medium text-primary">{profile.bandaName}</span>
            </div>
          )}

          {/* QR Code */}
          <div
            className="mt-6 p-4 rounded-2xl"
            style={{ backgroundColor: `${themeColor}15` }}
          >
            <QRCodeSVG
              id="profile-qr-code"
              value={profileUrl}
              size={200}
              level="H"
              bgColor="transparent"
              fgColor={themeColor}
              includeMargin={false}
            />
          </div>

          <p className="mt-4 text-sm text-muted-foreground text-center">{uiText("Scan this QR code to view my profile")}</p>

          {/* Actions */}
          <div className="flex gap-3 mt-6 w-full">
            <Button
              variant="outline"
              className="flex-1 h-12 rounded-xl"
              onClick={handleCopy}
            >
              <Copy className="w-4 h-4 mr-2" />{uiText("Copy Link")}</Button>
            <Button
              variant="outline"
              className="flex-1 h-12 rounded-xl"
              onClick={handleDownload}
            >
              <Download className="w-4 h-4 mr-2" />{uiText("Save QR")}</Button>
          </div>

          <div
            onClick={handleShare}
            className="w-full mt-3 p-4 rounded-2xl bg-gradient-to-r from-primary to-primary/80 cursor-pointer hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
          >
            <div className="flex items-center justify-center gap-3 text-primary-foreground">
              <Share2 className="w-5 h-5" />
              <span className="font-semibold text-base">{uiText("Share Profile")}</span>
            </div>
          </div>

          <Button
            type="button"
            variant="ghost"
            className="w-full h-10 rounded-xl mt-2"
            onClick={() => onOpenChange(false)}
          >{uiText("Fechar")}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
