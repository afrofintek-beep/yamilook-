/** A missing secret must never turn payment fulfilment into an open endpoint. */
export function authorizedPaymentWebhook(expected: string | undefined, provided: unknown): boolean {
  return !!expected && typeof provided === 'string' && provided === expected;
}

export function settledPaymentStatus(status: Record<string, unknown>, fallback: unknown): boolean {
  if (status.code !== undefined && status.code !== null) return Number(status.code) === 100;
  return ['success', 'successful', 'paid', 'completed', 'settled', 'approved']
    .includes(String(status.status ?? fallback ?? '').toLowerCase());
}
