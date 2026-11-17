export type PostalCard={status:'ready';kind:'example'|'linked';reference:string}|{status:'unavailable'};
export const POSTAL_LABELS={code:'Cód. Postal',box:'Cx. Postal',apartado:'Apartado n.º'} as const;
export const POSTAL_EXAMPLE_NOTE='* Exemplo ilustrativo do potencial da caixa postal AFROLOC. Não corresponde a uma caixa atribuída, não permite receber correspondência ou encomendas e não constitui atribuição postal oficial.';
export const POSTAL_LINKED_NOTE='* Referência associada na AFROLOC. A apresentação na Yamilook é ilustrativa: não activa recepção de correspondência ou encomendas nem comprova atribuição oficial pelos Correios de Angola.';
export function readPostalCard(raw:unknown):PostalCard|null {
 if(!raw||typeof raw!=='object')return null;
 const r=raw as Record<string,unknown>;
 if(r.status==='unavailable')return {status:'unavailable'};
 if(r.status==='ready'&&(r.kind==='example'||r.kind==='linked')&&typeof r.reference==='string'&&/^\d{7}-\d{5}$/.test(r.reference))return {status:'ready',kind:r.kind,reference:r.reference};
 return null;
}
