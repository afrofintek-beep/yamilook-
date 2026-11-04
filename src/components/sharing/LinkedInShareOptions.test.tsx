import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import LinkedInShareOptions from './LinkedInShareOptions';

const id = 'b2b884db-8edc-4acd-8739-07a32eee320a';
const url = `https://www.yamilook.com/post/${id}`;
const webUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('opens a choice without navigating and directs the owner to the branded preview', () => {
  const prepare = vi.fn();
  render(<LinkedInShareOptions id={id} webUrl={webUrl} branded onPrepareMedia={prepare} />);
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'LinkedIn' }));
  expect(prepare).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText('Preparar cópia com marca para LinkedIn'));
  expect(prepare).toHaveBeenCalledOnce();
});

it('copies the exact public URL and instructs the user to publish in the LinkedIn app', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal('navigator', { clipboard: { writeText } });
  render(<LinkedInShareOptions id={id} webUrl={webUrl} />);
  fireEvent.click(screen.getByRole('button', { name: 'LinkedIn' }));
  fireEvent.click(screen.getByText('Copiar ligação para LinkedIn'));
  expect(writeText).toHaveBeenCalledWith(url);
  await screen.findByText(/Ligação copiada. Abre a aplicação LinkedIn/);
  expect(screen.queryByRole('button', { name: /opções do telemóvel/ })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Abrir LinkedIn' })).toHaveAttribute('href', 'https://www.linkedin.com/feed/');
});

it('retains manual copy and the web alternative when sharing and clipboard both fail', async () => {
  vi.stubGlobal('navigator', { share: vi.fn().mockRejectedValue({ name: 'NotAllowedError' }), clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
  render(<LinkedInShareOptions id={id} webUrl={webUrl} />);
  fireEvent.click(screen.getByRole('button', { name: 'LinkedIn' }));
  fireEvent.click(screen.getByText('Partilhar ligação pelas opções do telemóvel'));
  await screen.findByText(/Não foi possível copiar automaticamente/);
  expect(screen.getByLabelText('Ligação para LinkedIn')).toHaveValue(url);
  expect(screen.getByRole('link', { name: 'Usar formulário web do LinkedIn' })).toHaveAttribute('href', webUrl);
});

it('does not report a completed publication after a native handoff or cancellation', async () => {
  const share = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce({ name: 'AbortError' });
  vi.stubGlobal('navigator', { share });
  render(<LinkedInShareOptions id={id} webUrl={webUrl} />);
  fireEvent.click(screen.getByRole('button', { name: 'LinkedIn' }));
  fireEvent.click(screen.getByText('Partilhar ligação pelas opções do telemóvel'));
  expect(share).toHaveBeenCalledWith({ title: 'Yamilook', url });
  await screen.findByText(/não recebe confirmação de publicação/);
  fireEvent.click(screen.getByText('Partilhar ligação pelas opções do telemóvel'));
  await screen.findByText('Partilha cancelada. Podes tentar novamente.');
});
