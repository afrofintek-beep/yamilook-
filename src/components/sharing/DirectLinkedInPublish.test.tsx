import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import DirectLinkedInPublish from './DirectLinkedInPublish';
import { linkedinRequest } from '@/lib/linkedin-publishing';
vi.mock('@/lib/linkedin-publishing', () => ({ linkedinRequest: vi.fn(), connectLinkedIn: vi.fn() }));
const file = new File(['art'], 'yamilook.png', { type: 'image/png' });
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(linkedinRequest).mockImplementation(async action => {
    if (action === 'status') return { enabled: true, connected: true, name: 'Tony' };
    if (action === 'initialize') return { id: 'draft', parts: [{ firstByte: 0, lastByte: 2 }] };
    if (action === 'finalize') return { status: 'ready' };
    if (action === 'publish') return { status: 'published', postId: 'urn:li:share:123' };
    return {};
  });
});
afterEach(cleanup);
it('uploads the branded file and requires confirmation before the external post', async () => {
  render(<DirectLinkedInPublish file={file} postId="post" />);
  fireEvent.click(await screen.findByText('Carregar arte para LinkedIn'));
  const confirm = await screen.findByText('Confirmar e publicar no LinkedIn');
  expect(confirm).toBeDisabled();
  expect(vi.mocked(linkedinRequest).mock.calls.some(([a]) => a === 'publish')).toBe(false);
  const upload = vi.mocked(linkedinRequest).mock.calls.find(([a]) => a === 'upload');
  expect(upload?.[2]?.blob.size).toBe(file.size);
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(confirm); fireEvent.click(confirm);
  await screen.findByText('Publicado no LinkedIn.');
  expect(vi.mocked(linkedinRequest).mock.calls.filter(([a]) => a === 'publish')).toHaveLength(1);
  expect(screen.getByText('Ver publicação no LinkedIn')).toHaveAttribute('href', 'https://www.linkedin.com/feed/update/urn%3Ali%3Ashare%3A123/');
});
it('does not retry publication automatically after a lost response', async () => {
  const normal = vi.mocked(linkedinRequest).getMockImplementation()!;
  vi.mocked(linkedinRequest).mockImplementation(async (...args) => { if (args[0] === 'publish') throw new Error('Verifica o LinkedIn.'); return normal(...args); });
  render(<DirectLinkedInPublish file={file} postId="post" />);
  fireEvent.click(await screen.findByText('Carregar arte para LinkedIn'));
  await screen.findByText('Confirmar e publicar no LinkedIn');
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByText('Confirmar e publicar no LinkedIn'));
  await screen.findByText('Verifica o LinkedIn.');
  expect(screen.queryByText('Confirmar e publicar no LinkedIn')).not.toBeInTheDocument();
  expect(screen.getByText('Verificar resultado')).toBeInTheDocument();
});
it('keeps the feature hidden when the server is not configured', async () => {
  vi.mocked(linkedinRequest).mockResolvedValue({ enabled: false, connected: false });
  const view = render(<DirectLinkedInPublish file={file} postId="post" />);
  await waitFor(() => expect(view.container).toBeEmptyDOMElement());
});
