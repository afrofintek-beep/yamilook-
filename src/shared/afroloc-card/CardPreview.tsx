import {forwardRef} from 'react';
import {QRCodeSVG} from 'qrcode.react';
import {cardQrValue,type CardLine} from './protocol';
import {wrapCardText,wrapCardCode} from './layout';
export const CardPreview=forwardRef<SVGSVGElement,{name:string;code:string;lines:CardLine[];photo?:string;notice:string;rtl:boolean;title?:string;qrLabel?:string;brand?:string;link?:string}>(function CardPreview({name,code,lines,photo,notice,rtl,title='AFROLOC',qrLabel='Abrir endereço AFROLOC',brand='Yamilook · NJILA',link},ref){
 const qrUrl=link||cardQrValue({code});
 const nameRows=wrapCardText(name,photo?25:36),codeRows=wrapCardCode(code);
 const identityBottom=Math.max(145+nameRows.length*32,photo?258:180);
 const codeY=identityBottom+26,bodyY=codeY+codeRows.length*32+42;
 const sections=['identity','location','status'] as const;
 let cursor=bodyY;
 const cells:{line:CardLine;x:number;y:number;values:string[];labels:string[]}[]=[];
 const rules:number[]=[];
 for(const group of sections){
  const fields=lines.filter(l=>(l.group||'location')===group);
  if(!fields.length)continue;
  rules.push(cursor-15);
  for(let i=0;i<fields.length;i+=2){
   let rowHeight=0;
   fields.slice(i,i+2).forEach((line,column)=>{
    const values=wrapCardText(line.value,25),labels=wrapCardText(line.label,32);
    const x=rtl?(column===0?684:344):(column===0?36:376);
    cells.push({line,x,y:cursor+8,values,labels});
    rowHeight=Math.max(rowHeight,labels.length*18+values.length*25+22);
   });
   cursor+=rowHeight;
  }
  cursor+=18;
 }
 const qrY=cursor,footerLines=lines.filter(l=>l.group==='footer');
 let footerY=qrY+15;
 const footer=footerLines.map(line=>{const y=footerY,values=wrapCardText(line.value,35),labels=wrapCardText(line.label,42);footerY+=labels.length*18+values.length*24+20;return {line,y,values,labels};});
 const noteY=Math.max(qrY+214,footerY)+28,noteRows=wrapCardText(notice,62),height=noteY+noteRows.length*22+28;
 const textStyle={fontFamily:'sans-serif',direction:rtl?'rtl' as const:'ltr' as const};
 return <svg ref={ref} xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 720 ${height}`} role="img" aria-label={name+' · '+code} style={{width:'100%',height:'auto',display:'block'}}>
  <rect width="720" height={height} rx="24" fill="#f5f1e8"/><rect width="720" height="106" rx="24" fill="#142a21"/><path d="M0 70H720V106H0Z" fill="#142a21"/>
  <text x="36" y="44" fill="#e1bd59" fontSize="29" fontWeight="700" fontFamily="sans-serif">AFROLOC</text>
  <text x="684" y="44" textAnchor="end" fill="#f5f1e8" fontSize="18" fontFamily="sans-serif">{brand}</text>
  <text x={rtl?684:36} y="78" fill="#f5f1e8" fontSize="21" {...textStyle}>{title}</text>
  {photo?<image data-card-photo="true" href={photo} x={rtl?36:564} y="130" width="120" height="120" preserveAspectRatio="xMidYMid slice"/>:null}
  {nameRows.map((v,i)=><text key={i} x={rtl?684:36} y={158+i*32} fontSize="27" fontWeight="700" fill="#142a21" {...textStyle}>{v}</text>)}
  <rect data-card-code="true" x="28" y={codeY-28} width="664" height={codeRows.length*32+22} rx="12" fill="#e7dbb9"/>
  {codeRows.map((v,i)=><text key={i} x="44" y={codeY+i*32} fontSize="27" fontWeight="700" fontFamily="monospace" fill="#142a21" direction="ltr">{v}</text>)}
  {rules.map(y=><path key={y} d={`M36 ${y}H684`} stroke="#d5cebd"/>)}
  {cells.map(({line,x,y,values,labels},i)=><g key={i}><title>{line.label+': '+line.value}</title>{labels.map((v,j)=><text key={'l'+j} x={x} y={y+j*18} fontSize="14" fill="#526058" {...textStyle}>{v}</text>)}{values.map((v,j)=><text key={j} x={x} y={y+labels.length*18+7+j*25} fontSize="21" fontWeight="600" fill="#142a21" {...textStyle}>{v}</text>)}</g>)}
  <a href={qrUrl} target="_blank" rel="noopener noreferrer" aria-label={qrLabel}>
  <QRCodeSVG aria-hidden="true" focusable="false" value={qrUrl} x={rtl?484:36} y={qrY} size={200} level="M" marginSize={4} bgColor="#ffffff" fgColor="#142a21"/>
  </a>
  <text x={rtl?584:136} y={qrY+218} textAnchor="middle" fontSize="14" fill="#526058" fontFamily="sans-serif">{qrLabel}</text>
  {footer.map(({y,values,labels},i)=><g key={i}>{labels.map((v,j)=><text key={'l'+j} x={rtl?448:272} y={y+j*18} fontSize="14" fill="#526058" {...textStyle}>{v}</text>)}{values.map((v,j)=><text key={j} x={rtl?448:272} y={y+labels.length*18+7+j*24} fontSize="19" fill="#142a21" {...textStyle}>{v}</text>)}</g>)}
  {noteRows.map((v,i)=><text key={i} x={rtl?684:36} y={noteY+i*22} fontSize="16" fill="#526058" {...textStyle}>{v}</text>)}
 </svg>;
});
