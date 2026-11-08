import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Download, Share, MoreVertical, Plus, CheckCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { getAppInstallPrompt, clearAppInstallPrompt, subscribeAppInstall, isAppMode, type InstallPrompt } from "@/lib/app-install";
import { Button } from "@/components/ui/button";
import YamilookLogo from "@/components/brand/YamilookLogo";

export default function Install() {
  useUiLocale();
  const [deferredPrompt, setDeferredPrompt] = useState<InstallPrompt | null>(getAppInstallPrompt);
  const [installed, setInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [status, setStatus] = useState('');
  const [installing, setInstalling] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    setIsIOS(/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
    const updateMode = () => setIsStandalone(isAppMode());
    updateMode();
    const unsubscribe = subscribeAppInstall(() => setDeferredPrompt(getAppInstallPrompt()));
    const installedHandler = () => setInstalled(true);
    const media = window.matchMedia('(display-mode: standalone)');
    media.addEventListener('change', updateMode);
    window.addEventListener('appinstalled', installedHandler);
    return () => {
      unsubscribe(); media.removeEventListener('change', updateMode);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt || installing) return;
    setInstalling(true);
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      setStatus(outcome === 'accepted' ? uiText("Pedido aceite. Conclui a instalação e abre o ícone Yamilook no ecrã principal.") : uiText("Instalação cancelada. Podes tentar novamente pelo menu do navegador."));
    } catch {
      setStatus(uiText("Não foi possível abrir a instalação. Usa o menu do navegador para adicionar o Yamilook ao ecrã principal."));
    } finally {
      clearAppInstallPrompt(); setInstalling(false);
    }
  };

  if (isStandalone || installed) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 text-center">
        <CheckCircle className="w-16 h-16 text-primary mb-4" />
        <h1 className="text-2xl font-semibold text-foreground mb-2">{isStandalone ? uiText("Modo aplicação activo") : uiText("Yamilook instalado!")}</h1>
        <p className="text-muted-foreground">{uiText("Abre o Yamilook pelo ícone do ecrã principal para o usar sem a barra de endereço.")}</p>
        <Button asChild className="mt-6"><Link to="/muxi">{uiText("Continuar no Yamilook")}</Link></Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
      <motion.div
        className="max-w-sm w-full text-center space-y-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <YamilookLogo size="xl" showTagline={false} />

        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-foreground">{uiText("Yamilook em modo aplicação")}</h1>
          <p className="text-muted-foreground text-sm">{uiText("Abre pelo ícone no ecrã principal, sem a barra de endereço do navegador.")}</p>
        </div>

        {deferredPrompt ? (
          <Button onClick={handleInstall} disabled={installing} size="lg" className="w-full gap-2">
            <Download className="w-5 h-5" />{uiText("Instalar agora")}</Button>
        ) : isIOS ? (
          <div className="bg-muted rounded-xl p-4 text-left space-y-3 text-sm text-foreground">
<p className="font-medium">{uiText("No iPhone ou iPad, abre esta página no Safari:")}</p>
            <div className="flex items-center gap-3">
              <Share className="w-5 h-5 text-primary shrink-0" />
              <span>{uiText("Toca em ")}<strong>{uiText("Partilhar")}</strong></span>
            </div>
            <div className="flex items-center gap-3">
              <Plus className="w-5 h-5 text-primary shrink-0" />
              <span>{uiText("Escolhe ")}<strong>{uiText("Adicionar ao ecrã principal")}</strong>{uiText(" (ou «ecrã inicial»).")}</span>
            </div>
            <p>{uiText("Se aparecer ")}<strong>{uiText("Abrir como aplicação web")}</strong>{uiText(", mantém essa opção activa. Confirma em ")}<strong>{uiText("Adicionar")}</strong>.</p>
            <p>{uiText("Depois abre o ")}<strong>{uiText("ícone Yamilook")}</strong>{uiText(" que ficou no ecrã principal.")}</p>
          </div>
        ) : (
          <div className="bg-muted rounded-xl p-4 text-left space-y-3 text-sm text-foreground">
            <p className="font-medium">{uiText("No browser:")}</p>
            <div className="flex items-center gap-3">
              <MoreVertical className="w-5 h-5 text-primary shrink-0" />
              <span>{uiText("Abre o menu ")}<strong>(⋮)</strong></span>
            </div>
            <div className="flex items-center gap-3">
              <Download className="w-5 h-5 text-primary shrink-0" />
              <span>{uiText("Toca em ")}<strong>{uiText("Instalar aplicação")}</strong>{uiText(" ou ")}<strong>{uiText("Adicionar ao ecrã principal")}</strong>{uiText(" e confirma.")}</span>
            </div>
          </div>
        )}
        <p role="status" className="text-sm text-muted-foreground">{status}</p>
        <Button asChild variant="outline" className="w-full"><Link to="/muxi">{uiText("Continuar no navegador")}</Link></Button>
      </motion.div>
    </div>
  );
}
