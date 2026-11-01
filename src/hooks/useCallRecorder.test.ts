import { afterEach, describe, expect, it, vi } from 'vitest';
import { pickMimeType } from './useCallRecorder';
afterEach(() => vi.unstubAllGlobals());
describe('call recording formats', () => {
  it('uses MP4 on devices without WebM support', () => {
    vi.stubGlobal('MediaRecorder', { isTypeSupported: (type: string) => type === 'video/mp4' });
    expect(pickMimeType()).toBe('video/mp4');
  });
  it('lets the browser choose when no explicit format is supported', () => {
    vi.stubGlobal('MediaRecorder', { isTypeSupported: () => false });
    expect(pickMimeType()).toBeUndefined();
  });
});

import { act, renderHook, cleanup } from '@testing-library/react';
import { useCallRecorder } from './useCallRecorder';
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it('mixes both audio sources, stops once, and releases only recording-owned tracks', async () => {
  const micStop=vi.fn(), videoStop=vi.fn(), mixStop=vi.fn(), close=vi.fn().mockResolvedValue(undefined), connect=vi.fn();
  class Stream {
    constructor(public tracks: {kind:string;stop:()=>void}[]) {}
    getTracks(){return this.tracks;}
    getAudioTracks(){return this.tracks.filter(t=>t.kind==='audio');}
    getVideoTracks(){return this.tracks.filter(t=>t.kind==='video');}
  }
  const mixed=new Stream([{kind:'audio',stop:mixStop}]);
  class Audio {
    close=close; resume=vi.fn().mockResolvedValue(undefined);
    createMediaStreamDestination(){return {stream:mixed};}
    createMediaStreamSource(){return {connect, disconnect: vi.fn()};}
  }
  const stop=vi.fn();
  class Recorder {
    static isTypeSupported(t:string){return t==='video/mp4';}
    mimeType='video/mp4';state='inactive';onstop?:()=>void;ondataavailable?:(e:{data:Blob})=>void;
    start(){this.state='recording';}
    stop(){stop();this.state='inactive';queueMicrotask(()=>{this.ondataavailable?.({data:new Blob(['audio/video'])});this.onstop?.();});}
    pause(){this.state='paused';} resume(){this.state='recording';}
  }
  vi.stubGlobal('MediaStream',Stream);vi.stubGlobal('AudioContext',Audio);vi.stubGlobal('MediaRecorder',Recorder);
  vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue({fillRect:vi.fn(),drawImage:vi.fn()} as unknown as CanvasRenderingContext2D);
  Object.defineProperty(HTMLCanvasElement.prototype,'captureStream',{configurable:true,value:()=>new Stream([{kind:'video',stop:videoStop}])});
  vi.spyOn(HTMLMediaElement.prototype,'play').mockResolvedValue(undefined);
  const local=new Stream([{kind:'audio',stop:micStop}]) as unknown as MediaStream;
  const remote=new Stream([{kind:'audio',stop:micStop}]) as unknown as MediaStream;
  const {result,unmount}=renderHook(()=>useCallRecorder());
  expect(result.current.start(local,new Map([['remote',remote]]))).toBe(true);
  expect(connect).toHaveBeenCalledTimes(2);
  result.current.pause(true);
  expect(result.current.update(local, new Map([['remote', new Stream([{kind:'audio',stop:micStop}]) as unknown as MediaStream]]))).toBe(true);
  expect(connect).toHaveBeenCalledTimes(3);
  result.current.pause(false);
  expect(result.current.start(local,new Map())).toBe(false);
  let blob: Blob|null=null;
  await act(async()=>{const first=result.current.stop();expect(result.current.stop()).toBe(first);blob=await first;});
  expect(blob!.type).toBe('video/mp4');expect(blob!.size).toBeGreaterThan(0);
  expect(stop).toHaveBeenCalledOnce();expect(videoStop).toHaveBeenCalledOnce();expect(mixStop).toHaveBeenCalledOnce();expect(micStop).not.toHaveBeenCalled();expect(close).toHaveBeenCalledOnce();
  unmount();delete (HTMLCanvasElement.prototype as unknown as {captureStream?:unknown}).captureStream;
});
