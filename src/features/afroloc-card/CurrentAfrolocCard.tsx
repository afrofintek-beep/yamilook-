import {useEffect,useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import {useAuth} from '@/hooks/useAuth';
import {supabase} from '@/integrations/supabase/client';
import {uiText as t,useUiLocale} from '@/i18n/ui-copy';
import type {AdministrativeAddress} from '@/lib/angola-administrative';
import {Button} from '@/components/ui/button';
import {cardPhoto} from './photo';
import {CardPreview} from './CardPreview';
import {cardAddresses,cardText,divisionName,type CardProfile,type SavedAddress,type CardLine} from './model';
import {cardImage,downloadCard,shareCard} from './export';

const PROFILE_FIELDS='id,display_name,username,avatar_url,phone_number,email,country_code,city,neighborhood,afroloc_code,afroloc_certification_status';
export default function CurrentAfrolocCard(){const {user}=useAuth();return user?<CardScreen key={user.id} userId={user.id}/>:null;}
function CardScreen({userId}:{userId:string}){
 const locale=useUiLocale(),svg=useRef<SVGSVGElement>(null);
 const [snapshot,setSnapshot]=useState<{profile:CardProfile;admin:AdministrativeAddress|null;saved:SavedAddress[];at:number}|null>(null);
 const [revision,setRevision]=useState(0),[busy,setBusy]=useState(true),[fresh,setFresh]=useState(false),[warning,setWarning]=useState(''),[feedback,setFeedback]=useState('');
 const [selected,setSelected]=useState(''),[include,setInclude]=useState({name:true,photo:true,phone:false,email:false});
 const [photo,setPhoto]=useState<{url:string;data:string}|null>(null),[photoFailed,setPhotoFailed]=useState('');
 const [image,setImage]=useState<{key:string;blob:Blob}|null>(null),[imageError,setImageError]=useState(false),[sharing,setSharing]=useState(false);
 useEffect(()=>{
  let active=true,pending=false;
  const load=async()=>{
   if(pending||document.hidden)return;pending=true;setBusy(true);setFresh(false);setWarning('');
   try{
    const {data:profile,error}=await supabase.from('profiles').select(PROFILE_FIELDS).eq('id',userId).single();
    if(error||!profile||profile.id!==userId)throw new Error('profile');
    const [admin,saved]=await Promise.allSettled([
     supabase.rpc('my_residence_administrative' as never),
     profile.country_code?.toUpperCase()==='AO'?supabase.functions.invoke('afroloc-experience',{body:{action:'list',data:{}}}):Promise.resolve({data:{addresses:[]},error:null}),
    ]);
    if(!active)return;
    const adminOK=admin.status==='fulfilled'&&!admin.value.error,savedOK=saved.status==='fulfilled'&&!saved.value.error&&!saved.value.data?.error;
    setSnapshot({profile:profile as CardProfile,admin:adminOK?admin.value.data as AdministrativeAddress:null,saved:savedOK&&Array.isArray(saved.value.data?.addresses)?saved.value.data.addresses:[],at:Date.now()});
    setWarning(!adminOK||!savedOK?'Alguns dados não puderam ser carregados. Actualiza antes de partilhar.':'');setFresh(adminOK&&savedOK);
   }catch{if(active){setFresh(false);setWarning('Não foi possível actualizar o cartão. Verifica a ligação e tenta novamente.');}}
   finally{pending=false;if(active)setBusy(false);}
  };
  void load();const resume=()=>{if(!document.hidden)void load();};const offline=()=>setFresh(false);
  window.addEventListener('focus',resume);window.addEventListener('online',resume);window.addEventListener('offline',offline);document.addEventListener('visibilitychange',resume);
  const timer=setInterval(resume,60000);
  return()=>{active=false;clearInterval(timer);window.removeEventListener('focus',resume);window.removeEventListener('online',resume);window.removeEventListener('offline',offline);document.removeEventListener('visibilitychange',resume);};
 },[userId,revision]);
 const profile=snapshot?.profile,avatar=include.photo?profile?.avatar_url:null;
 useEffect(()=>{
  setPhoto(null);setPhotoFailed('');if(!avatar)return;let active=true;const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),15000);
  void (async()=>{try{
   const data=await cardPhoto(avatar,controller.signal);
   if(active)setPhoto({url:avatar,data});
  }catch{if(active)setPhotoFailed(avatar);}})();return()=>{active=false;clearTimeout(timeout);controller.abort();};
 },[avatar]);
 const addresses=snapshot?cardAddresses(snapshot.profile,snapshot.admin,snapshot.saved):[];
 const address=addresses.find(a=>a.id===selected)||addresses[0];
 const lines:CardLine[]=[];const add=(label:string,value?:string|null)=>{if(value)lines.push({label:t(label),value})};
 if(address&&profile){
  add('Endereço',address.temporary?address.label:t('Residência associada'));
  if(include.name&&profile.username)add('Yamilook','@'+profile.username);
  let country=address.country;try{country=new Intl.DisplayNames([locale==='pt-banda'?'pt':locale],{type:'region'}).of(address.country)||country}catch{/* Keep known country code. */}
  add('País',country);add('Província',divisionName(address.administrative?.province));add('Município',divisionName(address.administrative?.municipality));add('Comuna',divisionName(address.administrative?.commune));add('Cidade',address.city);add('Bairro / zona',address.neighborhood);add('Complemento',address.administrative?.complement);
  add('Estado',t(address.status==='certified'||address.status==='approved'?'Revisto pela Yamilook':address.status==='rejected'?'Não aprovado':'Validação pendente'));
  add('Validade',address.expiresAt?new Date(address.expiresAt).toLocaleString(locale==='pt-banda'?'pt':locale,{timeZone:'Africa/Luanda'}):t('Validade não confirmada'));
  if(include.phone)add('Telefone',profile.phone_number);if(include.email)add('Email',profile.email);
  add('Emitido em',new Date(snapshot!.at).toLocaleString(locale==='pt-banda'?'pt':locale,{timeZone:'Africa/Luanda'})+' · Africa/Luanda');
 }
 const name=include.name?(profile?.display_name||profile?.username||''):'';
 const notice=t('Cópia dos dados à data de emissão. Não substitui um certificado de residência.');
 const photoData=avatar&&photo?.url===avatar?photo.data:undefined;
 const key=JSON.stringify([snapshot?.at,address?.id,address?.code,name,lines,photoData,notice,locale]);
 const hasAddress=!!address;
 const photoReady=!avatar||photo?.url===avatar||photoFailed===avatar;
 useEffect(()=>{let active=true;setImageError(false);if(!hasAddress||!svg.current||!photoReady)return;void cardImage(svg.current).then(blob=>{if(active)setImage({key,blob})}).catch(()=>{if(active)setImageError(true)});return()=>{active=false};},[key,photoReady,hasAddress]);
 const unexpired=()=>!address?.expiresAt||Date.parse(address.expiresAt)>Date.now();
 const ready=!!address&&unexpired()&&fresh&&!busy&&photoReady&&image?.key===key&&!sharing;
 const text=address?cardText(name,address.code,lines,notice):'';
 const share=async()=>{if(!ready||!image||!unexpired())return;setSharing(true);setFeedback('');try{const result=await shareCard(image.blob,text);if(result!=='cancelled')setFeedback(result==='downloaded'?'Imagem guardada. Podes anexá-la à tua mensagem.':'Cartão partilhado.');}catch{setFeedback('Não foi possível partilhar. Usa Guardar imagem ou Copiar dados.');}finally{setSharing(false)}};
 return <main className="mx-auto max-w-xl p-4 pb-28 space-y-4" dir={locale==='ar'?'rtl':'ltr'}>
  <nav className="sticky top-0 z-10 bg-background py-3 flex flex-wrap gap-3"><Link to="/profile">← {t('Voltar ao perfil')}</Link><Link to="/afroloc">{t('O meu endereço AFROLOC')}</Link></nav>
  <h1 className="text-2xl font-bold">{t('O meu cartão AFROLOC')}</h1>
  <Button variant="outline" disabled={busy} onClick={()=>setRevision(v=>v+1)}>{t('Actualizar cartão')}</Button>
  {busy&&<p role="status">{t('A actualizar o cartão…')}</p>}
  {warning&&<p role="alert">{t(warning)}</p>}
  {!fresh&&!busy&&snapshot&&!warning&&<p role="alert">{t('Não foi possível actualizar o cartão. Verifica a ligação e tenta novamente.')}</p>}
  {addresses.length>1&&<label className="block space-y-2">{t('Endereço')}<select className="w-full rounded-lg border bg-background p-3" value={address?.id} onChange={e=>setSelected(e.target.value)}>{addresses.map(a=><option key={a.id} value={a.id}>{a.temporary?a.label:t('Residência associada')} · {a.code}</option>)}</select></label>}
  {address&&profile?<>
   <fieldset className="rounded-xl border p-4 space-y-3"><legend className="px-2">{t('Dados a incluir na partilha')}</legend>
    {([['name','Nome',!!(profile.display_name||profile.username)],['photo','Fotografia',!!profile.avatar_url],['phone','Telefone',!!profile.phone_number],['email','Email',!!profile.email]] as const).filter(([, ,available])=>available).map(([field,label])=><label className="flex items-center gap-3" key={field}><input type="checkbox" checked={include[field]} onChange={e=>setInclude(v=>({...v,[field]:e.target.checked}))}/>{t(label)}</label>)}
   </fieldset>
   {photoFailed===avatar&&avatar&&<p role="status">{t('Fotografia indisponível. O cartão pode ser partilhado sem fotografia.')}</p>}
   <CardPreview ref={svg} name={name} code={address.code} lines={lines} photo={photoData} notice={notice} rtl={locale==='ar'}/>
   <p className="text-xs text-muted-foreground">{t('O QR contém apenas o endereço AFROLOC. Os contactos seleccionados aparecem no cartão.')}</p>
   {imageError&&<p role="alert">{t('Não foi possível preparar a imagem. Podes copiar os dados.')}</p>}
   <div className="flex flex-wrap gap-2">
    <Button disabled={!ready} onClick={()=>void share()}>{t('Partilhar cartão')}</Button>
    <Button variant="outline" disabled={!ready} onClick={()=>{if(image&&unexpired())downloadCard(image.blob)}}>{t('Guardar imagem')}</Button>
    <Button variant="outline" disabled={!fresh||busy||sharing} onClick={()=>{if(!unexpired())return;void (navigator.clipboard?.writeText(text)??Promise.reject(new Error('clipboard'))).then(()=>setFeedback('Dados copiados.')).catch(()=>setFeedback('Não foi possível partilhar. Usa Guardar imagem ou Copiar dados.'));}}>{t('Copiar dados')}</Button>
   </div>
  </>:!busy&&!warning?<p>{t('Ainda não tens um endereço AFROLOC associado ou activo.')} <Link className="underline" to="/profile">{t('Carregar cartão ou endereço AFROLOC')}</Link> · <Link className="underline" to="/afroloc">{t('Experimentar AFROLOC')}</Link></p>:null}
  {feedback&&<p role="status">{t(feedback)}</p>}
 </main>;
}
