/** Pure validation shared by the UI and the WebRTC entry points. */
export function validateCallRecipient(userId: string | undefined, targetUserId: string): void {
  if (!userId) throw new Error('Inicia sessão para fazer uma chamada.');
  if (!targetUserId || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(targetUserId)) {
    throw new Error('Destinatário inválido. Seleciona outro utilizador para fazer a chamada.');
  }
  if (userId.toLowerCase() === targetUserId.toLowerCase()) {
    throw new Error('Não podes ligar para a tua própria conta. Seleciona outro utilizador. Nos dois dispositivos, usa contas diferentes.');
  }
}

export function isMediaPermissionDenied(error: unknown): boolean {
  return !!error && typeof error === 'object' && 'name' in error &&
    (error.name === 'NotAllowedError' || error.name === 'SecurityError');
}
