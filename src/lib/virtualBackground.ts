import type {
  ImageSegmenter,
  FaceLandmarker,
  ImageSegmenterResult,
} from "@mediapipe/tasks-vision";

// Unified real-time video effects for calls, composited on a canvas and exposed
// as a processed MediaStream: virtual background (selfie segmentation), colour
// filters / low-light / auto-colour / beauty, and AR face filters (face
// landmarks). Fully defensive — if a model or frame fails, the raw camera passes
// through so a call is NEVER broken by effects.

export type BgMode =
  | { kind: "none" }
  | { kind: "blur"; intensity: number }
  | { kind: "image"; url: string }
  | { kind: "video"; url: string };

export type ColorFilter = "none" | "warm" | "cool" | "vintage" | "bw" | "vivid";
export type FaceFilter = "none" | "glasses" | "partyhat" | "cat" | "dog" | "bunny";

export interface EffectsConfig {
  background: BgMode;
  colorFilter: ColorFilter;
  beauty: boolean;
  touchUp: number; // 0..100
  lowLight: boolean;
  autoColor: boolean;
  faceFilter: FaceFilter;
}

export const DEFAULT_EFFECTS: EffectsConfig = {
  background: { kind: "none" },
  colorFilter: "none",
  beauty: false,
  touchUp: 50,
  lowLight: false,
  autoColor: false,
  faceFilter: "none",
};

export function effectsActive(c: EffectsConfig): boolean {
  return (
    c.background.kind !== "none" ||
    c.colorFilter !== "none" ||
    c.beauty ||
    c.lowLight ||
    c.autoColor ||
    c.faceFilter !== "none"
  );
}

const WASM_ROOT = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const SEG_MODEL = "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite";
const FACE_MODEL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task";

const COLOR_FILTERS: Record<ColorFilter, string> = {
  none: "",
  warm: "sepia(0.3) saturate(1.35) hue-rotate(-10deg) brightness(1.05)",
  cool: "saturate(1.1) hue-rotate(15deg) brightness(1.02) contrast(1.05)",
  vintage: "sepia(0.5) contrast(0.9) brightness(1.05) saturate(0.8)",
  bw: "grayscale(1) contrast(1.1)",
  vivid: "saturate(1.6) contrast(1.15)",
};

export class VirtualBackgroundProcessor {
  private video = document.createElement("video");
  private out = document.createElement("canvas");
  private outCtx: CanvasRenderingContext2D;
  private mid = document.createElement("canvas"); // person+background, no colour
  private midCtx: CanvasRenderingContext2D;
  private maskCanvas = document.createElement("canvas");
  private maskCtx: CanvasRenderingContext2D;
  private segmenter: ImageSegmenter | null = null;
  private faceLandmarker: FaceLandmarker | null = null;
  private loadingSeg = false;
  private loadingFace = false;
  private raf = 0;
  private running = false;
  private cfg: EffectsConfig = { ...DEFAULT_EFFECTS };
  private bgImage: HTMLImageElement | null = null;
  private bgVideo: HTMLVideoElement | null = null;
  private outStream: MediaStream;

  private constructor(sourceTrack: MediaStreamTrack) {
    const s = sourceTrack.getSettings();
    const w = s.width ?? 640;
    const h = s.height ?? 480;
    for (const c of [this.out, this.mid, this.maskCanvas]) { c.width = w; c.height = h; }
    this.outCtx = this.out.getContext("2d")!;
    this.midCtx = this.mid.getContext("2d")!;
    this.maskCtx = this.maskCanvas.getContext("2d", { willReadFrequently: true })!;
    this.video.muted = true;
    this.video.playsInline = true;
    this.video.srcObject = new MediaStream([sourceTrack]);
    this.outStream = this.out.captureStream(30);
  }

  static async create(sourceTrack: MediaStreamTrack, initial: BgMode | EffectsConfig): Promise<VirtualBackgroundProcessor> {
    const p = new VirtualBackgroundProcessor(sourceTrack);
    if ("kind" in (initial as BgMode)) p.setMode(initial as BgMode);
    else p.setEffects(initial as EffectsConfig);
    await p.video.play().catch(() => {});
    await p.ensureModels();
    p.running = true;
    p.raf = requestAnimationFrame(p.loop);
    return p;
  }

  get outputStream(): MediaStream { return this.outStream; }

  /** Back-compat: set just the background. */
  setMode(mode: BgMode) {
    this.setEffects({ ...this.cfg, background: mode });
  }

  setEffects(cfg: EffectsConfig) {
    const prev = this.cfg;
    this.cfg = cfg;
    // (re)load background image/video source when it changes
    const bg = cfg.background;
    if (bg.kind !== prev.background.kind || (("url" in bg) && ("url" in prev.background) && bg.url !== prev.background.url)) {
      if (this.bgVideo) { this.bgVideo.pause(); this.bgVideo = null; }
      this.bgImage = null;
      if (bg.kind === "image" && bg.url) {
        const img = new Image(); img.crossOrigin = "anonymous";
        img.onload = () => { this.bgImage = img; }; img.src = bg.url;
      } else if (bg.kind === "video" && bg.url) {
        const v = document.createElement("video");
        v.crossOrigin = "anonymous"; v.muted = true; v.loop = true; v.playsInline = true; v.src = bg.url;
        v.play().then(() => { this.bgVideo = v; }).catch(() => { this.bgVideo = null; });
      }
    }
    // lazily bring up models only when their effect is in use
    void this.ensureModels();
  }

  private async ensureModels() {
    const needsSeg = this.cfg.background.kind !== "none";
    const needsFace = this.cfg.faceFilter !== "none";
    if (needsSeg && !this.segmenter && !this.loadingSeg) {
      this.loadingSeg = true;
      try {
        const { FilesetResolver, ImageSegmenter } = await import("@mediapipe/tasks-vision");
        const vision = await FilesetResolver.forVisionTasks(WASM_ROOT);
        this.segmenter = await ImageSegmenter.createFromOptions(vision, {
          baseOptions: { modelAssetPath: SEG_MODEL, delegate: "GPU" },
          runningMode: "VIDEO", outputCategoryMask: true, outputConfidenceMasks: false,
        });
      } catch (e) { console.error("[FX] segmenter load failed:", e); this.segmenter = null; }
      this.loadingSeg = false;
    }
    if (needsFace && !this.faceLandmarker && !this.loadingFace) {
      this.loadingFace = true;
      try {
        const { FilesetResolver, FaceLandmarker } = await import("@mediapipe/tasks-vision");
        const vision = await FilesetResolver.forVisionTasks(WASM_ROOT);
        this.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: FACE_MODEL, delegate: "GPU" },
          runningMode: "VIDEO", numFaces: 1,
        });
      } catch (e) { console.error("[FX] face landmarker load failed:", e); this.faceLandmarker = null; }
      this.loadingFace = false;
    }
  }

  private blurPx(): number {
    const i = this.cfg.background.kind === "blur" ? this.cfg.background.intensity : 5;
    return Math.max(2, Math.min(24, i * 2.5));
  }

  private frameFilter(): string {
    const parts: string[] = [];
    const cf = COLOR_FILTERS[this.cfg.colorFilter];
    if (cf) parts.push(cf);
    if (this.cfg.lowLight) parts.push("brightness(1.28) contrast(1.08)");
    if (this.cfg.autoColor) parts.push("saturate(1.12)");
    if (this.cfg.beauty) {
      const soft = 0.5 + (this.cfg.touchUp / 100) * 2; // 0.5..2.5px
      parts.push(`blur(${soft.toFixed(1)}px) brightness(1.04)`);
    }
    return parts.join(" ").trim();
  }

  private loop = () => {
    if (!this.running) return;
    const { video } = this;
    if (video.readyState >= 2) {
      const useSeg = this.segmenter && this.cfg.background.kind !== "none";
      if (useSeg) {
        try {
          this.segmenter!.segmentForVideo(video, performance.now(), (res) => {
            this.buildMidWithMask(res);
            this.finishFrame();
          });
        } catch { this.buildMidPlain(); this.finishFrame(); }
      } else {
        this.buildMidPlain();
        this.finishFrame();
      }
    }
    this.raf = requestAnimationFrame(this.loop);
  };

  private buildMidPlain() {
    const { midCtx, video, mid } = this;
    midCtx.filter = "none";
    midCtx.globalCompositeOperation = "source-over";
    midCtx.drawImage(video, 0, 0, mid.width, mid.height);
  }

  private buildMidWithMask(res: ImageSegmenterResult) {
    const { midCtx, maskCtx, video, mid } = this;
    const w = mid.width, h = mid.height;
    const mask = res.categoryMask;
    if (!mask) { this.buildMidPlain(); return; }
    const data = mask.getAsUint8Array();
    const id = maskCtx.createImageData(w, h);
    for (let i = 0; i < data.length; i++) id.data[i * 4 + 3] = data[i] > 0 ? 255 : 0;
    maskCtx.putImageData(id, 0, 0);
    mask.close();

    midCtx.save();
    midCtx.clearRect(0, 0, w, h);
    midCtx.filter = "none";
    midCtx.globalCompositeOperation = "source-over";
    midCtx.drawImage(this.maskCanvas, 0, 0, w, h);      // person silhouette
    midCtx.globalCompositeOperation = "source-in";
    midCtx.drawImage(video, 0, 0, w, h);                 // keep video inside person
    midCtx.globalCompositeOperation = "destination-over";
    const bg = this.cfg.background;
    if (bg.kind === "image" && this.bgImage) {
      midCtx.filter = "none"; midCtx.drawImage(this.bgImage, 0, 0, w, h);
    } else if (bg.kind === "video" && this.bgVideo && this.bgVideo.readyState >= 2) {
      midCtx.filter = "none"; midCtx.drawImage(this.bgVideo, 0, 0, w, h);
    } else {
      midCtx.filter = `blur(${this.blurPx()}px)`; midCtx.drawImage(video, 0, 0, w, h);
    }
    midCtx.restore();
    midCtx.filter = "none";
    midCtx.globalCompositeOperation = "source-over";
  }

  private finishFrame() {
    const { outCtx, out, mid } = this;
    const w = out.width, h = out.height;
    outCtx.save();
    outCtx.filter = this.frameFilter() || "none";
    outCtx.globalCompositeOperation = "source-over";
    outCtx.drawImage(mid, 0, 0, w, h);
    outCtx.restore();
    outCtx.filter = "none";
    if (this.cfg.faceFilter !== "none" && this.faceLandmarker) {
      try {
        const r = this.faceLandmarker.detectForVideo(this.video, performance.now());
        const face = r.faceLandmarks?.[0];
        if (face) this.drawFaceFilter(face);
      } catch { /* skip overlay this frame */ }
    }
  }

  private drawFaceFilter(lm: { x: number; y: number }[]) {
    const { outCtx: c, out } = this;
    const w = out.width, h = out.height;
    const P = (i: number) => ({ x: lm[i].x * w, y: lm[i].y * h });
    const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
    const eyeR = P(33), eyeL = P(263); // outer eye corners (image right/left)
    const nose = P(1);
    const brow = P(10); // forehead centre
    const cheekR = P(234), cheekL = P(454);
    const faceW = dist(cheekR, cheekL);
    const eyeD = dist(eyeR, eyeL);

    c.save();
    switch (this.cfg.faceFilter) {
      case "glasses": {
        const rad = eyeD * 0.28;
        c.strokeStyle = "rgba(20,20,20,0.92)"; c.lineWidth = Math.max(2, eyeD * 0.06);
        c.fillStyle = "rgba(30,30,30,0.35)";
        for (const e of [eyeR, eyeL]) { c.beginPath(); c.arc(e.x, e.y, rad, 0, Math.PI * 2); c.fill(); c.stroke(); }
        c.beginPath(); c.moveTo(eyeR.x + rad, eyeR.y); c.lineTo(eyeL.x - rad, eyeL.y); c.stroke();
        break;
      }
      case "partyhat": {
        const cx = brow.x, top = brow.y - faceW * 0.75, baseY = brow.y - faceW * 0.15, bw = faceW * 0.5;
        c.fillStyle = "#ec4899";
        c.beginPath(); c.moveTo(cx, top); c.lineTo(cx - bw / 2, baseY); c.lineTo(cx + bw / 2, baseY); c.closePath(); c.fill();
        c.fillStyle = "#facc15"; c.beginPath(); c.arc(cx, top, faceW * 0.05, 0, Math.PI * 2); c.fill();
        break;
      }
      case "cat":
      case "dog":
      case "bunny": {
        const kind = this.cfg.faceFilter;
        const earColor = kind === "cat" ? "#6b7280" : kind === "dog" ? "#92400e" : "#f3f4f6";
        const inner = "#f9a8d4";
        const topY = brow.y - faceW * 0.15;
        const drawEar = (side: number) => {
          const ex = brow.x + side * faceW * 0.32;
          c.fillStyle = earColor;
          if (kind === "bunny") {
            c.beginPath(); c.ellipse(ex, topY - faceW * 0.5, faceW * 0.09, faceW * 0.34, 0, 0, Math.PI * 2); c.fill();
            c.fillStyle = inner; c.beginPath(); c.ellipse(ex, topY - faceW * 0.5, faceW * 0.04, faceW * 0.24, 0, 0, Math.PI * 2); c.fill();
          } else {
            c.beginPath(); c.moveTo(ex, topY - faceW * 0.55); c.lineTo(ex - faceW * 0.16, topY); c.lineTo(ex + faceW * 0.16, topY); c.closePath(); c.fill();
            c.fillStyle = inner; c.beginPath(); c.moveTo(ex, topY - faceW * 0.42); c.lineTo(ex - faceW * 0.08, topY - faceW * 0.02); c.lineTo(ex + faceW * 0.08, topY - faceW * 0.02); c.closePath(); c.fill();
          }
        };
        drawEar(-1); drawEar(1);
        c.fillStyle = kind === "dog" ? "#1f2937" : "#f472b6";
        c.beginPath(); c.ellipse(nose.x, nose.y, faceW * 0.05, faceW * 0.04, 0, 0, Math.PI * 2); c.fill();
        break;
      }
    }
    c.restore();
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    try { this.segmenter?.close(); } catch { /* noop */ }
    try { this.faceLandmarker?.close(); } catch { /* noop */ }
    if (this.bgVideo) { this.bgVideo.pause(); this.bgVideo = null; }
    this.outStream.getTracks().forEach((t) => t.stop());
    this.video.srcObject = null;
  }
}
