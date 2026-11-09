import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFileSync,readdirSync} from 'node:fs';
const name=readdirSync('supabase/migrations').find(n=>n.endsWith('_align_afroloc_official_codec.sql'));
const migration=readFileSync(`supabase/migrations/${name}`,'utf8');
test('official compact codec matches AFROLOC coordinates in all hemispheres',async()=>{
 const db=new PGlite();
 await db.exec(migration);
 const signed=n=>(n<0?'N':'')+Math.abs(n).toString(36).toUpperCase();
 for(const [lat,lon] of [[-8.93311,13.18261],[0,0],[5,-4],[-33,18],[30,31],[-8.838,13.234]]){
  const x=Math.floor(6378137*(lon*Math.PI/180)/10);
  const y=Math.floor(6378137*Math.log(Math.tan(Math.PI/4+(lat*Math.PI/180)/2))/10);
  const {rows}=await db.query('select public.afroloc_nom($1,null,null,null,$2,$3) as code',['AO',lat,lon]);
  assert.equal(rows[0].code,`AO-ZU-G10-${signed(x)}-${signed(y)}`);
 }
 const {rows}=await db.query("select public.afroloc_nom('AO','LUA','TAL','TAL',-8.93311,13.18261) as code");
 assert.equal(rows[0].code,'AO-ZU-G10-358C-N251L');
 await db.close();
});
test('unrelated updates preserve a historical code',async()=>{
 const db=new PGlite();await db.exec(migration);
 await db.exec(`create table profiles(latitude float8,longitude float8,country_code text,afroloc_code text,city text,neighborhood text); insert into profiles values(-8.93311,13.18261,'AO','AO-ZU-G10-X6AGO-Y4A35',null,null); create trigger code before update on profiles for each row execute function set_afroloc_code(); update profiles set latitude=latitude;`);
 const {rows}=await db.query('select afroloc_code from profiles');assert.equal(rows[0].afroloc_code,'AO-ZU-G10-X6AGO-Y4A35');await db.close();
});
