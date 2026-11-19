import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { ShareRegistrationInvite } from './ShareRegistrationInvite';
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc } }));
it('checks capacity before opening the share sheet and excludes the count from the message', async () => {
  const share = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'share', { configurable: true, value: share });
  rpc.mockResolvedValue({data:{valid:true,multi_use:true,remaining:7}});
  render(<ShareRegistrationInvite code="1234567890ABCDEF" />);
  fireEvent.click(screen.getByText('Partilhar convite'));
  await screen.findByText('Vagas disponíveis: 7');
  expect(share).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText('Continuar a partilhar'));
  expect(share).toHaveBeenCalledWith(expect.objectContaining({url:'https://www.yamilook.com/register?ref=1234567890ABCDEF',text:expect.not.stringContaining('7')}));
});
