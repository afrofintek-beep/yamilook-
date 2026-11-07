import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AspectRatio } from '@/components/ui/aspect-ratio';

const promoVideos = [
  { id: 'feed', get title() { return uiText("Muxi & Stories"); }, get description() { return uiText("Partilha momentos com a tua banda"); }, video: '/promo/feed-stories-promo.mp4' },
  { id: 'ritmos', title: 'Ritmos', get description() { return uiText("Vídeos curtos estilo TikTok"); }, video: '/promo/ritmos-promo.mp4' },
  { id: 'palco', title: 'Palco', get description() { return uiText("Salas de áudio ao vivo"); }, video: '/promo/palco-promo.mp4' },
  { id: 'live', get title() { return uiText("Live"); }, get description() { return uiText("Transmissões em direto"); }, video: '/promo/live-promo.mp4' },
  { id: 'reactions', get title() { return uiText("African Reactions"); }, get description() { return uiText("Reações únicas africanas"); }, video: '/promo/reactions-promo.mp4' },
  { id: 'chat', get title() { return uiText("Chat"); }, get description() { return uiText("Mensagens e chamadas"); }, video: '/promo/chat-promo.mp4' },
];

export default function PromoVideos() {
  useUiLocale();
  const navigate = useNavigate();

  const handleDownload = async (videoUrl: string, title: string) => {
    try {
      const response = await fetch(videoUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `yamilook-${title.toLowerCase().replace(/\s+/g, '-')}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border safe-top">
        <div className="flex items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="font-semibold text-foreground">{uiText("Vídeos Promocionais")}</h1>
            <p className="text-xs text-muted-foreground">{uiText("6 vídeos para marketing")}</p>
          </div>
        </div>
      </header>

      {/* Video Grid */}
      <div className="p-4 grid grid-cols-2 gap-4">
        {promoVideos.map((promo, index) => (
          <motion.div
            key={promo.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="space-y-2"
          >
            <div className="relative rounded-xl overflow-hidden bg-muted">
              <AspectRatio ratio={9/16}>
                <video
                  src={promo.video}
                  className="w-full h-full object-cover pointer-events-none [&::-webkit-media-controls]:hidden [&::-webkit-media-controls-enclosure]:hidden [&::-webkit-media-controls-panel]:hidden"
                  loop
                  muted
                  playsInline
                  autoPlay
                  preload="auto"
                  controls={false}
                  disablePictureInPicture
                  disableRemotePlayback
                />
              </AspectRatio>
            </div>

            <div className="space-y-1">
              <h3 className="font-medium text-sm text-foreground">{promo.title}</h3>
              <p className="text-xs text-muted-foreground">{promo.description}</p>
              <Button
                variant="outline"
                size="sm"
                className="w-full mt-2"
                onClick={() => handleDownload(promo.video, promo.title)}
              >
                <Download className="w-3 h-3 mr-1" />{uiText("Download")}</Button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
