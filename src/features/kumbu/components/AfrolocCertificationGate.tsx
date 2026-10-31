import { useState, type ReactNode } from 'react';
import { ShieldCheck, ShieldAlert, Clock, MapPin, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useAfrolocCertification } from '../hooks/useAfrolocCertification';

/**
 * Gates monetization behind a certified AFROLOC address. Renders `children`
 * only when the user's address is certified; otherwise shows the current
 * certification state and (when applicable) a request-certification action.
 */
export function AfrolocCertificationGate({
  action,
  children,
}: {
  /** Short verb phrase for the copy, e.g. "te candidatares a criador". */
  action: string;
  children: ReactNode;
}) {
  const { status, isCertified, hasAddress, afrolocCode, requestCertification, verifyWithAfroloc } =
    useAfrolocCertification();
  const [submitting, setSubmitting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [consentedCode, setConsentedCode] = useState<string | null>(null);

  if (isCertified) return <>{children}</>;

  const handleVerify = async () => {
    if (!afrolocCode || consentedCode !== afrolocCode) return;
    setVerifying(true);
    const res = await verifyWithAfroloc();
    setVerifying(false);
    if (res.certified) {
      toast.success('Endereço AFROLOC certificado verificado ✓');
      return;
    }
    const msg: Record<string, string> = {
      integration_pending: 'A integração de certificação AFROLOC está em validação. Podes continuar a usar a aplicação.',
      consent_required: 'Autoriza a consulta para este endereço antes de continuar.',
      address_changed: 'O endereço mudou. Revê o endereço e autoriza uma nova consulta.',
      identity_changed: 'A tua sessão ou telefone mudou. Inicia novamente a verificação.',
      phone_not_verified: 'A verificação automática requer um telefone confirmado na tua conta. Podes pedir validação manual.',
      no_address: 'Associa primeiro o teu endereço no perfil.',
      address_mismatch: 'O endereço confirmado pelo AFROLOC não corresponde ao declarado no teu perfil.',
      partner_unavailable: 'O serviço AFROLOC está indisponível. Tenta novamente mais tarde.',
      invalid_partner_response: 'O AFROLOC não devolveu uma confirmação válida. Podes pedir validação manual.',
      save_failed: 'Não foi possível guardar a certificação. Tenta novamente.',
      not_certified: 'O AFROLOC não confirmou a certificação deste endereço.',
      no_afroloc_account: 'Sem conta AFROLOC com este telefone. Cria o teu endereço na app AFROLOC.',
      no_certified_address: 'O teu endereço AFROLOC ainda não está certificado (fá-lo na app AFROLOC).',
    };
    toast.error(msg[res.reason ?? ''] ?? 'Não foi possível verificar com o AFROLOC.');
  };

  const handleRequest = async () => {
    setSubmitting(true);
    const res = await requestCertification();
    setSubmitting(false);
    if (res.success) {
      toast.success('Pedido enviado. Uma autoridade vai validar o teu endereço AFROLOC.');
    } else if (res.error === 'no_address') {
      toast.error('Precisas primeiro de um endereço AFROLOC.');
    } else if (res.error === 'already_pending') {
      toast.message('Já tens um pedido de certificação pendente.');
    } else if (res.error === 'already_certified') {
      toast.message('O teu endereço já está certificado.');
    } else {
      toast.error('Não foi possível enviar o pedido. Tenta novamente.');
    }
  };

  return (
    <Card className="border-none shadow-sm">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-amber-500" />
          <span className="text-sm font-semibold">Endereço AFROLOC por certificar</span>
          {status === 'pending' && (
            <Badge variant="secondary" className="ml-auto text-xs gap-1">
              <Clock className="h-3 w-3" /> Em análise
            </Badge>
          )}
          {status === 'rejected' && (
            <Badge variant="destructive" className="ml-auto text-xs">Rejeitado</Badge>
          )}
        </div>

        <p className="text-sm text-muted-foreground">
          Para {action}, o teu endereço AFROLOC precisa de ser{' '}
          <span className="font-medium text-foreground">certificado por uma autoridade</span>.
        </p>

        {afrolocCode && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="font-mono truncate">{afrolocCode}</span>
          </div>
        )}

        {!hasAddress && (
          <p className="text-xs text-muted-foreground">
            Ainda não tens um endereço AFROLOC. Cria o teu endereço no perfil antes de pedir a
            certificação.
          </p>
        )}

        <label className="flex items-start gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={!!afrolocCode && consentedCode === afrolocCode}
            onChange={event => setConsentedCode(event.target.checked ? afrolocCode : null)} disabled={!hasAddress || verifying} />
          Autorizo a consulta ao AFROLOC com o telefone confirmado e este código de endereço, apenas para verificar a titularidade e certificação.
        </label>
        {/* Primary: automatic verification against the AFROLOC partner API (by phone). */}
        <Button className="w-full" disabled={verifying || !hasAddress || consentedCode !== afrolocCode} onClick={handleVerify}>
          {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          Verificar com AFROLOC
        </Button>

        {/* Fallback: manual authority review. */}
        {status === 'pending' ? (
          <p className="text-xs text-muted-foreground text-center">
            Pedido de validação manual em análise por uma autoridade.
          </p>
        ) : (
          <button
            type="button"
            className="w-full text-xs text-muted-foreground underline underline-offset-2 disabled:opacity-50"
            disabled={!hasAddress || submitting}
            onClick={handleRequest}
          >
            {submitting
              ? 'A enviar…'
              : status === 'rejected'
                ? 'Ou pedir validação manual de novo'
                : 'Ou pedir validação manual'}
          </button>
        )}
      </CardContent>
    </Card>
  );
}
