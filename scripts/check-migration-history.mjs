import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
const rows=JSON.parse(readFileSync(new URL('../docs/migration-history/remote-history.json',import.meta.url)));
const dir=new URL('../supabase/migrations/',import.meta.url);
const files=readdirSync(dir).filter(x=>x.endsWith('.sql'));
const versions=files.map(x=>x.split('_')[0]);
const duplicates=[...new Set(versions.filter((v,i)=>versions.indexOf(v)!==i))];
for(const row of rows){
 const expected=row.statements.join('\n\n').trimEnd()+'\n';
 const actual=readFileSync(new URL(`${row.version}_${row.name}.sql`,dir),'utf8');
 if(actual!==expected)throw Error(`Recorded migration differs: ${row.version}`);
}
const earliest=rows[0].version;
const unrecorded=files.filter(f=>f.split('_')[0]<earliest);
console.log(`PASS: ${rows.length} remote records match repository SQL exactly. ${unrecorded.length} older files still lack remote history.`);
if(duplicates.length)console.log('Duplicate historical versions:',duplicates.join(', '));
if(process.argv.includes('--strict') && (duplicates.length || unrecorded.length))process.exitCode=2;
console.log('BLOCKED: do not db push or mark historical migrations applied until a schema-only baseline is restored and compared in staging.');
