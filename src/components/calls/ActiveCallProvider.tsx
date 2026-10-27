import { ScheduledCallNotices } from '@/features/scheduled-calls/ScheduledCallNotices';
/* @refresh reset */
import { createContext, useContext, useState, useCallback, ReactNode, lazy, Suspense, useMemo, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useWebRTC, CallState } from '@/hooks/useWebRTC';
import type { BgMode, EffectsConfig } from '@/lib/virtualBackground';
import { useCalls } from '@/hooks/useCalls';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';

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
    throw new Error('useActiveCall must be used within ActiveCallProvider');
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
      typeof errObj.code === 'string' ? `code=${errObj.code}` : null,
      typeof errObj.details === 'string' ? errObj.details : null,
    ].filter(Boolean).join(' · ');
    return extra ? `${errObj.message} (${extra})` : errObj.message;
  }

  return 'Erro desconhecido';
}

export function ActiveCallProvider({ children }: ActiveCallProviderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [isInCall, setIsInCall] = useState(false);
  const [currentCallId, setCurrentCallId] = useState<string | null>(null);
  const answeringCallRef = useRef<string | null>(null);
  const { incomingCall, setIncomingCall } = useCalls({ loadHistory: false });
  
  // Get ALL WebRTC methods and state from a single hook instance
  const webRTC = useWebRTC();
  const { 
    state: webRTCState,
    initiateCall, 
    answerCall, 
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
    if (!currentCallId || !['idle', 'ended', 'declined', 'failed'].includes(webRTCState.callStatus)) return;
    // A failed transport may still be running ICE recovery. Leave only after cleanup.
    if (webRTCState.callStatus === 'failed' && webRTCState.callId) return;
    if (webRTCState.callStatus === 'failed') {
      toast({ title: 'Não foi possível estabelecer a chamada', description: webRTCState.lastError || 'Verifica a ligação e tenta novamente.', variant: 'destructive' });
    }
    setIsInCall(false);
    setCurrentCallId(null);
    if (location.pathname === `/call/${currentCallId}`) navigate('/calls', { replace: true });
  }, [currentCallId, webRTCState.callId, webRTCState.callStatus, webRTCState.lastError, location.pathname, navigate, toast]);

  const startCall = useCallback(async (contactId: string, type: 'voice' | 'video', conversationId?: string) => {
    logger.debug('Starting call', 'ActiveCallProvider', { contactId, type });

    // Preflight checks to avoid "nothing happens" when the browser blocks media APIs.
    if (!window.isSecureContext) {
      toast({
        title: 'Chamada indisponível',
        description: 'O navegador bloqueou microfone/câmara porque a página não está num contexto seguro (HTTPS).',
        variant: 'destructive',
      });
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      toast({
        title: 'Chamada indisponível',
        description: 'Este dispositivo/navegador não suporta acesso ao microfone/câmara.',
        variant: 'destructive',
      });
      return;
    }

    // Silently proceed — no permission toast

    try {
      const callId = await initiateCall(contactId, type, conversationId);
      setCurrentCallId(callId);
      setIsInCall(true);
      navigate(`/call/${callId}`);
    } catch (err) {
      const message = formatCallError(err);
      logger.error('Failed to start call', 'ActiveCallProvider', err);
      toast({
        title: 'Não foi possível iniciar a chamada',
        description: message,
        variant: 'destructive',
      });
    }
  }, [initiateCall, navigate, toast]);

  const joinCall = useCallback(async (callId: string, callType: 'voice' | 'video', initiatorId: string) => {
    // If we already bootstrapped this call, do nothing.
    if ((currentCallId === callId && isInCall) || answeringCallRef.current) return;
    answeringCallRef.current = callId;

    try {
      // iOS Safari gesture unlock: play a silent audio context on the user tap
      // so subsequent media playback is not blocked by autoplay policy.
      try {
        const ctx = new AudioContext();
        await ctx.resume();
        ctx.close();
      } catch { /* non-fatal */ }

      // Answering a call requires user media; if this fails, show a clear toast.
      await answerCall(callId, callType, initiatorId);
      setCurrentCallId(callId);
      setIsInCall(true);
    } catch (err) {
      const message = formatCallError(err);
      logger.error('Failed to join call', 'ActiveCallProvider', err);
      toast({
        title: 'Não foi possível entrar na chamada',
        description: message,
        variant: 'destructive',
      });
    } finally {
      answeringCallRef.current = null;
    }
  }, [answerCall, currentCallId, isInCall, toast]);

  const endCurrentCall = useCallback(() => {
    logger.debug('Ending current call', 'ActiveCallProvider');
    endCall();
    setCurrentCallId(null);
    setIsInCall(false);
  }, [endCall]);

  const handleAnswerCall = useCallback(async () => {
    if (!incomingCall || answeringCallRef.current || currentCallId === incomingCall.id) return;
    const call = incomingCall;
    answeringCallRef.current = call.id;
    markUserInteracted();
    try {
      await answerCall(call.id, call.type, call.initiator_id);
      setCurrentCallId(call.id);
      setIsInCall(true);
      setIncomingCall(null);
      navigate(`/call/${call.id}`);
    } catch (err) {
      logger.error('Failed to answer incoming call', 'ActiveCallProvider', err);
      toast({ title: 'Não foi possível atender a chamada', description: formatCallError(err), variant: 'destructive' });
    } finally {
      answeringCallRef.current = null;
    }
  }, [incomingCall, currentCallId, answerCall, markUserInteracted, setIncomingCall, navigate, toast]);

  const handleDeclineCall = useCallback(async () => {
    if (incomingCall) {
      logger.debug('Declining incoming call', 'ActiveCallProvider', incomingCall.id);
      await declineCall(incomingCall.id, incomingCall.initiator_id);
      setIncomingCall(null);
    }
  }, [incomingCall, declineCall, setIncomingCall]);

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

  return (
    <ActiveCallContext.Provider value={contextValue}>
      {children}
      <ScheduledCallNotices />
      
      {/* Incoming call overlay - lazy loaded */}
      {incomingCall && (
        <Suspense fallback={null}>
          <IncomingCallOverlay
            callId={incomingCall.id}
            callType={incomingCall.type}
            callerId={incomingCall.initiator_id}
            onAnswer={handleAnswerCall}
            onDecline={handleDeclineCall}
          />
        </Suspense>
      )}
    </ActiveCallContext.Provider>
  );
}
