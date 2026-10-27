import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";

import { cn } from "@/lib/utils";
import { imageFitsVariant, optimizedPublicImageUrl } from "@/lib/image-delivery";

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn("relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full", className)}
    {...props}
  />
));
Avatar.displayName = AvatarPrimitive.Root.displayName;

type VariantAvatarImageProps = React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image> & {
  /** Opt-in: YAMILOOK-only avatars. Other apps keep their original URLs. */
  imageVariantSize?: 160 | 320;
};

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  VariantAvatarImageProps
>(({ className, src, onError, onLoad, imageVariantSize, ...props }, ref) => {
  const [failedSrc, setFailedSrc] = React.useState<string | null>(null);
  const variant = imageVariantSize
    ? { width: imageVariantSize, height: imageVariantSize, resize: 'cover' as const, quality: 78 }
    : null;
  const optimized = variant ? optimizedPublicImageUrl(src, variant) : src;
  const usingVariant = Boolean(variant && optimized && optimized !== src && failedSrc !== src);

  return (
    <AvatarPrimitive.Image
      loading="lazy"
      decoding="async"
      {...props}
      ref={ref}
      src={usingVariant ? optimized : src}
      data-image-delivery={imageVariantSize ? (usingVariant ? 'variant'
        : optimized !== src && failedSrc === src ? 'fallback' : 'original') : undefined}
      className={cn("aspect-square h-full w-full object-cover", className)}
      onError={event => {
        if (usingVariant && src) setFailedSrc(src);
        else onError?.(event);
      }}
      onLoad={event => {
        if (usingVariant && variant
          && !imageFitsVariant(event.currentTarget.naturalWidth, event.currentTarget.naturalHeight, variant)
          && src) setFailedSrc(src);
        onLoad?.(event);
      }}
    />
  );
});
AvatarImage.displayName = AvatarPrimitive.Image.displayName;

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn("flex h-full w-full items-center justify-center rounded-full bg-muted", className)}
    {...props}
  />
));
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName;

export { Avatar, AvatarImage, AvatarFallback };
