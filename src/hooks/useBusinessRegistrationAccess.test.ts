import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ businessRegistration: false, loading: false, error: null as unknown }));
vi.mock('@/features/integration-access/useIntegrationAccess', () => ({ useIntegrationAccess: () => state }));
import { useBusinessRegistrationAccess } from './useBusinessRegistrationAccess';
beforeEach(() => { Object.assign(state, { businessRegistration: false, loading: false, error: null }); });
afterEach(cleanup);
it('uses the central business creation decision and responds to its revocation', () => {
  const { result, rerender } = renderHook(() => useBusinessRegistrationAccess());
  expect(result.current).toEqual({ data: false, isLoading: false });
  state.businessRegistration = true; rerender(); expect(result.current.data).toBe(true);
  state.businessRegistration = false; rerender(); expect(result.current.data).toBe(false);
});
it('does not expose stale permission while loading or after a verification error', () => {
  Object.assign(state, { businessRegistration: true, loading: true });
  const { result, rerender } = renderHook(() => useBusinessRegistrationAccess());
  expect(result.current).toEqual({ data: false, isLoading: true });
  state.loading = false; state.error = new Error('offline'); rerender();
  expect(result.current).toEqual({ data: false, isLoading: false });
});
it('keeps unrelated onboarding flows disabled even while the shared check loads', () => {
  Object.assign(state, { businessRegistration: true, loading: true });
  const { result } = renderHook(() => useBusinessRegistrationAccess(false));
  expect(result.current).toEqual({ data: false, isLoading: false });
});
