import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { MokubicoPeer } from '../hooks/useMokubicoRoom';
import { MokubicoParticipants } from './MokubicoParticipants';

const self = { id: 'self', name: 'António', speaking: false };
const ana = { id: 'ana', name: 'Ana', speaking: false };
const gabriel = { id: 'gabriel', name: 'Gabriel', speaking: false };

function Participants({ peers }: { peers: MokubicoPeer[] }) {
  const [expanded, setExpanded] = useState(false);
  return <MokubicoParticipants peers={peers} selfId={self.id} avatars={{}} connecting={false}
    expanded={expanded} onExpandedChange={setExpanded} />;
}

describe('MOKUBICO speaker view', () => {
  it('follows the active speaker, keeps the last speaker during silence and shows the other participants as buttons', () => {
    const { rerender } = render(<Participants peers={[self, { ...ana, speaking: true }, gabriel]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Maximizar vídeo' }));
    expect(screen.getByRole('group', { name: 'Ana' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Destacar Gabriel' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Destacar o meu vídeo' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Destacar Ana' })).toBeNull();

    rerender(<Participants peers={[self, ana, { ...gabriel, speaking: true }]} />);
    expect(screen.getByRole('group', { name: 'Gabriel' })).toBeVisible();

    rerender(<Participants peers={[self, ana, gabriel]} />);
    expect(screen.getByRole('group', { name: 'Gabriel' })).toBeVisible();
    expect(screen.queryByRole('img', { name: 'A falar' })).toBeNull();
  });

  it('can feature the local participant and return to automatic follow or the conversation', () => {
    const { rerender } = render(<Participants peers={[self, ana, { ...gabriel, speaking: true }]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Destacar o meu vídeo' }));
    expect(screen.getByRole('group', { name: 'Tu' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Voltar à conversa' })).toHaveFocus();

    rerender(<Participants peers={[self, { ...ana, speaking: true }, gabriel]} />);
    expect(screen.getByRole('group', { name: 'Tu' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Seguir quem fala' }));
    expect(screen.getByRole('group', { name: 'Ana' })).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Voltar à conversa' }));
    expect(screen.getByRole('button', { name: 'Maximizar vídeo' })).toBeVisible();
    expect(screen.queryByRole('group', { name: 'Ana' })).toBeNull();
  });

  it('returns to speaker follow when the selected participant leaves', () => {
    const speakingAna = { ...ana, speaking: true };
    const { rerender } = render(<Participants peers={[self, speakingAna, gabriel]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Destacar Gabriel' }));
    expect(screen.getByRole('group', { name: 'Gabriel' })).toBeVisible();

    rerender(<Participants peers={[self, speakingAna]} />);
    expect(screen.getByRole('group', { name: 'Ana' })).toBeVisible();
    rerender(<Participants peers={[self, speakingAna, gabriel]} />);
    expect(screen.getByRole('group', { name: 'Ana' })).toBeVisible();
  });
});
