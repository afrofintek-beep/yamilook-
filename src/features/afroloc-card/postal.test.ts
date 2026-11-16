import {describe,it,expect,vi} from 'vitest';
import {postalHandler,type PostalDeps} from '../../../supabase/functions/afroloc-postal-card/handler';
import {readPostalCard,POSTAL_EXAMPLE_NOTE,POSTAL_LABELS} from './postal';
const context={owner:'owner',code:'AFROLOC-owned',province:'AO-LDA',municipality:'AO-LDA-TALATONA'};
const dependencies=():PostalDeps=>({authenticate:vi.fn(async()=> 'owner'),context:vi.fn(async()=>context),linkedBox:vi.fn(async()=>null),station:vi.fn(async()=> '5051500')});
const request=(body:unknown={source:'residence',code:context.code},headers:Record<string,string>={Authorization:'Bearer user-token'})=>new Request('https://example.invalid',{method:'POST',headers,body:JSON.stringify(body)});
describe('AFROLOC postal card boundary',()=>{
 it('uses the AFROLOC station and a labelled example without an allocation dependency',async()=>{const d=dependencies();const r=await postalHandler(d)(request());expect(r.headers.get('cache-control')).toBe('no-store');expect(await r.json()).toEqual({status:'ready',kind:'example',reference:'5051500-10000'});expect(Object.keys(d).sort()).toEqual(['authenticate','context','linkedBox','station']);});
 it('reuses a verified linked box byte for byte, retaining leading zeroes',async()=>{const d=dependencies();d.linkedBox=vi.fn(async()=>({station:'5051500',box_number:'00123'}));expect(await (await postalHandler(d)(request())).json()).toEqual({status:'ready',kind:'linked',reference:'5051500-00123'});expect(d.station).not.toHaveBeenCalled()});
 it('does not synthesize an unknown station',async()=>{const d=dependencies();d.station=async()=>null;expect(await (await postalHandler(d)(request())).json()).toEqual({status:'unavailable'})});
 it('rejects missing authentication',async()=>{const d=dependencies();expect((await postalHandler(d)(request({},{}))).status).toBe(401);expect(d.context).not.toHaveBeenCalled()});
 it('rejects expired authentication',async()=>{const d=dependencies();d.authenticate=async()=>null;expect((await postalHandler(d)(request())).status).toBe(401)});
 it('rejects a foreign or unavailable address before any postal query',async()=>{for(const value of [null,{...context,owner:'other'},{...context,code:'other'}]){const d=dependencies();d.context=async()=>value;expect((await postalHandler(d)(request())).status).toBe(403);expect(d.linkedBox).not.toHaveBeenCalled();expect(d.station).not.toHaveBeenCalled()}});
 it('rejects unexpected origins',async()=>{const d=dependencies();expect((await postalHandler(d)(request({}, {Origin:'https://evil.invalid',Authorization:'Bearer token'}))).status).toBe(403);expect(d.authenticate).not.toHaveBeenCalled()});
 it('does not turn a failed query into an invented example',async()=>{const d=dependencies();d.linkedBox=async()=>{throw new Error('offline')};expect((await postalHandler(d)(request())).status).toBe(503);expect(d.station).not.toHaveBeenCalled()});
 it('validates the wire shape and the approved labels',()=>{expect(readPostalCard({status:'ready',kind:'example',reference:'DEMO-00001'})).toBeNull();expect(readPostalCard({status:'ready',kind:'assigned',reference:'5051500-10000'})).toBeNull();expect(POSTAL_LABELS).toEqual({code:'Cód. Postal',box:'Cx. Postal',apartado:'Apartado n.º'});expect(POSTAL_EXAMPLE_NOTE).toContain('Não corresponde a uma caixa atribuída')});
});
