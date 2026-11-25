import { useIntegrationAccess } from '@/features/integration-access/useIntegrationAccess';

export function useBusinessRegistrationAccess(enabled = true) {
  const access = useIntegrationAccess();
  return { data: enabled && !access.loading && !access.error && access.businessRegistration === true,
    isLoading: enabled && access.loading };
}
