import { afterEach, expect, it, vi } from 'vitest';
import { deferCallUpdate, holdCallUpdates } from './call-update-guard';
afterEach(()=>vi.useRealTimers());
it('defers a destructive update until all rooms have left',()=>{
  vi.useFakeTimers();const update=vi.fn();
  const mentor=holdCallUpdates();const otherRoom=holdCallUpdates();
  deferCallUpdate(update);expect(update).not.toHaveBeenCalled();
  mentor();vi.runAllTimers();expect(update).not.toHaveBeenCalled();
  otherRoom();vi.runAllTimers();expect(update).toHaveBeenCalledOnce();
});
it('does not reload between cleanup and an immediate remount',()=>{
  vi.useFakeTimers();const update=vi.fn();const first=holdCallUpdates();
  deferCallUpdate(update);first();const second=holdCallUpdates();
  vi.runAllTimers();expect(update).not.toHaveBeenCalled();
  second();vi.runAllTimers();expect(update).toHaveBeenCalledOnce();
});
it('updates immediately when no call is active',()=>{
  const update=vi.fn();deferCallUpdate(update);expect(update).toHaveBeenCalledOnce();
});
