import { useRef, useCallback, useEffect } from "react";

// Records the whole call: composites every video tile onto a canvas and mixes
// all audio tracks (local mic + each remote) via Web Audio, then records the
// combined stream with MediaRecorder. stop() resolves with the final webm Blob.
// Fully defensive — a failure to start just means no recording, never a crash.

interface RecorderState {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  videos: HTMLVideoElement[];
  audioCtx: AudioContext;
  dest: MediaStreamAudioDestinationNode;
  recorder: MediaRecorder;
  chunks: BlobPart[];
  raf: number;
  combined: MediaStream;
}

export function pickMimeType(): string | undefined {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4",
  ];
  for (const t of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)) return t;
  }
  return undefined;
}

export function useCallRecorder() {
  const stateRef = useRef<RecorderState | null>(null);
  const stoppingRef = useRef<Promise<Blob | null> | null>(null);

  const start = useCallback((localStream: MediaStream | null, remoteStreams: Map<string, MediaStream>): boolean => {
    if (stateRef.current || stoppingRef.current) return false;
    let allocatedAudio: AudioContext | null = null;
    let allocatedStream: MediaStream | null = null;
    try {
      const streams: MediaStream[] = [];
      if (localStream) streams.push(localStream);
      for (const s of remoteStreams.values()) streams.push(s);
      if (streams.length === 0) return false;

      const W = 1280, H = 720;
      const canvas = document.createElement("canvas");
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext("2d");
      if (!ctx) return false;

      // hidden <video> per stream for canvas drawing
      const videos: HTMLVideoElement[] = streams.map((s) => {
        const v = document.createElement("video");
        v.muted = true; v.playsInline = true; v.srcObject = s;
        v.play().catch(() => {});
        return v;
      });

      // audio mixing
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioCtx();
      allocatedAudio = audioCtx;
      void audioCtx.resume().catch(() => {});
      const dest = audioCtx.createMediaStreamDestination();
      for (const s of streams) {
        if (s.getAudioTracks().length > 0) {
          try { audioCtx.createMediaStreamSource(s).connect(dest); } catch { /* skip */ }
        }
      }

      // grid layout
      const drawFrame = () => {
        const active = videos.filter((v) => v.readyState >= 2 && v.videoWidth > 0);
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, W, H);
        const n = Math.max(1, active.length);
        const cols = Math.ceil(Math.sqrt(n));
        const rows = Math.ceil(n / cols);
        const cw = W / cols, ch = H / rows;
        active.forEach((v, i) => {
          const cx = (i % cols) * cw;
          const cy = Math.floor(i / cols) * ch;
          // cover-fit
          const scale = Math.max(cw / v.videoWidth, ch / v.videoHeight);
          const dw = v.videoWidth * scale, dh = v.videoHeight * scale;
          ctx.drawImage(v, cx + (cw - dw) / 2, cy + (ch - dh) / 2, dw, dh);
        });
        const st = stateRef.current;
        if (st) st.raf = requestAnimationFrame(drawFrame);
      };

      const canvasStream = canvas.captureStream(30);
      const combined = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...dest.stream.getAudioTracks(),
      ]);

      allocatedStream = combined;
      const chunks: BlobPart[] = [];
      const recorder = new MediaRecorder(combined, pickMimeType() ? { mimeType: pickMimeType() } : undefined);
      recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
      recorder.start(1000);

      stateRef.current = { canvas, ctx, videos, audioCtx, dest, recorder, chunks, raf: 0, combined };
      stateRef.current.raf = requestAnimationFrame(drawFrame);
      return true;
    } catch (e) {
      allocatedStream?.getTracks().forEach(t => t.stop());
      if (allocatedAudio) void allocatedAudio.close().catch(() => {});
      console.error("[rec] failed to start:", e);
      return false;
    }
  }, []);

  const stop = useCallback((): Promise<Blob | null> => {
    if (stoppingRef.current) return stoppingRef.current;
    if (!stateRef.current) return Promise.resolve(null);
    const stopping = new Promise<Blob | null>((resolve) => {
      const st = stateRef.current;
      if (!st) { resolve(null); return; }
      let finished = false;
      let timeout: ReturnType<typeof setTimeout> | undefined;
      const finish = () => {
        if (finished) return;
        finished = true;
        clearTimeout(timeout);
        cancelAnimationFrame(st.raf);
        st.videos.forEach((v) => { v.srcObject = null; });
        st.combined.getTracks().forEach(t => t.stop());
        void st.audioCtx.close().catch(() => {});
        const blob = st.chunks.length ? new Blob(st.chunks, { type: st.recorder.mimeType || (st.chunks[0] instanceof Blob ? st.chunks[0].type : "") }) : null;
        stateRef.current = null;
        resolve(blob);
      };
      if (st.recorder.state !== "inactive") {
        st.recorder.onstop = finish;
        st.recorder.onerror = finish;
        timeout = setTimeout(finish, 3000);
        try { st.recorder.stop(); } catch { finish(); }
      } else {
        finish();
      }
    });
    stoppingRef.current = stopping.finally(() => { stoppingRef.current = null; });
    return stoppingRef.current;
  }, []);

  useEffect(() => () => { void stop(); }, [stop]);

  const pause = useCallback((paused: boolean) => {
    const st = stateRef.current;
    if (!st) return;
    try { paused ? st.recorder.pause() : st.recorder.resume(); } catch { /* noop */ }
  }, []);

  return { start, stop, pause };
}
