import {useEffect, useRef, useState} from 'react';
import {locaccess, validHandle} from './api';
import {uiLocale, uiText as t} from '@/i18n/ui-copy';
import {journeyCompassPermission,useJourneyCompass} from './useJourneyCompass';
import {readVisitLease,visitDeadline,type AccessVisitResult} from './visit-lease';

const NJILA = 'https://www.njilamaps.com';
type Point = {lat:number; lon:number};
type Fix = Point & {accuracy:number; timestamp:number};

/** The signed-in parent renews every lease through LOCACCESS. Credentials never cross the frame. */
export function NjilaJourney({handle}:{handle:string}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [expanded, setExpanded] = useState(true);
  useEffect(() => {
    if (!expanded) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setExpanded(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [expanded]);
  const channel = useRef<string|null>(null);
  const compass=useJourneyCompass(reading=>{
    if(channel.current)frame.current?.contentWindow?.postMessage({type:'locaccess-heading',audience:channel.current,...reading},NJILA);
  });
  const stopCompass=compass.stop;
  const startCompass=compass.request;
  const permission=useRef(journeyCompassPermission());
  const [message, setMessage] = useState('A verificar a autorização…');
  useEffect(() => {
    let active=true, connected=navigator.onLine, generation=0, connectionGeneration=0;
    let audience:string|null=null, fix:Fix|null=null, pending: symbol|null=null;
    let held:{expiresAt:number;deadline:number;offlineContinuation:'permitted'|'forbidden'}|undefined;
    // Keep only the deadline after clearing, so replaying the same expiry cannot revive it.
    let lastDeadline:{expiresAt:number;deadline:number}|undefined;
    let lease:ReturnType<typeof setTimeout>|undefined;
    const target=frame.current?.contentWindow;
    const post=(value:Record<string,unknown>)=>{
      try{target?.postMessage(value,NJILA);}
      catch{/* A destroyed iframe has already discarded its session; local cleanup must still finish. */}
    };
    const clear=()=>{
      stopCompass();
      generation++;
      pending=null;
      held=undefined;
      fix=null;
      channel.current=null;
      if(lease!==undefined)clearTimeout(lease);
      lease=undefined;
      post({type:'locaccess-clear',audience});
    };
    const unexpired=()=>held!==undefined&&performance.now()<held.deadline&&Date.now()<held.expiresAt;
    const mayContinueOffline=()=>unexpired()&&held?.offlineContinuation==='permitted';
    const expire=()=>{clear();setMessage('A autorização terminou. Liga-te à Internet para verificar novamente o acesso.');};
    const refresh=async()=>{
      if(!active||pending||!audience||!validHandle(handle)||document.hidden||!connected||!navigator.onLine)return;
      const request=Symbol();
      pending=request;
      const revision=++generation, connection=connectionGeneration, startedAt=performance.now(),startedWall=Date.now();
      try {
        const result=await locaccess<AccessVisitResult>('visit',{handle,...(fix?{position:fix}:{})});
        if(!active||revision!==generation)return;
        // A denial is authoritative even if connectivity disappeared while the request was in flight.
        if(result?.status!=='ready'&&result?.status!=='proximity') {
          clear();setMessage('Este acesso está fechado, expirou ou não foi autorizado para a tua conta.');return;
        }
        if((!connected||!navigator.onLine)&&result.offlineContinuation!=='permitted'){
          clear();return;
        }
        // A late positive response must not grant, renew or increase precision after going offline.
        if(document.hidden||!connected||!navigator.onLine||connection!==connectionGeneration)return;
        const issued=readVisitLease(result);
        if(!issued)throw new Error('expired');
        const deadline=visitDeadline(issued,startedAt,startedWall,lastDeadline);
        if(deadline<=performance.now()){expire();return;}
        if(!held)void startCompass(permission.current);
        if(lease!==undefined)clearTimeout(lease);
        held={expiresAt:issued.expiresAt,deadline,offlineContinuation:issued.offlineContinuation};
        lastDeadline={expiresAt:issued.expiresAt,deadline};
        channel.current=audience;
        post({type:'locaccess-lease',audience,point:issued.point,precision:issued.precision,radius:result.radius,
          expiresAt:new Date(issued.expiresAt).toISOString(),offlineContinuation:issued.offlineContinuation});
        lease=setTimeout(expire,deadline-performance.now());
        setMessage(result.status==='ready'?'Acesso autorizado.':'A área indicada é aproximada. A morada exacta depende da proximidade autorizada.');
      } catch(error) {
        if(active&&revision===generation){
          const serverError=typeof error==='object'&&error!==null&&'code' in error&&Boolean(error.code);
          if(!serverError&&(!connected||!navigator.onLine)&&mayContinueOffline()){
            setMessage('Sem rede. O acesso mantém-se apenas até ao fim da autorização actual; não será renovado.');
          }else{clear();setMessage('Não foi possível verificar o acesso. Tenta novamente.');}
        }
      } finally {if(pending===request)pending=null;}
    };
    const receive=(event:MessageEvent)=>{
      if(event.origin!==NJILA||event.source!==target)return;
      const data=event.data;
      if(data?.type==='locaccess-ready'&&typeof data.audience==='string'&&/^[a-f0-9-]{36}$/.test(data.audience)){
        if(audience!==data.audience){clear();audience=data.audience;}
        void refresh();
      }
      if(data?.type==='locaccess-position'&&data.audience===audience){
        const p=data.position;
        if(p&&[p.lat,p.lon,p.accuracy,p.timestamp].every(Number.isFinite)){
          fix={lat:p.lat,lon:p.lon,accuracy:p.accuracy,timestamp:p.timestamp};void refresh();
        }
      }
    };
    const pause=()=>{clear();};
    const offline=()=>{
      connected=false;
      connectionGeneration++;
      pending=null;
      fix=null;
      if(mayContinueOffline())setMessage('Sem rede. O acesso mantém-se apenas até ao fim da autorização actual; não será renovado.');
      else clear();
    };
    const online=()=>{connected=navigator.onLine;connectionGeneration++;void refresh();};
    const visibility=()=>{pause();if(!document.hidden)void refresh();};
    window.addEventListener('message',receive);
    window.addEventListener('offline',offline);
    window.addEventListener('pagehide',pause);
    window.addEventListener('online',online);
    document.addEventListener('visibilitychange',visibility);
    const timer=setInterval(()=>{if(held&&!unexpired())expire();void refresh();},5000);
    return()=>{active=false;clear();clearInterval(timer);window.removeEventListener('message',receive);window.removeEventListener('offline',offline);window.removeEventListener('pagehide',pause);window.removeEventListener('online',online);document.removeEventListener('visibilitychange',visibility);};
  },[handle,stopCompass,startCompass]);
  return <section className={expanded
    ? 'fixed inset-0 z-[9999] flex min-h-0 flex-col gap-2 bg-background p-2'
    : 'flex min-w-0 flex-col gap-2'}
    style={expanded ? {paddingTop:'max(.5rem, env(safe-area-inset-top))', paddingBottom:'max(.5rem, env(safe-area-inset-bottom))'} : undefined}>
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" aria-pressed={expanded}
        onClick={()=>setExpanded(value=>!value)}
        className="min-h-11 rounded-xl bg-foreground px-4 py-2 font-semibold text-background">
        {t(expanded?'Reduzir mapa':'Ecrã inteiro')}
      </button>
    </div>
    <p role="status" className="text-sm font-medium leading-snug">{t(message)}</p>
    <iframe ref={frame} title="NJILA" src={NJILA+'/?from=yamilook&purpose=locaccess&embedded=1&lang='+encodeURIComponent(uiLocale())}
      className={expanded ? 'min-h-0 w-full flex-1 border-0' : 'w-full rounded-xl border'} style={expanded ? undefined : {height:'80dvh'}} referrerPolicy="origin"
      sandbox="allow-scripts allow-same-origin" allow="geolocation; camera; accelerometer; gyroscope; magnetometer"/>
  </section>;
}
