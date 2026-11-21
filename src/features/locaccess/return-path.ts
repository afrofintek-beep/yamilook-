import {communityReturn} from '../academia/community-links';
export function afrolocReturn(search:string){
 const next=new URLSearchParams(search).get('next')||'';
 if(next === '/meus-negocios' || next === '/meus-negocios?abrir=1') return next;
 if(next === '/app/dangereux/') return next;
 if(/^\/notifications(?:\?(?:tab=requests|request=[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}))?$/i.test(next)) return next;
 return ['/afroloc','/afroloc/cartao','/afroloc/enderecos'].includes(next)||/^\/afroloc\/acesso\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(next)?next:communityReturn(search);
}
