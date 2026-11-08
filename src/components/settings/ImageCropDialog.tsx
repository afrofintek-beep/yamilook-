import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { ZoomIn, ZoomOut, RotateCw, Maximize2 } from 'lucide-react';

interface ImageCropDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageSrc: string;
  onCropComplete: (croppedBlob: Blob) => void;
  aspectRatio?: number; // Optional: default is 9/16 (portrait)
}

function centerAspectCrop(
  mediaWidth: number,
  mediaHeight: number,
  aspect: number
) {
  return centerCrop(
    makeAspectCrop(
      {
        unit: '%',
        width: 90,
      },
      aspect,
      mediaWidth,
      mediaHeight
    ),
    mediaWidth,
    mediaHeight
  );
}

export function ImageCropDialog({
  open,
  onOpenChange,
  imageSrc,
  onCropComplete,
  aspectRatio: initialAspectRatio,
}: ImageCropDialogProps) {
  useUiLocale();
  const { t } = useTranslation();
  const imgRef = useRef<HTMLImageElement>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [scale, setScale] = useState(1);
  const [rotate, setRotate] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const defaultAspect = initialAspectRatio ?? 9 / 16;
  const [aspect, setAspect] = useState<number | undefined>(defaultAspect);

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    const initialCrop = centerAspectCrop(width, height, aspect || 1);
    setCrop(initialCrop);
  }, [aspect]);

  const handleRotate = () => {
    setRotate((prev) => (prev + 90) % 360);
  };

  const toggleAspect = () => {
    if (aspect) {
      setAspect(undefined);
    } else {
      setAspect(defaultAspect);
      if (imgRef.current) {
        const { width, height } = imgRef.current;
        setCrop(centerAspectCrop(width, height, defaultAspect));
      }
    }
  };

  const getCroppedImg = useCallback(async (): Promise<Blob | null> => {
    const image = imgRef.current;
    if (!image || !completedCrop) return null;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    // Calculate the actual crop dimensions in natural image coordinates
    const cropWidth = completedCrop.width * scaleX;
    const cropHeight = completedCrop.height * scaleY;
    const cropX = completedCrop.x * scaleX;
    const cropY = completedCrop.y * scaleY;

    // Set canvas size to the cropped area
    canvas.width = cropWidth;
    canvas.height = cropHeight;

    ctx.imageSmoothingQuality = 'high';

    // Simple crop without rotation/scale transformations applied to canvas
    // The scale/rotate are visual only in the preview
    ctx.drawImage(
      image,
      cropX,
      cropY,
      cropWidth,
      cropHeight,
      0,
      0,
      cropWidth,
      cropHeight
    );

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            console.error('Canvas toBlob returned null');
            reject(new Error(uiText("Failed to create blob from canvas")));
          }
        },
        'image/jpeg',
        0.92
      );
    });
  }, [completedCrop]);

  const handleApply = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      const croppedBlob = await getCroppedImg();
      if (croppedBlob) {
        onCropComplete(croppedBlob);
        onOpenChange(false);
      } else {
        console.error('Failed to generate cropped image');
      }
    } catch (error) {
      console.error('Error cropping image:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancel = () => {
    setCrop(undefined);
    setCompletedCrop(undefined);
    setScale(1);
    setRotate(0);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle>{t('settings.cropImage', 'Ajustar imagem')}</DialogTitle>
        </DialogHeader>

        {/* Crop area */}
        <div className="flex-1 overflow-hidden bg-muted/50 flex items-center justify-center p-4 min-h-[300px]">
          <ReactCrop
            crop={crop}
            onChange={(_, percentCrop) => setCrop(percentCrop)}
            onComplete={(c) => setCompletedCrop(c)}
            aspect={aspect}
            className="max-h-[50vh]"
          >
            <img
              ref={imgRef}
              src={imageSrc}
              alt={uiText("Crop preview")}
              onLoad={onImageLoad}
              style={{
                transform: `scale(${scale}) rotate(${rotate}deg)`,
                maxHeight: '50vh',
                objectFit: 'contain',
              }}
              crossOrigin="anonymous"
            />
          </ReactCrop>
        </div>

        {/* Controls */}
        <div className="p-4 border-t border-border space-y-4">
          {/* Zoom control */}
          <div className="flex items-center gap-3">
            <ZoomOut className="w-4 h-4 text-muted-foreground" />
            <Slider
              value={[scale]}
              min={0.5}
              max={3}
              step={0.1}
              onValueChange={([value]) => setScale(value)}
              className="flex-1"
            />
            <ZoomIn className="w-4 h-4 text-muted-foreground" />
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRotate}
              className="flex-1"
            >
              <RotateCw className="w-4 h-4 mr-2" />
              {t('settings.rotate', 'Rodar')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={toggleAspect}
              className="flex-1"
            >
              <Maximize2 className="w-4 h-4 mr-2" />
              {aspect ? t('settings.freeForm', 'Livre') : t('settings.portrait', 'Retrato')}
            </Button>
          </div>
        </div>

        <DialogFooter className="p-4 pt-0 gap-2">
          <Button variant="outline" onClick={handleCancel}>
            {t('common.cancel', 'Cancelar')}
          </Button>
          <Button onClick={handleApply} disabled={!completedCrop || isProcessing}>
            {isProcessing ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {t('common.processing', 'A processar...')}
              </span>
            ) : (
              t('settings.applyCrop', 'Aplicar recorte')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
