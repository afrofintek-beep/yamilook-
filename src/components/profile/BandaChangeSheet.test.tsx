import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: vi.fn(() => Promise.resolve({ data: { status: 'none' } })) } }));
vi.mock('@/lib/residence', () => ({ submitResidence: vi.fn(() => Promise.resolve()) }));
import { submitResidence } from '@/lib/residence';
import { BandaChangeSheet } from './BandaChangeSheet';
const current = { country_code: 'AO', city: 'Luanda', neighborhood: 'Talatona' };
beforeEach(() => { vi.clearAllMocks(); });
afterEach(cleanup);
it('saves a locality and neighborhood outside the suggestions in profile changes', async () => {
  render(<BandaChangeSheet open onOpenChange={vi.fn()} current={current} onChanged={vi.fn()} />);
  fireEvent.change(screen.getByLabelText('Cidade'), { target: { value: 'Localidade nova' } });
  fireEvent.change(screen.getByLabelText('Bairro'), { target: { value: 'Bairro novo' } });
  fireEvent.click(screen.getByText('Confirmar mudança'));
  await waitFor(() => expect(submitResidence).toHaveBeenCalledWith({method:'away'}, 'AO', 'Localidade nova', 'Bairro novo'));
});
it('does not attach an old GPS response after the locality changes', async () => {
  let success: PositionCallback = () => {};
  Object.defineProperty(navigator,'geolocation',{configurable:true,value:{getCurrentPosition:vi.fn(ok=>{success=ok;})}});
  render(<BandaChangeSheet open onOpenChange={vi.fn()} current={current} onChanged={vi.fn()} />);
  fireEvent.click(screen.getByLabelText('Estou agora no meu endereço de residência'));
  fireEvent.click(screen.getByText('Captar localização do meu endereço'));
  fireEvent.change(screen.getByLabelText('Cidade'), { target: { value: 'Outra cidade' } });
  fireEvent.change(screen.getByLabelText('Bairro'), { target: { value: 'Outro bairro' } });
  await act(async () => {success({coords:{latitude:-8.9,longitude:13.2,accuracy:20}} as GeolocationPosition);});
  expect(screen.queryByText('Localização captada — validação pendente')).not.toBeInTheDocument();
  fireEvent.click(screen.getByText('Confirmar mudança'));
  await waitFor(() => expect(submitResidence).toHaveBeenCalledWith({method:'away'}, 'AO', 'Outra cidade', 'Outro bairro'));
});
