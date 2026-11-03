import { lazy } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppLoadingScreen, AppStartupBoundary } from './AppStartupBoundary';
import { recoverApplicationAssets } from '@/lib/app-assets';
import { holdCallUpdates } from '@/lib/call-update-guard';

vi.mock('@/lib/app-assets', () => ({ recoverApplicationAssets: vi.fn().mockResolvedValue(undefined) }));
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.clearAllMocks(); });

describe('application startup above lazy providers', () => {
  it('shows a visible fallback while the call provider is pending, then opens the page', async () => {
    let finish!: (value: { default: () => React.ReactNode }) => void;
    const Provider = lazy(() => new Promise<{ default: () => React.ReactNode }>(resolve => { finish = resolve; }));
    render(<AppStartupBoundary><Provider /></AppStartupBoundary>);
    expect(screen.getByRole('status')).toHaveTextContent('A abrir a Yamilook');
    await act(async () => { finish({ default: () => <h2>Página pronta</h2> }); });
    expect(screen.getByRole('heading', { name: 'Página pronta' })).toBeVisible();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows recovery if a provider import rejects before route boundaries exist', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const Provider = lazy(async () => { throw new TypeError('Failed to fetch dynamically imported module'); });
    await act(async () => { render(<AppStartupBoundary><Provider /></AppStartupBoundary>); });
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível abrir');
    expect(screen.getByRole('button', { name: 'Recarregar Yamilook' })).toBeVisible();
    expect(recoverApplicationAssets).not.toHaveBeenCalled();
  });

  it('offers recovery when loading never finishes and does not repair during an active call', async () => {
    vi.useFakeTimers();
    render(<AppLoadingScreen />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
    const release = holdCallUpdates();
    fireEvent.click(screen.getByRole('button', { name: 'Recarregar Yamilook' }));
    expect(screen.getByRole('button')).toBeDisabled();
    expect(recoverApplicationAssets).not.toHaveBeenCalled();
    await act(async () => { release(); await vi.advanceTimersByTimeAsync(0); });
    expect(recoverApplicationAssets).toHaveBeenCalledExactlyOnceWith('/');
  });
});
