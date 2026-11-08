import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { uiText } from '@/i18n/ui-copy';
import { changeAppLanguage } from '@/i18n';
import { MentorSettings } from './MentorSettings';

const fixtures = vi.hoisted(() => ({
  mentor: { user_id: 'mentor-test', status: 'active', specialty: 'Música', mentor_bio: 'Biografia original', experience: 'Experiência original' },
  source: 'Aprovação concluída.',
  translated: 'تمت الموافقة.',
  from: vi.fn(),
}));
vi.mock('../hooks/useMentorGovernance', () => ({
  useMyMentor: () => ({ data: fixtures.mentor }),
  useRefreshMentors: () => vi.fn(),
  mentorStatus: { active: 'Activo' },
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: fixtures.from },
}));
afterEach(async () => { cleanup(); await changeAppLanguage('pt'); vi.clearAllMocks(); });

it('refreshes a cached decision and changes the displayed note without replacing an editing draft', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: 300_000, refetchOnWindowFocus: false, retry: false } } });
  await changeAppLanguage('ar');
  client.setQueryData(['mentor-audit', fixtures.mentor.user_id, 'settings', 'ar'], [{ reason: fixtures.source }]);
  const limit = vi.fn().mockResolvedValue({
    data: [{ reason: fixtures.source, reason_translations: { source: fixtures.source, values: { ar: fixtures.translated } } }],
    error: null,
  });
  fixtures.from.mockReturnValue({ select: () => ({ eq: () => ({ order: () => ({ limit }) }) }) });
  render(<QueryClientProvider client={client}><MentorSettings /></QueryClientProvider>);
  await waitFor(() => expect(screen.getByText(fixtures.translated, { exact: false })).toBeVisible());
  expect(screen.queryByText(fixtures.source, { exact: false })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: uiText('Editar apresentação') }));
  fireEvent.change(screen.getByLabelText(uiText('Biografia')), { target: { value: 'Rascunho por guardar' } });
  await act(async () => { await changeAppLanguage('pt'); });
  expect(screen.getByLabelText('Biografia')).toHaveValue('Rascunho por guardar');
  await waitFor(() => expect(screen.getByText(fixtures.source, { exact: false })).toBeVisible());
  expect(limit).toHaveBeenCalledTimes(2);
  client.clear();
});
