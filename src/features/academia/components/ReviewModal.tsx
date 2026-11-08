import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Star } from 'lucide-react';
import { ACADEMIA_COPY } from '../copy';

interface ReviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit?: (rating: number, comment: string) => void;
}

export function ReviewModal({ open, onOpenChange, onSubmit }: ReviewModalProps) {
  useUiLocale();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');

  const handleSubmit = () => {
    onSubmit?.(rating, comment);
    setRating(0);
    setComment('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader className="text-center">
          <DialogTitle className="text-base font-semibold">{ACADEMIA_COPY.feedbackTitle}</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">{ACADEMIA_COPY.feedbackQuestion}</DialogDescription>
        </DialogHeader>

        <div className="flex justify-center gap-2 py-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} onClick={() => setRating(n)} className="p-1 transition-transform active:scale-90">
              <Star
                className={`h-8 w-8 transition-colors ${n <= rating ? 'fill-primary text-primary' : 'text-muted-foreground/30'}`}
              />
            </button>
          ))}
        </div>

        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={uiText("Deixa um comentário (opcional)")}
          rows={3}
          className="resize-none"
        />

        <DialogFooter className="flex-row gap-3 sm:flex-row">
          <Button variant="ghost" className="flex-1 rounded-full" onClick={() => onOpenChange(false)}>
            {ACADEMIA_COPY.feedbackDismiss}
          </Button>
          <Button className="flex-1 rounded-full" disabled={rating === 0} onClick={handleSubmit}>
            {ACADEMIA_COPY.feedbackSubmit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
