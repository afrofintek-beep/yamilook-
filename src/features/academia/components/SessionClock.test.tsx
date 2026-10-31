import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { SessionClock } from './SessionClock';
import { sessionTiming } from '../session-clock';
vi.mock('@/integrations/supabase/client',()=>({supabase:{}}));
afterEach(()=>{cleanup();vi.useRealTimers();});
const session={id:'s',status:'live',duration_minutes:60,started_at:'2026-10-31T12:00:00Z',ended_at:null};
it('uses persisted start time on late entry and remount',()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-31T12:20:00Z'));
  const props={session,isMentor:false,onUpdated:async()=>{}};
  const first=render(<SessionClock {...props}/>);
  expect(screen.getByText('Decorrido: 20:00')).toBeVisible();first.unmount();
  vi.setSystemTime(new Date('2026-10-31T12:22:00Z'));render(<SessionClock {...props}/>);
  expect(screen.getByText('Decorrido: 22:00')).toBeVisible();
});
it('shows both warning thresholds and overtime without ending the room',()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-31T12:49:59Z'));
  render(<SessionClock session={session} isMentor onUpdated={async()=>{}}/>);
  act(()=>vi.advanceTimersByTime(1000));expect(screen.getByRole('status')).toHaveTextContent('10 minutos');
  act(()=>vi.advanceTimersByTime(300000));expect(screen.getByRole('status')).toHaveTextContent('5 minutos');
  act(()=>vi.advanceTimersByTime(301000));expect(screen.getByRole('status')).toHaveTextContent('A sessão continua');
  expect(screen.getByRole('button',{name:'Prolongar +15 min'})).toBeEnabled();
});
it('freezes actual duration on end and never invents a legacy start',()=>{
  expect(sessionTiming({...session,status:'ended',ended_at:'2026-10-31T12:35:00Z'},Date.now()).elapsed).toBe(2100);
  expect(sessionTiming({...session,started_at:null},Date.now()).elapsed).toBeNull();
});
it('does not offer extension to participants',()=>{
  render(<SessionClock session={session} isMentor={false} onUpdated={async()=>{}}/>);
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
