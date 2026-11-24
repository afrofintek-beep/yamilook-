import {useEffect, useRef, useState} from 'react';
import {locaccess, validHandle} from './api';
import {uiLocale, uiText as t} from '@/i18n/ui-copy';
import {journeyCompassPermission,useJourneyCompass} from './useJourneyCompass';

const NJILA = 'https://www.njilamaps.com';
type Point = {lat:number; lon:number};
type Fix = Point & {accuracy:number; timestamp:number};
type Visit = {status:'ready'|'proximity'|'denied'; point?:Point; area?:Point; expiresAt?:string; radius?:number};

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
    let active=true, busy=false, generation=0, audience:string|null=null, fix:Fix|null=null;
    let lease:ReturnType<typeof setTimeout>|undefined;
    const post=(value:Record<string,unknown>)=>frame.current?.contentWindow?.postMessage(value,NJILA);
    const clear=()=>{
      stopCompass();
      generation++;
      if(lease)clearTimeout(lease);
      lease=undefined;
      post({type:'locaccess-clear',audience});
    };
    const refresh=async()=>{
      if(!active||busy||!audience||!validHandle(handle)||document.hidden||!navigator.onLine)return;
      busy=true;
      const revision=generation;
      try {
        const result=await locaccess<Visit>('visit',{handle,...(fix?{position:fix}:{})});
        if(!active||revision!==generation||document.hidden||!navigator.onLine)return;
        const point=result.status==='ready'?result.point:result.status==='proximity'?result.area:null;
        if(!point||!Number.isFinite(point.lat)||!Number.isFinite(point.lon)) {
          clear();setMessage('Este acesso está fechado, expirou ou não foi autorizado para a tua conta.');return;
        }
        const expiry=result.status==='ready'?Date.parse(result.expiresAt||''):Date.now()+15000;
        if(!Number.isFinite(expiry)||expiry<=Date.now()||expiry>Date.now()+25000)throw new Error('expired');
        if(!lease)void startCompass(permission.current);
        if(lease)clearTimeout(lease);
        post({type:'locaccess-lease',audience,point,precision:result.status==='ready'?'exact':'area',radius:result.radius,expiresAt:new Date(expiry).toISOString()});
        lease=setTimeout(clear,expiry-Date.now());
        setMessage(result.status==='ready'?'Acesso autorizado.':'A área indicada é aproximada. A morada exacta depende da proximidade autorizada.');
      } catch {
        if(active&&revision===generation){clear();setMessage('Não foi possível verificar o acesso. Tenta novamente.');}
      } finally {busy=false;}
    };
    const receive=(event:MessageEvent)=>{
      if(event.origin!==NJILA||event.source!==frame.current?.contentWindow)return;
      const data=event.data;
      if(data?.type==='locaccess-ready'&&typeof data.audience==='string'&&/^[a-f0-9-]{36}$/.test(data.audience)){
        if(audience!==data.audience){clear();fix=null;audience=data.audience;channel.current=audience;}
        void refresh();
      }
      if(data?.type==='locaccess-position'&&data.audience===audience){
        const p=data.position;
        if(p&&[p.lat,p.lon,p.accuracy,p.timestamp].every(Number.isFinite)){
          fix={lat:p.lat,lon:p.lon,accuracy:p.accuracy,timestamp:p.timestamp};void refresh();
        }
      }
    };
    const pause=()=>{clear();fix=null;};
    const visibility=()=>{pause();if(!document.hidden)void refresh();};
    window.addEventListener('message',receive);
    window.addEventListener('offline',pause);
    window.addEventListener('pagehide',pause);
    window.addEventListener('online',refresh);
    document.addEventListener('visibilitychange',visibility);
    const timer=setInterval(()=>void refresh(),5000);
    return()=>{active=false;clear();clearInterval(timer);window.removeEventListener('message',receive);window.removeEventListener('offline',pause);window.removeEventListener('pagehide',pause);window.removeEventListener('online',refresh);document.removeEventListener('visibilitychange',visibility);};
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
