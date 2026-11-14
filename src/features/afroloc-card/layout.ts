/** Wrap by Unicode code point rather than UTF-16 units; preserve the full code and labels. */
export function wrapCardText(text:string,width=48){
 const words=text.split(/\s+/),lines:string[]=[];let line='';
 for(const word of words){for(let part=word;part;){const chars=Array.from(part);const chunk=chars.slice(0,width).join('');part=chars.slice(width).join('');if(Array.from(line+' '+chunk).length>width){if(line)lines.push(line);line=chunk;}else line+=(line?' ':'')+chunk;if(part){lines.push(line);line='';}}}
 if(line)lines.push(line);return lines;
}
export function wrapCardCode(code:string){const rows:string[]=[];let line='';for(const part of code.match(/[^-]+-?/g)||[]){if(line.length+part.length>31&&line){rows.push(line);line='';}line+=part;}if(line)rows.push(line);return rows.flatMap(row=>wrapCardText(row,31));}
