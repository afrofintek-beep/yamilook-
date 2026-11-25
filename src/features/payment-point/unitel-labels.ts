import { useTranslation } from 'react-i18next';
import { useUiLocale } from '@/i18n/ui-copy';
import type { UnitelState } from './unitel-api';

type Copy = {
  title: string; description: string; phone: string; noPhones: string; amount: string;
  start: string; retry: string; newTest: string; check: string; checking: string;
  waiting: string; unknown: string; confirmedBody: string; failedBody: string; queryError: string; storageError: string;
  recoveryError: string;
  invalidResponse: string; states: Record<UnitelState, string>;
};

export const UNITEL_COPY: Record<'pt' | 'en', Copy> = {
  pt: {
    title: 'UNITEL Money · Sandbox',
    description: 'Cobranças de teste para este pedido, com contas autorizadas pela UNITEL Money. Sem dinheiro real.',
    phone: 'Conta de teste UNITEL Money', noPhones: 'Ainda não há contas de teste autorizadas disponíveis.',
    amount: 'Valor do teste', start: 'Criar cobrança UNITEL de teste', retry: 'Repetir o mesmo pedido UNITEL', newTest: 'Novo teste UNITEL',
    check: 'Consultar estado UNITEL', checking: 'A consultar…',
    waiting: 'Aguarda a confirmação da UNITEL Money. O estado é verificado automaticamente.',
    unknown: 'O resultado ainda está por confirmar. Consulta o estado antes de iniciar outra cobrança.',
    confirmedBody: 'O servidor confirmou este pagamento no ambiente de testes.',
    failedBody: 'Este teste não foi concluído. Não existe confirmação de pagamento para esta tentativa.',
    queryError: 'Não foi possível confirmar o estado. Consulta novamente quando houver ligação.',
    storageError: 'Não foi possível guardar o pedido neste dispositivo. Nenhuma cobrança foi enviada.',
    recoveryError: 'Não foi possível actualizar o pedido guardado neste dispositivo. Consulta o estado antes de continuar.',
    invalidResponse: 'A resposta não corresponde a este pedido. Consulta novamente o estado; não inicies outra cobrança.',
    states: {
      submitting: 'A enviar pedido UNITEL', pending: 'A aguardar confirmação UNITEL Money', uncertain: 'Resultado UNITEL por confirmar',
      confirmed: 'Pagamento UNITEL Money de teste confirmado', failed: 'Cobrança UNITEL de teste recusada',
      expired: 'Cobrança UNITEL expirada', review: 'A aguardar verificação UNITEL',
    },
  },
  en: {
    title: 'UNITEL Money · Sandbox',
    description: 'Test charges for this order using accounts approved by UNITEL Money. No real money.',
    phone: 'UNITEL Money test account', noPhones: 'No approved test accounts are available yet.',
    amount: 'Test amount', start: 'Create UNITEL test charge', retry: 'Retry the same UNITEL request', newTest: 'New UNITEL test',
    check: 'Check UNITEL status', checking: 'Checking…',
    waiting: 'Awaiting UNITEL Money confirmation. The status is checked automatically.',
    unknown: 'The result is still unconfirmed. Check its status before starting another charge.',
    confirmedBody: 'The server confirmed this payment in the test environment.',
    failedBody: 'This test did not complete. There is no payment confirmation for this attempt.',
    queryError: 'Could not confirm the status. Check again when connected.',
    storageError: 'Could not save this request on your device. No charge was sent.',
    recoveryError: 'Could not update the saved request on this device. Check its status before continuing.',
    invalidResponse: 'The response does not match this order. Check the status again; do not start another charge.',
    states: {
      submitting: 'Sending UNITEL request', pending: 'Awaiting UNITEL Money confirmation', uncertain: 'UNITEL result unconfirmed',
      confirmed: 'UNITEL Money test payment confirmed', failed: 'UNITEL test charge declined',
      expired: 'UNITEL charge expired', review: 'Awaiting UNITEL review',
    },
  },
};

/** Existing locales can translate these keys; all missing labels have a complete English fallback. */
export function useUnitelLabels(): Copy {
  const locale = useUiLocale();
  const { t } = useTranslation('interface');
  const fallback = UNITEL_COPY[locale === 'pt' ? 'pt' : 'en'];
  const result = {} as Copy;
  for (const key of Object.keys(fallback) as (keyof Copy)[]) {
    if (key === 'states') continue;
    result[key] = t(`massaUnitel.${key}`, { lng: locale, fallbackLng: 'en', defaultValue: fallback[key], keySeparator: false }) as string;
  }
  result.states = Object.fromEntries(Object.entries(fallback.states).map(([state, label]) => [
    state, t(`massaUnitel.states.${state}`, { lng: locale, fallbackLng: 'en', defaultValue: label, keySeparator: false }) as string,
  ])) as Copy['states'];
  return result;
}
