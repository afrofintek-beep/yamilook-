import { useState, useRef, useEffect } from 'react';
import { 
  Loader2, 
  Upload, 
  X, 
  Image as ImageIcon,
  Save
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Topic {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  is_trending: boolean;
}

interface EditTopicDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  topic: Topic | null;
  onTopicUpdated: () => void;
}

export function EditTopicDialog({ 
  open, 
  onOpenChange, 
  topic,
  onTopicUpdated 
}: EditTopicDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isTrending, setIsTrending] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Populate form when topic changes
  useEffect(() => {
    if (topic) {
      setName(topic.name);
      setDescription(topic.description || '');
      setIsTrending(topic.is_trending);
      setImagePreview(topic.image_url);
      setImageFile(null);
    }
  }, [topic]);

  const generateSlug = (text: string) => {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Por favor seleciona uma imagem');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 5MB');
      return;
    }

    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile) return imagePreview; // Keep existing image if no new file

    setUploading(true);
    try {
      const fileExt = imageFile.name.split('.').pop();
      const fileName = `topic-${Date.now()}.${fileExt}`;
      const filePath = `topics/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(filePath, imageFile, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Erro ao fazer upload da imagem');
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!topic) return;

    if (!name.trim()) {
      toast.error('O nome do tópico é obrigatório');
      return;
    }

    setSaving(true);
    try {
      let imageUrl = imagePreview;

      if (imageFile) {
        imageUrl = await uploadImage();
        if (!imageUrl) throw new Error("Image upload failed");
      }

      const slug = generateSlug(name);

      const { error } = await supabase
        .from('discover_topics')
        .update({
          name: name.trim(),
          slug,
          description: description.trim() || null,
          image_url: imageUrl,
          is_trending: isTrending,
        })
        .eq('id', topic.id).select('id').single();

      if (error) {
        if (error.code === '23505') {
          toast.error('Já existe um tópico com este nome');
        } else {
          throw error;
        }
        return;
      }

      toast.success('Tópico atualizado com sucesso!');
      onOpenChange(false);
      onTopicUpdated();
    } catch (error) {
      console.error('Error updating topic:', error);
      toast.error('Erro ao atualizar tópico');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = (isOpen: boolean) => {
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Tópico</DialogTitle>
          <DialogDescription>
            Atualiza as informações do tópico
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nome */}
          <div className="space-y-2">
            <Label htmlFor="edit-topic-name">Nome *</Label>
            <Input
              id="edit-topic-name"
              placeholder="Ex: Tecnologia"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={saving}
            />
          </div>

          {/* Descrição */}
          <div className="space-y-2">
            <Label htmlFor="edit-topic-description">Descrição</Label>
            <Textarea
              id="edit-topic-description"
              placeholder="Descreve o tópico..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={saving}
              rows={3}
            />
          </div>

          {/* Trending toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="trending-toggle">Em Destaque</Label>
              <p className="text-xs text-muted-foreground">
                Mostrar este tópico como trending
              </p>
            </div>
            <Switch
              id="trending-toggle"
              checked={isTrending}
              onCheckedChange={setIsTrending}
              disabled={saving}
            />
          </div>

          {/* Imagem */}
          <div className="space-y-2">
            <Label>Imagem do Tópico</Label>
            
            {imagePreview ? (
              <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-border">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="w-full h-full object-cover"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 h-8 w-8"
                  onClick={clearImage}
                  disabled={saving}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div
                className="flex flex-col items-center justify-center w-full aspect-video border-2 border-dashed border-border rounded-lg hover:border-primary/50 transition-colors cursor-pointer bg-muted/30"
                onClick={() => fileInputRef.current?.click()}
              >
                <ImageIcon className="w-10 h-10 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  Clica para escolher uma imagem
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  PNG, JPG até 5MB
                </p>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {/* Slug preview */}
          {name && (
            <div className="p-2 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground">
                Slug: <code className="text-primary">{generateSlug(name)}</code>
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleClose(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={saving || uploading}>
              {saving || uploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {uploading ? 'A fazer upload...' : 'A guardar...'}
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Guardar Alterações
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}