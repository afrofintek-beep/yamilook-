import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface EditMessageDialogProps {
  open: boolean;
  onClose: () => void;
  message: {
    id: string;
    content: string | null;
    created_at: string;
  } | null;
  onSave: (messageId: string, newContent: string) => Promise<void>;
}

export function EditMessageDialog({ open, onClose, message, onSave }: EditMessageDialogProps) {
  useUiLocale();
  const [content, setContent] = useState(message?.content || '');
  const [saving, setSaving] = useState(false);

  // Check if edit is within 15 minute window
  const isWithinEditWindow = () => {
    if (!message) return false;
    const createdAt = new Date(message.created_at).getTime();
    const now = Date.now();
    const fifteenMinutes = 15 * 60 * 1000;
    return now - createdAt < fifteenMinutes;
  };

  const handleSave = async () => {
    if (!message || !content.trim()) return;

    setSaving(true);
    await onSave(message.id, content.trim());
    setSaving(false);
    onClose();
  };

  const handleClose = () => {
    setContent(message?.content || '');
    onClose();
  };

  // Update content when message changes
  if (message && content !== message.content && !saving) {
    setContent(message.content || '');
  }

  const canEdit = isWithinEditWindow();
  const remainingTime = message
    ? Math.max(0, 15 * 60 - Math.floor((Date.now() - new Date(message.created_at).getTime()) / 1000))
    : 0;
  const remainingMinutes = Math.floor(remainingTime / 60);
  const remainingSeconds = remainingTime % 60;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{uiText("Edit Message")}</DialogTitle>
        </DialogHeader>

        {!canEdit ? (
          <div className="py-6 text-center">
            <p className="text-muted-foreground">{uiText("Messages can only be edited within 15 minutes of sending.")}</p>
          </div>
        ) : (
          <>
            <div className="space-y-4 py-4">
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={uiText("Edit your message...")}
                className="min-h-[100px] resize-none"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">{uiText("Time remaining to edit: {{value1}}:{{value2}}", { value1: (remainingMinutes) ?? "", value2: (remainingSeconds.toString().padStart(2, '0')) ?? "" })}</p>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose} disabled={saving}>{uiText("Cancel")}</Button>
              <Button
                onClick={handleSave}
                disabled={saving || !content.trim() || content === message?.content}
                className="bg-gradient-primary text-white"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}{uiText("Save")}</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
