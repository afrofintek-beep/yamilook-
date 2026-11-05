import { describe, it, expect, afterEach, vi } from 'vitest';
import type { Session } from '@supabase/supabase-js';
import { recoverySession } from './recovery-session';
const session = (id: string) => ({access_token:`e30.${btoa(JSON.stringify({session_id:id}))}.synthetic`,user:{id:'user'}} as Session);
afterEach(()=>{recoverySession.clear();vi.useRealTimers()});
describe('recovery lifecycle',()=>{
 it('rejects an ordinary session until recovery is established',()=>expect(recoverySession.matches(session('a'))).toBe(false));
 it('binds recovery to a session, survives token refresh, rejects another session',()=>{recoverySession.begin(session('a'));expect(recoverySession.matches(session('a'))).toBe(true);expect(recoverySession.matches(session('b'))).toBe(false)});
 it('expires recovery UI state',()=>{vi.useFakeTimers();recoverySession.begin(session('a'));vi.advanceTimersByTime(3600001);expect(recoverySession.matches(session('a'))).toBe(false)});
 it('clears state after logout',()=>{recoverySession.begin(session('a'));recoverySession.clear();expect(recoverySession.matches(session('a'))).toBe(false)});
});
