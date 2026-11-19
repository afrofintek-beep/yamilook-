import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { createChatConversation } from '@/lib/chat-conversations';
import { uploadPrivateChatFile } from '@/lib/private-chat-media';
import { Button } from '@/components/ui/button';
import type { Grant } from './api';

const suggestions = {
  Visita: 'Obrigado pela visita. Volta sempre!',
  Entrega: 'A partilha do endereço para esta entrega terminou. Obrigado.',
  Festa: 'Foi bom celebrar contigo! Fica aqui uma recordação deste dia.',
  Outra: 'A partilha do meu endereço terminou.',
};
type Recipient = {batch:string; id:string; username:string; message:string; date:string};
type Props = {source:{id:string;code:string}; grants:Grant[]; reload:()=>void; disabled:boolean};

async function cardPhoto(file?:File):Promise<Blob> {
  const canvas=document.createElement('canvas');
  const ctx=canvas.getContext('2d');
  if(!ctx) throw new Error('Não foi possível preparar a imagem.');
  if(file){
    const photo=await createImageBitmap(file);
    const scale=Math.min(1,1400/Math.max(photo.width,photo.height));
    canvas.width=Math.max(1,Math.round(photo.width*scale)); canvas.height=Math.max(1,Math.round(photo.height*scale));
    ctx.drawImage(photo,0,0,canvas.width,canvas.height); photo.close();
  }else{
    canvas.width=960;canvas.height=600;
    ctx.fillStyle='#154b42';ctx.fillRect(0,0,960,600);
    ctx.strokeStyle='#e8c783';ctx.lineWidth=3;ctx.strokeRect(30,30,900,540);
    ctx.textAlign='center';ctx.fillStyle='#f9edcf';ctx.font='italic 76px Georgia';
    ctx.fillText('Com carinho',480,295);ctx.font='30px Georgia';ctx.fillText('Uma recordação para ti',480,365);
  }
  return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Imagem indisponível.')),'image/jpeg',0.85));
}
export function Farewell({source,grants,reload,disabled}:Props){
  const [pending,setPending]=useState<Recipient[]>([]),[open,setOpen]=useState(false),[batch,setBatch]=useState('');
  const [selected,setSelected]=useState<string[]>([]),[occasion,setOccasion]=useState<keyof typeof suggestions>('Visita');
  const [note,setNote]=useState<string>(suggestions.Visita),[media,setMedia]=useState<Blob|null>(null),[url,setUrl]=useState('');
  const [preview,setPreview]=useState(false),[busy,setBusy]=useState(false),[status,setStatus]=useState('');
  async function request(action:string,extra={}){
    const {data,error}=await supabase.rpc('locaccess_farewell' as never,{p_action:action,p_data:{...source,...extra}} as never);
    if(error)throw new Error(error.message);
    return data as unknown as {batch:string;pending:Recipient[]};
  }
  useEffect(()=>{let live=true;request('list').then(r=>{if(live)setPending(r.pending)}).catch(()=>{if(live)setStatus('Não foi possível consultar as recordações pendentes.')});return()=>{live=false}},[source.id,source.code]);
  useEffect(()=>{if(!media){setUrl('');return}const next=URL.createObjectURL(media);setUrl(next);return()=>URL.revokeObjectURL(next)},[media]);
  function start(which=''){
    setBatch(which);setSelected(grants.map(g=>g.id));setMedia(null);setPreview(false);setStatus('');setOpen(true);
    setOccasion('Visita');setNote(suggestions.Visita);
  }
  async function attach(file?:File){
    setBusy(true);try{setMedia(await cardPhoto(file));setStatus('')}catch{setStatus('Não foi possível abrir a imagem. Escolhe outra fotografia.')}finally{setBusy(false)}
  }
  const guests=batch?pending.filter(p=>p.batch===batch):grants.filter(g=>selected.includes(g.id));
  async function finish(later:boolean){
    setBusy(true);setStatus('');let closed=Boolean(batch);
    try{
      let rows=pending.filter(p=>p.batch===batch);
      if(!batch){
        const result=await request('close',{grants:grants.map(g=>g.id),selected});
        closed=true;setBatch(result.batch);setPending(result.pending);reload();
        rows=result.pending.filter(p=>p.batch===result.batch);
      }
      if(!later){
        const {data:{user}}=await supabase.auth.getUser();
        if(!user)throw new Error('Volta a entrar na Yamilook.');
        for(const person of rows){
          const {data:chat,error}=await createChatConversation([person.id]);
          if(error||!chat)throw error||new Error('Conversa indisponível.');
          const reference=media?await uploadPrivateChatFile(chat.id,media,'recordacao.jpg','image/jpeg'):null;
          const sent=await supabase.from('messages').insert({id:person.message,sender_id:user.id,conversation_id:chat.id,message_type:reference?'image':'text',content:note.trim(),media_url:reference});
          if(sent.error && sent.error.code!=='23505')throw sent.error;
          setPending(previous=>previous.filter(p=>p.message!==person.message));
        }
      }
      setOpen(false);setStatus(later?'Partilha encerrada. Podes voltar aqui para preparar a recordação.':'Partilha encerrada. Mensagem enviada.');
    }catch(e){setStatus(closed?'Partilha encerrada. Retoma o envio aos destinatários pendentes.':e instanceof Error?e.message:'Não foi possível encerrar a partilha.');reload()}
    finally{setBusy(false)}
  }
  return <div className="grid gap-3">
    {!open&&grants.length>0&&<Button variant="outline" disabled={disabled} onClick={()=>start()}>Encerrar partilha</Button>}
    {!open&&[...new Set(pending.map(p=>p.batch))].map(id=><Button key={id} variant="outline" onClick={()=>start(id)}>Enviar recordação · {new Date(pending.find(p=>p.batch===id)!.date).toLocaleDateString('pt-AO')} · {pending.filter(p=>p.batch===id).length} destinatário(s)</Button>)}
    {open&&<fieldset disabled={busy||disabled} className="grid gap-3 rounded-xl border p-4">
      <legend>{preview?'Pré-visualização':batch?'Preparar recordação':'Encerrar partilha'}</legend>
      {!preview&&<>
        <label>Ocasião <select value={occasion} onChange={e=>{const key=e.target.value as keyof typeof suggestions;setOccasion(key);setNote(suggestions[key])}}>{Object.keys(suggestions).map(s=><option key={s}>{s}</option>)}</select></label>
        <label className="grid">Mensagem<textarea className="rounded border p-2" maxLength={2000} value={note} onChange={e=>setNote(e.target.value)}/></label>
        <details><summary>Juntar cartão ou fotografia</summary><div className="grid gap-2 py-2">
          <Button variant="outline" onClick={()=>void attach()}>Usar cartão de agradecimento</Button>
          <label>Escolher fotografia <input type="file" accept="image/*" onChange={e=>{const file=e.target.files?.[0];if(file)void attach(file)}}/></label>
          {media&&<button onClick={()=>setMedia(null)}>Retirar imagem</button>}
        </div></details>
        {!batch&&<fieldset><legend>Quem recebe a mensagem?</legend>{grants.map(g=><label className="block" key={g.id}><input type="checkbox" checked={selected.includes(g.id)} onChange={e=>setSelected(e.target.checked?[...selected,g.id]:selected.filter(id=>id!==g.id))}/> @{g.username}</label>)}</fieldset>}
      </>}
      {url&&<img className="max-h-56 rounded object-contain" src={url} alt="Recordação escolhida"/>}
      {preview&&<><p className="whitespace-pre-wrap">{note}</p><p>Para {guests.map(g=>'@'+g.username).join(', ')}</p></>}
      {!batch&&<p className="text-sm">O acesso à localização termina para todas as pessoas desta partilha.</p>}
      {preview?<><Button onClick={()=>void finish(false)}>{batch?'Enviar recordação':'Encerrar partilha e enviar'}</Button><Button variant="outline" onClick={()=>setPreview(false)}>Editar</Button></>:<Button disabled={!guests.length||!note.trim()} onClick={()=>setPreview(true)}>Pré-visualizar</Button>}
      {!batch&&<Button variant="outline" disabled={!selected.length} onClick={()=>void finish(true)}>Encerrar agora e enviar mais tarde</Button>}
      <button onClick={()=>setOpen(false)}>Cancelar</button>
    </fieldset>}
    {status&&<p role="status">{status}</p>}
  </div>;
}
