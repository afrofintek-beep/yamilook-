import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useCallRecorder } from '../../src/hooks/useCallRecorder';
import { getSharedAudioContext, unlockCallAudio } from '../../src/lib/audio-context';
import { keepRecording, pendingRecordings } from '../../src/features/call-recording/pending';
function Fixture() {
  const recorder = useCallRecorder();
  const [status, setStatus] = useState('idle');
  const start = async () => {
    unlockCallAudio();
    const ctx = getSharedAudioContext(); await ctx.resume();
    const streams = [440, 880].map(hz => {
      const oscillator=ctx.createOscillator();oscillator.frequency.value=hz;
      const gain=ctx.createGain();gain.gain.value=0.1;
      const dest=ctx.createMediaStreamDestination();oscillator.connect(gain);gain.connect(dest);oscillator.start();
      return dest.stream;
    });
    // Exercise the asynchronous consent delay after the initial user gesture.
    await new Promise(resolve => setTimeout(resolve, 100));
    setStatus(recorder.start(streams[0], new Map([['other',streams[1]]])) ? 'recording' : 'failed');
  };
  const stop = async () => {
    const blob=await recorder.stop();
    if (!blob) { setStatus('empty');return; }
    const durable=await keepRecording({id:'fixture',callId:'fixture',ownerId:'owner-a',blob,duration:2,createdAt:Date.now()});
    const context=getSharedAudioContext();
    const buffer=await context.decodeAudioData(await blob.arrayBuffer());
    const samples=buffer.getChannelData(0);const rate=buffer.sampleRate;
    const magnitude=(hz:number)=>{
      let sin=0,cos=0;const from=Math.floor(rate/2),n=Math.min(rate,samples.length-from);
      for(let i=0;i<n;i++){sin+=samples[from+i]*Math.sin(2*Math.PI*hz*i/rate);cos+=samples[from+i]*Math.cos(2*Math.PI*hz*i/rate);}
      return 2*Math.hypot(sin,cos)/n;
    };
    (window as any).result={type:blob.type,size:blob.size,durable,local:magnitude(440),remote:magnitude(880),noise:magnitude(1400),running:context.state};
    setStatus('saved');
  };
  const recover=async()=>{
    const own=await pendingRecordings('owner-a'),other=await pendingRecordings('owner-b');
    (window as any).recovery={count:own.length,size:own[0]?.blob.size,other:other.length};setStatus('recovered');
  };
  return <><button onClick={start}>Start</button><button onClick={stop}>Stop</button><button onClick={recover}>Recover</button><p>{status}</p></>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);
