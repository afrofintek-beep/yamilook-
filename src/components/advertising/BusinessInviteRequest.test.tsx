import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { BusinessInviteRequest } from './BusinessInviteRequest';

const { rpc } = vi.hoisted(() => ({rpc: vi.fn()}));
vi.mock('@/integrations/supabase/client', () => ({supabase:{rpc}}));
vi.mock('react-i18next', () => ({useTranslation: () => ({i18n:{language:'pt'}})}));
afterEach(() => { cleanup(); rpc.mockReset(); });

it('submits the existing business draft and allows retry after failure', async () => {
  rpc.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({error:null});
  render(<BusinessInviteRequest draft={{name:'Quitanda', activity:'Fruta', year:'', planned:true, scene:'luanda'}} scene="luanda" ready />);
  fireEvent.click(screen.getByText('Pedir convite'));
  fireEvent.change(screen.getByLabelText('Nome da pessoa responsável'),{target:{value:'Ana'}});
  fireEvent.change(screen.getByLabelText('Email para receber o convite'),{target:{value:'ana@example.com'}});
  fireEvent.click(screen.getByText('Enviar pedido de convite'));
  await screen.findByRole('alert');
  fireEvent.click(screen.getByText('Enviar pedido de convite'));
  expect(await screen.findByRole('status')).toHaveTextContent('Pedido recebido');
  expect(rpc).toHaveBeenLastCalledWith('request_business_invitation', {
    p_name:'Quitanda',p_activity:'Fruta',p_owner:'Ana',p_email:'ana@example.com',p_scene:'luanda',p_planned:true,p_year:null,p_language:'pt',
  });
});
