// Translate known service messages at render time, so changing language also updates errors.
const messageKeys: Record<string, string> = {
  "Tentar novamente": "kosolola.retry",
  "Serviço de alertas indisponível. Toca em Tentar novamente.": "kosolola.pushUnavailable",
  "Não foi possível alterar os alertas.": "kosolola.pushChangeError",
  "No iPhone ou iPad, usa Partilhar → Adicionar ao ecrã principal e abre a KOSOLOLA pelo ícone para ativar os alertas.": "kosolola.pushInstallIos",
  "Abre a KOSOLOLA através de uma ligação HTTPS para ativar os alertas.": "kosolola.pushHttps",
  "Atualiza o iPhone ou iPad para iOS 16.4 ou posterior e abre a KOSOLOLA pelo ícone no ecrã principal.": "kosolola.pushUpdateIos",
  "Este navegador não suporta alertas de chamadas. Usa um navegador atualizado com suporte a notificações.": "kosolola.pushUnsupported",
  "Não foi possível contactar o serviço de alertas. Tenta novamente.": "kosolola.pushContactError",
  "Atualiza a KOSOLOLA e volta a tentar.": "kosolola.pushUpdate",
  "Autoriza as notificações nas definições do dispositivo para receber alertas.": "kosolola.pushPermission",
  "Não foi possível desativar os alertas neste dispositivo.": "kosolola.pushDisableError",
  "A verificação dos alertas demorou demasiado. Verifica a ligação e toca em Tentar novamente.": "kosolola.pushTimeout"
};

export function callPushMessageKey(message: string, fallback: string) {
  return messageKeys[message] ?? fallback;
}
