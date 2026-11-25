import {expect,it} from 'vitest';
import {appLanguages} from './afroloc-languages';
import {maguelaIdentityCopy} from './maguela-identity-copy';
import {readFileSync} from 'node:fs';
it('covers all identity management messages in all ten languages',()=>{
 const source=readFileSync('src/components/account-link/MaguelaIdentityManagement.tsx','utf8');
 const keys=[...new Set([...source.matchAll(/\bt\('([^']+)'\)/g)].map(m=>m[1]))].sort();
 expect(keys).toHaveLength(10);
 expect(Object.keys(maguelaIdentityCopy).sort()).toEqual(appLanguages.map(l=>l.code).sort());
 for(const l of appLanguages){expect(Object.keys(maguelaIdentityCopy[l.code]).sort()).toEqual(keys);for(const k of keys)expect(maguelaIdentityCopy[l.code][k].trim()).not.toBe('');}
});
