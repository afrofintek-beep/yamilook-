import {forwardRef} from 'react';
import {QRCodeSVG} from 'qrcode.react';
import type {CardLine} from './model';
import {wrapCardText,wrapCardCode} from './layout';
export const CardPreview=forwardRef<SVGSVGElement,{name:string;code:string;lines:CardLine[];photo?:string;notice:string;rtl:boolean}>(function CardPreview({name,code,lines,photo,notice,rtl},ref){
 const rows=lines.flatMap(l=>wrapCardText(`${l.label}: ${l.value}`).map(value=>value));
 const codeRows=wrapCardCode(code),nameRows=wrapCardText(name,26);
 const top=180+nameRows.length*32;
 const body=top+codeRows.length*32+36;
 const qrY=body+rows.length*29+24,footer=qrY+220,height=footer+wrapCardText(notice,59).length*23+50;
 return <svg ref={ref} xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 720 ${height}`} role="img" aria-label={name+' · '+code} style={{width:'100%',height:'auto',display:'block'}}>
  <rect width="720" height={height} rx="24" fill="#f5f1e8"/><rect width="720" height="88" rx="24" fill="#142a21"/><path d="M0 64H720V88H0Z" fill="#142a21"/>
  <text x="36" y="55" fill="#e1bd59" fontSize="28" fontWeight="700" fontFamily="sans-serif">AFROLOC · Yamilook</text>
  {photo?<image href={photo} x="594" y="108" width="90" height="90" preserveAspectRatio="xMidYMid slice"/>:null}
  {nameRows.map((v,i)=><text key={i} x={rtl?560:36} y={135+i*32} direction={rtl?'rtl':'ltr'} fontSize="27" fontWeight="700" fill="#142a21" fontFamily="sans-serif">{v}</text>)}
  <rect x="28" y={top-30} width="664" height={codeRows.length*32+28} rx="12" fill="#e7dbb9"/>
  {codeRows.map((v,i)=><text key={i} x="44" y={top+i*32} fontSize="27" fontWeight="700" fontFamily="monospace" fill="#142a21" direction="ltr">{v}</text>)}
  {rows.map((v,i)=><text key={i} x={rtl?680:36} y={body+i*29} direction={rtl?'rtl':'ltr'} fontSize="21" fill="#283a32" fontFamily="sans-serif">{v}</text>)}
  <QRCodeSVG aria-hidden="true" focusable="false" value={code} x="260" y={qrY} size={200} level="M" marginSize={4} bgColor="#ffffff" fgColor="#142a21"/>
  {wrapCardText(notice,59).map((v,i)=><text key={i} x={rtl?680:36} y={footer+i*23} direction={rtl?'rtl':'ltr'} fontSize="17" fill="#526058" fontFamily="sans-serif">{v}</text>)}
 </svg>;
});
