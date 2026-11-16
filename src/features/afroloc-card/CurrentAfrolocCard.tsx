import {useEffect,useRef,useState} from 'react';
import {Link,useLocation} from 'react-router-dom';
import {useAuth} from '@/hooks/useAuth';
import {supabase} from '@/integrations/supabase/client';
import {uiText as t,useUiLocale} from '@/i18n/ui-copy';
import type {AdministrativeAddress} from '@/lib/angola-administrative';
import {ArrowLeft,MoreHorizontal,Share2,MapPin,Download,Printer,RefreshCw,Copy} from 'lucide-react';
import {DropdownMenu,DropdownMenuTrigger,DropdownMenuContent,DropdownMenuItem} from '@/components/ui/dropdown-menu';
import {Button} from '@/components/ui/button';
import {cardPhoto} from './photo';
import {CardPreview} from './CardPreview';
import {cardAddresses,selectCardAddress,cardQrValue,cardText,divisionName,type CardProfile,type SavedAddress,type CardLine} from './model';
import {cardImage,downloadCard,shareCard} from './export';

const PROFILE_FIELDS='id,display_name,username,avatar_url,phone_number,email,country_code,city,neighborhood,afroloc_code,afroloc_certification_status';
export default function CurrentAfrolocCard(){
 const {user}=useAuth(),location=useLocation();
 const value=location.state?.afrolocAddressId;
 const requested=typeof value==='string'&&/^[a-zA-Z0-9-]{1,64}$/.test(value)?value:undefined;
 return user?<CardScreen key={user.id+':'+location.key} userId={user.id} requested={requested}/>:null;
}
function CardScreen({userId,requested}:{userId:string;requested?:string}){
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
 const address=selectCardAddress(addresses,selected,requested);
 const lines:CardLine[]=[];const add=(label:string,value?:string|null,group:CardLine['group']='location')=>{if(value)lines.push({label:t(label),value,group})};
 if(address&&profile){
  add('Tipo de endereço',t(address.temporary?'Endereço temporário':'Residência principal'),'identity');
  if(address.temporary)add('Endereço',address.label,'identity');
  if(include.name&&profile.username)add('Yamilook','@'+profile.username,'identity');
  let country=address.country;try{country=new Intl.DisplayNames([locale==='pt-banda'?'pt':locale],{type:'region'}).of(address.country)||country}catch{/* Keep known country code. */}
  add('País',country);add('Província',divisionName(address.administrative?.province)||(address.country==='AO'?t('Por confirmar'):''));add('Município',divisionName(address.administrative?.municipality)||(address.country==='AO'?t('Por confirmar'):''));add('Comuna',divisionName(address.administrative?.commune)||(!address.administrative&&address.country==='AO'?t('Por confirmar'):''));add('Cidade',address.city);add('Bairro / zona',address.neighborhood);add('Complemento',address.administrative?.complement);
  add('Rua',t('Não indicado'));add('Número',t('Não indicado'));add('Fração / unidade',t('Não indicado'));
  add('Revisão local',t(address.status==='certified'||address.status==='approved'?'Revisto pela Yamilook':address.status==='rejected'?'Não aprovado':'Validação pendente'),'status');
  add('Entidade de validação',t('Revisão local da Yamilook'),'status');
  add('Emissão do endereço',t('Por confirmar'),'footer');
  add('Validade',address.expiresAt?new Date(address.expiresAt).toLocaleString(locale==='pt-banda'?'pt':locale,{timeZone:'Africa/Luanda',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}):t('Por confirmar'),'footer');
  if(include.phone)add('Telefone',profile.phone_number,'identity');if(include.email)add('Email',profile.email,'identity');
  add('Cartão gerado em',new Date(snapshot!.at).toLocaleDateString(locale==='pt-banda'?'pt':locale,{timeZone:'Africa/Luanda'}),'footer');
 }
 const compactLines=lines.filter(line=>![t('Por confirmar'),t('Não indicado')].includes(line.value)&&
  (line.group==='location'&&line.label!==t('Cidade')||
   line.group==='identity'&&![t('Tipo de endereço'),t('Yamilook')].includes(line.label)||
   line.label===t('Revisão local')||line.label===t('Validade')));
 const name=include.name?(profile?.display_name||profile?.username||''):'';
 const notice=t('Dados à data de geração. Não substitui um certificado de residência.');
 const photoData=avatar&&photo?.url===avatar?photo.data:undefined;
 const key=JSON.stringify([snapshot?.at,address?.id,address?.code,name,compactLines,photoData,notice,locale]);
 const hasAddress=!!address;
 const photoReady=!avatar||photo?.url===avatar||photoFailed===avatar;
 useEffect(()=>{let active=true;setImageError(false);if(!hasAddress||!svg.current||!photoReady)return;void cardImage(svg.current).then(blob=>{if(active)setImage({key,blob})}).catch(()=>{if(active)setImageError(true)});return()=>{active=false};},[key,photoReady,hasAddress]);
 const unexpired=()=>!address?.expiresAt||Date.parse(address.expiresAt)>Date.now();
 const ready=!!address&&unexpired()&&fresh&&!busy&&photoReady&&image?.key===key&&!sharing;
 const text=address?cardText(name,address.code,lines,notice)+'\n'+cardQrValue(address):'';
 const share=async()=>{if(!ready||!image||!unexpired())return;setSharing(true);setFeedback('');try{const result=await shareCard(image.blob,text);if(result!=='cancelled')setFeedback(result==='downloaded'?'Imagem guardada. Podes anexá-la à tua mensagem.':'Cartão partilhado.');}catch{setFeedback('Não foi possível partilhar. Usa Guardar imagem ou Copiar dados.');}finally{setSharing(false)}};
 const print=()=>{if(!ready||!image)return;const w=window.open('','_blank');if(!w){setFeedback('Permita abrir a janela de impressão.');return;}const img=w.document.createElement('img'),u=URL.createObjectURL(image.blob);img.style.cssText='width:100%;max-width:180mm;display:block;margin:auto';img.onload=()=>{w.focus();w.print();URL.revokeObjectURL(u)};img.src=u;w.document.title='Cartão AFROLOC';w.document.body.replaceChildren(img);};
 const copy=()=>{if(!fresh||busy||sharing||!unexpired())return;void (navigator.clipboard?.writeText(text)??Promise.reject(new Error('clipboard'))).then(()=>setFeedback('Dados copiados.')).catch(()=>setFeedback('Não foi possível partilhar. Usa Guardar imagem ou Copiar dados.'));};
 const mapAddress=snapshot?.saved.find(a=>a.code===address?.code&&a.status!=='closed'&&Date.parse(a.expires_at)>Date.now());
 const type=address?.temporary?t('Endereço temporário'):t('Residência principal');
 return <main className="mx-auto w-full max-w-xl px-4 pb-12 space-y-4" dir={locale==='ar'?'rtl':'ltr'}>
  <header className="sticky top-0 z-10 -mx-4 flex items-center gap-3 border-b bg-background px-4 py-3">
   <Link to="/settings" aria-label={t('Voltar à Yamilook')} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border"><ArrowLeft className="h-5 w-5"/></Link>
   <h1 className="min-w-0 flex-1 text-base font-semibold">{t('O meu cartão AFROLOC')}</h1>
   <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-11 w-11 shrink-0" aria-label={t('Opções do cartão')}><MoreHorizontal className="h-5 w-5"/></Button></DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="min-w-52">
     <DropdownMenuItem disabled={!ready} onSelect={()=>{if(image&&unexpired())downloadCard(image.blob)}}><Download className="mr-2 h-4 w-4"/>{t('Guardar imagem')}</DropdownMenuItem>
     <DropdownMenuItem disabled={!ready} onSelect={print}><Printer className="mr-2 h-4 w-4"/>{t('Imprimir cartão')}</DropdownMenuItem>
     <DropdownMenuItem disabled={!fresh||busy||sharing||!address} onSelect={copy}><Copy className="mr-2 h-4 w-4"/>{t('Copiar dados')}</DropdownMenuItem>
     <DropdownMenuItem disabled={busy} onSelect={()=>setRevision(v=>v+1)}><RefreshCw className="mr-2 h-4 w-4"/>{t('Actualizar cartão')}</DropdownMenuItem>
    </DropdownMenuContent>
   </DropdownMenu>
  </header>
  {busy&&<p role="status" className="text-sm text-muted-foreground">{t('A actualizar o cartão…')}</p>}
  {warning&&<p role="alert" className="text-sm">{t(warning)}</p>}
  {!fresh&&!busy&&snapshot&&!warning&&<p role="alert" className="text-sm">{t('Não foi possível actualizar o cartão. Verifica a ligação e tenta novamente.')}</p>}
  {(addresses.length>1||(!address&&addresses.length>0))?<label className="block space-y-1 text-sm"><span className="text-muted-foreground">{t('Endereço')}</span><select className="w-full min-w-0 rounded-lg border bg-background p-3 text-sm" value={address?.id||''} onChange={e=>setSelected(e.target.value)}>{!address&&<option value="" disabled>{t('Endereço')}</option>}{addresses.map(a=><option key={a.id} value={a.id}>{a.temporary?a.label:t('Residência principal')} · {a.code}</option>)}</select></label>:address?<p className="text-sm font-medium">{type}</p>:null}
  {address&&profile?<>
   <section aria-label={t('Cartão AFROLOC')} className="overflow-hidden rounded-2xl border shadow-sm">
    <CardPreview ref={svg} name={name} code={address.code} lines={compactLines} photo={photoData} notice={notice} rtl={locale==='ar'} title={type} qrLabel={t('Abrir localização')} />
   </section>
   <div className="grid grid-cols-2 gap-3">
    <Button className="h-12 gap-2" aria-label={t('Partilhar cartão')} disabled={!ready} onClick={()=>void share()}><Share2 className="h-4 w-4"/>{t('Partilhar')}</Button>
    <Button variant="outline" className="h-12 gap-2" asChild>{mapAddress?<Link to="/afroloc/enderecos" state={{afrolocMapAddressId:mapAddress.id}}><MapPin className="h-4 w-4"/>{t('Ver no mapa')}</Link>:<a href={cardQrValue(address)} target="_blank" rel="noopener noreferrer"><MapPin className="h-4 w-4"/>{t('Ver no mapa')}</a>}</Button>
   </div>
   {feedback&&<p role="status" className="text-sm">{t(feedback)}</p>}
   {imageError&&<p role="alert" className="text-sm">{t('Não foi possível preparar a imagem. Podes copiar os dados.')}</p>}
   {photoFailed===avatar&&avatar&&<p role="status" className="text-sm">{t('Fotografia indisponível. O cartão pode ser partilhado sem fotografia.')}</p>}
   <details className="rounded-xl border p-4"><summary className="cursor-pointer font-medium">{t('Dados a incluir na partilha')}</summary>
    <fieldset className="mt-4 grid grid-cols-2 gap-4"><legend className="sr-only">{t('Dados a incluir na partilha')}</legend>
     {([['name','Nome',!!(profile.display_name||profile.username)],['photo','Fotografia',!!profile.avatar_url],['phone','Telefone',!!profile.phone_number],['email','Email',!!profile.email]] as const).filter(([, ,available])=>available).map(([field,label])=><label className="flex min-h-11 items-center gap-3" key={field}><input type="checkbox" checked={include[field]} onChange={e=>setInclude(v=>({...v,[field]:e.target.checked}))}/>{t(label)}</label>)}
    </fieldset>
   </details>
   <details className="rounded-xl border p-4"><summary className="cursor-pointer font-medium">{t('Detalhes do endereço')}</summary>
    <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">{lines.map((line,i)=><div className="min-w-0" key={i}><dt className="text-xs text-muted-foreground">{line.label}</dt><dd className="break-words text-sm">{line.value}</dd></div>)}</dl>
   </details>
   <details className="rounded-xl border p-4"><summary className="cursor-pointer font-medium">{t('Sobre este endereço')}</summary>
    <p className="mt-3 text-sm text-muted-foreground">{notice}</p>
    <p className="mt-3 text-sm text-muted-foreground">{t('Qualquer pessoa que leia este QR pode ver gratuitamente a localização no mapa. Percursos, radar e realidade aumentada estão disponíveis na versão paga da NJILA. Os contactos seleccionados aparecem apenas no cartão.')}</p>
    {address.temporary&&<p className="mt-3 text-sm text-muted-foreground">{t('Um endereço temporário não altera a tua residência principal.')}</p>}
   </details>
  </>:!busy&&!warning?<section className="rounded-xl border p-4 space-y-4"><p>{requested?t('O cartão deste endereço não está disponível. Volta ao mapa e actualiza os teus endereços.'):t('Ainda não tens um endereço AFROLOC associado ou activo.')}</p><Button asChild><Link to="/profile">{t('Criar ou associar o meu endereço AFROLOC')}</Link></Button></section>:null}
  <details className="rounded-xl border p-4"><summary className="cursor-pointer font-medium">{t('Outros endereços')}</summary>
   <div className="mt-4 space-y-3">
    {addresses.filter(a=>a.id!==address?.id).map(a=><button type="button" className="block w-full rounded-lg border p-3 text-start" key={a.id} onClick={()=>{setSelected(a.id);window.scrollTo({top:0,behavior:'smooth'})}}><span className="block font-medium">{a.temporary?a.label:t('Residência principal')}</span><span className="block break-all text-xs text-muted-foreground">{a.code}</span></button>)}
    <Button asChild variant="outline" className="w-full h-auto min-h-11 whitespace-normal"><Link to="/afroloc/enderecos">{t('Adicionar ou gerir endereços')}</Link></Button>
   </div>
  </details>
 </main>;
}
