import {forwardRef} from 'react';
import {QRCodeSVG} from 'qrcode.react';
import {cardQrValue,type CardLine} from './model';
import {wrapCardText,wrapCardCode} from '../../shared/afroloc-card/layout';

/** A compact, exportable card; the complete record remains in the page details. */
export const CardPreview=forwardRef<SVGSVGElement,{name:string;code:string;lines:CardLine[];photo?:string;notice:string;rtl:boolean;title?:string;qrLabel?:string;link?:string|null}>(function CardPreview({name,code,lines,photo,notice,rtl,title='AFROLOC',qrLabel='Abrir localização',link},ref){
 const qr=link===undefined?cardQrValue({code}):link;
 const names=wrapCardText(name,photo?26:39),codes=wrapCardCode(code);
 const codeY=Math.max(156+names.length*32,photo?262:184)+28;
 const bodyY=codeY+codes.length*32+34;
 let cursor=bodyY;
 const fields=lines.filter(l=>l.group==='location'||l.group==='identity');
 const rows=fields.map(line=>{const y=cursor,values=wrapCardText(line.value,25),labels=wrapCardText(line.label,32);cursor+=labels.length*20+values.length*28+18;return {line,y,values,labels}});
 const footerY=Math.max(cursor,bodyY+282)+16;
 let footerCursor=footerY;
 const footer=lines.filter(l=>l.group==='status'||l.group==='footer').map(line=>{const y=footerCursor,values=wrapCardText(line.value,54),labels=wrapCardText(line.label,58);footerCursor+=labels.length*20+values.length*26+16;return {line,y,values,labels}});
 const notes=wrapCardText(notice,61),height=footerCursor+notes.length*22+28;
 const style={fontFamily:'sans-serif',direction:rtl?'rtl' as const:'ltr' as const};
 const left=rtl?684:36,qrX=rtl?36:440;
 return <svg ref={ref} xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 720 ${height}`} role="img" aria-label={name+' · '+code} style={{width:'100%',height:'auto',display:'block'}}>
  <rect width="720" height={height} rx="24" fill="#f5f1e8"/>
  <path d="M24 0H696Q720 0 720 24V106H0V24Q0 0 24 0" fill="#171719"/>
  <text x="36" y="45" fontSize="31" fontWeight="700" fill="#d7b14b" fontFamily="sans-serif">AFROLOC</text>
  <text x={left} y="80" fontSize="22" fill="#fff" {...style}>{title}</text>
  {photo&&<image data-card-photo="true" href={photo} x={rtl?36:564} y="126" width="120" height="120" preserveAspectRatio="xMidYMid slice"/>}
  {names.map((text,i)=><text key={i} x={left} y={156+i*32} fontSize="28" fontWeight="700" fill="#24221d" {...style}>{text}</text>)}
  <rect data-card-code="true" x="28" y={codeY-28} width="664" height={codes.length*32+20} rx="12" fill="#e8ddb9"/>
  {codes.map((text,i)=><text key={i} x="44" y={codeY+i*32} fontFamily="monospace" fontSize="27" fontWeight="700" fill="#24221d" direction="ltr">{text}</text>)}
  {rows.map(({line,y,values,labels},i)=><g key={i}><title>{line.label+': '+line.value}</title>{labels.map((text,j)=><text key={'l'+j} x={left} y={y+j*20} fontSize="18" fill="#655f50" {...style}>{text}</text>)}{values.map((text,j)=><text key={j} x={left} y={y+labels.length*20+8+j*28} fontSize="25" fontWeight="600" fill="#24221d" {...style}>{text}</text>)}</g>)}
  <>{qr&&<a href={qr} target="_blank" rel="noopener noreferrer" aria-label={qrLabel}>
   <QRCodeSVG aria-hidden="true" focusable="false" value={qr} x={qrX} y={bodyY-16} size={244} marginSize={4} level="M" bgColor="#fff" fgColor="#171719"/>
  </a>}</>
  {wrapCardText(qrLabel,23).map((text,i)=><text key={i} x={qrX+122} y={bodyY+254+i*22} textAnchor="middle" fontSize="18" fill="#655f50" {...style}>{text}</text>)}
  <path d={`M36 ${footerY-20}H684`} stroke="#d5cebd"/>
  {footer.map(({line,y,values,labels},i)=><g key={i}><title>{line.label+': '+line.value}</title>{labels.map((text,j)=><text key={'l'+j} x={left} y={y+j*20} fontSize="18" fill="#655f50" {...style}>{text}</text>)}{values.map((text,j)=><text key={j} x={left} y={y+labels.length*20+8+j*26} fontSize="23" fontWeight="600" fill="#24221d" {...style}>{text}</text>)}</g>)}
  {notes.map((text,i)=><text key={i} x={left} y={footerCursor+4+i*22} fontSize="17" fill="#655f50" {...style}>{text}</text>)}
 </svg>;
});
