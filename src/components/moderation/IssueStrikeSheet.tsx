import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useStrikes, VIOLATION_LABELS } from '@/hooks/useStrikes';

interface IssueStrikeSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetUserId?: string;
  targetDisplayName?: string;
  reportId?: string;
  contentType?: string;
  contentId?: string;
  onComplete?: () => void;
}

export default function IssueStrikeSheet({
  open,
  onOpenChange,
  targetUserId,
  targetDisplayName,
  reportId,
  contentType,
  contentId,
  onComplete,
}: IssueStrikeSheetProps) {
  useUiLocale();
  const { issueStrike } = useStrikes();
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState('');
  const [severity, setSeverity] = useState('1');
  const [reason, setReason] = useState('');
  const [userId, setUserId] = useState(targetUserId || '');

  const handleSubmit = async () => {
    if (!category || !reason.trim() || !userId) return;
    setLoading(true);
    try {
      await issueStrike({
        userId,
        violationCategory: category,
        severity: parseInt(severity),
        reason,
        contentType,
        contentId,
        reportId,
      });
      onOpenChange(false);
      setCategory('');
      setSeverity('1');
      setReason('');
      onComplete?.();
    } catch (error) {
      console.error('Error issuing strike:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />{uiText("Emitir Strike")}</SheetTitle>
          <SheetDescription>
            {targetDisplayName
              ? `Emitir um strike contra ${targetDisplayName}`
              : uiText("Emitir um strike contra um utilizador")}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 mt-4">
          {!targetUserId && (
            <div className="space-y-2">
              <Label>{uiText("ID do Utilizador")}</Label>
              <Input
                placeholder={uiText("UUID do utilizador...")}
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>{uiText("Categoria da Violação")}</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder={uiText("Seleciona uma categoria...")} />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(VIOLATION_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{uiText("Severidade")}</Label>
            <Select value={severity} onValueChange={setSeverity}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">{uiText("1 — Menor (aviso)")}</SelectItem>
                <SelectItem value="2">{uiText("2 — Moderada")}</SelectItem>
                <SelectItem value="3">{uiText("3 — Grave")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{uiText("Motivo")}</Label>
            <Textarea
              placeholder={uiText("Descreve o motivo do strike...")}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>

          <Button
            className="w-full"
            disabled={!category || !reason.trim() || !userId || loading}
            onClick={handleSubmit}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <AlertTriangle className="w-4 h-4 mr-2" />}{uiText("Emitir Strike")}</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
