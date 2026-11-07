import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, ArrowRight, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function PurchaseSuccess() {
  useUiLocale();
  const { palcoId, rodaId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const type = searchParams.get('type') || 'voice';

  const isVoice = type === 'voice';
  const isQAPass = type === 'qa_pass';

  return (
    <div className="min-h-screen bg-palco-bg flex flex-col items-center justify-center p-4">
      <Card className="w-full max-w-md border-palco-border bg-palco-surface">
        <CardContent className="p-6 text-center">
          {/* Success Icon */}
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-palco-text mb-2">
            {isVoice ? uiText("Voz confirmada!") : isQAPass ? uiText("Passe ativo!") : uiText("Pagamento confirmado!")}
          </h1>

          {/* Subtitle */}
          <p className="text-palco-text-secondary mb-6">
            {isVoice
              ? uiText("A tua Voz foi registada. Receberás a resposta conforme o tipo escolhido.")
              : isQAPass
              ? uiText("Agora já podes ouvir a sessão de perguntas.")
              : uiText("O teu pagamento foi processado com sucesso.")
            }
          </p>

          {/* Receipt Info */}
          <div className="bg-palco-bg rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between text-sm">
              <span className="text-palco-text-secondary">{uiText("Recibo")}</span>
              <span className="font-mono text-palco-text">#YML-{Date.now().toString(36).toUpperCase()}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <Button
              onClick={() => navigate(`/palco/${palcoId}/roda/${rodaId}`)}
              className="w-full bg-palco-accent hover:bg-palco-accent/90 text-white rounded-full h-12"
            >{uiText("Voltar à Roda")}<ArrowRight className="w-4 h-4 ml-2" />
            </Button>

            {isVoice && (
              <Button
                variant="outline"
                onClick={() => navigate('/profile?tab=voices')}
                className="w-full border-palco-border text-palco-text rounded-full h-12"
              >
                <MessageSquare className="w-4 h-4 mr-2" />{uiText("Ver as minhas Vozes")}</Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
