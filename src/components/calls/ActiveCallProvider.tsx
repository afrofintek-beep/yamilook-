import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { GroupConferenceProvider } from '@/features/group-calls/GroupConferenceProvider';
import { IncomingCallBoundary } from './IncomingCallBoundary';
import { ScheduledCallNotices } from '@/features/scheduled-calls/ScheduledCallNotices';
/* @refresh reset */
import { createContext, useContext, useState, useCallback, ReactNode, lazy, Suspense, useMemo, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { CallState } from '@/hooks/webrtc/types';
import { useCallTransport } from '@/hooks/useCallTransport';
import type { BgMode, EffectsConfig } from '@/lib/virtualBackground';
import { useCalls } from '@/hooks/useCalls';
import { useToast } from '@/hooks/use-toast';
import { callErrorCode, playCallTone, stopCallTone } from '@/lib/call-feedback';
import { unlockCallAudio } from '@/lib/audio-context';
import { Button } from '@/components/ui/button';
import { logger } from '@/lib/logger';
import { Phone, PhoneOff, Video, User } from 'lucide-react';

// Lazy load the heavy IncomingCallOverlay component
const IncomingCallOverlay = lazy(() => import('./IncomingCallOverlay').then(m => ({ default: m.IncomingCallOverlay })));

interface ActiveCallContextType {
  isInCall: boolean;
  currentCallId: string | null;
  startCall: (contactId: string, type: 'voice' | 'video', conversationId?: string) => Promise<void>;
  /**
   * Join an existing call when arriving via deep-link (/call/:id).
   * For non-initiators, this will answer the call and bootstrap WebRTC.
   */
  joinCall: (callId: string, callType: 'voice' | 'video', initiatorId: string) => Promise<void>;
  endCurrentCall: () => void;
  /** Call synchronously on user tap BEFORE any async call work (iOS Safari autoplay unlock) */
  markUserInteracted: () => void;
  // Expose WebRTC state and methods for VideoCall component
  webRTCState: CallState;
  toggleMute: () => void;
  toggleVideo: () => void;
  toggleScreenShare: () => Promise<void>;
  flipCamera: () => Promise<void>;
  setVirtualBackground: (mode: BgMode) => Promise<void>;
  setCallEffects: (partial: Partial<EffectsConfig>) => Promise<void>;
  setAudioProcessing: (opts: { noiseSuppression?: boolean; echoCancellation?: boolean; autoGainControl?: boolean }) => Promise<void>;
  raiseHand: (raised: boolean) => void;
  sendReaction: (emoji: string) => void;
  endCall: () => void;
}

const ActiveCallContext = createContext<ActiveCallContextType | null>(null);

export function useActiveCall() {
  const context = useContext(ActiveCallContext);
  return context;
}

export function useActiveCallRequired() {
  const context = useContext(ActiveCallContext);
  if (!context) {
    throw new Error("useActiveCall must be used within ActiveCallProvider");
  }
  return context;
}

interface ActiveCallProviderProps {
  children: ReactNode;
}

function formatCallError(err: unknown) {
  // More user-friendly mapping for common media permission errors
  if (err instanceof DOMException) {
    switch (err.name) {
      case 'NotAllowedError':
      case 'SecurityError':
        return 'Permissão negada. Ativa Microfone (e Câmara para videochamada) nas permissões do site.';
      case 'NotFoundError':
        return 'Não foi encontrado microfone/câmara neste dispositivo.';
      case 'NotReadableError':
      case 'AbortError':
        return 'O microfone/câmara está ocupado por outra app. Fecha outras apps e tenta novamente.';
      case 'OverconstrainedError':
        return 'Configuração de câmara não suportada. Tenta mudar de câmara ou usar chamada de voz.';
      default:
        return `${err.name}${err.message ? `: ${err.message}` : ''}`;
    }
  }

  if (err instanceof Error) return err.message;

  if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
    const errObj = err as { message: string; code?: unknown; details?: unknown };
    const extra = [
      typeof errObj.code === 'string' ? `code=${(errObj.code)}` : null,
      typeof errObj.details === 'string' ? errObj.details : null,
    ].filter(Boolean).join(' · ');
    return extra ? `${errObj.message} (${extra})` : errObj.message;
  }

  return 'Erro desconhecido';
}

export function ActiveCallProvider({ children }: ActiveCallProviderProps) {
  useUiLocale();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const location = useLocation();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [isInCall, setIsInCall] = useState(false);
  const [currentCallId, setCurrentCallId] = useState<string | null>(null);
  const [setupCallType, setSetupCallType] = useState<'voice' | 'video'>('voice');
  const [starting, setStarting] = useState(false);
  const [answering, setAnswering] = useState(false);
  const startEpoch = useRef(0);
  const startingRef = useRef(false);
  const answeringCallRef = useRef<string | null>(null);
  const { incomingCall, setIncomingCall } = useCalls({ loadHistory: false });

  // Get ALL WebRTC methods and state from a single hook instance
  const webRTC = useCallTransport();
  const {
    state: webRTCState,
    initiateCall,
    answerCall,
    endAndAnswerCall,
    addWaitingToConference,
    declineCall,
    endCall,
    toggleMute,
    toggleVideo,
    toggleScreenShare,
    flipCamera,
    setVirtualBackground,
    setCallEffects,
    setAudioProcessing,
    raiseHand,
    sendReaction,
    markUserInteracted,
  } = webRTC;

  useEffect(() => {
    if (webRTCState.isInitiator && webRTCState.callStatus === 'ringing') return playCallTone('ringback');
  }, [webRTCState.isInitiator, webRTCState.callStatus]);
  useEffect(() => () => { startEpoch.current++; stopCallTone(); }, []);

  useEffect(() => {
    if (answeringCallRef.current) return;
    if (!currentCallId || !['idle', 'ended', 'declined', 'failed'].includes(webRTCState.callStatus)) return;
    // A failed transport may still be running ICE recovery. Leave only after cleanup.
    if (webRTCState.callStatus === 'failed' && webRTCState.callId) return;
    if (webRTCState.callStatus === 'failed') {
      toast({ title: uiText("Não foi possível estabelecer a chamada"), description: webRTCState.lastError || 'Verifica a ligação e tenta novamente.', variant: 'destructive' });
    }
    if ((webRTCState.callStatus === 'ended' && webRTCState.lastError) || webRTCState.callStatus === 'declined') {
      playCallTone(webRTCState.callStatus === 'declined' ? 'declined' : 'ended');
      toast({ title: webRTCState.callStatus === 'declined' ? 'Chamada recusada.' : webRTCState.lastError || 'Chamada terminada.' });
    }
    setIsInCall(false);
    setCurrentCallId(null);
    if (location.pathname === `/call/${currentCallId}`) navigate('/calls', { replace: true });
  }, [answering, currentCallId, webRTCState.callId, webRTCState.callStatus, webRTCState.lastError, location.pathname, navigate, toast]);

  const startCall = useCallback(async (contactId: string, type: 'voice' | 'video', conversationId?: string) => {
    logger.debug('Starting call', 'ActiveCallProvider', { contactId, type });

    // Preflight checks to avoid "nothing happens" when the browser blocks media APIs.
    if (!window.isSecureContext) {
      toast({
        title: uiText("Chamada indisponível"),
        description: uiText("O navegador bloqueou microfone/câmara porque a página não está num contexto seguro (HTTPS)."),
        variant: 'destructive',
      });
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      toast({
        title: uiText("Chamada indisponível"),
        description: uiText("Este dispositivo/navegador não suporta acesso ao microfone/câmara."),
        variant: 'destructive',
      });
      return;
    }

    if (startingRef.current) return;
    const epoch = ++startEpoch.current;
    setSetupCallType(type);
    startingRef.current = true; setStarting(true);
    unlockCallAudio(); markUserInteracted();
    try {
      const callId = await initiateCall(contactId, type, conversationId);
      if (epoch !== startEpoch.current) return;
      setCurrentCallId(callId);
      setIsInCall(true);
      navigate(`/call/${callId}`);
    } catch (err) {
      if (epoch !== startEpoch.current) return;
      const code = callErrorCode(err);
      if (code === 'callee_busy') {
        playCallTone('busy');
        toast({ title: uiText("Ocupado"), description: uiText("Este contacto está noutra chamada. Tenta novamente mais tarde.") });
        return;
      }
      if (code === 'caller_busy') {
        toast({ title: uiText("Já tens uma chamada em curso"), description: uiText("Termina a chamada no outro dispositivo antes de iniciar uma nova.") });
        return;
      }
      const message = code === 'call_unavailable' ? 'Não é possível ligar a este contacto.' : formatCallError(err);
      logger.error('Failed to start call', 'ActiveCallProvider', err);
      toast({
        title: uiText("Não foi possível iniciar a chamada"),
        description: message,
        variant: 'destructive',
      });
    } finally {
      if (epoch === startEpoch.current) { startingRef.current = false; setStarting(false); }
    }
  }, [initiateCall, navigate, toast, markUserInteracted]);

  const joinCall = useCallback(async (callId: string, callType: 'voice' | 'video', initiatorId: string) => {
    // If we already bootstrapped this call, do nothing.
    if ((currentCallId === callId && isInCall) || answeringCallRef.current) return;
    if (isInCall || currentCallId || startingRef.current) {
      toast({ title: t('calls.waitingTitle'), description: t('calls.waitingDescription') });
      return;
    }
    answeringCallRef.current = callId;
    const epoch = ++startEpoch.current;
    setSetupCallType(callType);
    setAnswering(true);
    unlockCallAudio(); markUserInteracted();

    try {
      // Answering a call requires user media; if this fails, show a clear toast.
      await answerCall(callId, callType, initiatorId);
      if (epoch !== startEpoch.current) return;
      setCurrentCallId(callId);
      setIsInCall(true);
    } catch (err) {
      if (epoch !== startEpoch.current) return;
      const message = formatCallError(err);
      logger.error('Failed to join call', 'ActiveCallProvider', err);
      toast({
        title: uiText("Não foi possível entrar na chamada"),
        description: message,
        variant: 'destructive',
      });
    } finally {
      if (epoch === startEpoch.current) setAnswering(false);
      if (answeringCallRef.current === callId) answeringCallRef.current = null;
    }
  }, [answerCall, currentCallId, isInCall, toast, markUserInteracted, t]);

  const endCurrentCall = useCallback(() => {
    logger.debug('Ending current call', 'ActiveCallProvider');
    startEpoch.current++; startingRef.current = false; setStarting(false); setAnswering(false);
    stopCallTone();
    void endCall();
    setCurrentCallId(null);
    setIsInCall(false);
  }, [endCall]);

  const handleAnswerCall = useCallback(async () => {
    if (!incomingCall || answeringCallRef.current || currentCallId === incomingCall.id) return;
    const call = incomingCall;
    answeringCallRef.current = call.id;
    const epoch = ++startEpoch.current;
    setSetupCallType(call.type);
    setAnswering(true);
    unlockCallAudio(); markUserInteracted();
    try {
      if (currentCallId && isInCall) await endAndAnswerCall(currentCallId, call.id, call.type, call.initiator_id);
      else await answerCall(call.id, call.type, call.initiator_id);
      if (epoch !== startEpoch.current) return;
      setCurrentCallId(call.id);
      setIsInCall(true);
      setIncomingCall(null);
      navigate(`/call/${call.id}`);
    } catch (err) {
      if (epoch !== startEpoch.current) return;
      logger.error('Failed to answer incoming call', 'ActiveCallProvider', err);
      toast({ title: uiText("Não foi possível atender a chamada"), description: formatCallError(err), variant: 'destructive' });
    } finally {
      if (epoch === startEpoch.current) setAnswering(false);
      if (answeringCallRef.current === call.id) answeringCallRef.current = null;
    }
  }, [incomingCall, currentCallId, isInCall, answerCall, endAndAnswerCall, markUserInteracted, setIncomingCall, navigate, toast]);

  const handleAddToCall = useCallback(async () => {
    if (!incomingCall || !currentCallId || !isInCall || answeringCallRef.current) return;
    const call = incomingCall;
    answeringCallRef.current = call.id;
    const epoch = ++startEpoch.current;
    setAnswering(true);
    unlockCallAudio(); markUserInteracted();
    try {
      await addWaitingToConference(currentCallId, call.id);
      if (epoch !== startEpoch.current) return;
      setCurrentCallId(null);
      setIsInCall(false);
      setIncomingCall(null);
      navigate('/calls', { replace: true });
      await queryClient.invalidateQueries({ queryKey: ['group-conference-invites'] });
      void queryClient.invalidateQueries({ queryKey: ['conversations'] });
      toast({ title: t('calls.conferenceInvited') });
    } catch (err) {
      if (epoch === startEpoch.current) toast({ title: t('calls.addToCall'), description: formatCallError(err), variant: 'destructive' });
    } finally {
      if (epoch === startEpoch.current) setAnswering(false);
      if (answeringCallRef.current === call.id) answeringCallRef.current = null;
    }
  }, [incomingCall, currentCallId, isInCall, addWaitingToConference, markUserInteracted, setIncomingCall, navigate, queryClient, toast, t]);

  const handleDeclineCall = useCallback(async () => {
    if (answeringCallRef.current) return;
    if (incomingCall) {
      logger.debug('Declining incoming call', 'ActiveCallProvider', incomingCall.id);
      try {
        await declineCall(incomingCall.id, incomingCall.initiator_id);
        setIncomingCall(null);
      } catch (err) {
        toast({ title: uiText("Não foi possível recusar a chamada"), description: formatCallError(err), variant: 'destructive' });
      }
    }
  }, [incomingCall, declineCall, setIncomingCall, toast]);

  // Memoize context value to prevent unnecessary re-renders of consumers
  const contextValue = useMemo<ActiveCallContextType>(() => ({
    isInCall,
    currentCallId,
    startCall,
    joinCall,
    endCurrentCall,
    markUserInteracted,
    // Expose WebRTC state and methods
    webRTCState,
    toggleMute,
    toggleVideo,
    toggleScreenShare,
    flipCamera,
    setVirtualBackground,
    setCallEffects,
    setAudioProcessing,
    raiseHand,
    sendReaction,
    endCall,
  }), [isInCall, currentCallId, startCall, joinCall, endCurrentCall, markUserInteracted, webRTCState, toggleMute, toggleVideo, toggleScreenShare, flipCamera, setVirtualBackground, setCallEffects, setAudioProcessing, raiseHand, sendReaction, endCall]);
  const callWaiting = !!incomingCall && !!currentCallId && isInCall && incomingCall.id !== currentCallId;

  return (
    <ActiveCallContext.Provider value={contextValue}>
      <GroupConferenceProvider directBusy={isInCall || starting || answering}>
      {children}
      {(starting || answering) && <div role="dialog" aria-modal="true" aria-label={uiText("A iniciar chamada")} className="fixed inset-0 z-[190] bg-background flex flex-col items-center justify-center gap-6 p-6 safe-top">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">{setupCallType === 'video' ? <Video className="h-4 w-4" /> : <Phone className="h-4 w-4" />}<span>{setupCallType === 'video' ? uiText("Videochamada") : uiText("Chamada de voz")}</span></div>
        <div className="flex h-28 w-28 items-center justify-center rounded-full bg-primary/15"><User className="h-14 w-14 text-primary" /></div>
        <p role="status" aria-live="polite" className="text-xl font-medium">{webRTCState.callStatus === 'ringing' ? uiText("A chamar…") : uiText("A ligar…")}</p>
        <p className="max-w-sm text-center text-sm text-muted-foreground">{uiText("Se for solicitado, autoriza o microfone para continuar.")}</p>
        <Button variant="destructive" className="mt-12 h-16 rounded-full px-6 gap-2" onClick={endCurrentCall}><PhoneOff className="h-6 w-6" />{uiText("Cancelar chamada")}</Button>
      </div>}
      <ScheduledCallNotices />

      {/* Incoming call overlay - lazy loaded */}
      {incomingCall && (
        <IncomingCallBoundary key={incomingCall.id} onAnswer={handleAnswerCall} onDecline={handleDeclineCall} waiting={callWaiting} busy={answering} answerLabel={callWaiting ? t('calls.endAndAnswer') : undefined} waitingLabel={callWaiting ? t('calls.waitingTitle') : undefined}>
        <Suspense fallback={null}>
          <IncomingCallOverlay
            callId={incomingCall.id}
            callType={incomingCall.type}
            callerId={incomingCall.initiator_id}
            onAnswer={handleAnswerCall}
            onDecline={handleDeclineCall}
            onAddToCall={callWaiting ? handleAddToCall : undefined}
            waiting={callWaiting}
            busy={answering}
          />
        </Suspense>
        </IncomingCallBoundary>
      )}
      </GroupConferenceProvider>
    </ActiveCallContext.Provider>
  );
}
