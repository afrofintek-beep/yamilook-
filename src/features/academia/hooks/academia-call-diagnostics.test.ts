import { beforeEach, expect, it } from 'vitest';
import { readAcademiaDiagnostics, recordAcademiaCall } from './academia-call-diagnostics';
beforeEach(()=>sessionStorage.clear());
it('bounds diagnostic storage and recovers from invalid stored data',()=>{
  sessionStorage.setItem('academia-call-diagnostics-v1','{}');
  expect(readAcademiaDiagnostics()).toEqual([]);
  for(let i=0;i<45;i++)recordAcademiaCall('connection',String(i));
  const entries=readAcademiaDiagnostics();
  expect(entries).toHaveLength(40);expect(entries[0].detail).toBe('5');
  expect(entries.at(-1)?.detail).toBe('44');
});
