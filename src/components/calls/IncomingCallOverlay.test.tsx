import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { IncomingCallOverlay } from './IncomingCallOverlay';
const m=vi.hoisted(()=>({start:vi.fn(),stop:vi.fn(),ring:vi.fn()}));
vi.mock('@/hooks/useRingtone',()=>({useRingtone:(options:unknown)=>{m.ring(options);return {startRingtone:m.start,stopRingtone:m.stop};}}));
vi.mock('react-i18next',()=>({useTranslation:()=>({t:(key:string)=>key})}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{from:()=>({select:()=>({eq:()=>({single:async()=>({data:{display_name:'Ana',avatar_url:null}})})})})}}));
afterEach(()=>{cleanup();vi.clearAllMocks();});
it('shows a compact waiting notice with the caller and explicit end-and-answer',async()=>{
  const answer=vi.fn(),decline=vi.fn();
  render(<IncomingCallOverlay callId="waiting" callType="voice" callerId="ana" waiting onAnswer={answer} onDecline={decline} />);
  expect(await screen.findByText('Ana')).toBeInTheDocument();
  expect(screen.getByRole('region',{name:'calls.waitingTitle'})).not.toHaveClass('inset-0');
  expect(m.ring).toHaveBeenCalledWith({waiting:true});
  fireEvent.click(screen.getByRole('button',{name:'calls.endAndAnswer'}));expect(m.stop).toHaveBeenCalled();expect(answer).toHaveBeenCalledOnce();
});
it('declines only through the decline action and disables actions during handoff',async()=>{
  const answer=vi.fn(),decline=vi.fn();
  const props={callId:'waiting',callType:'video' as const,callerId:'ana',waiting:true,onAnswer:answer,onDecline:decline};
  const view=render(<IncomingCallOverlay {...props} />);await screen.findByText('Ana');
  fireEvent.click(screen.getByRole('button',{name:'calls.decline'}));expect(decline).toHaveBeenCalledOnce();expect(answer).not.toHaveBeenCalled();
  view.rerender(<IncomingCallOverlay {...props} busy />);
  expect(screen.getByRole('button',{name:'calls.endAndAnswer'})).toBeDisabled();expect(screen.getByRole('button',{name:'calls.decline'})).toBeDisabled();
});
