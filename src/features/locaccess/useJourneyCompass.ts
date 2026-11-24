import {useCallback,useEffect,useRef,useState} from 'react';
export type CompassReading={heading:number;pitch:number|null};
type Sensor=typeof DeviceOrientationEvent & {requestPermission?:(absolute?:boolean)=>Promise<string>};
let openingPermission: Promise<boolean> | undefined;
export function prepareJourneyCompass(){
 const sensor=globalThis.DeviceOrientationEvent as Sensor|undefined;
 try {
  openingPermission=sensor?.requestPermission
   ? sensor.requestPermission(true).then(result=>result==='granted',()=>false)
   : Promise.resolve(Boolean(sensor));
 } catch { openingPermission=Promise.resolve(false); }
}
export function journeyCompassPermission(){
 return openingPermission ?? Promise.resolve(Boolean(globalThis.DeviceOrientationEvent));
}
/** Request in the top-level tap: Safari can refuse orientation inside a cross-origin frame. */
export function useJourneyCompass(onReading:(reading:CompassReading)=>void){
 const [active,setActive]=useState(false);
 const report=useRef(onReading);report.current=onReading;
 const cleanup=useRef<()=>void>(()=>{}),generation=useRef(0);
 const stop=useCallback(()=>{generation.current++;cleanup.current();cleanup.current=()=>{};setActive(false)},[]);
 useEffect(()=>{const pause=()=>{if(document.hidden)stop()};document.addEventListener('visibilitychange',pause);window.addEventListener('pagehide',stop);return()=>{stop();document.removeEventListener('visibilitychange',pause);window.removeEventListener('pagehide',stop)}},[stop]);
 const request=useCallback(async(permission:Promise<boolean>)=>{
  stop();const version=generation.current;const sensor=globalThis.DeviceOrientationEvent as Sensor|undefined;
  if(!sensor)return;
  try{
   if(!await permission)return;
   if(version!==generation.current||document.hidden)return;
   let expiry:ReturnType<typeof setTimeout>|undefined;
   const receive=(event:Event)=>{
    const e=event as DeviceOrientationEvent & {webkitCompassHeading?:number;webkitCompassAccuracy?:number};
    if(document.hidden||e.webkitCompassAccuracy!=null&&e.webkitCompassAccuracy<0)return;
    const h=Number.isFinite(e.webkitCompassHeading)?e.webkitCompassHeading!:e.absolute&&Number.isFinite(e.alpha)?360-e.alpha!:null;
    if(h===null)return;
    setActive(true);report.current({heading:((h%360)+360)%360,pitch:Number.isFinite(e.beta)?e.beta:null});
    clearTimeout(expiry);expiry=setTimeout(()=>setActive(false),3000);
   };
   window.addEventListener('deviceorientation',receive);window.addEventListener('deviceorientationabsolute',receive);
   cleanup.current=()=>{clearTimeout(expiry);window.removeEventListener('deviceorientation',receive);window.removeEventListener('deviceorientationabsolute',receive)};
  }catch{setActive(false)}
 },[stop]);
 return {active,request,stop};
}
