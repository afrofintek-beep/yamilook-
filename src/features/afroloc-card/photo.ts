/** Keep the selected profile photo inside the exported image; never embed a remote URL. */
export async function cardPhoto(url:string,signal:AbortSignal):Promise<string>{
 const response=await fetch(url,{signal,credentials:'omit',referrerPolicy:'no-referrer'});if(!response.ok)throw new Error('photo');const blob=await response.blob();
 if(!['image/png','image/jpeg','image/webp'].includes(blob.type)||blob.size>10*1024*1024)throw new Error('photo');
 const object=URL.createObjectURL(blob);
 try{
  const image=new Image();await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(new Error('photo'));image.src=object});
  if(signal.aborted)throw new Error('aborted');
  const size=Math.min(image.naturalWidth,image.naturalHeight);if(!size)throw new Error('photo');
  const canvas=document.createElement('canvas');canvas.width=canvas.height=360;const ctx=canvas.getContext('2d');if(!ctx)throw new Error('photo');
  ctx.drawImage(image,(image.naturalWidth-size)/2,(image.naturalHeight-size)/2,size,size,0,0,360,360);return canvas.toDataURL('image/png');
 }finally{URL.revokeObjectURL(object)}
}
