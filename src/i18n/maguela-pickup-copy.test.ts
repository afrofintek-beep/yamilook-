import {expect,it} from 'vitest';
import {appLanguages} from './afroloc-languages';
import {maguelaPickupCopy} from './maguela-pickup-copy';
import {readFileSync} from 'node:fs';
it('covers all fixed MAGUELA pickup labels and status messages in all ten public languages',()=>{
 const source=readFileSync('src/features/locaccess/MaguelaPickup.tsx','utf8');
 const keys=[...source.matchAll(/(?:\bt|\bsetMessage)\('([^']+)'\)/g)].map(m=>m[1]);
 expect(new Set(keys).size).toBe(18);
 expect(Object.keys(maguelaPickupCopy).sort()).toEqual(appLanguages.map(l=>l.code).sort());
 for(const l of appLanguages){expect(Object.keys(maguelaPickupCopy[l.code]).sort()).toEqual([...new Set(keys)].sort());for(const k of keys)expect(maguelaPickupCopy[l.code][k].trim()).not.toBe('');}
});
