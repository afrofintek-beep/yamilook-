import { expect, it } from 'vitest';
import { applicationAuthStorageKey } from './app-auth';
it('isolates Papos tokens without changing the existing Yamilook session key',()=>{
  const project='https://same-project.supabase.co';
  expect(applicationAuthStorageKey(project,'/papos-app/login')).toBe('sb-same-project-papos-auth-token');
  expect(applicationAuthStorageKey(project,'/papos-app')).toBe('sb-same-project-papos-auth-token');
  expect(applicationAuthStorageKey(project,'/papos')).toBeUndefined();
  expect(applicationAuthStorageKey(project,'/papos-app-other')).toBeUndefined();
});
