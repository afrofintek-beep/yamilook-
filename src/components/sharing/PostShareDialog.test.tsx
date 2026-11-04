import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import PostShareDialog from './PostShareDialog';

vi.mock('@/components/ui/responsive-modal', () => ({ ResponsiveModal: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('./BrandedPostExport', () => ({ default: function Preview() {
  const [ready, setReady] = useState(false);
  return <button onClick={() => setReady(true)}>{ready ? 'Cópia pronta' : 'Preparar ficheiro'}</button>;
} }));
vi.mock('./PostVideoShare', () => ({ default: () => <button>Vídeo público</button> }));
afterEach(cleanup);

it('defaults to branded file, shows only one route and retains preparation across mode changes', () => {
  render(<PostShareDialog id="b2b884db-8edc-4acd-8739-07a32eee320a" isOwner open onOpenChange={vi.fn()} />);
  expect(screen.queryByRole('button', { name: 'LinkedIn' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByText('Preparar ficheiro'));
  fireEvent.click(screen.getByRole('button', { name: 'Ligação', exact: true }));
  expect(screen.queryByRole('button', { name: 'Cópia pronta' })).not.toBeInTheDocument();
  expect(screen.getAllByRole('button', { name: 'LinkedIn' })).toHaveLength(1);
  expect(screen.queryByRole('button', { name: 'TikTok' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Ficheiro com marca' }));
  expect(screen.getByRole('button', { name: 'Cópia pronta' })).toBeInTheDocument();
  expect(screen.queryByText('Enviar ficheiro a amigos')).not.toBeInTheDocument();
});

it('never exposes a public link or export to a nonowner of a restricted post', () => {
  render(<PostShareDialog id="post" privacy="contacts" open onOpenChange={vi.fn()} />);
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Ligação pública')).not.toBeInTheDocument();
});
