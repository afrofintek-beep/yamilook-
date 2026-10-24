import { expect, it } from 'vitest';
import { localStorageObject, publicObjectKeys } from '../../supabase/functions/migrate-chat-attachments/plan';
const origin='https://project.supabase.co';
it('normalizes encoded paths and signed/public variants only in our project',()=>{
 expect(localStorageObject(`${origin}/storage/v1/object/public/media/u/a%20b.mov`,origin)).toEqual({bucket:'media',path:'u/a b.mov'});
 expect(publicObjectKeys([`${origin}/storage/v1/object/sign/media/u/a%20b.mov?token=old`],origin).has('media/u/a b.mov')).toBe(true);
 expect(localStorageObject('https://other.example/storage/v1/object/public/media/u/a',origin)).toBeNull();
});
it('does not migrate arbitrary buckets or private references',()=>{
 expect(localStorageObject(`${origin}/storage/v1/object/public/avatars/u/a`,origin)).toBeNull();expect(localStorageObject('chat-attachment://c/u/a',origin)).toBeNull();
});
