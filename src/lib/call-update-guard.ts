// Defer destructive application updates until every active room has released media.
const calls = new Set<symbol>();
let pending: (() => void) | undefined;
export function deferCallUpdate(update: () => void) {
  if (calls.size) pending = update;
  else update();
}
export function holdCallUpdates() {
  const id = Symbol('active-call');
  calls.add(id);
  return () => {
    calls.delete(id);
    // A new room or React effect remount may acquire a hold in the same turn.
    setTimeout(() => {
      if (calls.size || !pending) return;
      const update = pending;
      pending = undefined;
      update();
    }, 0);
  };
}
