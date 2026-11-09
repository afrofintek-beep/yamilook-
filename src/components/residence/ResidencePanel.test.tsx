import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { changeAppLanguage } from '@/i18n';
import { uiText } from '@/i18n/ui-copy';

const state = vi.hoisted(() => ({
  isCertified: false,
  profile: { country_code: 'AO', city: 'Luanda', neighborhood: 'Talatona', afroloc_code: null as string | null, afroloc_certification_status: 'pending' },
}));
vi.mock('@/features/kumbu/hooks/useAfrolocCertification', () => ({ useAfrolocCertification: () => state }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ profile: state.profile, refreshProfile: vi.fn() }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
import { ResidencePanel } from './ResidencePanel';

afterEach(async () => { cleanup(); await changeAppLanguage('pt'); });

it('translates every residence status when the language changes on the mounted profile', async () => {
  for (const [certified, code, source] of [
    [false, null, 'Banda declarada — endereço por confirmar'],
    [false, 'AO-LDA-TAL-TEST', 'Endereço associado — validação pendente'],
    [true, 'AO-LDA-TAL-TEST', 'Banda validada'],
  ] as const) {
    state.isCertified = certified;
    state.profile.afroloc_code = code;
    state.profile.afroloc_certification_status = certified ? 'certified' : 'pending';
    const view = render(<ResidencePanel />);
    for (const language of ['pt', 'en', 'fr', 'ar', 'am', 'sw', 'ln', 'yo', 'sn', 'zu']) {
      await act(async () => { await changeAppLanguage(language); });
      expect(screen.getByText(uiText(source))).toBeVisible();
      if (language !== 'pt') expect(screen.queryByText(source)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: certified ? uiText('Atualizar endereço de residência') : uiText('Validar a minha Banda') })).toBeVisible();
    }
    view.unmount();
  }
});
