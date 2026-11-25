import {MaguelaPickupVisit} from './MaguelaPickup';
import {prepareJourneyCompass} from '../locaccess/useJourneyCompass';
import {uiText as t,useUiLocale} from '@/i18n/ui-copy';
import {NjilaJourney} from './NjilaJourney';
import {useEffect,useRef,useState} from 'react';import {Link,useParams} from 'react-router-dom';
import {Button} from '@/components/ui/button';import {locaccess,validHandle} from './api';import {AccessMap,type MapPoint} from './AccessMap';
import {googleEntryUrl,openGoogleEntry,type ExternalRoute} from './google-entry';
import {readVisitLease,visitDeadline,type AccessVisitResult} from './visit-lease';
type Result=AccessVisitResult;
type Fix=MapPoint&{accuracy:number;timestamp:number};
export default function AccessVisit(){
 const {handle=''}=useParams();
 const [journey,setJourney]=useState(window.location.hash==='#njila');
 return journey?<JourneyVisit onBack={()=>setJourney(false)}/>:<LocationVisit key={handle} onJourney={()=>{prepareJourneyCompass();setJourney(true)}}/>;
}
function JourneyVisit({onBack}:{onBack:()=>void}){
 useUiLocale();
 const {handle=''}=useParams();
 return <main className="mx-auto max-w-3xl space-y-3 p-3"><Button variant="outline" onClick={onBack}>{t('Voltar ao endereço')}</Button><h1 className="text-xl font-semibold">NJILA · AFROLOC</h1><NjilaJourney key={handle} handle={handle}/></main>;
}
function LocationVisit({onJourney}:{onJourney:()=>void}){
 useUiLocale();
 const {handle=''}=useParams();const [tracking,setTracking]=useState(false),[result,setResult]=useState<Result|null>(null),[message,setMessage]=useState('A verificar a autorização…');
 const [retry,setRetry]=useState(0);
 const [openingRoute,setOpeningRoute]=useState(false),[routeError,setRouteError]=useState(false);
 const routeRequest=useRef<AbortController|null>(null);
 useEffect(()=>()=>routeRequest.current?.abort(),[]);

 const openRoute=async()=>{
  if(routeRequest.current||!validHandle(handle)||document.hidden||!navigator.onLine)return;
  const request=new AbortController();
  routeRequest.current=request;
  setOpeningRoute(true);
  setRouteError(false);
  try {
   const route=await locaccess<ExternalRoute>('external_route',{handle});
   if(request.signal.aborted||document.hidden||!navigator.onLine)return;
   const url=googleEntryUrl(route);
   if(url)openGoogleEntry(url);
   else setRouteError(true);
  }catch{
   if(!request.signal.aborted)setRouteError(true);
  }finally{
   if(!request.signal.aborted)setOpeningRoute(false);
   routeRequest.current=null;
  }
 };
 useEffect(()=>{let active=true,connected=navigator.onLine,epoch=0,fix:Fix|null=null,watch:number|undefined,expiry:ReturnType<typeof setTimeout>|undefined;
  setResult(null);setMessage('A verificar a autorização…');
  let pending:symbol|null=null,lastDeadline:{expiresAt:number;deadline:number}|undefined;
  const clear=()=>{epoch++;pending=null;if(expiry!==undefined)clearTimeout(expiry);expiry=undefined;setResult(null)};
  const refresh=async()=>{if(!validHandle(handle)){setMessage('Ligação de acesso inválida.');return}if(!active||pending||document.hidden||!connected||!navigator.onLine)return;
   const request=Symbol();pending=request;const generation=++epoch,startedAt=performance.now(),startedWall=Date.now();
   try{const data=await locaccess<Result>('visit',{handle,...(fix?{position:fix}:{})});if(!active||epoch!==generation||document.hidden||!connected||!navigator.onLine)return;
    if(data?.status==='ready'||data?.status==='proximity'){
     const issued=readVisitLease(data);if(!issued)throw new Error('A autorização expirou. Tenta novamente.');
     const deadline=visitDeadline(issued,startedAt,startedWall,lastDeadline);if(deadline<=performance.now())throw new Error('A autorização expirou. Tenta novamente.');
     lastDeadline={expiresAt:issued.expiresAt,deadline};
     if(expiry!==undefined)clearTimeout(expiry);
     setResult(data);setMessage(data.status==='proximity'?'A morada exacta só aparece a {{distance}} metros. A área indicada é aproximada.':data.owner?'A tua morada. O acesso de terceiros depende das tuas autorizações.':'Acesso autorizado.');
     expiry=setTimeout(()=>{clear();setMessage('A renovar a autorização…')},deadline-performance.now());
    }else{clear();setMessage('Este acesso está fechado, expirou ou não foi autorizado para a tua conta.')}
   }catch(e){if(active&&epoch===generation){clear();setMessage((e as Error).message)}}finally{if(pending===request)pending=null}
  };
  const pause=()=>{clear();fix=null;setMessage('Consulta pausada. Volta a verificar o acesso.')};
  const offline=()=>{connected=false;pause()};
  const online=()=>{connected=navigator.onLine;void refresh()};
  const visibility=()=>{pause();if(!document.hidden)void refresh()};
  if(tracking&&navigator.geolocation)watch=navigator.geolocation.watchPosition(p=>{fix={lat:p.coords.latitude,lon:p.coords.longitude,accuracy:p.coords.accuracy,timestamp:p.timestamp};void refresh()},()=>{pause();setTracking(false);setMessage('Permite a localização no Safari ou Chrome e volta a tentar.')},{enableHighAccuracy:true,maximumAge:0,timeout:15000});
  void refresh();const timer=setInterval(()=>void refresh(),5000);
  window.addEventListener('offline',offline);window.addEventListener('online',online);window.addEventListener('pagehide',pause);document.addEventListener('visibilitychange',visibility);
  return()=>{active=false;epoch++;if(expiry!==undefined)clearTimeout(expiry);if(watch!==undefined)navigator.geolocation.clearWatch(watch);clearInterval(timer);window.removeEventListener('offline',offline);window.removeEventListener('online',online);window.removeEventListener('pagehide',pause);document.removeEventListener('visibilitychange',visibility)};
 },[handle,tracking,retry]);
 return <main className="mx-auto max-w-2xl space-y-4 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
  <header className="sticky top-0 z-50 -mx-4 border-b bg-background px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
   <Button asChild variant="outline" className="min-h-11 h-auto max-w-full whitespace-normal py-2 text-start">
    <Link to="/afroloc">{t("← O meu cartão AFROLOC")}</Link>
   </Button>
  </header>
  <h1 className="text-xl font-semibold">{t("Localização AFROLOC")}</h1><p className="text-sm text-muted-foreground">{t("LOCACCESS · Consulta experimental protegida")}</p><p role="status">{t(message,{distance:result?.radius||0})}</p>
  {(result?.status==='ready'||result?.status==='proximity')&&<Button onClick={onJourney}>{t('Abrir na NJILA')}</Button>}
  {result?.status==='ready'&&result.point?<AccessMap point={result.point}/>:result?.status==='proximity'&&result.area?<AccessMap point={result.area} approximate/>:null}
  {result?.hasExternalRoute===true&&(
   <details className="rounded-lg border p-3">
    <summary className="cursor-pointer font-medium">{t('Formas de lá chegar')}</summary>
    <p className="my-2 text-sm text-muted-foreground">{t('Usa o Google Maps até à entrada pública. Para chegar à morada, continua na NJILA.')}</p>
    <Button type="button" variant="outline" disabled={openingRoute} onClick={()=>void openRoute()}>
     {openingRoute?t('A verificar a autorização…'):'Google Maps'}
    </Button>
   </details>
  )}
  {(result?.status==='ready'||result?.status==='proximity')&&!result.owner&&<MaguelaPickupVisit key={handle} handle={handle}/>}
  {routeError&&<p role="alert">{t('O percurso no Google Maps já não está disponível. Verifica o acesso.')}</p>}
  {result?.status==='proximity'&&<Button disabled={tracking} onClick={()=>{if(navigator.geolocation)setTracking(true);else setMessage('Este dispositivo não disponibiliza a localização.')}}>{t(tracking?'A verificar proximidade…':'Activar localização e verificar proximidade')}</Button>}
  <Button variant="outline" onClick={()=>setRetry(n=>n+1)}>{t("Verificar novamente")}</Button>
 </main>;
}
