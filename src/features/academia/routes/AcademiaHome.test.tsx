import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { type ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('framer-motion', () => ({ motion: { section: ({ children }: { children: ReactNode }) => <section>{children}</section>, div: ({ children }: { children: ReactNode }) => <div>{children}</div> } }));
const state = vi.hoisted(() => ({ admin: false }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'me' } }) }));
vi.mock('@/hooks/useAdmin', () => ({ useAdmin: () => ({ isAdmin: state.admin }) }));
vi.mock('@/components/BottomNav', () => ({ default: () => null }));
vi.mock('../components/SessionManagement', () => ({ SessionManagement: ({ session }: { session: { title: string } }) => <button>Gerir {session.title}</button> }));
vi.mock('../hooks/useAcademia', () => ({
  useAcademiaSessions: () => ({ data: [
    { id: '1', title: 'Minha futura', mentorId: 'me', scheduledAt: '2099-01-01', status: 'scheduled' },
    { id: '2', title: 'Outra futura', mentorId: 'other', scheduledAt: '2099-01-01', status: 'scheduled' },
    { id: '3', title: 'Minha passada', mentorId: 'me', scheduledAt: '2020-01-01', status: 'completed' },
    { id: '4', title: 'Minha cancelada', mentorId: 'me', scheduledAt: '2099-01-01', status: 'cancelled' },
    { id: '5', title: 'Minha arquivada', mentorId: 'me', scheduledAt: '2020-01-01', status: 'completed', archivedAt: '2020-02-01' },
  ].map(s => ({ ...s, mentorName: 'Mentor', spots: 1, spotsLeft: 1 })) }),
  useAcademiaMentors: () => ({ data: [] }), useIsMentor: () => ({ data: true }),
  useBecomeMentor: () => ({}), useAcademiaNotices: () => ({ data: [] }),
}));
import AcademiaHome from './AcademiaHome';
afterEach(() => { cleanup(); state.admin = false; });
function mount() { render(<MemoryRouter><AcademiaHome /></MemoryRouter>); }
describe('Academia session discovery and management', () => {
  it('shows upcoming sessions and only exposes management for the organizer', () => {
    mount();
    expect(screen.getByText('Minha futura')).toBeVisible();
    expect(screen.getByText('Outra futura')).toBeVisible();
    expect(screen.queryByText('Minha passada')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gerir Minha futura' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Gerir Outra futura' })).not.toBeInTheDocument();
  });
  it('keeps own past, cancelled and archived sessions available in separate filters', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'As minhas sessões' }));
    expect(screen.queryByText('Outra futura')).not.toBeInTheDocument();
    for (const [filter, title] of [['Passadas', 'Minha passada'], ['Canceladas', 'Minha cancelada'], ['Arquivadas', 'Minha arquivada']]) {
      fireEvent.click(screen.getByRole('button', { name: filter }));
      expect(screen.getByText(title)).toBeVisible();
      expect(screen.queryByText('Minha futura')).not.toBeInTheDocument();
    }
  });
  it('allows administrators to manage sessions from other organizers', () => {
    state.admin = true;
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Gerir sessões' }));
    expect(screen.getByRole('button', { name: 'Gerir Outra futura' })).toBeVisible();
  });
});
