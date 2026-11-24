import {useRef,useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {uiText as t} from '@/i18n/ui-copy';
import {Button} from '@/components/ui/button';
import {validHandle} from './api';

function receivedAccessPath(value:string){
 try{
  const link=new URL(value.trim());
  if(!['https://www.yamilook.com','https://yamilook.com'].includes(link.origin)
    ||link.username||link.password)return null;
  const path='/afroloc/acesso/';
  const handle=link.pathname.startsWith(path)?link.pathname.slice(path.length):'';
  // Open the protected map first. The signed-in visit checks the grant.
  return validHandle(handle)?path+handle:null;
 }catch{
  return null;
 }
}

export function ReceivedAccessQr(){
 const navigate=useNavigate();
 const camera=useRef<HTMLInputElement>(null);
 const gallery=useRef<HTMLInputElement>(null);
 const [busy,setBusy]=useState(false);
 const [failed,setFailed]=useState(false);

 async function read(file:File|undefined){
  if(!file)return;
  setBusy(true);
  setFailed(false);
  const source=URL.createObjectURL(file);
  try{
   const picture=new Image();
   picture.src=source;
   await picture.decode();
   const scale=Math.min(1,2400/Math.max(picture.naturalWidth,picture.naturalHeight));
   const canvas=document.createElement('canvas');
   canvas.width=Math.max(1,Math.round(picture.naturalWidth*scale));
   canvas.height=Math.max(1,Math.round(picture.naturalHeight*scale));
   const context=canvas.getContext('2d');
   if(!context)throw new Error('Canvas unavailable');
   context.drawImage(picture,0,0,canvas.width,canvas.height);
   const pixels=context.getImageData(0,0,canvas.width,canvas.height);
   const {default:decode}=await import('jsqr');
   const result=decode(pixels.data,pixels.width,pixels.height);
   const path=result&&receivedAccessPath(result.data);
   if(path)navigate(path);
   else setFailed(true);
  }catch{
   setFailed(true);
  }finally{
   URL.revokeObjectURL(source);
   setBusy(false);
  }
 }

 return <div className="space-y-2" aria-busy={busy}>
  <div className="flex flex-wrap gap-2">
   <Button type="button" variant="outline" disabled={busy} onClick={()=>camera.current?.click()}>{t('Ler QR de um endereço partilhado')}</Button>
   <Button type="button" variant="ghost" disabled={busy} onClick={()=>gallery.current?.click()}>{t('Escolher imagem QR')}</Button>
  </div>
  <input ref={camera} hidden type="file" accept="image/*" capture="environment" onChange={event=>{void read(event.currentTarget.files?.[0]);event.currentTarget.value='';}}/>
  <input ref={gallery} hidden type="file" accept="image/*" onChange={event=>{void read(event.currentTarget.files?.[0]);event.currentTarget.value='';}}/>
  {failed&&<p role="alert" className="text-sm">{t('Usa o QR protegido de um cartão AFROLOC partilhado contigo.')}</p>}
 </div>;
}
