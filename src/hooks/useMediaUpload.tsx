import { uploadPrivateChatFile } from '@/lib/private-chat-media';
import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { chatMediaContentType, chatMediaType, createVideoPoster } from '@/lib/chat-media';

export function useVoiceRecorder(conversationId?: string) {
  const { user } = useAuth();
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pendingBlobRef = useRef<{ blob: Blob; duration: number } | null>(null);
  const uploadQueueRef = useRef<Array<{ blob: Blob; duration: number; resolve: (result: { blob: Blob; duration: number } | null) => void }>>([]);
  const isProcessingQueueRef = useRef(false);
  // Live mirror of recordingTime so non-React handlers (e.g. the recorder's
  // default onstop, which fires on auto-stop) read the current value instead of
  // the stale one captured when startRecording was memoized.
  const recordingTimeRef = useRef(0);
  useEffect(() => {
    recordingTimeRef.current = recordingTime;
  }, [recordingTime]);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;
  }, []);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      streamRef.current = stream;
      
      // Determine best supported format - prioritize widely compatible formats
      let mimeType = '';
      const supportedTypes = [
        'audio/mp4',
        'audio/aac',
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/ogg'
      ];
      
      for (const type of supportedTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          mimeType = type;
          break;
        }
      }
      
      const options: MediaRecorderOptions = mimeType ? { mimeType } : {};
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        if (chunksRef.current.length > 0) {
          const actualMimeType = mediaRecorder.mimeType || mimeType || 'audio/webm';
          const blob = new Blob(chunksRef.current, { type: actualMimeType });
          // Store the blob in a ref so it can be retrieved immediately
          pendingBlobRef.current = { blob, duration: recordingTimeRef.current };
          setAudioBlob(blob);
        }
        cleanup();
      };

      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        setError('Erro ao gravar áudio');
        cleanup();
        setIsRecording(false);
      };

      // Request data every 1 second to ensure we capture audio
      mediaRecorder.start(1000);
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Failed to start recording:', err);
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        setError('Permissão de microfone negada');
      } else {
        setError('Não foi possível iniciar a gravação');
      }
      cleanup();
    }
  }, [cleanup]);

  const stopRecording = useCallback((): Promise<{ blob: Blob; duration: number } | null> => {
    return new Promise((resolve) => {
      if (mediaRecorderRef.current && isRecording) {
        // Capture the current recording time before stopping
        const currentDuration = recordingTime;
        
        // Override the onstop handler to resolve the promise
        const originalOnStop = mediaRecorderRef.current.onstop;
        mediaRecorderRef.current.onstop = (event) => {
          if (chunksRef.current.length > 0) {
            const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm';
            const blob = new Blob(chunksRef.current, { type: mimeType });
            pendingBlobRef.current = { blob, duration: currentDuration };
            setAudioBlob(blob);
            cleanup();
            resolve({ blob, duration: currentDuration });
          } else {
            cleanup();
            resolve(null);
          }
        };
        
        try {
          if (mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
          } else {
            resolve(null);
          }
        } catch (err) {
          console.error('Error stopping recording:', err);
          resolve(null);
        }
        setIsRecording(false);
      } else {
        resolve(null);
      }
    });
  }, [isRecording, recordingTime, cleanup]);

  const cancelRecording = useCallback(() => {
    cleanup();
    setIsRecording(false);
    setAudioBlob(null);
    setRecordingTime(0);
    pendingBlobRef.current = null;
  }, [cleanup]);

  // Get a local blob URL immediately for optimistic display
  const getLocalAudioUrl = useCallback((): { localUrl: string; duration: number; blob: Blob } | null => {
    if (!audioBlob) return null;
    
    const localUrl = URL.createObjectURL(audioBlob);
    const duration = recordingTime;
    
    return { localUrl, duration, blob: audioBlob };
  }, [audioBlob, recordingTime]);

  // Upload in background and return the final URL
  const uploadVoiceMessageAsync = useCallback(async (
    blob: Blob,
    onSuccess: (url: string) => void,
    onError: () => void
  ): Promise<void> => {
    if (!user) {
      onError();
      return;
    }

    try {
      // Determine file extension based on blob type
      let extension = 'webm';
      let contentType = blob.type || 'audio/webm';
      
      if (contentType.includes('mp4') || contentType.includes('aac')) {
        extension = 'm4a';
        contentType = 'audio/mp4';
      } else if (contentType.includes('ogg')) {
        extension = 'ogg';
        contentType = 'audio/ogg';
      } else if (contentType.includes('webm')) {
        extension = 'webm';
        contentType = 'audio/webm';
      }

      if (!conversationId) throw new Error('Conversation required');
      onSuccess(await uploadPrivateChatFile(conversationId, blob, `audio.${extension}`, contentType));

    } catch (err) {
      console.error('Upload error:', err);
      onError();
    }
  }, [user, conversationId]);

  // Legacy sync upload (for backwards compatibility)
  const uploadVoiceMessage = async (conversationId: string): Promise<{ url: string; duration: number } | null> => {
    if (!audioBlob || !user) return null;

    try {
      let extension = 'webm';
      let contentType = audioBlob.type || 'audio/webm';
      
      if (contentType.includes('mp4') || contentType.includes('aac')) {
        extension = 'm4a';
        contentType = 'audio/mp4';
      } else if (contentType.includes('ogg')) {
        extension = 'ogg';
        contentType = 'audio/ogg';
      } else if (contentType.includes('webm')) {
        extension = 'webm';
        contentType = 'audio/webm';
      }

      const reference = await uploadPrivateChatFile(conversationId, audioBlob, `audio.${extension}`, contentType);

      const duration = recordingTime;
      setAudioBlob(null);
      setRecordingTime(0);
      setError(null);

      return { url: reference, duration };

    } catch (err) {
      console.error('Upload error:', err);
      setError('Erro ao enviar áudio');
      return null;
    }
  };

  const clearRecording = useCallback(() => {
    setAudioBlob(null);
    setRecordingTime(0);
    setError(null);
  }, []);

  return {
    isRecording,
    recordingTime,
    audioBlob,
    error,
    startRecording,
    stopRecording,
    cancelRecording,
    uploadVoiceMessage,
    getLocalAudioUrl,
    uploadVoiceMessageAsync,
    clearRecording,
  };
}

export function useMediaUpload() {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const uploadMedia = async (
    file: File,
    type: 'image' | 'video' | 'file',
    options: { videoPoster?: boolean; conversationId?: string } = {}
  ): Promise<{ url: string; type: string; name: string; size: number; thumbnailUrl?: string; durationSeconds?: number } | null> => {
    if (!user) return null;

    setUploading(true);
    setProgress(0);

    const fileName = `${user.id}/${Date.now()}_${file.name}`;
    const bucket = 'media';

    try {
      const posterPromise = options.videoPoster && chatMediaType(file) === 'video'
        ? createVideoPoster(file).catch(() => null) : Promise.resolve(null);
      if (options.conversationId) {
        const url = await uploadPrivateChatFile(options.conversationId, file, file.name, chatMediaContentType(file));
        const poster = await posterPromise;
        let thumbnailUrl: string | undefined;
        if (poster) {
          try { thumbnailUrl = await uploadPrivateChatFile(options.conversationId, poster.blob, `${file.name}.poster.jpg`, 'image/jpeg'); }
          catch { /* A missing optional cover must not discard the video. */ }
        }
        return { url, type: file.type, name: file.name, size: file.size, thumbnailUrl, durationSeconds: poster?.durationSeconds };
      }
      const { error } = await supabase.storage
        .from(bucket)
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: chatMediaContentType(file),
        });

      if (error) {
        console.error('[useMediaUpload] Upload error:', error.message, error);
        setUploading(false);
        return null;
      }

      // Use public URL for media bucket (videos, images need to be publicly viewable)
      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(fileName);

      if (!urlData?.publicUrl) {
        console.error('Failed to get public URL');
        return null;
      }

      const poster = await posterPromise;
      let thumbnailUrl: string | undefined;
      if (poster) {
        try {
          const posterPath = `${fileName}.poster.jpg`;
          const { error: posterError } = await supabase.storage.from(bucket).upload(posterPath, poster.blob, {
            contentType: 'image/jpeg', cacheControl: '31536000', upsert: false,
          });
          if (!posterError) thumbnailUrl = supabase.storage.from(bucket).getPublicUrl(posterPath).data.publicUrl;
        } catch {
          // The original is already uploaded; an optional cover must not discard it.
        }
      }

      return {
        url: urlData.publicUrl,
        type: file.type,
        name: file.name,
        size: file.size,
        thumbnailUrl,
        durationSeconds: poster?.durationSeconds,
      };
    } catch (err) {
      console.error('Upload error:', err);
      return null;
    } finally {
      setUploading(false);
    }
  };

  return {
    uploading,
    progress,
    uploadMedia,
  };
}
