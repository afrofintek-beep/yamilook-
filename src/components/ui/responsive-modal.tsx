import * as React from 'react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';

interface ResponsiveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Visible title. If omitted, pass `srTitle` so the dialog stays accessible. */
  title?: React.ReactNode;
  /** Accessible name used when there is no visible title. */
  srTitle?: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  /** Extra classes for the content container (e.g. a wider desktop dialog). */
  className?: string;
  style?: React.CSSProperties;
  /** Padding is applied by default; set false when the child manages its own. */
  padded?: boolean;
  /** Use a custom close control inside the modal body. */
  hideCloseButton?: boolean;
  /** Optional scrim strength for a specific modal. */
  overlayClassName?: string;
}

/**
 * WhatsApp/Instagram pattern: a compact centered dialog on desktop and a bottom
 * sheet on mobile, sharing one body. Always renders an (optionally hidden)
 * title so Radix accessibility is satisfied.
 */
export function ResponsiveModal({
  open,
  onOpenChange,
  title,
  srTitle,
  description,
  children,
  className,
  style,
  padded = true,
  hideCloseButton = false,
  overlayClassName,
}: ResponsiveModalProps) {
  const isMobile = useIsMobile();

  const header = (Title: typeof DialogTitle, Description: typeof DialogDescription, Header: typeof DialogHeader) => {
    if (!title) {
      return (
        <VisuallyHidden>
          <Title>{srTitle ?? 'Diálogo'}</Title>
          {description && <Description>{description}</Description>}
        </VisuallyHidden>
      );
    }
    return (
      <Header className="mb-4 text-left">
        <Title>{title}</Title>
        {description && <Description>{description}</Description>}
      </Header>
    );
  };

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          style={style}
          side="bottom"
          hideCloseButton={hideCloseButton}
          overlayClassName={overlayClassName}
          className={cn('h-auto max-h-[90vh] overflow-y-auto rounded-t-3xl', !padded && 'p-0', className)}
        >
          {header(SheetTitle, SheetDescription, SheetHeader)}
          {children}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent style={style} hideCloseButton={hideCloseButton} overlayClassName={overlayClassName} className={cn('max-w-md', !padded && 'p-0', className)}>
        {header(DialogTitle, DialogDescription, DialogHeader)}
        {children}
      </DialogContent>
    </Dialog>
  );
}
