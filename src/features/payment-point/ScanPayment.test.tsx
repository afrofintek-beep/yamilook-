import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ScanPayment } from './ScanPayment';

afterEach(() => vi.unstubAllGlobals());

it('allows opening the request by link after camera access is denied', async () => {
  const getUserMedia = vi.fn().mockRejectedValue(new DOMException('Denied', 'NotAllowedError'));
  vi.stubGlobal('navigator', Object.assign(Object.create(navigator), { mediaDevices: { getUserMedia } }));
  const onScan = vi.fn();
  render(<ScanPayment onScan={onScan} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Permita o acesso');
  fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
  await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(2));
  const id = '00000000-0000-4000-8000-000000000001';
  fireEvent.change(screen.getByLabelText('Ligação do pedido'), {
    target: { value: window.location.origin + '/payment-point/' + id },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Abrir pedido' }));
  expect(onScan).toHaveBeenCalledWith(id);
});
