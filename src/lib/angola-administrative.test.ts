import {expect,it} from 'vitest';
import {divisions,childrenOf,validAdministrativeAddress,administrativeFromCode} from './angola-administrative';
it('covers the complete hierarchy without orphaned or duplicate units',()=>{
 expect([1,2,3].map(l=>divisions.filter(d=>d.level===l).length)).toEqual([21,326,378]);
 expect(new Set(divisions.map(d=>d.code)).size).toBe(725);
 for(const d of divisions.filter(d=>d.level>1))expect(divisions.some(p=>p.code===d.parent_code&&p.level===d.level-1)).toBe(true);
});
it('handles Talatona communes and municipalities without communes',()=>{
 expect(childrenOf('AO-LDA-TALATONA',3).map(c=>c.name).sort()).toEqual(['Benfica','Talatona']);
 expect(validAdministrativeAddress({province:'AO-LDA',municipality:'AO-LDA-INGOMBOTA',commune:''})).toBe(true);
 expect(validAdministrativeAddress({province:'AO-BGO',municipality:'AO-LDA-TALATONA',commune:'AO-LDA-KTALATONA'})).toBe(false);
 expect(validAdministrativeAddress({province:'AO-LDA',municipality:'AO-LDA-TALATONA',commune:''})).toBe(false);
});
it('only recovers administrative metadata from an unambiguous address',()=>{
 expect(administrativeFromCode('AO-LDA-TAL-KTA-DIG-G10-ABC-DEF')).toEqual({province:'AO-LDA',municipality:'AO-LDA-TALATONA',commune:'AO-LDA-KTALATONA'});
 expect(administrativeFromCode('AO-LDA-TAL-KBE-DIG-G25-ABC-DEF')?.commune).toBe('AO-LDA-KBENFICA');
 expect(administrativeFromCode('AO-ZU-G10-ABC-DEF')).toBeNull();
 expect(administrativeFromCode('AO-LDA-ING-000-DIG-G10-ABC-DEF')?.commune).toBe('');
});
