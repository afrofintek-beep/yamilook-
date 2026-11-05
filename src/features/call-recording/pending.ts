// Store finalized media before attempting the network. Never store session tokens.
export interface PendingRecording {
  id: string; callId: string; ownerId: string; blob: Blob; duration: number; createdAt: number;
}
const memory = new Map<string, PendingRecording>();
export const RECORDINGS_CHANGED = 'call-recordings-changed';
const key = (file: PendingRecording) => `${file.ownerId}:${file.id}`;
export const notifyRecordings = () => window.dispatchEvent(new Event(RECORDINGS_CHANGED));

async function database() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('kosolola-recording-recovery', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('files');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function write(file: PendingRecording, remove = false) {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('files', 'readwrite');
      const store = tx.objectStore('files');
      if (remove) store.delete(key(file)); else store.put(file, key(file));
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
}
export async function keepRecording(file: PendingRecording): Promise<boolean> {
  memory.set(key(file), file);
  let durable = false;
  try { await write(file); durable = true; } catch { /* Memory remains available for download. */ }
  notifyRecordings();
  return durable;
}
export async function removePendingRecording(file: PendingRecording) {
  // An old disk copy is safe: retry rechecks completed status and never uploads twice.
  await write(file, true).catch(() => {});
  memory.delete(key(file));
  notifyRecordings();
}
export async function pendingRecordings(ownerId: string): Promise<PendingRecording[]> {
  try {
    const db = await database();
    try {
      const files = await new Promise<PendingRecording[]>((resolve, reject) => {
        // Read this account's keys only; never load another account's media into memory.
        const request = db.transaction('files').objectStore('files').getAll(IDBKeyRange.bound(`${ownerId}:`, `${ownerId}:\uffff`));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      for (const file of files) if (file.ownerId === ownerId) memory.set(key(file), file);
    } finally { db.close(); }
  } catch { /* Browsers may deny persistent storage. */ }
  return [...memory.values()].filter(file => file.ownerId === ownerId);
}
export function downloadRecording(file: PendingRecording) {
  const url = URL.createObjectURL(file.blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `gravacao-${file.id}.${file.blob.type.includes('mp4') ? 'mp4' : 'webm'}`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
