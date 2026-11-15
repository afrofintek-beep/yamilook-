import {useEffect,useRef,useState} from 'react';
import {CardPreview} from './CardPreview';
import {addressLink,type CardLine} from './protocol';
import {cardImage,downloadCard,shareCard} from './export';
export interface AddressCardData {
 code:string;name?:string;photo?:string;label?:string;type?:string;country?:string;
 province?:string;municipality?:string;commune?:string;city?:string;neighborhood?:string;
 street?:string;number?:string;unit?:string;complement?:string;
 status?:string;authority?:string;verifiedAt?:string;issuedAt?:string;expiresAt?:string;
}
const when=(value?:string)=>value&&Number.isFinite(Date.parse(value))?new Date(value).toLocaleString('pt-PT',{timeZone:'Africa/Luanda'}):'Por confirmar';
export function addressCardLines(d:AddressCardData):CardLine[]{
 const lines:CardLine[]=[];
 const add=(label:string,value:string|undefined,group:CardLine['group']='location')=>lines.push({label,value:value||'Não indicado',group});
 add('Tipo de endereço',d.type,'identity');if(d.label)add('Local',d.label,'identity');
 for(const [label,value] of [['País',d.country],['Província',d.province],['Município',d.municipality],['Comuna',d.commune],['Cidade',d.city],['Bairro / zona',d.neighborhood],['Rua',d.street],['Número',d.number],['Fração / unidade',d.unit],['Complemento',d.complement]])add(label!,value);
 add('Estado do registo',d.status||'Por confirmar','status');
 add('Entidade de validação',d.authority||'Por confirmar','status');
 if(d.verifiedAt)add('Última verificação',when(d.verifiedAt),'status');
 add('Emissão do endereço',when(d.issuedAt),'footer');add('Validade do endereço',when(d.expiresAt),'footer');
 return lines;
}
/** All supplied fields must already be authorised for this viewer. No record fetching or location decoding. */
export function AddressCard({data,brand='Yamilook · NJILA',link,notice='Dados à data de geração. Não substitui um certificado de residência.'}:{data:AddressCardData;brand?:string;link?:string;notice?:string}){
 const svg=useRef<SVGSVGElement>(null),[image,setImage]=useState<{key:string;blob:Blob}|null>(null),[message,setMessage]=useState('');
 const [generatedAt]=useState(()=>new Date().toISOString());
 const lines=[...addressCardLines(data),{label:'Cartão gerado em',value:when(generatedAt),group:'footer' as const}];
 const url=link||addressLink(data.code),key=JSON.stringify([data,brand,url,notice]);
 useEffect(()=>{let active=true;setImage(null);if(svg.current)void cardImage(svg.current).then(blob=>{if(active)setImage({key,blob})}).catch(()=>{if(active)setMessage('Não foi possível preparar a imagem. Pode copiar a ligação.');});return()=>{active=false}},[key]);
 const ready=image?.key===key;
 const text=['AFROLOC',data.name,data.code,...lines.map(l=>l.label+': '+l.value),url,notice].filter(Boolean).join('\n');
 const run=async(fn:()=>Promise<unknown>)=>{try{setMessage('');await fn()}catch(e){if((e as Error).name!=='AbortError')setMessage('Não foi possível concluir. Tente novamente.')}};
 const print=()=>{if(!ready)return;const w=window.open('','_blank');if(!w){setMessage('Permita abrir a janela de impressão.');return;}const img=w.document.createElement('img'),objectUrl=URL.createObjectURL(image.blob);img.style.cssText='display:block;width:100%;max-width:180mm;margin:auto';img.onload=()=>{w.focus();w.print();URL.revokeObjectURL(objectUrl)};img.src=objectUrl;w.document.title='Cartão AFROLOC';w.document.body.replaceChildren(img);};
 return <section aria-label="Cartão AFROLOC" style={{maxWidth:720,margin:'16px auto',width:'100%'}}>
  <CardPreview ref={svg} name={data.name||data.label||''} code={data.code} photo={data.photo} lines={lines} notice={notice} rtl={false} title="Cartão de endereço digital" brand={brand} link={url}/>
  <div style={{display:'flex',flexWrap:'wrap',gap:8,marginTop:12}}>
   <a href={url} target="_blank" rel="noopener noreferrer">Abrir endereço AFROLOC</a>
   <button type="button" disabled={!ready} onClick={()=>void run(async()=>{if(ready)await shareCard(image.blob,text)})}>Partilhar cartão</button>
   <button type="button" disabled={!ready} onClick={()=>{if(ready)downloadCard(image.blob)}}>Guardar imagem</button>
   <button type="button" disabled={!ready} onClick={print}>Imprimir cartão</button>
   <button type="button" onClick={()=>void run(async()=>{await navigator.clipboard.writeText(text);setMessage('Dados copiados.')})}>Copiar dados</button>
  </div><p role="status">{message}</p>
 </section>;
}
