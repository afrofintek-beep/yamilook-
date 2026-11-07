import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity, Wifi, WifiOff, Mic, MicOff, Video, VideoOff,
  Server, Shield, RefreshCw, CheckCircle, XCircle, AlertTriangle,
  ChevronDown, ChevronUp, Copy, ExternalLink, Phone, PhoneOff, Volume2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { CallSignalsDebugPanel } from '@/components/calls/CallSignalsDebugPanel';

interface MediaPermissions {
  microphone: PermissionState | 'unknown';
  camera: PermissionState | 'unknown';
}

interface TurnServerInfo {
  url: string;
  username?: string;
  status: 'available' | 'unavailable' | 'checking';
}

interface SignalingState {
  realtimeConnected: boolean;
  lastEventTime: Date | null;
  pendingSignals: number;
}

interface DiagnosticsData {
  mediaPermissions: MediaPermissions;
  mediaDevices: MediaDeviceInfo[];
  turnServers: TurnServerInfo[];
  signalingState: SignalingState;
  iceConnectionState: RTCPeerConnectionState | null;
  iceGatheringState: RTCIceGatheringState | null;
  localCandidates: RTCIceCandidate[];
  remoteCandidates: RTCIceCandidate[];
  browserInfo: {
    userAgent: string;
    isSecureContext: boolean;
    hasWebRTC: boolean;
    hasGetUserMedia: boolean;
  };
}

interface LoopbackTestResult {
  status: 'idle' | 'running' | 'success' | 'failed';
  step: string;
  audioLevel: number;
  videoFrames: number;
  error?: string;
  iceState?: string;
  latencyMs?: number;
}

export function CallDiagnosticsPanel() {
  useUiLocale();
  const { user } = useAuth();
  const [isExpanded, setIsExpanded] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [diagnostics, setDiagnostics] = useState<DiagnosticsData | null>(null);
  const [testPeerConnection, setTestPeerConnection] = useState<RTCPeerConnection | null>(null);

  // Loopback test state
  const [loopbackTest, setLoopbackTest] = useState<LoopbackTestResult>({
    status: 'idle',
    step: '',
    audioLevel: 0,
    videoFrames: 0,
  });
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const loopbackPcsRef = useRef<{ local: RTCPeerConnection | null; remote: RTCPeerConnection | null }>({
    local: null,
    remote: null,
  });
  const loopbackStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  // Cleanup loopback test resources
  const cleanupLoopbackTest = useCallback(() => {
    // Stop media stream
    if (loopbackStreamRef.current) {
      loopbackStreamRef.current.getTracks().forEach(track => track.stop());
      loopbackStreamRef.current = null;
    }

    // Close peer connections
    loopbackPcsRef.current.local?.close();
    loopbackPcsRef.current.remote?.close();
    loopbackPcsRef.current = { local: null, remote: null };

    // Close audio context
    if (audioContextRef.current?.state !== 'closed') {
      audioContextRef.current?.close();
    }
    audioContextRef.current = null;
    analyserRef.current = null;

    // Clear video elements
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
  }, []);

  // Run loopback test - tests the full audio/video stack locally
  const runLoopbackTest = useCallback(async () => {
    // Cleanup any previous test
    cleanupLoopbackTest();

    setLoopbackTest({
      status: 'running',
      step: 'A solicitar acesso à câmara e microfone...',
      audioLevel: 0,
      videoFrames: 0,
    });

    try {
      // Step 1: Get user media
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: { width: 320, height: 240 },
      });
      loopbackStreamRef.current = stream;

      // Show local video
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.muted = true;
        await localVideoRef.current.play().catch(() => {});
      }

      setLoopbackTest(prev => ({
        ...prev,
        step: 'Média capturada. A criar conexões peer-to-peer...',
      }));

      // Step 2: Create peer connections for loopback
      const config: RTCConfiguration = {
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      };

      const localPc = new RTCPeerConnection(config);
      const remotePc = new RTCPeerConnection(config);
      loopbackPcsRef.current = { local: localPc, remote: remotePc };

      // Track ICE state
      localPc.oniceconnectionstatechange = () => {
        setLoopbackTest(prev => ({
          ...prev,
          iceState: localPc.iceConnectionState,
        }));
      };

      // Exchange ICE candidates
      localPc.onicecandidate = (e) => {
        if (e.candidate) remotePc.addIceCandidate(e.candidate);
      };
      remotePc.onicecandidate = (e) => {
        if (e.candidate) localPc.addIceCandidate(e.candidate);
      };

      // Handle remote track on remotePc
      let videoFrameCount = 0;
      const startTime = Date.now();

      remotePc.ontrack = (e) => {
        if (remoteVideoRef.current && e.streams[0]) {
          remoteVideoRef.current.srcObject = e.streams[0];
          remoteVideoRef.current.play().catch(() => {});

          // Count video frames
          const checkFrames = () => {
            if (remoteVideoRef.current && !remoteVideoRef.current.paused) {
              videoFrameCount++;
              setLoopbackTest(prev => ({
                ...prev,
                videoFrames: videoFrameCount,
                latencyMs: Date.now() - startTime,
              }));
            }
          };
          const frameInterval = setInterval(checkFrames, 100);
          setTimeout(() => clearInterval(frameInterval), 5000);
        }
      };

      // Add tracks to local peer
      stream.getTracks().forEach(track => {
        localPc.addTrack(track, stream);
      });

      setLoopbackTest(prev => ({
        ...prev,
        step: 'A estabelecer conexão SDP...',
      }));

      // Step 3: Create and exchange SDP
      const offer = await localPc.createOffer();
      await localPc.setLocalDescription(offer);
      await remotePc.setRemoteDescription(offer);

      const answer = await remotePc.createAnswer();
      await remotePc.setLocalDescription(answer);
      await localPc.setRemoteDescription(answer);

      setLoopbackTest(prev => ({
        ...prev,
        step: 'A aguardar conexão ICE...',
      }));

      // Step 4: Setup audio level monitoring
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const analyser = audioContext.createAnalyser();
      analyserRef.current = analyser;
      analyser.fftSize = 256;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const checkAudioLevel = () => {
        if (!analyserRef.current) return;
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        const normalizedLevel = Math.min(100, Math.round((average / 128) * 100));

        setLoopbackTest(prev => ({
          ...prev,
          audioLevel: normalizedLevel,
        }));
      };

      const audioInterval = setInterval(checkAudioLevel, 100);

      // Wait for ICE connection
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error(uiText("ICE connection timeout")));
        }, 10000);

        const checkState = () => {
          if (localPc.iceConnectionState === 'connected' || localPc.iceConnectionState === 'completed') {
            clearTimeout(timeout);
            resolve();
          } else if (localPc.iceConnectionState === 'failed' || localPc.iceConnectionState === 'disconnected') {
            clearTimeout(timeout);
            reject(new Error(`ICE connection failed: ${localPc.iceConnectionState}`));
          }
        };

        localPc.oniceconnectionstatechange = () => {
          setLoopbackTest(prev => ({
            ...prev,
            iceState: localPc.iceConnectionState,
          }));
          checkState();
        };

        // Check initial state
        checkState();
      });

      setLoopbackTest(prev => ({
        ...prev,
        status: 'success',
        step: 'Teste de loopback concluído com sucesso!',
      }));

      toast.success(uiText("Teste de loopback bem-sucedido! Áudio e vídeo funcionam corretamente."));

      // Keep running for 10 seconds then cleanup
      setTimeout(() => {
        clearInterval(audioInterval);
        cleanupLoopbackTest();
        setLoopbackTest(prev => ({
          ...prev,
          status: 'idle',
          step: '',
        }));
      }, 10000);

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
      console.error('[LoopbackTest] Failed:', error);

      setLoopbackTest({
        status: 'failed',
        step: 'Teste falhou',
        audioLevel: 0,
        videoFrames: 0,
        error: errorMsg,
      });

      toast.error(`Teste de loopback falhou: ${errorMsg}`);
      cleanupLoopbackTest();
    }
  }, [cleanupLoopbackTest]);

  // Stop loopback test
  const stopLoopbackTest = useCallback(() => {
    cleanupLoopbackTest();
    setLoopbackTest({
      status: 'idle',
      step: '',
      audioLevel: 0,
      videoFrames: 0,
    });
  }, [cleanupLoopbackTest]);

  // Check media permissions
  const checkMediaPermissions = useCallback(async (): Promise<MediaPermissions> => {
    const result: MediaPermissions = {
      microphone: 'unknown',
      camera: 'unknown',
    };

    try {
      if (navigator.permissions) {
        const [micPerm, camPerm] = await Promise.all([
          navigator.permissions.query({ name: 'microphone' as PermissionName }).catch(() => null),
          navigator.permissions.query({ name: 'camera' as PermissionName }).catch(() => null),
        ]);
        result.microphone = micPerm?.state || 'unknown';
        result.camera = camPerm?.state || 'unknown';
      }
    } catch (e) {
      console.log('[Diagnostics] Permissions API not available');
    }

    return result;
  }, []);

  // Get media devices
  const getMediaDevices = useCallback(async (): Promise<MediaDeviceInfo[]> => {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) return [];
      return await navigator.mediaDevices.enumerateDevices();
    } catch (e) {
      return [];
    }
  }, []);

  // Check TURN servers
  const checkTurnServers = useCallback(async (): Promise<TurnServerInfo[]> => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) return [];

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-turn-credentials`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionData.session.access_token}`,
          },
        }
      );

      if (!response.ok) {
        return [{ url: 'TURN fetch failed', status: 'unavailable' }];
      }

      const data = await response.json();
      const servers: TurnServerInfo[] = [];

      if (data.iceServers) {
        for (const server of data.iceServers) {
          const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
          for (const url of urls) {
            servers.push({
              url,
              username: server.username,
              status: 'available',
            });
          }
        }
      }

      return servers.length > 0 ? servers : [{ url: 'No servers returned', status: 'unavailable' }];
    } catch (e) {
      return [{ url: `Error: ${e instanceof Error ? e.message : 'unknown'}`, status: 'unavailable' }];
    }
  }, []);

  // Check signaling state
  const checkSignalingState = useCallback(async (): Promise<SignalingState> => {
    const result: SignalingState = {
      realtimeConnected: false,
      lastEventTime: null,
      pendingSignals: 0,
    };

    try {
      if (!user) return result;

      // Check pending signals
      const { data, error } = await supabase
        .from('call_signals')
        .select('id, created_at')
        .eq('to_user_id', user.id)
        .eq('processed', false)
        .order('created_at', { ascending: false })
        .limit(10);

      if (!error && data) {
        result.pendingSignals = data.length;
        if (data.length > 0) {
          result.lastEventTime = new Date(data[0].created_at);
        }
      }

      // Quick realtime check — nome único por execução para não colidir se o
      // diagnóstico correr mais do que uma vez em simultâneo.
      const testChannel = supabase.channel(`diagnostics-test-${Math.random().toString(36).slice(2)}`);
      await new Promise<void>((resolve) => {
        testChannel.subscribe((status) => {
          result.realtimeConnected = status === 'SUBSCRIBED';
          supabase.removeChannel(testChannel);
          resolve();
        });
        setTimeout(() => {
          supabase.removeChannel(testChannel);
          resolve();
        }, 3000);
      });
    } catch (e) {
      console.error('[Diagnostics] Signaling check error:', e);
    }

    return result;
  }, [user]);

  // Create test peer connection
  const createTestConnection = useCallback(async (turnServers: TurnServerInfo[]) => {
    try {
      const config: RTCConfiguration = {
        iceServers: [
          { urls: ['stun:stun.l.google.com:19302'] },
          ...turnServers
            .filter(s => s.status === 'available')
            .map(s => ({
              urls: s.url,
              username: s.username,
              credential: s.username ? 'retrieved-credential' : undefined,
            })),
        ],
      };

      const pc = new RTCPeerConnection(config);
      setTestPeerConnection(pc);

      // Create a data channel to trigger ICE gathering
      pc.createDataChannel('diagnostics');
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      return pc;
    } catch (e) {
      console.error('[Diagnostics] Failed to create test connection:', e);
      return null;
    }
  }, []);

  // Run full diagnostics
  const runDiagnostics = useCallback(async () => {
    setIsLoading(true);

    try {
      const [mediaPermissions, mediaDevices, turnServers, signalingState] = await Promise.all([
        checkMediaPermissions(),
        getMediaDevices(),
        checkTurnServers(),
        checkSignalingState(),
      ]);

      const pc = await createTestConnection(turnServers);

      const browserInfo = {
        userAgent: navigator.userAgent,
        isSecureContext: window.isSecureContext,
        hasWebRTC: !!window.RTCPeerConnection,
        hasGetUserMedia: !!(navigator.mediaDevices?.getUserMedia),
      };

      setDiagnostics({
        mediaPermissions,
        mediaDevices,
        turnServers,
        signalingState,
        iceConnectionState: pc?.connectionState || null,
        iceGatheringState: pc?.iceGatheringState || null,
        localCandidates: [],
        remoteCandidates: [],
        browserInfo,
      });

      // Gather ICE candidates
      if (pc) {
        const candidates: RTCIceCandidate[] = [];
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            candidates.push(event.candidate);
            setDiagnostics(prev => prev ? { ...prev, localCandidates: [...candidates] } : null);
          }
        };
      }
    } catch (e) {
      console.error('[Diagnostics] Error:', e);
      toast.error(uiText("Diagnóstico falhou"));
    } finally {
      setIsLoading(false);
    }
  }, [checkMediaPermissions, getMediaDevices, checkTurnServers, checkSignalingState, createTestConnection]);

  // Cleanup test connection and loopback on unmount
  useEffect(() => {
    return () => {
      testPeerConnection?.close();
      cleanupLoopbackTest();
    };
  }, [testPeerConnection, cleanupLoopbackTest]);

  // Run on mount
  useEffect(() => {
    runDiagnostics();
  }, []);

  const copyToClipboard = () => {
    if (!diagnostics) return;
    const text = JSON.stringify(diagnostics, null, 2);
    navigator.clipboard.writeText(text);
    toast.success(uiText("Diagnóstico copiado para a área de transferência"));
  };

  const StatusIcon = ({ ok }: { ok: boolean }) => (
    ok ? <CheckCircle className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-red-500" />
  );

  const PermissionBadge = ({ state }: { state: PermissionState | 'unknown' }) => {
  useUiLocale();
    const variants: Record<string, { color: string; label: string }> = {
      granted: { color: 'bg-green-500/20 text-green-400 border-green-500/30', label: uiText("Permitido") },
      denied: { color: 'bg-red-500/20 text-red-400 border-red-500/30', label: uiText("Negado") },
      prompt: { color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', label: uiText("Aguardando") },
      unknown: { color: 'bg-muted text-muted-foreground', label: uiText("Desconhecido") },
    };
    const { color, label } = variants[state] || variants.unknown;
    return <Badge variant="outline" className={color}>{label}</Badge>;
  };

  return (
    <Card className="border-primary/20">
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">{uiText("Diagnóstico de Chamadas")}</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={runDiagnostics}
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />{uiText("Atualizar")}</Button>
              <Button size="sm" variant="ghost" onClick={copyToClipboard}>
                <Copy className="h-4 w-4" />
              </Button>
              <CollapsibleTrigger asChild>
                <Button size="sm" variant="ghost">
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>
          <CardDescription>{uiText("Estado atual do sistema de chamadas WebRTC")}</CardDescription>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="space-y-4">
            {diagnostics ? (
              <ScrollArea className="h-[500px] pr-4">
                {/* Browser Compatibility */}
                <div className="space-y-3 mb-6">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <Shield className="h-4 w-4" />{uiText("Compatibilidade do Navegador")}</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center gap-2 p-2 rounded bg-muted/50">
                      <StatusIcon ok={diagnostics.browserInfo.isSecureContext} />
                      <span>{uiText("Contexto Seguro (HTTPS)")}</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded bg-muted/50">
                      <StatusIcon ok={diagnostics.browserInfo.hasWebRTC} />
                      <span>{uiText("WebRTC Disponível")}</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded bg-muted/50">
                      <StatusIcon ok={diagnostics.browserInfo.hasGetUserMedia} />
                      <span>{uiText("getUserMedia API")}</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded bg-muted/50">
                      <StatusIcon ok={diagnostics.signalingState.realtimeConnected} />
                      <span>{uiText("Realtime Conectado")}</span>
                    </div>
                  </div>
                </div>

                {/* Media Permissions */}
                <div className="space-y-3 mb-6">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <Mic className="h-4 w-4" />{uiText("Permissões de Média")}</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg border bg-card">
                      <div className="flex items-center gap-2 mb-2">
                        {diagnostics.mediaPermissions.microphone === 'granted' ? (
                          <Mic className="h-4 w-4 text-green-500" />
                        ) : (
                          <MicOff className="h-4 w-4 text-red-500" />
                        )}
                        <span className="text-sm font-medium">{uiText("Microfone")}</span>
                      </div>
                      <PermissionBadge state={diagnostics.mediaPermissions.microphone} />
                    </div>
                    <div className="p-3 rounded-lg border bg-card">
                      <div className="flex items-center gap-2 mb-2">
                        {diagnostics.mediaPermissions.camera === 'granted' ? (
                          <Video className="h-4 w-4 text-green-500" />
                        ) : (
                          <VideoOff className="h-4 w-4 text-red-500" />
                        )}
                        <span className="text-sm font-medium">{uiText("Câmara")}</span>
                      </div>
                      <PermissionBadge state={diagnostics.mediaPermissions.camera} />
                    </div>
                  </div>
                </div>

                {/* Media Devices */}
                <div className="space-y-3 mb-6">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <Video className="h-4 w-4" />{uiText("Dispositivos Detetados (")}{diagnostics.mediaDevices.length})
                  </h4>
                  <div className="space-y-1">
                    {diagnostics.mediaDevices.length === 0 ? (
                      <p className="text-sm text-muted-foreground p-2 bg-muted/50 rounded">{uiText("Nenhum dispositivo detetado (permissões podem estar pendentes)")}</p>
                    ) : (
                      diagnostics.mediaDevices.map((device, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm p-2 bg-muted/30 rounded">
                          <Badge variant="outline" className="text-xs">
                            {device.kind.replace('input', '').replace('output', ' out')}
                          </Badge>
                          <span className="truncate flex-1">
                            {device.label || `Dispositivo ${i + 1}`}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* TURN Servers */}
                <div className="space-y-3 mb-6">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <Server className="h-4 w-4" />{uiText("Servidores TURN/STUN")}</h4>
                  <div className="space-y-1">
                    {diagnostics.turnServers.map((server, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm p-2 bg-muted/30 rounded">
                        <StatusIcon ok={server.status === 'available'} />
                        <span className="truncate flex-1 font-mono text-xs">{server.url}</span>
                        {server.username && (
                          <Badge variant="outline" className="text-xs">{uiText("auth")}</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* ICE Candidates */}
                <div className="space-y-3 mb-6">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <Wifi className="h-4 w-4" />{uiText("ICE Candidates Locais (")}{diagnostics.localCandidates.length})
                  </h4>
                  {diagnostics.localCandidates.length === 0 ? (
                    <p className="text-sm text-muted-foreground p-2 bg-muted/50 rounded">{uiText("A recolher candidatos ICE...")}</p>
                  ) : (
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {diagnostics.localCandidates.map((c, i) => (
                        <div key={i} className="text-xs font-mono p-2 bg-muted/30 rounded break-all">
                          <Badge variant="outline" className="mr-2 mb-1">
                            {c.type || uiText("unknown")}
                          </Badge>
                          {c.candidate?.split(' ').slice(4, 7).join(' ')}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Signaling State */}
                <div className="space-y-3 mb-6">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <Activity className="h-4 w-4" />{uiText("Estado do Signaling")}</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="p-2 rounded bg-muted/50">
                      <span className="text-muted-foreground">{uiText("Realtime:")}</span>
                      <span className="ml-2">
                        {diagnostics.signalingState.realtimeConnected ? (
                          <Badge className="bg-green-500">{uiText("Conectado")}</Badge>
                        ) : (
                          <Badge variant="destructive">{uiText("Desconectado")}</Badge>
                        )}
                      </span>
                    </div>
                    <div className="p-2 rounded bg-muted/50">
                      <span className="text-muted-foreground">{uiText("Sinais Pendentes:")}</span>
                      <span className="ml-2 font-medium">{diagnostics.signalingState.pendingSignals}</span>
                    </div>
                  </div>
                </div>

                {/* call_signals Debug */}
                <CallSignalsDebugPanel />

                {/* ICE State */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <WifiOff className="h-4 w-4" />{uiText("Estado ICE (teste)")}</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="p-2 rounded bg-muted/50">
                      <span className="text-muted-foreground">{uiText("Connection:")}</span>
                      <span className="ml-2 font-mono">{diagnostics.iceConnectionState || uiText("N/A")}</span>
                    </div>
                    <div className="p-2 rounded bg-muted/50">
                      <span className="text-muted-foreground">{uiText("Gathering:")}</span>
                      <span className="ml-2 font-mono">{diagnostics.iceGatheringState || uiText("N/A")}</span>
                    </div>
                  </div>
                </div>

                {/* Loopback Test Section */}
                <div className="space-y-3 pt-4 border-t">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <Phone className="h-4 w-4" />{uiText("Teste de Loopback (Áudio/Vídeo)")}</h4>

                  <div className="flex gap-2">
                    {loopbackTest.status === 'idle' || loopbackTest.status === 'failed' ? (
                      <Button
                        onClick={runLoopbackTest}
                        size="sm"
                        className="flex-1"
                      >
                        <Phone className="h-4 w-4 mr-2" />{uiText("Iniciar Teste de Chamada")}</Button>
                    ) : (
                      <Button
                        onClick={stopLoopbackTest}
                        size="sm"
                        variant="destructive"
                        className="flex-1"
                      >
                        <PhoneOff className="h-4 w-4 mr-2" />{uiText("Parar Teste")}</Button>
                    )}
                  </div>

                  {/* Test Status */}
                  {loopbackTest.status !== 'idle' && (
                    <div className="space-y-3">
                      <div className="p-3 rounded-lg border bg-card">
                        <div className="flex items-center gap-2 mb-2">
                          {loopbackTest.status === 'running' && (
                            <RefreshCw className="h-4 w-4 animate-spin text-primary" />
                          )}
                          {loopbackTest.status === 'success' && (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          )}
                          {loopbackTest.status === 'failed' && (
                            <XCircle className="h-4 w-4 text-destructive" />
                          )}
                          <span className="text-sm font-medium">
                            {loopbackTest.status === 'running' ? uiText("A testar...") :
                             loopbackTest.status === 'success' ? uiText("Sucesso") : uiText("Falhou")}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">{loopbackTest.step}</p>
                        {loopbackTest.error && (
                          <p className="text-xs text-destructive mt-1">{loopbackTest.error}</p>
                        )}
                      </div>

                      {/* Video Preview */}
                      {(loopbackTest.status === 'running' || loopbackTest.status === 'success') && (
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground text-center">{uiText("Local")}</p>
                            <div className="aspect-video bg-muted rounded-lg overflow-hidden relative">
                              <video
                                ref={localVideoRef}
                                autoPlay
                                playsInline
                                muted
                                className="w-full h-full object-cover"
                              />
                            </div>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground text-center">{uiText("Remoto (Loopback)")}</p>
                            <div className="aspect-video bg-muted rounded-lg overflow-hidden relative">
                              <video
                                ref={remoteVideoRef}
                                autoPlay
                                playsInline
                                className="w-full h-full object-cover"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Audio Level */}
                      {(loopbackTest.status === 'running' || loopbackTest.status === 'success') && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Volume2 className="h-4 w-4 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">{uiText("Nível de Áudio")}</span>
                            <span className="text-xs font-mono ml-auto">{loopbackTest.audioLevel}%</span>
                          </div>
                          <Progress value={loopbackTest.audioLevel} className="h-2" />
                        </div>
                      )}

                      {/* Stats */}
                      {(loopbackTest.status === 'running' || loopbackTest.status === 'success') && (
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div className="p-2 rounded bg-muted/50 text-center">
                            <p className="text-muted-foreground">{uiText("ICE State")}</p>
                            <p className="font-mono">{loopbackTest.iceState || '-'}</p>
                          </div>
                          <div className="p-2 rounded bg-muted/50 text-center">
                            <p className="text-muted-foreground">{uiText("Frames")}</p>
                            <p className="font-mono">{loopbackTest.videoFrames}</p>
                          </div>
                          <div className="p-2 rounded bg-muted/50 text-center">
                            <p className="text-muted-foreground">{uiText("Tempo")}</p>
                            <p className="font-mono">{loopbackTest.latencyMs ? `${loopbackTest.latencyMs}ms` : '-'}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground">{uiText("Este teste captura o seu áudio e vídeo, cria uma conexão peer-to-peer local (loopback), e verifica se a stack completa de WebRTC está a funcionar corretamente.")}</p>
                </div>
              </ScrollArea>
            ) : (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
