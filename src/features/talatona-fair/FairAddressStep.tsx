import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ResidencePanel } from "@/components/residence/ResidencePanel";
import AuthorizedAfrolocLink from "@/components/account-link/AuthorizedAfrolocLink";

export default function FairAddressStep() {
  const { user, profile, loading, profileError } = useAuth();
  const [open, setOpen] = useState(false);

  if (loading) return <p role="status" className="text-sm">A verificar a sua conta…</p>;
  if (!user) {
    return (
      <div className="space-y-3 text-sm">
        <p>Entre na sua conta YAMILOOK para preparar a associação do seu endereço.</p>
        <Button asChild variant="outline"><a href="/login">Entrar na YAMILOOK</a></Button>
        <p>Se ainda não tem conta, utilize o seu convite de adesão à YAMILOOK.</p>
      </div>
    );
  }
  if (profileError || !profile) return <p role="alert" className="text-sm">Não foi possível carregar o seu perfil. Recarregue a página para tentar novamente.</p>;

  return (
    <div className="space-y-3 text-sm">
      <p>Prepare o endereço de residência na sua conta. Pode associar um endereço AFROLOC existente ou iniciar o pedido a partir da sua residência.</p>
      <Button variant="outline" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="fair-residence">
        {open ? "Fechar dados de residência" : "Preparar o meu endereço"}
      </Button>
      {open && (
        <div id="fair-residence" className="space-y-4">
          <p>As alterações que guardar nesta etapa actualizam a residência no seu perfil YAMILOOK.</p>
          <ResidencePanel />
          {import.meta.env.VITE_ACCOUNT_LINK_V1_ENABLED === "true" ? (
            <AuthorizedAfrolocLink />
          ) : (
            <p>A confirmação do endereço pelo AFROLOC ficará disponível após a activação do serviço.</p>
          )}
        </div>
      )}
      <p>A organização verifica a residência para confirmar a elegibilidade nesta iniciativa.</p>
    </div>
  );
}
