import {expect,it} from 'vitest';
import {afrolocReturn} from './return-path';
import {readCardReference} from '@/shared/afroloc-card/protocol';
const route='/afroloc/acesso/00000000-0000-4000-8000-000000000001';
it('retains only a valid internal recipient destination through sign in',()=>{
 expect(afrolocReturn('?next='+encodeURIComponent(route))).toBe(route);
 expect(afrolocReturn('?next='+encodeURIComponent(route+'#njila'))).toBe(route+'#njila');
 for(const v of ['https://evil.invalid'+route,'//evil.invalid'+route,route+'?next=evil',route+'#x',route+'/other','/afroloc/acesso/bad'])expect(afrolocReturn('?next='+encodeURIComponent(v))).toBeNull();
});
it('keeps the access opaque when scanning and rejects modified links',()=>{
 const url='https://www.yamilook.com'+route;
 expect(readCardReference(url)).toEqual({kind:'access',url});
 for(const v of [url+'?code=AO-TEST-CODE',url+'#x',url.replace('yamilook.com','yamilook.com.evil.invalid')])expect(readCardReference(v)).toBeNull();
});
it('preserves friendship review after login without accepting arbitrary redirects',()=>{
 const target='/notifications?request=00000000-0000-4000-8000-000000000001';
 expect(afrolocReturn('?next='+encodeURIComponent(target))).toBe(target);
 expect(afrolocReturn('?next='+encodeURIComponent('/notifications?tab=requests'))).toBe('/notifications?tab=requests');
 for(const bad of ['//evil.invalid/notifications','/notifications?request=bad',target+'&accept=true','/notifications?next=https://evil.invalid']) expect(afrolocReturn('?next='+encodeURIComponent(bad))).toBeNull();
});
