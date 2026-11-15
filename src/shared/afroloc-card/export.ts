/** Rasterise the same SVG preview the owner reviewed. No external renderer/upload. */
export async function cardImage(svg:SVGSVGElement):Promise<Blob>{
 const width=svg.viewBox.baseVal.width*2,height=svg.viewBox.baseVal.height*2;
 const copy=svg.cloneNode(true) as SVGSVGElement;copy.removeAttribute('style');copy.setAttribute('width',String(width));copy.setAttribute('height',String(height));
 const source=new XMLSerializer().serializeToString(copy);
 const url=URL.createObjectURL(new Blob([source],{type:'image/svg+xml;charset=utf-8'}));
 try{
  const image=new Image();await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(new Error('image'));image.src=url});
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('canvas');ctx.drawImage(image,0,0,canvas.width,canvas.height);
  return await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('image')),'image/png'));
 }finally{URL.revokeObjectURL(url)}
}
export function downloadCard(blob:Blob){const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download='AFROLOC-cartao.png';link.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}
export async function shareCard(blob:Blob,text:string):Promise<'shared'|'downloaded'|'cancelled'>{
 const file=new File([blob],'AFROLOC-cartao.png',{type:'image/png'});
 try{
  if(navigator.share&&navigator.canShare?.({files:[file]})){await navigator.share({title:'AFROLOC',files:[file],text});return 'shared';}
  if(navigator.share){await navigator.share({title:'AFROLOC',text});return 'shared';}
  downloadCard(blob);return 'downloaded';
 }catch(error){if((error as Error).name==='AbortError')return 'cancelled';throw error;}
}
