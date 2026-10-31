import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { User, Mail, MapPin, Info, X } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface GuideProfileSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guide: {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
    is_verified: boolean;
  } | null;
  isCurrentUserGuide: boolean;
}

export function GuideProfileSheet({ 
  open, 
  onOpenChange, 
  guide,
  isCurrentUserGuide 
}: GuideProfileSheetProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    display_name: guide?.display_name || '',
    bio: '',
    location: '',
  });

  const hasCompleteProfile = guide?.display_name && guide?.avatar_url;

  const handleSubmit = async () => {
    if (!user || !isCurrentUserGuide) return;

    try {
      setIsSubmitting(true);
      
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: formData.display_name,
          bio: formData.bio,
          city: formData.location,
        })
        .eq('id', user.id);

      if (error) throw error;

      toast.success('Perfil atualizado com sucesso!');
      onOpenChange(false);
      navigate(`/profile/${user.id}`);
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Erro ao atualizar perfil');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleViewProfile = () => {
    if (guide?.id) {
      onOpenChange(false);
      navigate(`/profile/${guide.id}`);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="bg-palco-bg border-palco-border rounded-t-[24px] max-h-[90vh] overflow-y-auto">
        <SheetHeader className="flex flex-row items-center justify-between pb-4">
          <SheetTitle className="text-palco-text">
            {isCurrentUserGuide && !hasCompleteProfile 
              ? 'Complete o seu Perfil' 
              : t('palco.guideProfile')
            }
          </SheetTitle>
          <Button
            variant="ghost"
            size="icon"
            className="text-palco-text-secondary"
            onClick={() => onOpenChange(false)}
          >
            <X className="w-5 h-5" />
          </Button>
        </SheetHeader>

        <div className="space-y-6 pb-6">
          {/* Guide Preview */}
          <div className="flex items-center gap-4 p-4 bg-palco-surface rounded-[16px] border border-palco-border">
            <Avatar className="w-16 h-16 border-2 border-palco-accent">
              <AvatarImage src={guide?.avatar_url || ''} />
              <AvatarFallback className="bg-palco-accent text-white text-xl">
                {guide?.display_name?.[0] || 'G'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h3 className="font-semibold text-palco-text text-lg">
                {guide?.display_name || t('palco.guide')}
              </h3>
              <p className="text-sm text-palco-text-secondary">{t('palco.guide')} do PALCO</p>
            </div>
          </div>

          {/* Show form if current user is guide and profile is incomplete */}
          {isCurrentUserGuide && !hasCompleteProfile ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-3 bg-palco-accent/10 rounded-[12px] border border-palco-accent/30">
                <Info className="w-5 h-5 text-palco-accent flex-shrink-0" />
                <p className="text-sm text-palco-text">
                  Complete o seu perfil para que os participantes possam conhecê-lo melhor.
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="display_name" className="text-palco-text flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Nome de exibição
                  </Label>
                  <Input
                    id="display_name"
                    value={formData.display_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, display_name: e.target.value }))}
                    placeholder="Como quer ser chamado?"
                    className="bg-palco-surface border-palco-border text-palco-text"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio" className="text-palco-text flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Sobre você
                  </Label>
                  <Textarea
                    id="bio"
                    value={formData.bio}
                    onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
                    placeholder="Fale um pouco sobre você e a sua experiência..."
                    className="bg-palco-surface border-palco-border text-palco-text min-h-[100px]"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location" className="text-palco-text flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Localização
                  </Label>
                  <Input
                    id="location"
                    value={formData.location}
                    onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                    placeholder="Ex: Luanda, Angola"
                    className="bg-palco-surface border-palco-border text-palco-text"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  className="flex-1 border-palco-border text-palco-text rounded-full"
                  onClick={() => onOpenChange(false)}
                >
                  Mais tarde
                </Button>
                <Button
                  className="flex-1 bg-palco-accent hover:bg-palco-accent/90 text-white rounded-full"
                  onClick={handleSubmit}
                  disabled={isSubmitting || !formData.display_name.trim()}
                >
                  {isSubmitting ? 'A guardar...' : 'Guardar'}
                </Button>
              </div>
            </div>
          ) : (
            /* Show view profile button for complete profiles */
            <div className="space-y-4">
              {hasCompleteProfile ? (
                <Button
                  className="w-full bg-palco-accent hover:bg-palco-accent/90 text-white rounded-full h-12"
                  onClick={handleViewProfile}
                >
                  Ver Perfil Completo
                </Button>
              ) : (
                <div className="text-center p-4 bg-palco-surface rounded-[16px] border border-palco-border">
                  <p className="text-palco-text-secondary text-sm">
                    Este {t('palco.guide').toLowerCase()} ainda não completou o perfil na Yamilook.
                  </p>
                </div>
              )}

              {isCurrentUserGuide && (
                <Button
                  variant="outline"
                  className="w-full border-palco-accent text-palco-accent rounded-full h-12"
                  onClick={() => navigate('/settings')}
                >
                  Editar Meu Perfil
                </Button>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
