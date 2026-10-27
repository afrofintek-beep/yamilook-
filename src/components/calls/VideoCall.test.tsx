import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { VideoCall } from './VideoCall';
const { controls, checkIsHost, callState } = vi.hoisted(() => ({
  callState: { callStatus: 'connected', connectionState: 'connected' },
  controls: {toggleMute:vi.fn(),toggleVideo:vi.fn(),toggleScreenShare:vi.fn(),flipCamera:vi.fn(),setVirtualBackground:vi.fn(),raiseHand:vi.fn(),sendReaction:vi.fn(),endCall:vi.fn()},
  checkIsHost:vi.fn().mockResolvedValue(false),
}));
vi.mock('./ActiveCallProvider',()=>({useActiveCallRequired:()=>({...controls,webRTCState:{isMuted:false,isVideoEnabled:true,isScreenSharing:false,remoteStreams:new Map(),localStream:null,...callState}})}));
vi.mock('@/hooks/useHostControls',()=>({useHostControls:()=>({checkIsHost})}));
vi.mock('./ParticipantGrid',()=>({ParticipantGrid:()=> <div data-testid="call-media" />}));
vi.mock('./CallChatPanel',()=>({CallChatPanel:()=> <div>Papo aberto</div>}));
vi.mock('./CallEffects',()=>({CallEffects:()=> <div>Definições abertas</div>}));
vi.mock('./CallReactions',()=>({CallReactions:()=>null}));
vi.mock('./VirtualBackgroundPicker',()=>({VirtualBackgroundPicker:()=> <div>Fundos abertos</div>}));
vi.mock('./RecordingControls',()=>({RecordingControls:()=>null}));
vi.mock('./LiveCaptions',()=>({LiveCaptions:()=> <div>Demo captions</div>}));
vi.mock('./WaitingRoomPanel',()=>({WaitingRoomPanel:()=>null}));
vi.mock('./BreakoutRoomsPanel',()=>({BreakoutRoomsPanel:()=>null}));
vi.mock('./HostControlsPanel',()=>({HostControlsPanel:()=>null}));
const participant={id:'p',user_id:'other',display_name:'Participante de teste',avatar_url:null,is_muted:false,is_video_enabled:true,is_screen_sharing:false,is_hand_raised:false,is_spotlight:false};
beforeEach(()=>{callState.callStatus='connected';callState.connectionState='connected';Object.values(controls).forEach(mock=>mock.mockReset());});
afterEach(cleanup);
function setup(){const onEndCall=vi.fn();render(<VideoCall callId="call" callType="video" participants={[participant]} onEndCall={onEndCall} />);return {onEndCall};}
it('wires microphone, camera, flip and hangup to the active call',()=>{
  const {onEndCall}=setup();
  fireEvent.click(screen.getByRole('button',{name:'Desligar microfone'}));
  fireEvent.click(screen.getByRole('button',{name:'Desligar câmara'}));
  fireEvent.click(screen.getByRole('button',{name:'Trocar câmara'}));
  expect(controls.toggleMute).toHaveBeenCalledOnce();expect(controls.toggleVideo).toHaveBeenCalledOnce();expect(controls.flipCamera).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button',{name:'Desligar chamada'}));
  expect(controls.endCall).toHaveBeenCalledOnce();expect(onEndCall).toHaveBeenCalledOnce();
});
it('opens participants and settings rather than only toggling unused state',async()=>{
  setup();
  fireEvent.click(screen.getByRole('button',{name:/Participantes.*2/i}));
  expect(await screen.findByText('Participante de teste')).toBeVisible();
  fireEvent.click(screen.getByRole('button',{name:'Close'}));
  fireEvent.click(screen.getByRole('button',{name:'Definições da chamada'}));
  expect(screen.getByText('Definições abertas')).toBeVisible();
  expect(screen.getByTestId('call-media')).toBeInTheDocument();
  expect(controls.endCall).not.toHaveBeenCalled();
});
it('allows lowering a raised hand',async()=>{
  setup();fireEvent.click(screen.getByRole('button',{name:'Levantar a mão'}));
  await waitFor(()=>expect(screen.getByRole('button',{name:'Baixar a mão'})).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button',{name:'Baixar a mão'}));
  expect(controls.raiseHand.mock.calls).toEqual([[true],[false]]);
});
it('opens chat, backgrounds and effects while preserving the call media',()=>{
  setup();
  fireEvent.click(screen.getByRole('button',{name:'Escrever mensagem'}));
  expect(screen.getByText('Papo aberto')).toBeVisible();
  fireEvent.click(screen.getByRole('button',{name:'Fundos'}));
  expect(screen.getByText('Fundos abertos')).toBeVisible();
  fireEvent.click(screen.getByRole('button',{name:'Efeitos'}));
  expect(screen.getByText('Definições abertas')).toBeVisible();
  expect(screen.getByTestId('call-media')).toBeInTheDocument();
  expect(controls.endCall).not.toHaveBeenCalled();
});
it('does not offer simulated captions or unsupported screen/fullscreen actions',()=>{
  setup();expect(screen.getByRole('button',{name:'Legendas indisponíveis'})).toBeDisabled();
  expect(screen.getByRole('button',{name:'Partilhar ecrã'})).toBeDisabled();
  expect(screen.getByRole('button',{name:'Abrir ecrã inteiro'})).toBeDisabled();
  expect(screen.queryByText('Demo captions')).not.toBeInTheDocument();
});

it('uses one transport-backed status while reconnecting',()=>{
  callState.connectionState='disconnected';setup();
  expect(screen.getByRole('status')).toHaveTextContent('A estabelecer ligação');
  expect(screen.queryByText('Ligada')).not.toBeInTheDocument();
});
