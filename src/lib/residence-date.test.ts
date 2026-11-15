import {expect,it} from 'vitest';
import {residenceChangeDate} from './residence-date';
it('normalizes database timezone offsets and rejects invalid timestamps',()=>{
 expect(residenceChangeDate('2026-12-15T10:20:30+00','pt')).toBe(residenceChangeDate('2026-12-15T10:20:30Z','pt'));
 expect(residenceChangeDate('garbage','pt')).toBeNull();expect(residenceChangeDate(undefined,'pt')).toBeNull();
 expect(residenceChangeDate('2026-12-15T10:20:30+00','pt')).toContain('2026');
});
