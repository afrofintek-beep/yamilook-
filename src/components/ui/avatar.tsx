import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";

import { cn } from "@/lib/utils";
import { optimizedPublicImageUrl } from "@/lib/image-delivery";

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

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, src, onError, ...props }, ref) => {
  const [failedSrc, setFailedSrc] = React.useState<string | null>(null);
  const optimized = optimizedPublicImageUrl(src, 128);
  // If image transforms are not enabled for this storage project, use the
  // original source rather than leaving the avatar blank.
  return (
    <AvatarPrimitive.Image
      loading="lazy"
      decoding="async"
      {...props}
      ref={ref}
      src={failedSrc === src ? src : optimized}
      className={cn("aspect-square h-full w-full object-cover", className)}
      onError={event => {
        if (optimized !== src && failedSrc !== src && src) setFailedSrc(src);
        else onError?.(event);
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
